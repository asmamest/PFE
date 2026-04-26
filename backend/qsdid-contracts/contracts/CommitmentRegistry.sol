// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserRegistry.sol";

contract CommitmentRegistry {
    // Structure pour stocker un commitment avec métadonnées
    struct Commitment {
        bytes32 value;           // Le hash (ex: Poseidon) des attributs
        uint256 timestamp;
        string metadataCID;      // Optionnel: description des attributs engagés (ex: "nom, date de naissance, nationalité")
    }

    // Chaque utilisateur ne peut avoir qu'un seul commitment actif (ou on peut en autoriser plusieurs)
    mapping(address => Commitment) public commitments;

    UserRegistry public userRegistry;

    event CommitmentSet(address indexed user, bytes32 commitmentValue, uint256 timestamp);
    event CommitmentUpdated(address indexed user, bytes32 oldValue, bytes32 newValue, uint256 timestamp);
    event CommitmentRevoked(address indexed user, uint256 timestamp);

    modifier onlyActiveUser(address _user) {
        require(userRegistry.isHolder(_user) || userRegistry.isIssuer(_user), "User not registered or not active");
        _;
    }

    constructor(address _userRegistry) {
        userRegistry = UserRegistry(_userRegistry);
    }

    // Enregistre ou met à jour le commitment de l'utilisateur (appelé par l'utilisateur lui-même)
    function setCommitment(bytes32 _commitment, string calldata _metadataCID) external onlyActiveUser(msg.sender) {
        require(_commitment != bytes32(0), "Commitment cannot be zero");
        
        Commitment storage existing = commitments[msg.sender];
        if (existing.value != bytes32(0)) {
            emit CommitmentUpdated(msg.sender, existing.value, _commitment, block.timestamp);
        } else {
            emit CommitmentSet(msg.sender, _commitment, block.timestamp);
        }
        
        commitments[msg.sender] = Commitment({
            value: _commitment,
            timestamp: block.timestamp,
            metadataCID: _metadataCID
        });
    }

    // Récupère le commitment actuel d'un utilisateur
    function getCommitment(address _user) external view returns (Commitment memory) {
        return commitments[_user];
    }

    // Optionnel: révoquer le commitment (l'utilisateur ne veut plus l'utiliser)
    function revokeCommitment() external onlyActiveUser(msg.sender) {
        require(commitments[msg.sender].value != bytes32(0), "No commitment to revoke");
        delete commitments[msg.sender];
        emit CommitmentRevoked(msg.sender, block.timestamp);
    }

    // Vérifie si un utilisateur a un commitment actif
    function hasCommitment(address _user) external view returns (bool) {
        return commitments[_user].value != bytes32(0);
    }
}
