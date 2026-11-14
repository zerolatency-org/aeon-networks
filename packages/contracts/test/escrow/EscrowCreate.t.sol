// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { AeonEscrow } from "../../src/AeonEscrow.sol";
import { AeonRegistry } from "../../src/AeonRegistry.sol";
import { IAeonAgentNFT } from "../../src/interfaces/IAeonAgentNFT.sol";
import { RejectingActor } from "./Actors.sol";
import { EscrowBase } from "./EscrowBase.sol";

/// Step 1: createJob, decline, claimRefund.
contract EscrowCreateTest is EscrowBase {
    function test_create_storesJobHoldsFundsAndEmits() public {
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        vm.expectEmit(true, true, true, true);
        emit AeonEscrow.JobCreated(
            1, tokenId, client, owner, evaluator, PRICE, expiredAt, WINDOW, TASK
        );
        uint256 jobId = _create();

        AeonEscrow.Job memory job = escrow.getJob(jobId);
        assertEq(jobId, 1);
        assertEq(job.client, client);
        assertEq(job.payee, owner);
        assertEq(job.evaluator, evaluator);
        assertEq(job.amount, PRICE);
        assertEq(job.taskHash, TASK);
        assertEq(uint8(job.state), uint8(AeonEscrow.State.Funded));
        assertEq(address(escrow).balance, PRICE);
        assertEq(escrow.nextJobId(), 2);
    }

    function test_create_paysMoreThanPriceIsEscrowedWhole() public {
        uint256 jobId = _createAs(client, 1 ether);
        assertEq(escrow.getJob(jobId).amount, 1 ether);
        assertEq(address(escrow).balance, 1 ether);
    }

    function test_create_rejectsInactiveListing() public {
        vm.prank(owner);
        reg.delist(tokenId);
        vm.expectRevert(AeonEscrow.ListingInactive.selector);
        _create();
    }

    function test_create_rejectsListingStaleAfterTransfer() public {
        vm.prank(owner);
        nft.transferFrom(owner, stranger, tokenId);
        vm.expectRevert(AeonEscrow.ListingInactive.selector);
        _create();
    }

    function test_create_rejectsBelowPrice() public {
        vm.expectRevert(abi.encodeWithSelector(AeonEscrow.AmountTooLow.selector, PRICE - 1, PRICE));
        _createAs(client, PRICE - 1);
    }

    function test_create_requiresMinAmountWhenAboveListingPrice() public {
        AeonEscrow strict = _deployEscrow(1 ether);
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        vm.prank(client);
        vm.expectRevert(abi.encodeWithSelector(AeonEscrow.AmountTooLow.selector, PRICE, 1 ether));
        strict.createJob{ value: PRICE }(tokenId, TASK, expiredAt, WINDOW, evaluator);
    }

    function test_create_rejectsExpiryOutsideBounds() public {
        vm.startPrank(client);
        uint64 tooSoon = uint64(block.timestamp + MIN_WINDOW - 1);
        vm.expectRevert(AeonEscrow.BadExpiry.selector);
        escrow.createJob{ value: PRICE }(tokenId, TASK, tooSoon, WINDOW, evaluator);

        uint64 tooFar = uint64(block.timestamp + MAX_LIFETIME + 1);
        vm.expectRevert(AeonEscrow.BadExpiry.selector);
        escrow.createJob{ value: PRICE }(tokenId, TASK, tooFar, WINDOW, evaluator);
        vm.stopPrank();
    }

    function test_create_rejectsWindowOutsideBounds() public {
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        vm.startPrank(client);
        vm.expectRevert(AeonEscrow.BadWindow.selector);
        escrow.createJob{ value: PRICE }(tokenId, TASK, expiredAt, MIN_WINDOW - 1, evaluator);
        vm.expectRevert(AeonEscrow.BadWindow.selector);
        escrow.createJob{ value: PRICE }(tokenId, TASK, expiredAt, MAX_WINDOW + 1, evaluator);
        vm.stopPrank();
    }

    function test_create_rejectsBadEvaluators() public {
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        address[3] memory bad = [address(0), owner, agent.addr];
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(client);
            vm.expectRevert(AeonEscrow.BadEvaluator.selector);
            escrow.createJob{ value: PRICE }(tokenId, TASK, expiredAt, WINDOW, bad[i]);
        }
    }

    function test_create_rejectsOwnerHiringOwnAgent() public {
        vm.deal(owner, 1 ether);
        vm.expectRevert(AeonEscrow.ClientIsPayee.selector);
        _createAs(owner, PRICE);
    }

    function test_constructor_rejectsBadConfig() public {
        AeonEscrow.Config memory c = _config(MIN_AMOUNT);
        c.feeBps = 1001;
        vm.expectRevert(AeonEscrow.BadConfig.selector);
        new AeonEscrow(IAeonAgentNFT(address(nft)), reg, c);

        c = _config(MIN_AMOUNT);
        c.minWindow = MAX_WINDOW + 1;
        vm.expectRevert(AeonEscrow.BadConfig.selector);
        new AeonEscrow(IAeonAgentNFT(address(nft)), reg, c);

        c = _config(MIN_AMOUNT);
        c.feeRecipient = address(0);
        vm.expectRevert(AeonEscrow.ZeroAddress.selector);
        new AeonEscrow(IAeonAgentNFT(address(nft)), reg, c);

        vm.expectRevert(AeonEscrow.ZeroAddress.selector);
        new AeonEscrow(IAeonAgentNFT(address(nft)), AeonRegistry(address(0)), _config(1));
    }

    function test_decline_byAgentWalletRefundsInFullWithoutFee() public {
        uint256 jobId = _create();
        uint256 before = client.balance;
        vm.prank(agent.addr);
        escrow.decline(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Declined));
        assertEq(client.balance, before + PRICE);
        assertEq(treasury.balance, 0);
        assertEq(address(escrow).balance, 0);
    }

    function test_decline_byOwner() public {
        uint256 jobId = _create();
        vm.prank(owner);
        escrow.decline(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Declined));
    }

    function test_decline_rejectsStrangerAndEvaluator() public {
        uint256 jobId = _create();
        vm.prank(stranger);
        vm.expectRevert(AeonEscrow.NotProvider.selector);
        escrow.decline(jobId);
        vm.prank(evaluator);
        vm.expectRevert(AeonEscrow.NotProvider.selector);
        escrow.decline(jobId);
    }

    function test_claimRefund_onlyAfterExpiryAndByAnyone() public {
        uint256 jobId = _create();
        uint64 expiredAt = escrow.getJob(jobId).expiredAt;

        vm.warp(expiredAt - 1);
        vm.prank(stranger);
        vm.expectRevert(AeonEscrow.TooEarly.selector);
        escrow.claimRefund(jobId);

        uint256 before = client.balance;
        vm.warp(expiredAt);
        vm.prank(stranger);
        escrow.claimRefund(jobId);
        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Refunded));
        assertEq(client.balance, before + PRICE);
    }

    function test_refundToRejectingClientIsKeptForWithdrawal() public {
        RejectingActor rejecting = new RejectingActor();
        vm.deal(address(rejecting), 1 ether);
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        bytes memory create =
            abi.encodeCall(AeonEscrow.createJob, (tokenId, TASK, expiredAt, WINDOW, evaluator));
        uint256 jobId = abi.decode(rejecting.exec(address(escrow), PRICE, create), (uint256));

        vm.expectEmit(true, false, false, true);
        emit AeonEscrow.PaymentDeferred(address(rejecting), PRICE);
        vm.prank(agent.addr);
        escrow.decline(jobId);

        assertEq(uint8(_state(jobId)), uint8(AeonEscrow.State.Declined));
        assertEq(escrow.pendingWithdrawals(address(rejecting)), PRICE);
        assertEq(address(escrow).balance, PRICE);
    }
}
