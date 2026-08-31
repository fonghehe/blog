---
title: "Polygon Layer2 DApp Deployment and Frontend Adaptation"
date: 2021-06-15 10:05:24
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 8
description: "From contract deployment to frontend network switching, a complete guide to Polygon Layer2 DApp adaptation"
wordCount: 557
---

## Polygon Network Overview

Polygon (formerly Matic Network) is a multi-chain scaling framework that evolved from a Plasma sidechain solution. For DApp developers, the most practical option is the Polygon PoS sidechain—an independent blockchain compatible with Ethereum EVM, anchored to the Ethereum mainnet through a PoS checkpoint mechanism.

Key features of Polygon PoS:

- **EVM compatibility**: Solidity contracts can be deployed without modification; the Ethereum development toolchain is directly usable
- **Low Gas fees**: Transaction costs are approximately 1/100th of mainnet; a swap transaction typically costs less than 1 cent in Gas
- **Fast confirmation**: Block time is approximately 2 seconds, with near-instant transaction confirmation
- **Bridging mechanism**: Cross-chain transfers of ETH and ERC-20 tokens via the official PoS bridge

### PoS Sidechain vs Plasma

Polygon supports both Plasma and PoS security models. Plasma uses fraud proofs for security but only supports specific token types (ETH and ERC-20), with a withdrawal period of up to 7 days. The PoS sidechain ensures consensus through validator staking, supports all EVM operations, and asset cross-chain transfers are completed through the official bridge, with a withdrawal period of approximately 7-30 minutes. For the vast majority of DApps, the PoS sidechain is the correct choice.

## Deploying Contracts to Polygon

### Hardhat Configuration

```javascript
// hardhat.config.js
require('@nomiclabs/hardhat-ethers');
require('@nomiclabs/hardhat-etherscan');

const POLYGON_PRIVATE_KEY = process.env.POLYGON_PRIVATE_KEY;
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;

module.exports = {
  solidity: {
    version: '0.8.6',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    // Polygon mainnet
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 137,
      gasPrice: 30000000000, // 30 Gwei
    },
    // Polygon Mumbai testnet
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 80001,
      gasPrice: 1000000000, // 1 Gwei
    },
    // Local development
    hardhat: {
      chainId: 31337,
    },
  },
  etherscan: {
    apiKey: {
      polygon: POLYGONSCAN_API_KEY,
      polygonMumbai: POLYGONSCAN_API_KEY,
    },
  },
};
```

### Deployment Script

```javascript
// scripts/deploy.js
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await deployer.getBalance();
  console.log('Account balance:', ethers.utils.formatEther(balance), 'MATIC');

  // Deploy contract
  const MyContract = await ethers.getContractFactory('MyContract');
  const contract = await MyContract.deploy();
  await contract.deployed();

  console.log('Contract deployed to:', contract.address);
  console.log('Transaction hash:', contract.deployTransaction.hash);

  // Wait for several block confirmations
  console.log('Waiting for confirmations...');
  await contract.deployTransaction.wait(5);
  console.log('Confirmed!');

  // Verify contract
  if (network.name !== 'hardhat') {
    console.log('Verifying contract...');
    await run('verify:verify', {
      address: contract.address,
      constructorArguments: [],
    });
    console.log('Verified!');
  }

  // Save deployment information
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    contractAddress: contract.address,
    deployer: deployer.address,
    txHash: contract.deployTransaction.hash,
    blockNumber: contract.deployTransaction.blockNumber,
    timestamp: new Date().toISOString(),
  };

  const fs = require('fs');
  const dir = `deployments/${network.name}`;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    `${dir}/MyContract.json`,
    JSON.stringify(deploymentInfo, null, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Deployment Commands

```bash
# Deploy to Mumbai testnet
npx hardhat run scripts/deploy.js --network mumbai

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.js --network polygon

# Verify contract
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

## RPC Endpoint Configuration and Chain ID

Key parameters for the Polygon network:

| Network | Chain ID | RPC Endpoint | Block Explorer |
|---|---|---|---|
| Polygon Mainnet | 137 | https://polygon-rpc.com | https://polygonscan.com |
| Mumbai Testnet | 80001 | https://rpc-mumbai.maticvigil.com | https://mumbai.polygonscan.com |

Recommended RPC endpoints:

