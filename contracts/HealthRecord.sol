// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title HealthRecord
 * @dev A simple smart contract to store cryptographic hashes of patient medical records on the blockchain.
 * Built for HealthChain.
 */
contract HealthRecord {
    // Mapping from a patient's UID to an array of their medical record hashes
    mapping(string => string[]) private patientHashes;

    // Event emitted whenever a new hash is permanently stored on the blockchain
    event HashStored(string indexed patientId, string recordHash, uint256 timestamp);

    /**
     * @dev Store a new SHA-256 hash for a patient.
     * @param patientId The unique ID of the patient (e.g., Firebase UID).
     * @param recordHash The SHA-256 hash string of the medical report.
     */
    function storeHash(string memory patientId, string memory recordHash) public {
        // In a real production app, you might want to add authentication here
        // to ensure only the patient or authorized doctors can add hashes.
        // For the hackathon MVP, we allow open insertion to demonstrate the concept.
        patientHashes[patientId].push(recordHash);
        
        emit HashStored(patientId, recordHash, block.timestamp);
    }

    /**
     * @dev Retrieve all record hashes for a given patient.
     * @param patientId The unique ID of the patient.
     * @return An array of string hashes.
     */
    function getHashes(string memory patientId) public view returns (string[] memory) {
        return patientHashes[patientId];
    }
}
