require("@matterlabs/hardhat-zksync-deploy");
require("@matterlabs/hardhat-zksync-solc");
require("@matterlabs/hardhat-zksync-verify");
require("dotenv").config();

module.exports = {
  zksolc: {
    version: "1.4.0",
    compilerSource: "binary",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Réseau local Hardhat (sans zkSync)
    hardhat: {
      zksync: false,
    },
    // Réseau local zkSync (pour tests)
    zkSyncLocal: {
      url: "http://127.0.0.1:8545",
      ethNetwork: "http://127.0.0.1:8545",
      zksync: true,
    },
    // ✅ zkSync Sepolia Testnet avec RPC principal + fallbacks
    zkSyncSepolia: {
      url: "https://sepolia.era.zksync.dev", // RPC principal
      ethNetwork: "sepolia",                // Réseau L1 associé (Sepolia)
      zksync: true,
      verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
      // Optionnel : timeout plus long pour les connexions lentes
      timeout: 60000,
    },
    // Alternative : si le RPC principal ne répond pas, décommente celui-ci et commente le précédent
    // zkSyncSepolia: {
    //   url: "https://zksync-sepolia.blockpi.network/v1/rpc/public",
    //   ethNetwork: "sepolia",
    //   zksync: true,
    //   verifyURL: "https://explorer.sepolia.era.zksync.dev/contract_verification",
    // },
  },
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
};