```javascript
const POLYGON_RPC_CONFIG = {
  // Public RPC (free, but may have rate limits)
  public: [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.network',
    'https://rpc-mainnet.maticvigil.com',
  ],
  // Infura (requires API Key)
  infura: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
  // Alchemy (requires API Key)
  alchemy: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};

// RPC failover
class PolygonProvider {
  constructor() {
    this.rpcUrls = [
      POLYGON_RPC_CONFIG.alchemy,
      POLYGON_RPC_CONFIG.infura,
      ...POLYGON_RPC_CONFIG.public,
    ];
    this.currentIndex = 0;
    this.provider = null;
  }

  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.StaticJsonRpcProvider(
        this.rpcUrls[this.currentIndex],
        { chainId: 137, name: 'polygon' }
      );
    }
    return this.provider;
  }

  // Failover
  async withFallback(operation) {
    let lastError;
    for (let i = 0; i < this.rpcUrls.length; i++) {
      try {
        const index = (this.currentIndex + i) % this.rpcUrls.length;
        const provider = new ethers.providers.StaticJsonRpcProvider(
          this.rpcUrls[index],
          { chainId: 137, name: 'polygon' }
        );
        const result = await operation(provider);
        this.currentIndex = index; // Record the successful RPC
        this.provider = provider;
        return result;
      } catch (err) {
        lastError = err;
        console.warn(`RPC ${this.rpcUrls[i]} failed:`, err.message);
      }
    }
    throw lastError;
  }
}
```

## Frontend Network Switching

### Adding the Polygon Network to MetaMask

```javascript
const POLYGON_NETWORK_PARAMS = {
  chainId: '0x89', // 137 in hex
  chainName: 'Polygon Mainnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: ['https://polygon-rpc.com'],
  blockExplorerUrls: ['https://polygonscan.com'],
};

const MUMBAI_NETWORK_PARAMS = {
  chainId: '0x13881', // 80001 in hex
  chainName: 'Mumbai Testnet',
  nativeCurrency: {
    name: 'MATIC',
    symbol: 'MATIC',
    decimals: 18,
  },
  rpcUrls: ['https://rpc-mumbai.maticvigil.com'],
  blockExplorerUrls: ['https://mumbai.polygonscan.com'],
};

class NetworkManager {
  constructor() {
    this.ethereum = window.ethereum;
  }

  // Get current network
  async getCurrentChainId() {
    const chainIdHex = await this.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  }

  // Check if on Polygon network
  async isOnPolygon() {
    const chainId = await this.getCurrentChainId();
    return chainId === 137;
  }

  // Switch to Polygon network
  async switchToPolygon() {
    const currentChainId = await this.getCurrentChainId();

    if (currentChainId === 137) return; // Already on Polygon

    try {
      // Try switching (if the user has already added the Polygon network)
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    } catch (switchError) {
      // Error code 4902 means the network is not added
      if (switchError.code === 4902) {
        await this.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [POLYGON_NETWORK_PARAMS],
        });
      } else {
        throw switchError;
      }
    }
  }

  // Listen for network changes
  onChainChanged(callback) {
    this.ethereum.on('chainChanged', (chainIdHex) => {
      callback(parseInt(chainIdHex, 16));
    });
  }
}
```

### Network Switching UI Component

```jsx
import React, { useState, useEffect } from 'react';

function NetworkSwitcher({ onNetworkChange }) {
  const [currentChainId, setCurrentChainId] = useState(null);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState(null);

  const networkManager = new NetworkManager();

  useEffect(() => {
    networkManager.getCurrentChainId().then(setCurrentChainId);
    networkManager.onChainChanged((chainId) => {
      setCurrentChainId(chainId);
      onNetworkChange?.(chainId);
    });
  }, []);

  const handleSwitch = async () => {
    setSwitching(true);
    setError(null);
    try {
      await networkManager.switchToPolygon();
    } catch (err) {
      setError(err.message);
    } finally {
      setSwitching(false);
    }
  };

  const isOnPolygon = currentChainId === 137;

  return (
    <div className="network-switcher">
      {isOnPolygon ? (
        <span className="network-badge network-badge--polygon">
          Polygon Mainnet
        </span>
      ) : (
        <div>
          <p className="network-warning">
            Current network is not supported. Please switch to Polygon
          </p>
          <button onClick={handleSwitch} disabled={switching}>
            {switching ? 'Switching...' : 'Switch to Polygon'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

## Cross-Chain Bridge Interaction

### ETH -> Polygon Asset Transfer

Polygon's official PoS bridge supports cross-chain transfers of ETH and ERC-20 tokens. Deposits (L1 -> L2) are typically completed within 7-30 minutes, while withdrawals (L2 -> L1) require approximately 7-30 minutes (including checkpoint confirmation).

```javascript
const ROOT_CHAIN_MANAGER = '0xA0c68C638235ee32657e8f720a23ceC1aFc1dC4C';
const ERC20_PREDICATE = '0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf';

const ROOT_CHAIN_ABI = [
  'function depositEtherFor(address user) payable',
  'function depositFor(address user, address rootToken, bytes data) payable',
];

