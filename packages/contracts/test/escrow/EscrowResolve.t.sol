// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { AeonEscrow } from "../../src/AeonEscrow.sol";
import { ReentrantActor } from "./Actors.sol";
import { EscrowFlows } from "./EscrowFlows.sol";

contract EscrowResolveTest is EscrowFlows {
    function test_split_matchingProposalsSettle() public {
        uint256 jobId = _disputed();
        uint256 toClient = 0.03 ether;
        uint256 toProvider = PRICE - toClient;
        uint256 clientBefore = client.balance;

        vm.prank(client);
        escrow.proposeSplit(jobId, toClient, toProvider);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Disputed));

        uint256 fee = _fee(toProvider);
        vm.expectEmit(true, false, false, true);
        emit AeonEscrow.JobSplit(jobId, toClient, toProvider - fee, fee);
        vm.prank(agent.addr);
        escrow.proposeSplit(jobId, toClient, toProvider);

        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Split));
        assertEq(client.balance, clientBefore + toClient);
        assertEq(owner.balance, toProvider - fee);
        assertEq(treasury.balance, fee);
        assertEq(address(escrow).balance, 0);
        (bytes32 c, bytes32 p) = escrow.splitProposals(jobId);
        assertEq(c, bytes32(0));
        assertEq(p, bytes32(0));
    }

    function test_split_mismatchWaitsAndLaterProposalReplaces() public {
        uint256 jobId = _disputed();
        vm.prank(client);
        escrow.proposeSplit(jobId, PRICE, 0);
        vm.prank(owner);
        escrow.proposeSplit(jobId, 0, PRICE);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Disputed));

        vm.prank(client);
        escrow.proposeSplit(jobId, 0.02 ether, PRICE - 0.02 ether);
        vm.prank(owner);
        escrow.proposeSplit(jobId, 0.02 ether, PRICE - 0.02 ether);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Split));
    }

    function test_split_rejectsWrongSumAndOutsiders() public {
        uint256 jobId = _disputed();
        vm.prank(client);
        vm.expectRevert(AeonEscrow.BadSplit.selector);
        escrow.proposeSplit(jobId, PRICE, 1);

        vm.prank(evaluator);
        vm.expectRevert(AeonEscrow.NotParty.selector);
        escrow.proposeSplit(jobId, PRICE, 0);
        vm.prank(stranger);
        vm.expectRevert(AeonEscrow.NotParty.selector);
        escrow.proposeSplit(jobId, PRICE, 0);
    }

    function test_forceClose_refundsAfterDisputeLimit() public {
        uint256 jobId = _disputed();
        uint256 disputedAt = escrow.getJob(jobId).disputedAt;

        vm.warp(disputedAt + DISPUTE_LIMIT - 1);
        vm.expectRevert(AeonEscrow.TooEarly.selector);
        escrow.forceClose(jobId);

        uint256 before = client.balance;
        vm.warp(disputedAt + DISPUTE_LIMIT);
        vm.prank(stranger);
        escrow.forceClose(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.ForceClosed));
        assertEq(client.balance, before + PRICE);
        assertEq(treasury.balance, 0);
    }

    function test_withdraw_nothingPending() public {
        vm.expectRevert(AeonEscrow.NothingToWithdraw.selector);
        escrow.withdraw();
    }

    function test_reentrantClientCannotDoubleDip() public {
        ReentrantActor attacker = new ReentrantActor(escrow);
        vm.deal(address(attacker), 1 ether);
        uint256 jobId = _createFrom(attacker);
        uint256 other = _createFrom(attacker);
        vm.warp(escrow.getJob(jobId).expiredAt);

        attacker.setAttack(abi.encodeCall(AeonEscrow.claimRefund, (other)));
        escrow.claimRefund(jobId);

        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Refunded));
        assertEq(uint8(_state(other)), uint8(AeonEscrow.State.Funded));
        assertEq(escrow.pendingWithdrawals(address(attacker)), PRICE);

        attacker.setAttack(abi.encodeCall(AeonEscrow.withdraw, ()));
        vm.expectRevert(AeonEscrow.WithdrawFailed.selector);
        attacker.exec(address(escrow), 0, abi.encodeCall(AeonEscrow.withdraw, ()));
        assertEq(escrow.pendingWithdrawals(address(attacker)), PRICE);

        attacker.setAttack("");
        uint256 before = address(attacker).balance;
        attacker.exec(address(escrow), 0, abi.encodeCall(AeonEscrow.withdraw, ()));
        assertEq(address(attacker).balance, before + PRICE);
        assertEq(escrow.pendingWithdrawals(address(attacker)), 0);
    }

    function test_reentrantPayeeCannotDoubleDip() public {
        ReentrantActor attacker = new ReentrantActor(escrow);
        tokenId = _mintAndList(address(attacker), agent);
        uint256 jobId = _submitted();
        uint256 other = _submitted();

        attacker.setAttack(abi.encodeCall(AeonEscrow.claimTimeout, (other)));
        vm.prank(evaluator);
        escrow.complete(jobId);

        uint256 payout = PRICE - _fee(PRICE);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Completed));
        assertEq(uint8(_state(other)), uint8(AeonEscrow.State.Submitted));
        assertEq(escrow.pendingWithdrawals(address(attacker)), payout);
        assertEq(address(escrow).balance, PRICE + payout);
    }

    enum Fn {
        Decline,
        ClaimRefund,
        Submit,
        Complete,
        Dispute,
        ClaimTimeout,
        ProposeSplit,
        ForceClose
    }

    function test_everyFunctionRejectsEveryWrongState() public {
        for (uint8 s; s <= uint8(AeonEscrow.State.ForceClosed); ++s) {
            AeonEscrow.State state = AeonEscrow.State(s);
            uint256 jobId = state == AeonEscrow.State.None ? 999 : _jobIn(state);
            for (uint8 f; f <= uint8(Fn.ForceClose); ++f) {
                if (_allowed(Fn(f), state)) continue;
                vm.expectRevert(abi.encodeWithSelector(AeonEscrow.WrongState.selector, state));
                _invoke(Fn(f), jobId);
            }
        }
    }

    function _allowed(Fn f, AeonEscrow.State s) internal pure returns (bool) {
        if (s == AeonEscrow.State.Funded) {
            return f == Fn.Decline || f == Fn.ClaimRefund || f == Fn.Submit;
        }
        if (s == AeonEscrow.State.Submitted) {
            return f == Fn.Complete || f == Fn.Dispute || f == Fn.ClaimTimeout;
        }
        if (s == AeonEscrow.State.Disputed) return f == Fn.ProposeSplit || f == Fn.ForceClose;
        return false;
    }

    function _invoke(Fn f, uint256 jobId) internal {
        if (f == Fn.Decline) {
            vm.prank(agent.addr);
            escrow.decline(jobId);
        } else if (f == Fn.ClaimRefund) {
            escrow.claimRefund(jobId);
        } else if (f == Fn.Submit) {
            vm.prank(agent.addr);
            escrow.submit(jobId, RESULT);
        } else if (f == Fn.Complete) {
            vm.prank(evaluator);
            escrow.complete(jobId);
        } else if (f == Fn.Dispute) {
            vm.prank(evaluator);
            escrow.dispute(jobId);
        } else if (f == Fn.ClaimTimeout) {
            escrow.claimTimeout(jobId);
        } else if (f == Fn.ProposeSplit) {
            vm.prank(client);
            escrow.proposeSplit(jobId, PRICE, 0);
        } else {
            escrow.forceClose(jobId);
        }
    }

    function _jobIn(AeonEscrow.State s) internal returns (uint256 jobId) {
        if (s == AeonEscrow.State.Funded) return _create();
        if (s == AeonEscrow.State.Submitted) return _submitted();
        if (s == AeonEscrow.State.Disputed) return _disputed();
        if (s == AeonEscrow.State.Declined) {
            jobId = _create();
            vm.prank(owner);
            escrow.decline(jobId);
        } else if (s == AeonEscrow.State.Refunded) {
            jobId = _create();
            vm.warp(escrow.getJob(jobId).expiredAt);
            escrow.claimRefund(jobId);
        } else if (s == AeonEscrow.State.Completed) {
            jobId = _submitted();
            vm.prank(evaluator);
            escrow.complete(jobId);
        } else if (s == AeonEscrow.State.TimedOut) {
            jobId = _submitted();
            vm.warp(block.timestamp + WINDOW);
            escrow.claimTimeout(jobId);
        } else if (s == AeonEscrow.State.Split) {
            jobId = _disputed();
            vm.prank(client);
            escrow.proposeSplit(jobId, PRICE, 0);
            vm.prank(owner);
            escrow.proposeSplit(jobId, PRICE, 0);
        } else {
            jobId = _disputed();
            vm.warp(block.timestamp + DISPUTE_LIMIT);
            escrow.forceClose(jobId);
        }
        assertEq(uint8(_state(jobId)), uint8(s));
    }

    function _createFrom(ReentrantActor who) internal returns (uint256) {
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        bytes memory data =
            abi.encodeCall(AeonEscrow.createJob, (tokenId, TASK, expiredAt, WINDOW, evaluator));
        return abi.decode(who.exec(address(escrow), PRICE, data), (uint256));
    }
}
