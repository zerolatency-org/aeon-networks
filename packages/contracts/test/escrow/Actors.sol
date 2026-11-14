// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

import { AeonEscrow } from "../../src/AeonEscrow.sol";

/// Refuses every payment.
contract RejectingActor is IERC721Receiver {
    function exec(address target, uint256 value, bytes calldata data)
        external
        returns (bytes memory)
    {
        (bool ok, bytes memory ret) = target.call{ value: value }(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        revert("no thanks");
    }
}

/// When paid, tries to call back into the escrow.
contract ReentrantActor is IERC721Receiver {
    AeonEscrow internal immutable escrow;
    bytes public attack;

    constructor(AeonEscrow escrow_) {
        escrow = escrow_;
    }

    function setAttack(bytes calldata data) external {
        attack = data;
    }

    function exec(address target, uint256 value, bytes calldata data)
        external
        returns (bytes memory)
    {
        (bool ok, bytes memory ret) = target.call{ value: value }(data);
        if (!ok) {
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }
        return ret;
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }

    receive() external payable {
        if (attack.length == 0) return;
        (bool ok,) = address(escrow).call(attack);
        require(ok, "reentry blocked");
    }
}