const ERC20_PREDICATE_ABI = [
  'function lockTokens(address depositor, address rootToken, uint256 amount) returns (uint256)',
];

// Deposit: Transfer from Ethereum to Polygon
async function depositETHToPolygon(provider, amount) {
  const signer = provider.getSigner();
  const rootChain = new ethers.Contract(ROOT_CHAIN_MANAGER, ROOT_CHAIN_ABI, signer);
  const userAddress = await signer.getAddress();

  const tx = await rootChain.depositEtherFor(userAddress, {
    value: ethers.utils.parseEther(amount),
  });

  const receipt = await tx.wait();
  return {
    txHash: receipt.transactionHash,
    estimatedTime: '7-30 minutes',
  };
}

// ERC-20 deposit to Polygon
async function depositERC20ToPolygon(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const userAddress = await signer.getAddress();

  // 1. First authorize the Predicate contract on Ethereum
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await token.allowance(userAddress, ERC20_PREDICATE);
  const rawAmount = ethers.utils.parseUnits(amount, await token.decimals());

  if (allowance.lt(rawAmount)) {
    const approveTx = await token.approve(ERC20_PREDICATE, rawAmount);
    await approveTx.wait();
  }

  // 2. Call depositFor
  const rootChain = new ethers.Contract(ROOT_CHAIN_MANAGER, ROOT_CHAIN_ABI, signer);
  const data = ethers.utils.defaultAbiCoder.encode(['uint256'], [rawAmount]);

  const tx = await rootChain.depositFor(userAddress, tokenAddress, data);
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    estimatedTime: '7-30 minutes',
  };
}
```

### Bridge Status Tracking

```javascript
class BridgeTracker {
  constructor(l1Provider, l2Provider) {
    this.l1Provider = l1Provider;
    this.l2Provider = l2Provider;
  }

  // Check deposit status
  async checkDepositStatus(l1TxHash) {
    const receipt = await this.l1Provider.getTransactionReceipt(l1TxHash);
    if (!receipt) return { status: 'pending' };

    // Wait for Polygon checkpoint (approximately 7-30 minutes)
    const l2BlockNumber = await this.l2Provider.getBlockNumber();

    // Query StateSync events on Polygon
    const stateSenderAddress = '0x28e4F3a7f651294B9563200b5D633605D1ce4a29';
    const stateSenderAbi = [
      'event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data)',
    ];

    const stateSync = new ethers.Contract(stateSenderAddress, stateSenderAbi, this.l2Provider);

    // Simplified status check: wait for the corresponding StateSynced event on L2
    return {
      status: 'confirmed',
      l1Block: receipt.blockNumber,
      l2Block: l2BlockNumber,
    };
  }

  // Withdrawal status tracking (more complex, requires burn + confirm + exit)
  async checkWithdrawStatus(l2BurnTxHash) {
    const l2Receipt = await this.l2Provider.getTransactionReceipt(l2BurnTxHash);
    if (!l2Receipt) return { status: 'pending_burn' };

    // Withdrawal flow:
    // 1. Burn tokens on Polygon (completed)
    // 2. Wait for checkpoint confirmation (approximately 7-30 minutes)
    // 3. Call exit on Ethereum to complete the withdrawal

    return {
      status: 'burnt',
      nextStep: 'Waiting for checkpoint confirmation',
      estimatedTime: '7-30 minutes',
    };
  }
}
```

## Gas Fee Comparison

```javascript
// Gas fee comparison tool
class GasComparator {
  constructor() {
    this.gasEstimates = {};
  }

  async compareGasCost(l1Provider, l2Provider, gasLimit) {
    const [l1GasPrice, l2GasPrice, l1EthPrice, l2MaticPrice] = await Promise.all([
      l1Provider.getGasPrice(),
      l2Provider.getGasPrice(),
      this.getTokenPrice('ethereum'),
      this.getTokenPrice('matic-network'),
    ]);

    const l1CostWei = l1GasPrice.mul(gasLimit);
    const l2CostWei = l2GasPrice.mul(gasLimit);

    const l1CostUsd = parseFloat(ethers.utils.formatEther(l1CostWei)) * l1EthPrice;
    const l2CostUsd = parseFloat(ethers.utils.formatEther(l2CostWei)) * l2MaticPrice;

    return {
      l1: {
        gasPrice: ethers.utils.formatUnits(l1GasPrice, 'gwei') + ' Gwei',
        costEth: ethers.utils.formatEther(l1CostWei),
        costUsd: l1CostUsd.toFixed(4),
      },
      l2: {
        gasPrice: ethers.utils.formatUnits(l2GasPrice, 'gwei') + ' Gwei',
        costMatic: ethers.utils.formatEther(l2CostWei),
        costUsd: l2CostUsd.toFixed(4),
      },
      savings: ((1 - l2CostUsd / l1CostUsd) * 100).toFixed(2) + '%',
    };
  }

