// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.26;

/**
 * @title IQualityOracle
 * @notice Interface for proposal quality verification
 */
interface IQualityOracle {
    /**
     * @notice Verify a quality attestation signature
     * @param contentHash IPFS hash of proposal content
     * @param score Quality score (0-100)
     * @param timestamp When attestation was signed
     * @param submitter Address submitting the proposal
     * @param signature Assessor's signature
     * @return assessor Address of the signing assessor
     */
    function verifyScore(
        bytes32 contentHash,
        uint8 score,
        uint256 timestamp,
        address submitter,
        bytes calldata signature
    ) external returns (address assessor);

    /**
     * @notice Check if an attestation would be valid (view function)
     */
    function checkAttestation(
        bytes32 contentHash,
        uint8 score,
        uint256 timestamp,
        address submitter,
        bytes calldata signature
    ) external view returns (bool valid, address assessor, string memory reason);

    /**
     * @notice Get minimum required score
     */
    function minScore() external view returns (uint8);

    /**
     * @notice Check if address is an authorized assessor
     */
    function isAssessor(address addr) external view returns (bool);
}
