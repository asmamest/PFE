// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./UserRegistry.sol";

contract CredentialRegistry {
    enum Status { Active, Revoked, Expired }

    struct Credential {
        bytes32 docHash;        // SHA-256 du document (clair)
        string ipfsCID;         // CID IPFS du credential chiffré + signature
        address issuer;         // Adresse de l'émetteur (doit être enregistré avec rôle issuer)
        address holder;         // Adresse du détenteur (doit être enregistré)
        Status status;
        uint256 issuedAt;
        uint256 expiresAt;      // 0 = jamais
        string metadataCID;     // CID IPFS des métadonnées additionnelles
    }

    mapping(bytes32 => Credential) public credentials;
    mapping(address => bytes32[]) public issuerCredentials;
    mapping(address => bytes32[]) public holderCredentials;

    UserRegistry public userRegistry;
    uint256 public totalCredentials;

    event CredentialIssued(
        bytes32 indexed credentialId,
        address indexed issuer,
        address indexed holder,
        bytes32 docHash,
        string ipfsCID,
        uint256 issuedAt,
        uint256 expiresAt
    );
    event CredentialRevoked(bytes32 indexed credentialId, address indexed issuer, uint256 revokedAt);
    event CredentialStatusUpdated(bytes32 indexed credentialId, Status newStatus, uint256 updatedAt);

    modifier onlyIssuer(bytes32 _credentialId) {
        require(credentials[_credentialId].issuer == msg.sender, "Only issuer can perform");
        _;
    }

    modifier onlyActiveCredential(bytes32 _credentialId) {
        require(credentials[_credentialId].status == Status.Active, "Credential not active");
        _;
    }

    constructor(address _userRegistry) {
        userRegistry = UserRegistry(_userRegistry);
    }

    function issueCredential(
        bytes32 _docHash,
        string calldata _ipfsCID,
        address _holder,
        uint256 _expiresAt,
        string calldata _metadataCID
    ) external returns (bytes32) {
        require(userRegistry.isIssuer(msg.sender), "Caller is not an active issuer");
        require(userRegistry.isHolder(_holder), "Holder is not registered");
        require(_docHash != bytes32(0), "Doc hash required");
        require(bytes(_ipfsCID).length > 0, "IPFS CID required");

        bytes32 credentialId = keccak256(abi.encodePacked(msg.sender, _holder, _docHash, block.timestamp));
        require(credentials[credentialId].issuer == address(0), "Credential already exists");

        credentials[credentialId] = Credential({
            docHash: _docHash,
            ipfsCID: _ipfsCID,
            issuer: msg.sender,
            holder: _holder,
            status: Status.Active,
            issuedAt: block.timestamp,
            expiresAt: _expiresAt,
            metadataCID: _metadataCID
        });

        issuerCredentials[msg.sender].push(credentialId);
        holderCredentials[_holder].push(credentialId);
        totalCredentials++;

        emit CredentialIssued(credentialId, msg.sender, _holder, _docHash, _ipfsCID, block.timestamp, _expiresAt);
        return credentialId;
    }

    function revokeCredential(bytes32 _credentialId) external onlyIssuer(_credentialId) onlyActiveCredential(_credentialId) {
        credentials[_credentialId].status = Status.Revoked;
        emit CredentialRevoked(_credentialId, msg.sender, block.timestamp);
        emit CredentialStatusUpdated(_credentialId, Status.Revoked, block.timestamp);
    }

    function updateExpired(bytes32 _credentialId) external {
        Credential storage cred = credentials[_credentialId];
        if (cred.status == Status.Active && cred.expiresAt > 0 && cred.expiresAt <= block.timestamp) {
            cred.status = Status.Expired;
            emit CredentialStatusUpdated(_credentialId, Status.Expired, block.timestamp);
        }
    }

    function getCredential(bytes32 _credentialId) external view returns (Credential memory) {
        return credentials[_credentialId];
    }

    function isCredentialValid(bytes32 _credentialId) external view returns (bool) {
        Credential storage cred = credentials[_credentialId];
        if (cred.status != Status.Active) return false;
        if (cred.expiresAt > 0 && cred.expiresAt <= block.timestamp) return false;
        return true;
    }

    function getIssuerCredentials(address _issuer) external view returns (bytes32[] memory) {
        return issuerCredentials[_issuer];
    }

    function getHolderCredentials(address _holder) external view returns (bytes32[] memory) {
        return holderCredentials[_holder];
    }
}
