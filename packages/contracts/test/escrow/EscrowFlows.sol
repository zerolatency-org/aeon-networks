// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { EscrowBase } from "./EscrowBase.sol";

/// Step 2 helpers: jobs already submitted or disputed.
abstract contract EscrowFlows is EscrowBase {
    function _submitted() internal returns (uint256 jobId) {
        jobId = _create();
        vm.prank(agent.addr);
        escrow.submit(jobId, RESULT);
    }

    function _disputed() internal returns (uint256 jobId) {
        jobId = _submitted();
        vm.prank(evaluator);
        escrow.dispute(jobId);
    }
}
