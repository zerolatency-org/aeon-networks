// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { CommonBase } from "forge-std/Base.sol";
import { StdUtils } from "forge-std/StdUtils.sol";

import { AeonEscrow } from "../../src/AeonEscrow.sol";
import { RejectingActor } from "./Actors.sol";
import { EscrowBase } from "./EscrowBase.sol";

contract EscrowHandler is CommonBase, StdUtils {
    AeonEscrow internal immutable escrow;
    uint256 internal immutable tokenId;
    address internal immutable agentWallet;
    address internal immutable owner;
    address internal immutable evaluator;
    RejectingActor internal immutable rejecting;

    address[] public clients;
    uint256[] public jobIds;

    constructor(
        AeonEscrow escrow_,
        uint256 tokenId_,
        address agentWallet_,
        address owner_,
        address evaluator_
    ) {
        escrow = escrow_;
        tokenId = tokenId_;
        agentWallet = agentWallet_;
        owner = owner_;
        evaluator = evaluator_;
        rejecting = new RejectingActor();
        clients.push(address(0xC1));
        clients.push(address(0xC2));
        clients.push(address(rejecting));
    }

    function create(uint256 who, uint256 amount) external {
        address c = clients[who % clients.length];
        amount = bound(amount, 0.05 ether, 5 ether);
        vm.deal(c, amount);
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        bytes memory data =
            abi.encodeCall(AeonEscrow.createJob, (tokenId, "t", expiredAt, 1 hours, evaluator));
        if (c == address(rejecting)) {
            try rejecting.exec(address(escrow), amount, data) returns (bytes memory ret) {
                jobIds.push(abi.decode(ret, (uint256)));
            } catch { }
        } else {
            vm.prank(c);
            (bool ok, bytes memory ret) = address(escrow).call{ value: amount }(data);
            if (ok) jobIds.push(abi.decode(ret, (uint256)));
        }
    }

    function submit(uint256 i) external {
        vm.prank(agentWallet);
        try escrow.submit(_job(i), "r") { } catch { }
    }

    function decline(uint256 i) external {
        vm.prank(owner);
        try escrow.decline(_job(i)) { } catch { }
    }

    function complete(uint256 i) external {
        vm.prank(evaluator);
        try escrow.complete(_job(i)) { } catch { }
    }

    function dispute(uint256 i) external {
        vm.prank(evaluator);
        try escrow.dispute(_job(i)) { } catch { }
    }

    function split(uint256 i, uint256 toClient) external {
        uint256 jobId = _job(i);
        AeonEscrow.Job memory job = escrow.getJob(jobId);
        toClient = bound(toClient, 0, job.amount);
        uint256 toProvider = job.amount - toClient;
        vm.prank(job.client);
        try escrow.proposeSplit(jobId, toClient, toProvider) { } catch { }
        vm.prank(owner);
        try escrow.proposeSplit(jobId, toClient, toProvider) { } catch { }
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 2 days));
    }

    function claimRefund(uint256 i) external {
        try escrow.claimRefund(_job(i)) { } catch { }
    }

    function claimTimeout(uint256 i) external {
        try escrow.claimTimeout(_job(i)) { } catch { }
    }

    function forceClose(uint256 i) external {
        try escrow.forceClose(_job(i)) { } catch { }
    }

    function withdraw(uint256 who) external {
        vm.prank(clients[who % clients.length]);
        try escrow.withdraw() { } catch { }
    }

    function jobCount() external view returns (uint256) {
        return jobIds.length;
    }

    function clientCount() external view returns (uint256) {
        return clients.length;
    }

    function _job(uint256 i) internal view returns (uint256) {
        if (jobIds.length == 0) return 0;
        return jobIds[i % jobIds.length];
    }
}

contract EscrowInvariantTest is EscrowBase {
    EscrowHandler internal handler;

    function setUp() public override {
        super.setUp();
        handler = new EscrowHandler(escrow, tokenId, agent.addr, owner, evaluator);
        targetContract(address(handler));
    }

    function invariant_balanceEqualsOpenJobsPlusPending() public view {
        uint256 open;
        for (uint256 i; i < handler.jobCount(); ++i) {
            AeonEscrow.Job memory job = escrow.getJob(handler.jobIds(i));
            if (
                job.state == AeonEscrow.State.Funded || job.state == AeonEscrow.State.Submitted
                    || job.state == AeonEscrow.State.Disputed
            ) open += job.amount;
        }
        uint256 pending = escrow.pendingWithdrawals(owner) + escrow.pendingWithdrawals(treasury);
        for (uint256 i; i < handler.clientCount(); ++i) {
            pending += escrow.pendingWithdrawals(handler.clients(i));
        }
        assertEq(address(escrow).balance, open + pending);
    }
}
