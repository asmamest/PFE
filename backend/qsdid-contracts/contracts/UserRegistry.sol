// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract UserRegistry {
    // Rôles (bitmask)
    uint256 public constant ROLE_ISSUER = 1 << 0;  // 1
    uint256 public constant ROLE_HOLDER = 1 << 1; // 2
    uint256 public constant ROLE_VERIFIER = 1 << 2; // 4

    struct User {
        bytes mldsaPublicKey;    // ML-DSA-65 public key (obligatoire pour issuer, optionnel pour holder/verifier)
        bytes mlkemPublicKey;    // optionnel, pour chiffrement
        string metadataCID;      // CID IPFS du DID / profil
        uint256 roles;           // combinaison de ROLE_*
        bool active;
        uint256 registeredAt;
        uint256 updatedAt;
    }

    mapping(address => User) public users;
    address[] public userList;

    event UserRegistered(address indexed user, uint256 roles, uint256 timestamp);
    event UserUpdated(address indexed user, uint256 roles, uint256 timestamp);
    event UserRevoked(address indexed user, uint256 timestamp);

    modifier onlyActiveUser(address _user) {
        require(users[_user].active, "User not active");
        _;
    }

    modifier onlySelfOrAdmin(address _user) {
        require(msg.sender == _user || msg.sender == address(this), "Not authorized");
        _;
    }

    function registerUser(
        bytes calldata _mldsaPublicKey,
        bytes calldata _mlkemPublicKey,
        string calldata _metadataCID,
        uint256 _roles
    ) external {
        require(!users[msg.sender].active, "User already active");
        require(_roles != 0, "At least one role required");
        // Si le rôle émetteur est demandé, la clé ML-DSA est obligatoire
        if ((_roles & ROLE_ISSUER) != 0) {
            require(_mldsaPublicKey.length > 0, "ML-DSA key required for issuer");
        }

        users[msg.sender] = User({
            mldsaPublicKey: _mldsaPublicKey,
            mlkemPublicKey: _mlkemPublicKey,
            metadataCID: _metadataCID,
            roles: _roles,
            active: true,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp
        });
        userList.push(msg.sender);
        emit UserRegistered(msg.sender, _roles, block.timestamp);
    }

    function updateUser(
        bytes calldata _mldsaPublicKey,
        bytes calldata _mlkemPublicKey,
        string calldata _metadataCID,
        uint256 _roles
    ) external onlyActiveUser(msg.sender) {
        require(_roles != 0, "At least one role required");
        if ((_roles & ROLE_ISSUER) != 0) {
            require(_mldsaPublicKey.length > 0, "ML-DSA key required for issuer");
        }
        User storage u = users[msg.sender];
        if (_mldsaPublicKey.length > 0) u.mldsaPublicKey = _mldsaPublicKey;
        if (_mlkemPublicKey.length > 0) u.mlkemPublicKey = _mlkemPublicKey;
        if (bytes(_metadataCID).length > 0) u.metadataCID = _metadataCID;
        u.roles = _roles;
        u.updatedAt = block.timestamp;
        emit UserUpdated(msg.sender, _roles, block.timestamp);
    }

    function revokeUser(address _user) external onlySelfOrAdmin(_user) {
        require(users[_user].active, "User already revoked");
        users[_user].active = false;
        users[_user].updatedAt = block.timestamp;
        emit UserRevoked(_user, block.timestamp);
    }

    function isIssuer(address _user) external view returns (bool) {
        return users[_user].active && ((users[_user].roles & ROLE_ISSUER) != 0);
    }

    function isHolder(address _user) external view returns (bool) {
        return users[_user].active && ((users[_user].roles & ROLE_HOLDER) != 0);
    }

    function isVerifier(address _user) external view returns (bool) {
        return users[_user].active && ((users[_user].roles & ROLE_VERIFIER) != 0);
    }

    function getUser(address _user) external view returns (User memory) {
        return users[_user];
    }

    function getAllUsers() external view returns (address[] memory) {
        return userList;
    }
}