  async getTokenPrice(coinId) {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    const data = await response.json();
    return data[coinId].usd;
  }
}
```

Typical transaction Gas fee comparison:

| Operation | Ethereum | Polygon | Savings |
|---|---|---|---|
| ERC-20 transfer | $3-15 | $0.0001 | ~99% |
| Uniswap Swap | $30-100 | $0.01 | ~99% |
| Add liquidity | $50-200 | $0.02 | ~99% |
| Contract deployment | $500-2000 | $0.5-2 | ~99% |

## Migration Steps for Existing Ethereum DApps

### 1. Contract Migration

```javascript
// Cross-chain deployment configuration
module.exports = {
  networks: {
    ethereum: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      chainId: 1,
    },
    polygon: {
      url: 'https://polygon-rpc.com',
      chainId: 137,
    },
  },
};

// Deployment script: deploy to both chains simultaneously
async function deployToBothChains() {
  const networks = ['ethereum', 'polygon'];
  const deployments = {};

  for (const networkName of networks) {
    console.log(`Deploying to ${networkName}...`);
    const network = config.networks[networkName];
    const provider = new ethers.providers.JsonRpcProvider(network.url);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy();
    await contract.deployed();

    deployments[networkName] = {
      address: contract.address,
      chainId: network.chainId,
    };

    console.log(`${networkName}: ${contract.address}`);
  }

  // Note: Contract addresses are usually different across chains!
  return deployments;
}
```

### 2. Frontend Multi-Chain Configuration

```javascript
const CONTRACT_ADDRESSES = {
  1: { // Ethereum Mainnet
    MyContract: '0x1234...abcd',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  },
  137: { // Polygon
    MyContract: '0x5678...efgh',
    USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  },
};

const RPC_URLS = {
  1: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  137: 'https://polygon-rpc.com',
};

const EXPLORER_URLS = {
  1: 'https://etherscan.io',
  137: 'https://polygonscan.com',
};

class MultiChainConfig {
  constructor(chainId) {
    this.chainId = chainId;
    this.contracts = CONTRACT_ADDRESSES[chainId];
    this.rpcUrl = RPC_URLS[chainId];
    this.explorerUrl = EXPLORER_URLS[chainId];
  }

  getContractAddress(name) {
    const addr = this.contracts?.[name];
    if (!addr) {
      throw new Error(`Contract ${name} is not configured on chainId=${this.chainId}`);
    }
    return addr;
  }

  getProvider() {
    return new ethers.providers.JsonRpcProvider(this.rpcUrl);
  }

  getExplorerUrl(txHash) {
    return `${this.explorerUrl}/tx/${txHash}`;
  }
}
```

### 3. Contract Address Consistency

Note: Contracts deployed using CREATE typically have different addresses across chains (because the deployer's nonce differs). If you need consistent addresses, use CREATE2:

```javascript
// Use CREATE2 to ensure cross-chain address consistency
async function deployWithCreate2(factory, salt, bytecode, constructorArgs) {
  // CREATE2: address = keccak256(0xff, factory, salt, keccak256(bytecode))
  const expectedAddress = ethers.utils.getCreate2Address(
    factory.address,
    salt,
    ethers.utils.keccak256(bytecode)
  );

  // Deploy on each chain with the same salt and factory
  const tx = await factory.deploy(salt, bytecode, constructorArgs);
  await tx.wait();

  return expectedAddress;
}
```

## Common Issues

### Indexing Services

The Graph indexing service on Polygon differs slightly from Ethereum. You need to specify the Polygon network configuration in `subgraph.yaml`:

```yaml
# subgraph.yaml (Polygon)
network: matic
```

You also need to use Polygon contract addresses as data sources.

### Event Parsing Differences

Polygon's block time is approximately 2 seconds, so the `fromBlock` and `toBlock` parameters for event filtering need to be adapted for faster block speeds. When querying historical events, it's recommended to use block numbers rather than `'latest'`.

## Summary

As a Layer2 scaling solution, Polygon's EVM compatibility makes the migration cost for Ethereum DApps extremely low—the main effort is focused on network configuration, contract address mapping, and frontend network switching. From a user experience perspective, Polygon virtually eliminates the two biggest pain points of Gas fees and confirmation times, bringing on-chain interaction experiences close to traditional web applications.

However, Polygon is fundamentally a sidechain rather than a true Layer2—it does not inherit the security of Ethereum L1, but relies instead on its own PoS consensus. For high-value asset scenarios, this security assumption requires careful evaluation. In actual projects, it's recommended to support both Ethereum mainnet and Polygon, letting users choose the appropriate network based on their needs.
