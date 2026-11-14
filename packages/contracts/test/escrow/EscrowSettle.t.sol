// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { AeonEscrow } from "../../src/AeonEscrow.sol";
import { AeonRegistry } from "../../src/AeonRegistry.sol";
import { RejectingActor } from "./Actors.sol";
import { EscrowFlows } from "./EscrowFlows.sol";

/// Step 2: submit, complete, dispute, claimTimeout.
contract EscrowSettleTest is EscrowFlows {
    function test_submit_byAgentWalletRecordsResult() public {
        uint256 jobId = _create();
        vm.expectEmit(true, false, false, true);
        emit AeonEscrow.JobSubmitted(jobId, RESULT);
        vm.prank(agent.addr);
        escrow.submit(jobId, RESULT);

        AeonEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AeonEscrow.State.Submitted));
        assertEq(job.resultHash, RESULT);
        assertEq(job.submittedAt, block.timestamp);
    }

    function test_submit_byOwnerIsAllowed() public {
        uint256 jobId = _create();
        vm.prank(owner);
        escrow.submit(jobId, RESULT);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Submitted));
    }

    function test_submit_rejectsStrangerAndLateSubmission() public {
        uint256 jobId = _create();
        vm.prank(stranger);
        vm.expectRevert(AeonEscrow.NotProvider.selector);
        escrow.submit(jobId, RESULT);

        vm.warp(escrow.getJob(jobId).expiredAt);
        vm.prank(agent.addr);
        vm.expectRevert(AeonEscrow.TooLate.selector);
        escrow.submit(jobId, RESULT);
    }

    function test_complete_paysPayeeMinusFeeAndRecordsStats() public {
        uint256 jobId = _submitted();
        uint256 fee = _fee(PRICE);
        vm.expectEmit(true, false, false, true);
        emit AeonEscrow.JobCompleted(jobId, PRICE - fee, fee);
        vm.prank(evaluator);
        escrow.complete(jobId);

        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Completed));
        assertEq(owner.balance, PRICE - fee);
        assertEq(treasury.balance, fee);
        assertEq(address(escrow).balance, 0);
        AeonRegistry.Listing memory l = reg.getListing(tokenId);
        assertEq(l.jobsCompleted, 1);
        assertEq(l.totalSettled, PRICE);
    }

    function test_complete_onlyEvaluator() public {
        uint256 jobId = _submitted();
        address[3] memory notEvaluator = [client, owner, agent.addr];
        for (uint256 i; i < notEvaluator.length; ++i) {
            vm.prank(notEvaluator[i]);
            vm.expectRevert(AeonEscrow.NotEvaluator.selector);
            escrow.complete(jobId);
        }
    }

    function test_complete_payeeStaysTheOwnerAtCreation() public {
        uint256 jobId = _submitted();
        vm.prank(owner);
        nft.transferFrom(owner, stranger, tokenId);
        vm.prank(evaluator);
        escrow.complete(jobId);
        assertEq(owner.balance, PRICE - _fee(PRICE));
    }

    function test_complete_rejectingPayeeIsKeptForWithdrawal() public {
        RejectingActor rejecting = new RejectingActor();
        tokenId = _mintAndList(address(rejecting), agent);
        uint256 jobId = _submitted();
        uint256 payout = PRICE - _fee(PRICE);

        vm.prank(evaluator);
        escrow.complete(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Completed));
        assertEq(escrow.pendingWithdrawals(address(rejecting)), payout);
        assertEq(treasury.balance, _fee(PRICE), "fee still pushed");
    }

    function test_complete_aRevertingRegistryDoesNotBlockPayment() public {
        uint256 jobId = _submitted();
        vm.mockCallRevert(
            address(reg), abi.encodeWithSelector(AeonRegistry.recordSettlement.selector), "down"
        );
        vm.prank(evaluator);
        escrow.complete(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Completed));
        assertEq(owner.balance, PRICE - _fee(PRICE));
    }

    function test_dispute_insideWindowRecordsStat() public {
        uint256 jobId = _submitted();
        vm.warp(block.timestamp + WINDOW - 1);
        vm.prank(evaluator);
        escrow.dispute(jobId);

        AeonEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(uint8(job.state), uint8(AeonEscrow.State.Disputed));
        assertEq(job.disputedAt, block.timestamp);
        assertEq(reg.getListing(tokenId).jobsDisputed, 1);
        assertEq(address(escrow).balance, PRICE, "money stays locked");
    }

    function test_dispute_rejectsAfterWindowAndNonEvaluator() public {
        uint256 jobId = _submitted();
        vm.prank(client);
        vm.expectRevert(AeonEscrow.NotEvaluator.selector);
        escrow.dispute(jobId);

        vm.warp(block.timestamp + WINDOW);
        vm.prank(evaluator);
        vm.expectRevert(AeonEscrow.TooLate.selector);
        escrow.dispute(jobId);
    }

    function test_claimTimeout_paysProviderAfterSilentWindow() public {
        uint256 jobId = _submitted();
        vm.warp(block.timestamp + WINDOW - 1);
        vm.prank(stranger);
        vm.expectRevert(AeonEscrow.TooEarly.selector);
        escrow.claimTimeout(jobId);

        vm.warp(block.timestamp + 1);
        vm.prank(stranger);
        escrow.claimTimeout(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.TimedOut));
        assertEq(owner.balance, PRICE - _fee(PRICE));
        assertEq(treasury.balance, _fee(PRICE));
        assertEq(reg.getListing(tokenId).jobsCompleted, 1);
    }

    function testFuzz_feePlusPayoutEqualsAmount(uint256 amount) public {
        amount = bound(amount, PRICE, 1_000 ether);
        vm.deal(client, amount);
        uint256 jobId = _createAs(client, amount);
        vm.prank(agent.addr);
        escrow.submit(jobId, RESULT);
        vm.prank(evaluator);
        escrow.complete(jobId);

        uint256 fee = amount * FEE_BPS / 10_000;
        assertEq(treasury.balance, fee);
        assertEq(owner.balance, amount - fee);
        assertEq(owner.balance + treasury.balance, amount, "nothing lost to rounding");
        assertEq(address(escrow).balance, 0);
    }
}
