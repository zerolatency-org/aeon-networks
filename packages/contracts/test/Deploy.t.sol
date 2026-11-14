// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, Vm } from "forge-std/Test.sol";

import { AeonAgentNFT } from "../src/AeonAgentNFT.sol";
import { AeonEscrow } from "../src/AeonEscrow.sol";
import { Deploy } from "../script/Deploy.s.sol";

contract DeployTest is Test {
    Deploy internal script;
    Deploy.Deployment internal d;
    address internal owner = makeAddr("owner");
    address internal oracle = makeAddr("oracle");
    address internal treasury = makeAddr("treasury");

    function setUp() public {
        script = new Deploy();
        d = script.deploy(script.defaultParams(owner, oracle, treasury));
    }

    function test_wiresTheThreeContracts() public view {
        assertEq(d.registry.escrow(), address(d.escrow));
        assertEq(address(d.registry.nft()), address(d.nft));
        assertEq(address(d.escrow.nft()), address(d.nft));
        assertEq(address(d.escrow.registry()), address(d.registry));
        assertEq(d.nft.owner(), owner);
        assertEq(d.nft.oracle(), oracle);
        assertEq(d.escrow.feeRecipient(), treasury);
    }

    function test_usesTestnetBounds() public view {
        assertEq(d.escrow.minWindow(), 60);
        assertEq(d.escrow.disputeLimit(), 1 hours);
        assertEq(d.escrow.feeBps(), 250);
        assertEq(d.registry.minPrice(), 0.001 ether);
    }

    function test_networkNames() public {
        vm.chainId(16602);
        assertEq(script.network(), "galileo");
        vm.chainId(31337);
        assertEq(script.network(), "anvil");
        vm.chainId(5);
        assertEq(script.network(), "5");
    }

    function test_deployedContractsRunAJob() public {
        address seller = makeAddr("seller");
        address buyer = makeAddr("buyer");
        address evaluator = makeAddr("evaluator");
        Vm.Wallet memory agent = vm.createWallet("agent");

        AeonAgentNFT.IntelligentData[] memory data = new AeonAgentNFT.IntelligentData[](1);
        data[0] = AeonAgentNFT.IntelligentData("persona", keccak256("p"));
        uint256 signJobs = d.nft.SIGN_JOBS();
        vm.startPrank(seller);
        uint256 id = d.nft.mint(seller, data);
        d.nft.authorizeUsage(id, agent.addr, signJobs);
        d.registry
            .list(id, 0.01 ether, abi.encodePacked(agent.publicKeyX, agent.publicKeyY), bytes32(0));
        vm.stopPrank();

        vm.deal(buyer, 1 ether);
        vm.prank(buyer);
        uint256 jobId = d.escrow.createJob{ value: 0.01 ether }(
            id, keccak256("t"), uint64(block.timestamp + 1 days), 1 hours, evaluator
        );
        vm.prank(agent.addr);
        d.escrow.submit(jobId, keccak256("r"));
        vm.prank(evaluator);
        d.escrow.complete(jobId);

        assertEq(uint8(d.escrow.getJob(jobId).state), uint8(AeonEscrow.State.Completed));
        assertEq(seller.balance, 0.01 ether - 0.01 ether * 250 / 10_000);
        assertEq(d.registry.getListing(id).jobsCompleted, 1);
    }
}
