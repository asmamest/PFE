// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./CredentialStore.sol";

contract VerificationOracle is Initializable, AccessControlUpgradeable {
    CredentialStore public credentialStore;

    struct Request {
        address requester;
        bytes32 docHash;
        uint256 requestedAt;
        bool resolved;
        bool isValid;
        string proofCID;      // IPFS CID du résultat (AI + heatmap + signature)
        address resolver;
        uint256 resolvedAt;
    }

    mapping(uint256 => Request) public requests;
    mapping(bytes32 => uint256[]) public credentialRequests;
    uint256 public totalRequests;

    address public oracle;
    address public pendingOracle;

    event VerificationRequested(uint256 indexed requestId, bytes32 indexed docHash, address indexed requester, uint256 timestamp);
    event VerificationResolved(uint256 indexed requestId, bytes32 indexed docHash, bool isValid, string proofCID, address resolver, uint256 timestamp);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers(); // pour upgradeable
    }

    function initialize(address _credentialStore, address _oracle) public initializer {
        __AccessControl_init();
        require(_credentialStore != address(0), "Invalid CredentialStore");
        require(_oracle != address(0), "Oracle address required");
        credentialStore = CredentialStore(_credentialStore);
        oracle = _oracle;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Only oracle can call");
        _;
    }

    function requestVerification(bytes32 _docHash) external returns (uint256) {
        require(_docHash != bytes32(0), "Invalid docHash");
        uint256 requestId = totalRequests;
        requests[requestId] = Request({
            requester: msg.sender,
            docHash: _docHash,
            requestedAt: block.timestamp,
            resolved: false,
            isValid: false,
            proofCID: "",
            resolver: address(0),
            resolvedAt: 0
        });
        credentialRequests[_docHash].push(requestId);
        totalRequests++;
        emit VerificationRequested(requestId, _docHash, msg.sender, block.timestamp);
        return requestId;
    }

    function submitVerificationResult(
        uint256 _requestId,
        bool _isValid,
        string memory _proofCID
    ) external onlyOracle {
        require(_requestId < totalRequests, "Request does not exist");
        require(!requests[_requestId].resolved, "Already resolved");
        Request storage req = requests[_requestId];
        req.resolved = true;
        req.isValid = _isValid;
        req.proofCID = _proofCID;
        req.resolver = msg.sender;
        req.resolvedAt = block.timestamp;

        // Mise à jour du statut dans CredentialStore
        credentialStore.setVerificationStatus(req.docHash, _isValid);

        emit VerificationResolved(_requestId, req.docHash, _isValid, _proofCID, msg.sender, block.timestamp);
    }

    function getVerificationStatus(uint256 _requestId) external view returns (bool resolved, bool isValid, uint256 requestedAt, uint256 resolvedAt, string memory proofCID) {
        Request storage req = requests[_requestId];
        return (req.resolved, req.isValid, req.requestedAt, req.resolvedAt, req.proofCID);
    }

    function getCredentialVerifications(bytes32 _docHash) external view returns (uint256[] memory) {
        return credentialRequests[_docHash];
    }

    // --- Gestion du changement d'oracle ---
    function proposeNewOracle(address _newOracle) external onlyOracle {
        require(_newOracle != address(0), "Invalid address");
        pendingOracle = _newOracle;
    }

    function acceptOracle() external {
        require(msg.sender == pendingOracle, "Only pending oracle can accept");
        emit OracleUpdated(oracle, pendingOracle);
        oracle = pendingOracle;
        pendingOracle = address(0);
    }
}