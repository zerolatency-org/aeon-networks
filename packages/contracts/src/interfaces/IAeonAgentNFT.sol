// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice What AeonRegistry and AeonEscrow need from the agent token.
interface IAeonAgentNFT {
    function ownerOf(uint256 tokenId) external view returns (address);

    function isAuthorized(uint256 tokenId, address executor, uint256 permission)
        external
        view
        returns (bool);
}
