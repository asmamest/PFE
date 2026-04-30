const { Provider } = require("zksync-ethers");
const provider = new Provider("https://sepolia.era.zksync.dev");
provider.getBlockNumber().then(console.log).catch(console.error);
