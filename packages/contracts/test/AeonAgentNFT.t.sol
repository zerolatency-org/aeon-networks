// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test } from "forge-std/Test.sol";
import { IERC721Errors } from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { AeonAgentNFT } from "../src/AeonAgentNFT.sol";

contract RevertingReceiver {
    receive() external payable {
        revert("no");
    }
}

contract AeonAgentNFTTest is Test {
    AeonAgentNFT internal nft;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal agentWallet = makeAddr("agentWallet");
    uint256 internal oraclePk = 0xA11CE;
    address internal oracle;
    uint256 internal constant FEE = 0.001 ether;

    function setUp() public {
        oracle = vm.addr(oraclePk);
        nft = new AeonAgentNFT(admin, oracle, treasury, FEE);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    // ----------------------------------------------------------- helpers

    function _data(uint256 n) internal pure returns (AeonAgentNFT.IntelligentData[] memory d) {
        d = new AeonAgentNFT.IntelligentData[](n);
        for (uint256 i; i < n; ++i) {
            d[i] = AeonAgentNFT.IntelligentData("slot", keccak256(abi.encode(i)));
        }
    }

    function _mint(address to) internal returns (uint256 id) {
        vm.prank(to);
        id = nft.mint{ value: FEE }(to, _data(3));
    }

    function _hashes(uint256 n, uint256 salt) internal pure returns (bytes32[] memory h) {
        h = new bytes32[](n);
        for (uint256 i; i < n; ++i) {
            h[i] = keccak256(abi.encode(salt, i));
        }
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(pk, MessageHashUtils.toEthSignedMessageHash(digest));
        return abi.encodePacked(r, s, v);
    }

    // -------------------------------------------------------------- mint

    function test_mint_setsOwnerDataAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit AeonAgentNFT.Minted(1, alice, 3, FEE);
        uint256 id = _mint(alice);
        assertEq(id, 1);
        assertEq(nft.ownerOf(1), alice);
        assertEq(nft.getIntelligentData(1).length, 3);
        assertEq(nft.getIntelligentData(1)[2].dataHash, keccak256(abi.encode(uint256(2))));
        assertEq(nft.totalSupply(), 1);
        assertEq(nft.tokenOfOwnerByIndex(alice, 0), 1);
    }

    function test_mint_revertsOnEmptyOrTooManySlots() public {
        vm.startPrank(alice);
        vm.expectRevert(AeonAgentNFT.EmptyData.selector);
        nft.mint{ value: FEE }(alice, _data(0));
        vm.expectRevert(AeonAgentNFT.TooManySlots.selector);
        nft.mint{ value: FEE }(alice, _data(17));
        vm.stopPrank();
    }

    function test_mint_revertsBelowFee() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AeonAgentNFT.FeeTooLow.selector, FEE - 1, FEE));
        nft.mint{ value: FEE - 1 }(alice, _data(1));
    }

    function test_mint_forwardsFeeAndRefundsExcess() public {
        uint256 before = alice.balance;
        vm.prank(alice);
        nft.mint{ value: 1 ether }(alice, _data(1));
        assertEq(treasury.balance, FEE);
        assertEq(alice.balance, before - FEE);
        assertEq(address(nft).balance, 0);
    }

    function test_mint_zeroFeeAllowed() public {
        AeonAgentNFT free = new AeonAgentNFT(admin, oracle, treasury, 0);
        vm.prank(alice);
        free.mint(alice, _data(1));
        assertEq(free.ownerOf(1), alice);
    }

    function test_mint_revertingFeeRecipientRevertsMint() public {
        AeonAgentNFT bad = new AeonAgentNFT(admin, oracle, address(new RevertingReceiver()), FEE);
        vm.prank(alice);
        vm.expectRevert();
        bad.mint{ value: FEE }(alice, _data(1));
    }

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(AeonAgentNFT.ZeroAddress.selector);
        new AeonAgentNFT(admin, address(0), treasury, FEE);
        vm.expectRevert(AeonAgentNFT.ZeroAddress.selector);
        new AeonAgentNFT(admin, oracle, address(0), FEE);
    }

    // ---------------------------------------------------- authorization

    function test_authorize_onlyOwner() public {
        uint256 id = _mint(alice);
        uint256 signJobs = nft.SIGN_JOBS(); // read first: a getter call would eat the prank
        vm.prank(bob);
        vm.expectRevert(AeonAgentNFT.NotTokenOwner.selector);
        nft.authorizeUsage(id, agentWallet, signJobs);
    }

    function test_authorize_setsAndRevokes() public {
        uint256 id = _mint(alice);
        uint256 signJobs = nft.SIGN_JOBS();
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, signJobs);
        assertTrue(nft.isAuthorized(id, agentWallet, signJobs));
        assertFalse(nft.isAuthorized(id, agentWallet, nft.UPDATE_SLOTS()));
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, 0);
        assertFalse(nft.isAuthorized(id, agentWallet, signJobs));
    }

    function test_authorize_rejectsZeroExecutorAndUnknownBits() public {
        uint256 id = _mint(alice);
        vm.startPrank(alice);
        vm.expectRevert(AeonAgentNFT.ZeroAddress.selector);
        nft.authorizeUsage(id, address(0), 1);
        vm.expectRevert(abi.encodeWithSelector(AeonAgentNFT.BadPermissions.selector, 4));
        nft.authorizeUsage(id, agentWallet, 4);
        vm.stopPrank();
    }

    function test_isAuthorized_zeroPermissionIsNeverTrue() public {
        uint256 id = _mint(alice);
        assertFalse(nft.isAuthorized(id, agentWallet, 0));
    }

    function test_authorizations_clearOnTransfer() public {
        uint256 id = _mint(alice);
        uint256 all = nft.ALL_PERMISSIONS();
        vm.startPrank(alice);
        nft.authorizeUsage(id, agentWallet, all);
        nft.transferFrom(alice, bob, id);
        vm.stopPrank();
        assertEq(nft.permissionsOf(id, agentWallet), 0);
        vm.prank(agentWallet);
        vm.expectRevert(AeonAgentNFT.NotAllowed.selector);
        nft.anchorManifest(id, bytes32(uint256(1)));
    }

    // ------------------------------------------------------------- slots

    function test_update_byOwnerAndUpdateSlotsExecutor() public {
        uint256 id = _mint(alice);
        uint256[] memory slots = new uint256[](1);
        bytes32[] memory hashes = new bytes32[](1);
        hashes[0] = bytes32(uint256(42));

        vm.prank(alice);
        nft.update(id, slots, hashes);
        assertEq(nft.getIntelligentData(id)[0].dataHash, hashes[0]);

        uint256 updateSlots = nft.UPDATE_SLOTS();
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, updateSlots);
        hashes[0] = bytes32(uint256(43));
        vm.prank(agentWallet);
        nft.update(id, slots, hashes);
        assertEq(nft.getIntelligentData(id)[0].dataHash, hashes[0]);
    }

    function test_update_rejectsStrangerAndSignJobsOnlyExecutor() public {
        uint256 id = _mint(alice);
        uint256[] memory slots = new uint256[](1);
        bytes32[] memory hashes = new bytes32[](1);
        vm.prank(bob);
        vm.expectRevert(AeonAgentNFT.NotAllowed.selector);
        nft.update(id, slots, hashes);

        uint256 signJobs = nft.SIGN_JOBS();
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, signJobs);
        vm.prank(agentWallet);
        vm.expectRevert(AeonAgentNFT.NotAllowed.selector);
        nft.update(id, slots, hashes);
    }

    function test_update_rejectsBadSlotAndLengthMismatch() public {
        uint256 id = _mint(alice);
        uint256[] memory slots = new uint256[](1);
        slots[0] = 3;
        bytes32[] memory hashes = new bytes32[](1);
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(AeonAgentNFT.InvalidSlot.selector, 3));
        nft.update(id, slots, hashes);
        vm.expectRevert(AeonAgentNFT.LengthMismatch.selector);
        nft.update(id, new uint256[](2), hashes);
        vm.stopPrank();
    }

    function test_appendSlot_ownerOnlyUpToMax() public {
        uint256 id = _mint(alice);
        AeonAgentNFT.IntelligentData memory s = AeonAgentNFT.IntelligentData("chat-log", bytes32(0));
        vm.prank(bob);
        vm.expectRevert(AeonAgentNFT.NotTokenOwner.selector);
        nft.appendSlot(id, s);

        vm.startPrank(alice);
        for (uint256 i = 3; i < 16; ++i) {
            nft.appendSlot(id, s);
        }
        assertEq(nft.getIntelligentData(id).length, 16);
        vm.expectRevert(AeonAgentNFT.TooManySlots.selector);
        nft.appendSlot(id, s);
        vm.stopPrank();
    }

    function test_anchorManifest_ownerOrExecutorOnly() public {
        uint256 id = _mint(alice);
        vm.prank(alice);
        nft.anchorManifest(id, bytes32(uint256(7)));
        assertEq(nft.manifestOf(id), bytes32(uint256(7)));

        vm.prank(bob);
        vm.expectRevert(AeonAgentNFT.NotAllowed.selector);
        nft.anchorManifest(id, bytes32(uint256(8)));

        uint256 updateSlots = nft.UPDATE_SLOTS();
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, updateSlots);
        vm.prank(agentWallet);
        nft.anchorManifest(id, bytes32(uint256(9)));
        assertEq(nft.manifestOf(id), bytes32(uint256(9)));
    }

    function test_views_revertForMissingToken() public {
        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 99));
        nft.getIntelligentData(99);
    }

    // ----------------------------------------------- intelligent transfer

    function test_iTransfer_validProofRotatesHashesAndClearsGrants() public {
        uint256 id = _mint(alice);
        uint256 all = nft.ALL_PERMISSIONS();
        vm.prank(alice);
        nft.authorizeUsage(id, agentWallet, all);

        bytes32[] memory h = _hashes(3, 1);
        bytes memory sig = _sign(oraclePk, nft.transferDigest(id, alice, bob, h, "n1"));
        vm.prank(alice);
        nft.iTransferFrom(alice, bob, id, h, "n1", sig);

        assertEq(nft.ownerOf(id), bob);
        assertEq(nft.getIntelligentData(id)[1].dataHash, h[1]);
        assertEq(nft.permissionsOf(id, agentWallet), 0);
    }

    function test_iTransfer_strangerWithValidProofCannotMove() public {
        uint256 id = _mint(alice);
        bytes32[] memory h = _hashes(3, 1);
        bytes memory sig = _sign(oraclePk, nft.transferDigest(id, alice, bob, h, "n1"));
        vm.prank(bob); // the flaw in 0G's sample: anyone with a proof could move the token
        vm.expectRevert(AeonAgentNFT.NotAllowed.selector);
        nft.iTransferFrom(alice, bob, id, h, "n1", sig);
    }

    function test_iTransfer_approvedOperatorCanMove() public {
        uint256 id = _mint(alice);
        vm.prank(alice);
        nft.approve(bob, id);
        bytes32[] memory h = _hashes(3, 2);
        bytes memory sig = _sign(oraclePk, nft.transferDigest(id, alice, bob, h, "n2"));
        vm.prank(bob);
        nft.iTransferFrom(alice, bob, id, h, "n2", sig);
        assertEq(nft.ownerOf(id), bob);
    }

    function test_iTransfer_rejectsReplayWrongSignerWrongChainAndLength() public {
        uint256 id = _mint(alice);
        bytes32[] memory h = _hashes(3, 3);
        bytes32 digest = nft.transferDigest(id, alice, bob, h, "n3");

        vm.prank(alice);
        vm.expectRevert(AeonAgentNFT.InvalidProof.selector);
        nft.iTransferFrom(alice, bob, id, h, "n3", _sign(0xB0B, digest));

        vm.chainId(1);
        bytes memory otherChain = _sign(oraclePk, nft.transferDigest(id, alice, bob, h, "n3"));
        vm.chainId(31337);
        vm.prank(alice);
        vm.expectRevert(AeonAgentNFT.InvalidProof.selector);
        nft.iTransferFrom(alice, bob, id, h, "n3", otherChain);

        vm.prank(alice);
        vm.expectRevert(AeonAgentNFT.LengthMismatch.selector);
        nft.iTransferFrom(alice, bob, id, _hashes(2, 3), "n3", _sign(oraclePk, digest));

        bytes memory sig = _sign(oraclePk, digest);
        vm.prank(alice);
        nft.iTransferFrom(alice, bob, id, h, "n3", sig);
        vm.prank(bob);
        nft.transferFrom(bob, alice, id);
        vm.prank(alice);
        vm.expectRevert(AeonAgentNFT.ProofAlreadyUsed.selector);
        nft.iTransferFrom(alice, bob, id, h, "n3", sig);
    }

    function test_setOracle_onlyContractOwner() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        nft.setOracle(alice);
        vm.prank(admin);
        nft.setOracle(bob);
        assertEq(nft.oracle(), bob);
    }

    // -------------------------------------------------------------- fuzz

    function testFuzz_mintAnySlotCountToAnyEOA(address to, uint8 n) public {
        vm.assume(to != address(0) && to.code.length == 0);
        assumeNotForgeAddress(to);
        assumeNotPrecompile(to);
        uint256 slots = bound(n, 1, 16);
        vm.deal(to, 1 ether);
        vm.prank(to);
        uint256 id = nft.mint{ value: FEE }(to, _data(slots));
        assertEq(nft.ownerOf(id), to);
        assertEq(nft.getIntelligentData(id).length, slots);
    }

    function testFuzz_strangerNeverAuthorized(address stranger, uint256 permission) public {
        uint256 id = _mint(alice);
        vm.assume(stranger != alice);
        assertFalse(nft.isAuthorized(id, stranger, bound(permission, 1, 3)));
    }
}
