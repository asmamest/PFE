// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract DIDRegistry is Initializable, AccessControlUpgradeable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct DID {
        address owner;
        bytes hybridPublicKey; // ML-DSA-65 + HQC-128 concatenated
        uint256 registeredAt;
        bool active;
    }

    mapping(address => DID) public dids;
    address[] public allDIDs;

    event DIDRegistered(address indexed owner, bytes hybridPublicKey, uint256 timestamp);
    event DIDDeactivated(address indexed owner);

    function initialize() public initializer {
        __AccessControl_init();
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function registerDID(bytes memory _hybridPublicKey) external {
        require(!dids[msg.sender].active, "DID already active");
        dids[msg.sender] = DID(msg.sender, _hybridPublicKey, block.timestamp, true);
        allDIDs.push(msg.sender);
        emit DIDRegistered(msg.sender, _hybridPublicKey, block.timestamp);
    }

    function deactivateDID() external {
        require(dids[msg.sender].active, "DID not active");
        dids[msg.sender].active = false;
        emit DIDDeactivated(msg.sender);
    }

    function grantIssuerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(ISSUER_ROLE, account);
    }

    function isIssuer(address account) public view returns (bool) {
        return hasRole(ISSUER_ROLE, account) && dids[account].active;
    }
}
