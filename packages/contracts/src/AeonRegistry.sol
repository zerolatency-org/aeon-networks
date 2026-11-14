// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import { IAeonAgentNFT } from "./interfaces/IAeonAgentNFT.sol";

/// @title AeonRegistry
/// @notice Which agents are for hire, at what price, and their track record.
/// @dev The listing stores the agent wallet's 64-byte public key; the wallet address is derived
/// from it, and listing requires that wallet to hold SIGN_JOBS on the token. So the key buyers
/// encrypt to always belongs to the wallet that will do the work. A listing whose lister no
/// longer owns the token reads as inactive. Track-record counters move only through the escrow.
contract AeonRegistry is ReentrancyGuard {
    struct Listing {
        address listedBy;
        uint96 price;
        bool active;
        bytes32 profileHash;
        uint64 jobsCompleted;
        uint64 jobsDisputed;
        uint128 totalSettled;
        bytes agentPubKey;
        uint256 erc8004Id;
    }

    uint256 public constant SIGN_JOBS = 1 << 1; // must match AeonAgentNFT.SIGN_JOBS
    uint8 public constant OUTCOME_COMPLETED = 0;
    uint8 public constant OUTCOME_DISPUTED = 1;

    IAeonAgentNFT public immutable nft;
    uint96 public immutable minPrice;
    uint256 public immutable listingFee;
    address public immutable feeRecipient;
    address public immutable deployer;

    address public escrow;

    mapping(uint256 tokenId => Listing) private _listings;
    uint256[] private _listedIds;
    mapping(uint256 tokenId => bool) private _everListed;

    event Listed(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed agentWallet,
        uint96 price,
        bytes32 profileHash
    );
    event ListingUpdated(uint256 indexed tokenId, uint96 price, bytes32 profileHash);
    event Delisted(uint256 indexed tokenId);
    event SettlementRecorded(uint256 indexed tokenId, uint8 outcome, uint256 amount);
    event EscrowSet(address indexed escrow);

    error ZeroAddress();
    error NotTokenOwner();
    error NotListed();
    error PriceTooLow(uint96 price, uint96 minimum);
    error BadPublicKey();
    error AgentWalletNotAuthorized(address agentWallet);
    error FeeTooLow(uint256 sent, uint256 required);
    error PaymentFailed(address to, uint256 amount);
    error OnlyEscrow();
    error OnlyDeployer();
    error EscrowAlreadySet();

    constructor(IAeonAgentNFT nft_, uint96 minPrice_, uint256 listingFee_, address feeRecipient_) {
        if (address(nft_) == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        nft = nft_;
        minPrice = minPrice_;
        listingFee = listingFee_;
        feeRecipient = feeRecipient_;
        deployer = msg.sender;
    }

    // ------------------------------------------------------------ owner

    /// @notice List (or re-list after a transfer) an agent. Pays listingFee; excess is returned.
    function list(uint256 tokenId, uint96 price, bytes calldata agentPubKey, bytes32 profileHash)
        external
        payable
        nonReentrant
    {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (price < minPrice) revert PriceTooLow(price, minPrice);
        if (agentPubKey.length != 64) revert BadPublicKey();
        address wallet = _walletOf(agentPubKey);
        if (!nft.isAuthorized(tokenId, wallet, SIGN_JOBS)) revert AgentWalletNotAuthorized(wallet);
        if (msg.value < listingFee) revert FeeTooLow(msg.value, listingFee);

        Listing storage l = _listings[tokenId];
        l.listedBy = msg.sender;
        l.price = price;
        l.active = true;
        l.profileHash = profileHash;
        l.agentPubKey = agentPubKey;
        if (!_everListed[tokenId]) {
            _everListed[tokenId] = true;
            _listedIds.push(tokenId);
        }
        emit Listed(tokenId, msg.sender, wallet, price, profileHash);

        _pay(feeRecipient, listingFee);
        _pay(msg.sender, msg.value - listingFee);
    }

    function update(uint256 tokenId, uint96 price, bytes32 profileHash) external {
        _requireActiveOwner(tokenId);
        if (price < minPrice) revert PriceTooLow(price, minPrice);
        Listing storage l = _listings[tokenId];
        l.price = price;
        l.profileHash = profileHash;
        emit ListingUpdated(tokenId, price, profileHash);
    }

    function delist(uint256 tokenId) external {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!_listings[tokenId].active) revert NotListed();
        _listings[tokenId].active = false;
        emit Delisted(tokenId);
    }

    // ------------------------------------------------------------ escrow

    function setEscrow(address escrow_) external {
        if (msg.sender != deployer) revert OnlyDeployer();
        if (escrow != address(0)) revert EscrowAlreadySet();
        if (escrow_ == address(0)) revert ZeroAddress();
        escrow = escrow_;
        emit EscrowSet(escrow_);
    }

    function recordSettlement(uint256 tokenId, uint8 outcome, uint256 amount) external {
        if (msg.sender != escrow) revert OnlyEscrow();
        Listing storage l = _listings[tokenId];
        if (outcome == OUTCOME_COMPLETED) {
            l.jobsCompleted += 1;
            l.totalSettled += SafeCast.toUint128(amount);
        } else if (outcome == OUTCOME_DISPUTED) {
            l.jobsDisputed += 1;
        }
        emit SettlementRecorded(tokenId, outcome, amount);
    }

    // ------------------------------------------------------------ views

    function isActive(uint256 tokenId) public view returns (bool) {
        Listing storage l = _listings[tokenId];
        return l.active && nft.ownerOf(tokenId) == l.listedBy;
    }

    function agentWallet(uint256 tokenId) external view returns (address) {
        bytes storage key = _listings[tokenId].agentPubKey;
        if (key.length != 64) revert NotListed();
        return _walletOf(key);
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    function listedCount() external view returns (uint256) {
        return _listedIds.length;
    }

    /// @notice Pages through every token that was ever listed (check isActive per item).
    function listings(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Listing[] memory items)
    {
        uint256 total = _listedIds.length;
        uint256 n = offset >= total ? 0 : (limit > total - offset ? total - offset : limit);
        ids = new uint256[](n);
        items = new Listing[](n);
        for (uint256 i; i < n; ++i) {
            ids[i] = _listedIds[offset + i];
            items[i] = _listings[ids[i]];
        }
    }

    // ------------------------------------------------------------ internals

    function _requireActiveOwner(uint256 tokenId) private view {
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!isActive(tokenId)) revert NotListed();
    }

    function _walletOf(bytes memory pubKey) private pure returns (address) {
        return address(uint160(uint256(keccak256(pubKey))));
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) revert PaymentFailed(to, amount);
    }
}
