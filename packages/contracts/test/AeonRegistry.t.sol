// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, Vm } from "forge-std/Test.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { AeonAgentNFT } from "../src/AeonAgentNFT.sol";
import { AeonRegistry } from "../src/AeonRegistry.sol";
import { IAeonAgentNFT } from "../src/interfaces/IAeonAgentNFT.sol";

contract AeonRegistryTest is Test {
    AeonAgentNFT internal nft;
    AeonRegistry internal reg;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal escrow = makeAddr("escrow");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    Vm.Wallet internal agent;

    uint96 internal constant MIN_PRICE = 0.01 ether;
    uint256 internal constant LIST_FEE = 0.002 ether;

    function setUp() public {
        nft = new AeonAgentNFT(admin, makeAddr("oracle"), treasury, 0);
        reg = new AeonRegistry(IAeonAgentNFT(address(nft)), MIN_PRICE, LIST_FEE, treasury);
        agent = vm.createWallet("agent");
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // ----------------------------------------------------------- helpers

    function _pub(Vm.Wallet memory w) internal pure returns (bytes memory) {
        return abi.encodePacked(w.publicKeyX, w.publicKeyY);
    }

    /// Mints to `to` and grants SIGN_JOBS to the agent wallet.
    function _mintReady(address to) internal returns (uint256 id) {
        AeonAgentNFT.IntelligentData[] memory d = new AeonAgentNFT.IntelligentData[](1);
        d[0] = AeonAgentNFT.IntelligentData("persona", keccak256("p"));
        uint256 signJobs = nft.SIGN_JOBS();
        vm.startPrank(to);
        id = nft.mint(to, d);
        nft.authorizeUsage(id, agent.addr, signJobs);
        vm.stopPrank();
    }

    function _list(address who, uint256 id) internal {
        vm.prank(who);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, _pub(agent), keccak256("profile"));
    }

    // -------------------------------------------------------------- list

    function test_list_happyPathEmitsAndStores() public {
        uint256 id = _mintReady(alice);
        vm.expectEmit(true, true, true, true);
        emit AeonRegistry.Listed(id, alice, agent.addr, MIN_PRICE, keccak256("profile"));
        _list(alice, id);

        AeonRegistry.Listing memory l = reg.getListing(id);
        assertEq(l.listedBy, alice);
        assertEq(l.price, MIN_PRICE);
        assertTrue(reg.isActive(id));
        assertEq(reg.agentWallet(id), agent.addr);
        assertEq(treasury.balance, LIST_FEE);
    }

    function test_list_refundsExcessFee() public {
        uint256 id = _mintReady(alice);
        uint256 before = alice.balance;
        vm.prank(alice);
        reg.list{ value: 1 ether }(id, MIN_PRICE, _pub(agent), bytes32(0));
        assertEq(alice.balance, before - LIST_FEE);
        assertEq(address(reg).balance, 0);
    }

    function test_list_rejectsNonOwner() public {
        uint256 id = _mintReady(alice);
        bytes memory pub = _pub(agent);
        vm.prank(bob);
        vm.expectRevert(AeonRegistry.NotTokenOwner.selector);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, pub, bytes32(0));
    }

    function test_list_rejectsLowPriceBadKeyAndLowFee() public {
        uint256 id = _mintReady(alice);
        bytes memory pub = _pub(agent);
        vm.startPrank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AeonRegistry.PriceTooLow.selector, MIN_PRICE - 1, MIN_PRICE)
        );
        reg.list{ value: LIST_FEE }(id, MIN_PRICE - 1, pub, bytes32(0));

        vm.expectRevert(AeonRegistry.BadPublicKey.selector);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, abi.encodePacked(bytes1(0x04), pub), bytes32(0));

        vm.expectRevert(
            abi.encodeWithSelector(AeonRegistry.FeeTooLow.selector, LIST_FEE - 1, LIST_FEE)
        );
        reg.list{ value: LIST_FEE - 1 }(id, MIN_PRICE, pub, bytes32(0));
        vm.stopPrank();
    }

    function test_list_requiresSignJobsOnDerivedWallet() public {
        uint256 id = _mintReady(alice);
        Vm.Wallet memory other = vm.createWallet("other");
        bytes memory pub = _pub(other);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AeonRegistry.AgentWalletNotAuthorized.selector, other.addr)
        );
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, pub, bytes32(0));

        // UPDATE_SLOTS alone is not enough
        uint256 updateSlots = nft.UPDATE_SLOTS();
        vm.prank(alice);
        nft.authorizeUsage(id, other.addr, updateSlots);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AeonRegistry.AgentWalletNotAuthorized.selector, other.addr)
        );
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, pub, bytes32(0));
    }

    // ---------------------------------------------------- update / delist

    function test_update_ownerOnlyAndFree() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);

        vm.prank(bob);
        vm.expectRevert(AeonRegistry.NotTokenOwner.selector);
        reg.update(id, 1 ether, bytes32(0));

        vm.prank(alice);
        reg.update(id, 1 ether, keccak256("v2"));
        assertEq(reg.getListing(id).price, 1 ether);
        assertEq(reg.getListing(id).profileHash, keccak256("v2"));

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AeonRegistry.PriceTooLow.selector, 1, MIN_PRICE));
        reg.update(id, 1, bytes32(0));
    }

    function test_delist_thenUpdateFails() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);
        vm.startPrank(alice);
        reg.delist(id);
        assertFalse(reg.isActive(id));
        vm.expectRevert(AeonRegistry.NotListed.selector);
        reg.delist(id);
        vm.expectRevert(AeonRegistry.NotListed.selector);
        reg.update(id, MIN_PRICE, bytes32(0));
        vm.stopPrank();
    }

    function test_transfer_makesListingInactiveUntilNewOwnerRelists() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);
        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        assertFalse(reg.isActive(id), "stale listing must not stay active");

        // the transfer wiped the agent grant, so bob re-grants and re-lists
        uint256 signJobs = nft.SIGN_JOBS();
        vm.startPrank(bob);
        nft.authorizeUsage(id, agent.addr, signJobs);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, _pub(agent), bytes32(0));
        vm.stopPrank();
        assertTrue(reg.isActive(id));
        assertEq(reg.getListing(id).listedBy, bob);
        assertEq(reg.listedCount(), 1, "relist must not duplicate the id");
    }

    function test_relistAfterTransfer_failsWithoutFreshGrant() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);
        vm.prank(alice);
        nft.transferFrom(alice, bob, id);
        bytes memory pub = _pub(agent);
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(AeonRegistry.AgentWalletNotAuthorized.selector, agent.addr)
        );
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, pub, bytes32(0));
    }

    // ------------------------------------------------------------ escrow

    function test_setEscrow_deployerOnceNonZero() public {
        vm.prank(alice);
        vm.expectRevert(AeonRegistry.OnlyDeployer.selector);
        reg.setEscrow(escrow);

        vm.expectRevert(AeonRegistry.ZeroAddress.selector);
        reg.setEscrow(address(0));

        reg.setEscrow(escrow);
        assertEq(reg.escrow(), escrow);

        vm.expectRevert(AeonRegistry.EscrowAlreadySet.selector);
        reg.setEscrow(alice);
    }

    function test_recordSettlement_onlyEscrowAndCounts() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);
        reg.setEscrow(escrow);

        vm.prank(alice);
        vm.expectRevert(AeonRegistry.OnlyEscrow.selector);
        reg.recordSettlement(id, 0, 1 ether);

        vm.startPrank(escrow);
        reg.recordSettlement(id, reg.OUTCOME_COMPLETED(), 1 ether);
        reg.recordSettlement(id, reg.OUTCOME_COMPLETED(), 0.5 ether);
        reg.recordSettlement(id, reg.OUTCOME_DISPUTED(), 2 ether);
        vm.stopPrank();

        AeonRegistry.Listing memory l = reg.getListing(id);
        assertEq(l.jobsCompleted, 2);
        assertEq(l.jobsDisputed, 1);
        assertEq(l.totalSettled, 1.5 ether);
    }

    function test_recordSettlement_revertsOnUint128Overflow() public {
        reg.setEscrow(escrow);
        vm.prank(escrow);
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeCast.SafeCastOverflowedUintDowncast.selector,
                128,
                uint256(type(uint128).max) + 1
            )
        );
        reg.recordSettlement(1, 0, uint256(type(uint128).max) + 1);
    }

    function test_countersSurviveRelist() public {
        uint256 id = _mintReady(alice);
        _list(alice, id);
        reg.setEscrow(escrow);
        vm.prank(escrow);
        reg.recordSettlement(id, 0, 1 ether);
        vm.startPrank(alice);
        reg.delist(id);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, _pub(agent), bytes32(0));
        vm.stopPrank();
        assertEq(reg.getListing(id).jobsCompleted, 1);
    }

    // ------------------------------------------------------------- views

    function test_agentWallet_revertsWhenNeverListed() public {
        vm.expectRevert(AeonRegistry.NotListed.selector);
        reg.agentWallet(42);
    }

    function test_listings_pagesAndClampsHugeLimit() public {
        for (uint256 i; i < 5; ++i) {
            _list(alice, _mintReady(alice));
        }
        (uint256[] memory ids,) = reg.listings(1, 2);
        assertEq(ids.length, 2);
        assertEq(ids[0], 2);
        assertEq(ids[1], 3);

        (ids,) = reg.listings(3, type(uint256).max);
        assertEq(ids.length, 2);
        assertEq(ids[1], 5);

        (ids,) = reg.listings(9, 10);
        assertEq(ids.length, 0);
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(AeonRegistry.ZeroAddress.selector);
        new AeonRegistry(IAeonAgentNFT(address(0)), MIN_PRICE, LIST_FEE, treasury);
        vm.expectRevert(AeonRegistry.ZeroAddress.selector);
        new AeonRegistry(IAeonAgentNFT(address(nft)), MIN_PRICE, LIST_FEE, address(0));
    }

    // -------------------------------------------------------------- fuzz

    function testFuzz_listAnyPriceAtOrAboveFloor(uint96 price) public {
        price = uint96(bound(price, MIN_PRICE, type(uint96).max));
        uint256 id = _mintReady(alice);
        vm.prank(alice);
        reg.list{ value: LIST_FEE }(id, price, _pub(agent), bytes32(0));
        assertEq(reg.getListing(id).price, price);
    }

    function testFuzz_derivedWalletMatchesKey(uint256 seed) public {
        uint256 pk = bound(
            seed, 1, 115792089237316195423570985008687907852837564279074904382605163141518161494336
        );
        Vm.Wallet memory w = vm.createWallet(pk);
        uint256 id = _mintReady(alice);
        uint256 signJobs = nft.SIGN_JOBS();
        vm.startPrank(alice);
        nft.authorizeUsage(id, w.addr, signJobs);
        reg.list{ value: LIST_FEE }(id, MIN_PRICE, _pub(w), bytes32(0));
        vm.stopPrank();
        assertEq(reg.agentWallet(id), w.addr);
    }
}
