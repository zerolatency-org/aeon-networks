// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {
    ERC721Enumerable
} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { IAeonAgentNFT } from "./interfaces/IAeonAgentNFT.sol";

/// @title AeonAgentNFT
/// @notice ERC-7857-style agent token. Each token holds (description, dataHash) slots that
/// point at encrypted blobs on 0G Storage, a manifest root for the owner's vault, and
/// per-token executor permissions for the server-held agent wallet.
/// @dev Differences from 0G's reference (0gfoundation/0g-agent-nft, CC0):
///  - not upgradeable;
///  - authorizeUsage takes a permission mask (UPDATE_SLOTS, SIGN_JOBS);
///  - authorizations live under a per-token epoch that bumps on every transfer, so they
///    clear in O(1) instead of looping over executors;
///  - iTransferFrom checks the caller owns or is approved for the token before the oracle proof.
contract AeonAgentNFT is ERC721Enumerable, Ownable, ReentrancyGuard, IAeonAgentNFT {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    struct IntelligentData {
        string description;
        bytes32 dataHash;
    }

    uint256 public constant UPDATE_SLOTS = 1 << 0;
    uint256 public constant SIGN_JOBS = 1 << 1;
    uint256 public constant ALL_PERMISSIONS = UPDATE_SLOTS | SIGN_JOBS;
    uint256 public constant MAX_SLOTS = 16;

    uint256 public immutable mintFee;
    address public immutable feeRecipient;

    address public oracle;
    uint256 private _nextId = 1;

    // Filled with .push() in mint/appendSlot; Slither misreads that as never initialized.
    // slither-disable-next-line uninitialized-state
    mapping(uint256 tokenId => IntelligentData[]) private _slots;
    mapping(uint256 tokenId => bytes32) private _manifest;
    mapping(uint256 tokenId => uint256) private _epoch;
    mapping(uint256 tokenId => mapping(uint256 epoch => mapping(address executor => uint256)))
        private _permissions;
    mapping(bytes32 digest => bool) public consumedProofs;

    event Minted(uint256 indexed tokenId, address indexed to, uint256 slots, uint256 feePaid);
    event SlotsUpdated(uint256 indexed tokenId, uint256[] slots, bytes32[] hashes);
    event SlotAppended(
        uint256 indexed tokenId, uint256 index, string description, bytes32 dataHash
    );
    event ManifestAnchored(uint256 indexed tokenId, bytes32 rootHash, address indexed by);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor, uint256 permissions);
    event AuthorizationsCleared(uint256 indexed tokenId, uint256 newEpoch);
    event IntelligentTransfer(uint256 indexed tokenId, address indexed from, address indexed to);
    event OracleRotated(address indexed oldOracle, address indexed newOracle);

    error ZeroAddress();
    error EmptyData();
    error TooManySlots();
    error FeeTooLow(uint256 sent, uint256 required);
    error PaymentFailed(address to, uint256 amount);
    error NotTokenOwner();
    error NotAllowed();
    error BadPermissions(uint256 permissions);
    error InvalidSlot(uint256 slot);
    error LengthMismatch();
    error InvalidProof();
    error ProofAlreadyUsed();

    constructor(address initialOwner, address oracle_, address feeRecipient_, uint256 mintFee_)
        ERC721("Aeon Agent", "AEON")
        Ownable(initialOwner)
    {
        if (oracle_ == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
        oracle = oracle_;
        feeRecipient = feeRecipient_;
        mintFee = mintFee_;
    }

    // ---------------------------------------------------------------- mint

    /// @notice Anyone can mint their own agent by paying mintFee. Excess value is returned.
    function mint(address to, IntelligentData[] calldata data)
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert ZeroAddress();
        if (data.length == 0) revert EmptyData();
        if (data.length > MAX_SLOTS) revert TooManySlots();
        if (msg.value < mintFee) revert FeeTooLow(msg.value, mintFee);

        tokenId = _nextId++;
        IntelligentData[] storage slots = _slots[tokenId];
        for (uint256 i; i < data.length; ++i) {
            slots.push(data[i]);
        }
        emit Minted(tokenId, to, data.length, mintFee);

        _safeMint(to, tokenId);
        _pay(feeRecipient, mintFee);
        _pay(msg.sender, msg.value - mintFee);
    }

    // ------------------------------------------------------- authorization

    /// @notice Grants `executor` a permission mask on `tokenId`. 0 revokes. Owner only.
    /// Grants are wiped when the token changes hands.
    function authorizeUsage(uint256 tokenId, address executor, uint256 permissions) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (executor == address(0)) revert ZeroAddress();
        if (permissions & ~ALL_PERMISSIONS != 0) revert BadPermissions(permissions);
        _permissions[tokenId][_epoch[tokenId]][executor] = permissions;
        emit UsageAuthorized(tokenId, executor, permissions);
    }

    function permissionsOf(uint256 tokenId, address executor) public view returns (uint256) {
        _requireOwned(tokenId);
        return _permissions[tokenId][_epoch[tokenId]][executor];
    }

    function isAuthorized(uint256 tokenId, address executor, uint256 permission)
        public
        view
        returns (bool)
    {
        return permission != 0 && permissionsOf(tokenId, executor) & permission == permission;
    }

    // ----------------------------------------------------------- data slots

    function update(uint256 tokenId, uint256[] calldata slots, bytes32[] calldata hashes) external {
        _requireOwnerOr(tokenId, UPDATE_SLOTS);
        if (slots.length != hashes.length) revert LengthMismatch();
        IntelligentData[] storage data = _slots[tokenId];
        for (uint256 i; i < slots.length; ++i) {
            if (slots[i] >= data.length) revert InvalidSlot(slots[i]);
            data[slots[i]].dataHash = hashes[i];
        }
        emit SlotsUpdated(tokenId, slots, hashes);
    }

    function appendSlot(uint256 tokenId, IntelligentData calldata slot) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        IntelligentData[] storage data = _slots[tokenId];
        if (data.length >= MAX_SLOTS) revert TooManySlots();
        data.push(slot);
        emit SlotAppended(tokenId, data.length - 1, slot.description, slot.dataHash);
    }

    function anchorManifest(uint256 tokenId, bytes32 rootHash) external {
        _requireOwnerOr(tokenId, UPDATE_SLOTS);
        _manifest[tokenId] = rootHash;
        emit ManifestAnchored(tokenId, rootHash, msg.sender);
    }

    function manifestOf(uint256 tokenId) external view returns (bytes32) {
        _requireOwned(tokenId);
        return _manifest[tokenId];
    }

    function getIntelligentData(uint256 tokenId) external view returns (IntelligentData[] memory) {
        _requireOwned(tokenId);
        return _slots[tokenId];
    }

    // --------------------------------------------------- intelligent transfer

    /// @notice The digest the oracle signs for an intelligent transfer (EIP-191 personal sign).
    function transferDigest(
        uint256 tokenId,
        address from,
        address to,
        bytes32[] calldata newHashes,
        bytes32 nonce
    ) public view returns (bytes32) {
        return keccak256(
            abi.encode(
                block.chainid,
                address(this),
                tokenId,
                from,
                to,
                keccak256(abi.encodePacked(newHashes)),
                nonce
            )
        );
    }

    /// @notice Transfers the token and rotates every slot hash to data re-encrypted for `to`.
    function iTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes32[] calldata newHashes,
        bytes32 nonce,
        bytes calldata oracleSignature
    ) external {
        address owner = ownerOf(tokenId);
        if (owner != from) revert NotTokenOwner();
        if (!_isAuthorized(owner, msg.sender, tokenId)) revert NotAllowed();
        IntelligentData[] storage data = _slots[tokenId];
        if (newHashes.length != data.length) revert LengthMismatch();

        bytes32 digest = transferDigest(tokenId, from, to, newHashes, nonce);
        if (consumedProofs[digest]) revert ProofAlreadyUsed();
        if (digest.toEthSignedMessageHash().recover(oracleSignature) != oracle) {
            revert InvalidProof();
        }
        consumedProofs[digest] = true;

        for (uint256 i; i < newHashes.length; ++i) {
            data[i].dataHash = newHashes[i];
        }
        _transfer(from, to, tokenId);
        emit IntelligentTransfer(tokenId, from, to);
    }

    function setOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit OracleRotated(oracle, newOracle);
        oracle = newOracle;
    }

    // ------------------------------------------------------------ internals

    /// @dev Bumps the token's epoch on every transfer (not on mint), which voids all grants.
    function _update(address to, uint256 tokenId, address auth)
        internal
        override
        returns (address from)
    {
        from = super._update(to, tokenId, auth);
        if (from != address(0)) {
            uint256 next = ++_epoch[tokenId];
            emit AuthorizationsCleared(tokenId, next);
        }
    }

    function _requireOwnerOr(uint256 tokenId, uint256 permission) private view {
        if (ownerOf(tokenId) != msg.sender && !isAuthorized(tokenId, msg.sender, permission)) {
            revert NotAllowed();
        }
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = to.call{ value: amount }("");
        if (!ok) revert PaymentFailed(to, amount);
    }

    function ownerOf(uint256 tokenId)
        public
        view
        override(ERC721, IERC721, IAeonAgentNFT)
        returns (address)
    {
        return super.ownerOf(tokenId);
    }
}
