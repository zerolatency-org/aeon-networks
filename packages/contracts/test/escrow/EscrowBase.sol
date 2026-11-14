// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { Test, Vm } from "forge-std/Test.sol";

import { AeonAgentNFT } from "../../src/AeonAgentNFT.sol";
import { AeonEscrow } from "../../src/AeonEscrow.sol";
import { AeonRegistry } from "../../src/AeonRegistry.sol";
import { IAeonAgentNFT } from "../../src/interfaces/IAeonAgentNFT.sol";

/// Shared setup: one agent minted by `owner`, its wallet granted SIGN_JOBS, listed at PRICE.
abstract contract EscrowBase is Test {
    AeonAgentNFT internal nft;
    AeonRegistry internal reg;
    AeonEscrow internal escrow;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal owner = makeAddr("owner");
    address internal client = makeAddr("client");
    address internal evaluator = makeAddr("evaluator");
    address internal stranger = makeAddr("stranger");
    Vm.Wallet internal agent;
    uint256 internal tokenId;

    uint96 internal constant PRICE = 0.05 ether;
    uint16 internal constant FEE_BPS = 250;
    uint128 internal constant MIN_AMOUNT = 0.01 ether;
    uint32 internal constant MIN_WINDOW = 60;
    uint32 internal constant MAX_WINDOW = 7 days;
    uint64 internal constant MAX_LIFETIME = 30 days;
    uint64 internal constant DISPUTE_LIMIT = 1 hours;
    uint32 internal constant WINDOW = 1 hours;
    bytes32 internal constant TASK = keccak256("task");

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        nft = new AeonAgentNFT(admin, makeAddr("oracle"), treasury, 0);
        reg = new AeonRegistry(IAeonAgentNFT(address(nft)), 0.01 ether, 0, treasury);
        escrow = _deployEscrow(MIN_AMOUNT);
        reg.setEscrow(address(escrow));

        agent = vm.createWallet("agent");
        tokenId = _mintAndList(owner, agent);
        vm.deal(client, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    function _config(uint128 minAmount) internal view returns (AeonEscrow.Config memory) {
        return AeonEscrow.Config({
            feeRecipient: treasury,
            feeBps: FEE_BPS,
            minAmount: minAmount,
            minWindow: MIN_WINDOW,
            maxWindow: MAX_WINDOW,
            maxLifetime: MAX_LIFETIME,
            disputeLimit: DISPUTE_LIMIT
        });
    }

    function _deployEscrow(uint128 minAmount) internal returns (AeonEscrow) {
        return new AeonEscrow(IAeonAgentNFT(address(nft)), reg, _config(minAmount));
    }

    function _pub(Vm.Wallet memory w) internal pure returns (bytes memory) {
        return abi.encodePacked(w.publicKeyX, w.publicKeyY);
    }

    function _mintAndList(address to, Vm.Wallet memory wallet) internal returns (uint256 id) {
        AeonAgentNFT.IntelligentData[] memory d = new AeonAgentNFT.IntelligentData[](1);
        d[0] = AeonAgentNFT.IntelligentData("persona", keccak256("p"));
        uint256 signJobs = nft.SIGN_JOBS();
        vm.startPrank(to);
        id = nft.mint(to, d);
        nft.authorizeUsage(id, wallet.addr, signJobs);
        reg.list(id, PRICE, _pub(wallet), bytes32(0));
        vm.stopPrank();
    }

    function _create() internal returns (uint256) {
        return _createAs(client, PRICE);
    }

    function _createAs(address who, uint256 amount) internal returns (uint256 jobId) {
        uint64 expiredAt = uint64(block.timestamp + 1 days);
        vm.prank(who);
        jobId = escrow.createJob{ value: amount }(tokenId, TASK, expiredAt, WINDOW, evaluator);
    }

    function _state(uint256 jobId) internal view returns (AeonEscrow.State) {
        return escrow.getJob(jobId).state;
    }
}
