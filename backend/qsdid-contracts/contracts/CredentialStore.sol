// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "./DIDRegistry.sol";

contract CredentialStore is Initializable, AccessControlUpgradeable {
    DIDRegistry public didRegistry;

    struct Credential {
        bytes32 docHash;        // SHA-256 du document
        string cid;             // IPFS CID du payload (document + signature)
        address issuer;
        address holder;
        uint256 issuedAt;
        bool revoked;
        bool verified;          // statut retourné par l’IA / oracle
        uint256 verifiedAt;
    }

    mapping(bytes32 => Credential) public credentials; // docHash => Credential
    bytes32[] public allCredentialHashes;

    event CredentialIssued(bytes32 indexed docHash, string cid, address issuer, address holder);
    event CredentialRevoked(bytes32 indexed docHash);
    event CredentialVerified(bytes32 indexed docHash, bool verified, uint256 timestamp);

    function initialize(address _didRegistry) public initializer {
        __AccessControl_init();
        didRegistry = DIDRegistry(_didRegistry);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyIssuer() {
        require(didRegistry.isIssuer(msg.sender), "Not an issuer");
        _;
    }

    function issueCredential(
        bytes32 _docHash,
        string memory _cid,
        address _holder
    ) external onlyIssuer {
        require(credentials[_docHash].issuer == address(0), "Credential already exists");
        credentials[_docHash] = Credential({
            docHash: _docHash,
            cid: _cid,
            issuer: msg.sender,
            holder: _holder,
            issuedAt: block.timestamp,
            revoked: false,
            verified: false,
            verifiedAt: 0
        });
        allCredentialHashes.push(_docHash);
        emit CredentialIssued(_docHash, _cid, msg.sender, _holder);
    }

    function revokeCredential(bytes32 _docHash) external {
        require(msg.sender == credentials[_docHash].issuer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        require(!credentials[_docHash].revoked, "Already revoked");
        credentials[_docHash].revoked = true;
        emit CredentialRevoked(_docHash);
    }

    function setVerificationStatus(bytes32 _docHash, bool _verified) external onlyRole(DEFAULT_ADMIN_ROLE) {
        credentials[_docHash].verified = _verified;
        credentials[_docHash].verifiedAt = block.timestamp;
        emit CredentialVerified(_docHash, _verified, block.timestamp);
    }

    function getCredential(bytes32 _docHash) external view returns (Credential memory) {
        return credentials[_docHash];
    }
}
