// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title ZKPresentation
 * @notice Gère les preuves à divulgation nulle (Zero-Knowledge) pour les Presentation Credentials.
 * @dev Supporte la vérification on-chain via un verifier configurable (ex: Groth16, Plonk).
 *      Les preuves sont stockées off-chain, seul leur hash est conservé on-chain.
 */
contract ZKPresentation is Initializable, AccessControlUpgradeable {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    
    // Guard anti-reentrance maison (compatible upgradeable)
    uint256 private _reentrancyStatus;

    /// @notice Structure d'une présentation ZK
    struct Presentation {
        bytes32 presentationId;   // Identifiant unique de la présentation
        bytes32 credentialHash;   // Hash du credential concerné (docHash)
        address prover;           // Personne qui prouve (holder)
        address verifier;         // Entité qui vérifie (peut être un oracle ou contrat)
        bytes32 publicInputsHash; // Hash des inputs publics (ex: age>18, pays, etc.)
        bytes32 proofHash;        // Hash de la preuve ZK (stockée off-chain)
        uint256 timestamp;
        bool verified;
        bool revoked;
        string metadataCID;       // CID IPFS contenant les détails de la preuve (optionnel)
    }

    mapping(bytes32 => Presentation) public presentations;
    mapping(bytes32 => bytes32[]) public credentialPresentations; // credentialHash -> liste presentationIds
    mapping(address => bytes32[]) public proverPresentations;      // prover -> liste presentationIds

    bytes32[] public allPresentationIds;

    address public zkVerifier;    // Adresse du contrat verifier (ex: Groth16Verifier)

    event PresentationCreated(
        bytes32 indexed presentationId,
        bytes32 indexed credentialHash,
        address indexed prover,
        bytes32 publicInputsHash,
        string metadataCID,
        uint256 timestamp
    );

    event PresentationVerified(
        bytes32 indexed presentationId,
        bytes32 indexed credentialHash,
        bool success,
        address verifier,
        uint256 timestamp
    );

    event PresentationRevoked(
        bytes32 indexed presentationId,
        address revoker,
        uint256 timestamp
    );

    event ZKVerifierUpdated(address indexed oldVerifier, address indexed newVerifier);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _zkVerifier) public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Initialiser le guard anti-reentrance
        _reentrancyStatus = 1;
        
        if (_zkVerifier != address(0)) {
            zkVerifier = _zkVerifier;
            _grantRole(VERIFIER_ROLE, _zkVerifier);
        }
    }

    // Modifier anti-reentrance maison
    modifier nonReentrant() {
        require(_reentrancyStatus != 2, "ReentrancyGuard: reentrant call");
        _reentrancyStatus = 2;
        _;
        _reentrancyStatus = 1;
    }

    modifier onlyVerifier() {
        require(hasRole(VERIFIER_ROLE, msg.sender), "Caller is not a verifier");
        _;
    }

    /**
     * @notice Crée une nouvelle présentation (sans vérification immédiate)
     * @param _credentialHash Hash du credential concerné
     * @param _publicInputsHash Hash des inputs publics (pour lier la preuve)
     * @param _metadataCID CID IPFS contenant les détails de la preuve (optionnel)
     * @return presentationId Identifiant unique généré
     */
    function createPresentation(
        bytes32 _credentialHash,
        bytes32 _publicInputsHash,
        string memory _metadataCID
    ) external nonReentrant returns (bytes32) {
        require(_credentialHash != bytes32(0), "Invalid credential hash");

        bytes32 presentationId = keccak256(abi.encodePacked(
            _credentialHash,
            msg.sender,
            _publicInputsHash,
            block.timestamp,
            block.prevrandao
        ));

        require(presentations[presentationId].timestamp == 0, "Presentation already exists");

        presentations[presentationId] = Presentation({
            presentationId: presentationId,
            credentialHash: _credentialHash,
            prover: msg.sender,
            verifier: address(0),
            publicInputsHash: _publicInputsHash,
            proofHash: bytes32(0),
            timestamp: block.timestamp,
            verified: false,
            revoked: false,
            metadataCID: _metadataCID
        });

        credentialPresentations[_credentialHash].push(presentationId);
        proverPresentations[msg.sender].push(presentationId);
        allPresentationIds.push(presentationId);

        emit PresentationCreated(
            presentationId,
            _credentialHash,
            msg.sender,
            _publicInputsHash,
            _metadataCID,
            block.timestamp
        );

        return presentationId;
    }

    /**
     * @notice Soumet une preuve ZK pour une présentation (vérification on-chain)
     * @param _presentationId Identifiant de la présentation
     * @param _proof Données de la preuve (format dépendant du verifier)
     * @param _publicInputs Inputs publics pour la vérification
     * @return success Vrai si la preuve est valide
     */
    function submitProofAndVerify(
        bytes32 _presentationId,
        bytes calldata _proof,
        uint256[] calldata _publicInputs
    ) external nonReentrant returns (bool) {
        Presentation storage pres = presentations[_presentationId];
        require(pres.timestamp != 0, "Presentation does not exist");
        require(!pres.verified, "Already verified");
        require(!pres.revoked, "Presentation revoked");
        require(msg.sender == pres.prover, "Only prover can submit proof");

        // Vérifier que les inputs publics correspondent au hash stocké
        bytes32 computedHash = keccak256(abi.encodePacked(_publicInputs));
        require(computedHash == pres.publicInputsHash, "Public inputs mismatch");

        // Vérification on-chain via le verifier configuré
        bool isValid = _verifyProof(_proof, _publicInputs);

        if (isValid) {
            pres.verified = true;
            pres.verifier = address(this);
            pres.proofHash = keccak256(_proof);
        }

        emit PresentationVerified(
            _presentationId,
            pres.credentialHash,
            isValid,
            msg.sender,
            block.timestamp
        );

        return isValid;
    }

    /**
     * @notice Vérification interne (appelle le contrat verifier ou une precompile)
     * @dev À adapter selon le système ZK utilisé (Groth16, Plonk, etc.)
     */
    function _verifyProof(bytes calldata _proof, uint256[] calldata _publicInputs) internal view returns (bool) {
        require(zkVerifier != address(0), "ZK verifier not set");
        
        (bool success, bytes memory result) = zkVerifier.staticcall(
            abi.encodeWithSignature("verifyProof(bytes,uint256[])", _proof, _publicInputs)
        );
        require(success, "Verifier call failed");
        return abi.decode(result, (bool));
    }

    /**
     * @notice Vérification par un oracle (sans preuve on-chain)
     * @dev Utile si la vérification est trop coûteuse ou si le verifier n'est pas déployé
     */
    function verifyByOracle(
        bytes32 _presentationId,
        bool _isValid,
        bytes32 _proofHash,
        string memory _proofCID
    ) external onlyVerifier {
        Presentation storage pres = presentations[_presentationId];
        require(pres.timestamp != 0, "Presentation does not exist");
        require(!pres.verified, "Already verified");
        require(!pres.revoked, "Presentation revoked");

        pres.verified = _isValid;
        pres.verifier = msg.sender;
        pres.proofHash = _proofHash;
        pres.metadataCID = _proofCID;

        emit PresentationVerified(
            _presentationId,
            pres.credentialHash,
            _isValid,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Révoque une présentation (par le prover ou admin)
     */
    function revokePresentation(bytes32 _presentationId) external {
        Presentation storage pres = presentations[_presentationId];
        require(pres.timestamp != 0, "Presentation does not exist");
        require(!pres.revoked, "Already revoked");
        require(msg.sender == pres.prover || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");

        pres.revoked = true;
        emit PresentationRevoked(_presentationId, msg.sender, block.timestamp);
    }

    /**
     * @notice Met à jour l'adresse du verifier ZK
     */
    function setZKVerifier(address _newVerifier) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newVerifier != address(0), "Invalid address");
        address old = zkVerifier;
        if (old != address(0)) {
            revokeRole(VERIFIER_ROLE, old);
        }
        zkVerifier = _newVerifier;
        grantRole(VERIFIER_ROLE, _newVerifier);
        emit ZKVerifierUpdated(old, _newVerifier);
    }

    /**
     * @notice Récupère les détails d'une présentation
     */
    function getPresentation(bytes32 _presentationId) external view returns (Presentation memory) {
        return presentations[_presentationId];
    }

    /**
     * @notice Liste les presentations d'un credential
     */
    function getCredentialPresentations(bytes32 _credentialHash) external view returns (bytes32[] memory) {
        return credentialPresentations[_credentialHash];
    }

    /**
     * @notice Liste les presentations d'un prover
     */
    function getProverPresentations(address _prover) external view returns (bytes32[] memory) {
        return proverPresentations[_prover];
    }
}