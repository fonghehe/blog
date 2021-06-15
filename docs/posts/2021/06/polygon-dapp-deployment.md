---
title: "Polygon Layer2 DApp 部署与前端适配"
date: 2021-06-15 10:05:24
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 14
description: "从合约部署到前端网络切换，完整解析 Polygon Layer2 的 DApp 适配流程"
wordCount: 3800
---

## Polygon 网络概述

Polygon（原名 Matic Network）在 2021 年初完成了品牌升级，从一个 Plasma 侧链方案演进为多链扩展框架。对于 DApp 开发者而言，当前最实用的是 Polygon PoS 侧链——一条与以太坊 EVM 兼容的独立区块链，通过 PoS 检查点机制与以太坊主网锚定。

Polygon PoS 的核心特点：

- **EVM 兼容**：Solidity 合约无需修改即可部署，以太坊开发工具链直接可用
- **低 Gas 费**：交易成本约为主网的 1/100，一笔 swap 交易 Gas 费通常不到 1 美分
- **快速确认**：区块时间约 2 秒，交易几乎即时确认
- **桥接机制**：通过官方 PoS 桥实现 ETH 和 ERC-20 的跨链转移

### PoS Sidechain vs Plasma

Polygon 同时支持 Plasma 和 PoS 两种安全模型。Plasma 使用欺诈证明确保安全性，但只支持特定类型的代币（ETH 和 ERC-20），且退出周期长达 7 天。PoS 侧链通过验证人质押保证共识，支持所有 EVM 操作，资产跨链通过官方桥完成，退出周期约 7-30 分钟。对于绝大多数 DApp，PoS 侧链是正确的选择。

## 合约部署到 Polygon

### Hardhat 配置

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
    // Polygon 主网
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 137,
      gasPrice: 30000000000, // 30 Gwei
    },
    // Polygon Mumbai 测试网
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 80001,
      gasPrice: 1000000000, // 1 Gwei
    },
    // 本地开发
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

### 部署脚本

```javascript
// scripts/deploy.js
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await deployer.getBalance();
  console.log('Account balance:', ethers.utils.formatEther(balance), 'MATIC');

  // 部署合约
  const MyContract = await ethers.getContractFactory('MyContract');
  const contract = await MyContract.deploy();
  await contract.deployed();

  console.log('Contract deployed to:', contract.address);
  console.log('Transaction hash:', contract.deployTransaction.hash);

  // 等待几个区块确认
  console.log('Waiting for confirmations...');
  await contract.deployTransaction.wait(5);
  console.log('Confirmed!');

  // 验证合约
  if (network.name !== 'hardhat') {
    console.log('Verifying contract...');
    await run('verify:verify', {
      address: contract.address,
      constructorArguments: [],
    });
    console.log('Verified!');
  }

  // 保存部署信息
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

### 部署命令

```bash
# 部署到 Mumbai 测试网
npx hardhat run scripts/deploy.js --network mumbai

# 部署到 Polygon 主网
npx hardhat run scripts/deploy.js --network polygon

# 验证合约
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

## RPC 端点配置与 Chain ID

Polygon 网络的关键参数：

| 网络 | Chain ID | RPC 端点 | 区块浏览器 |
|---|---|---|---|
| Polygon Mainnet | 137 | https://polygon-rpc.com | https://polygonscan.com |
| Mumbai Testnet | 80001 | https://rpc-mumbai.maticvigil.com | https://mumbai.polygonscan.com |

推荐的 RPC 端点选择：

```javascript
const POLYGON_RPC_CONFIG = {
  // 公共 RPC（免费，但可能有速率限制）
  public: [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.network',
    'https://rpc-mainnet.maticvigil.com',
  ],
  // Infura（需要 API Key）
  infura: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`,
  // Alchemy（需要 API Key）
  alchemy: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`,
};

// RPC 故障转移
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

  // 故障转移
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
        this.currentIndex = index; // 记录成功的 RPC
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

## 前端网络切换

### 添加 Polygon 网络到 MetaMask

```javascript
const POLYGON_NETWORK_PARAMS = {
  chainId: '0x89', // 137 的十六进制
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
  chainId: '0x13881', // 80001 的十六进制
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

  // 获取当前网络
  async getCurrentChainId() {
    const chainIdHex = await this.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  }

  // 检查是否在 Polygon 网络
  async isOnPolygon() {
    const chainId = await this.getCurrentChainId();
    return chainId === 137;
  }

  // 切换到 Polygon 网络
  async switchToPolygon() {
    const currentChainId = await this.getCurrentChainId();

    if (currentChainId === 137) return; // 已在 Polygon

    try {
      // 尝试切换（如果用户已添加过 Polygon 网络）
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    } catch (switchError) {
      // 错误码 4902 表示网络未添加
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

  // 监听网络切换
  onChainChanged(callback) {
    this.ethereum.on('chainChanged', (chainIdHex) => {
      callback(parseInt(chainIdHex, 16));
    });
  }
}
```

### 网络切换 UI 组件

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
            当前网络不支持，请切换到 Polygon
          </p>
          <button onClick={handleSwitch} disabled={switching}>
            {switching ? '切换中...' : '切换到 Polygon'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

## 跨链桥交互

### ETH -> Polygon 资产转移

Polygon 官方 PoS 桥支持 ETH 和 ERC-20 的跨链转移。存款（L1 -> L2）通常在 7-30 分钟内完成，提款（L2 -> L1）需要约 7-30 分钟（包含检查点确认）。

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

// 存款：从以太坊转移到 Polygon
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
    estimatedTime: '7-30 分钟',
  };
}

// ERC-20 存款到 Polygon
async function depositERC20ToPolygon(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const userAddress = await signer.getAddress();

  // 1. 先在以太坊上授权 Predicate 合约
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await token.allowance(userAddress, ERC20_PREDICATE);
  const rawAmount = ethers.utils.parseUnits(amount, await token.decimals());

  if (allowance.lt(rawAmount)) {
    const approveTx = await token.approve(ERC20_PREDICATE, rawAmount);
    await approveTx.wait();
  }

  // 2. 调用 depositFor
  const rootChain = new ethers.Contract(ROOT_CHAIN_MANAGER, ROOT_CHAIN_ABI, signer);
  const data = ethers.utils.defaultAbiCoder.encode(['uint256'], [rawAmount]);

  const tx = await rootChain.depositFor(userAddress, tokenAddress, data);
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    estimatedTime: '7-30 分钟',
  };
}
```

### 桥接状态追踪

```javascript
class BridgeTracker {
  constructor(l1Provider, l2Provider) {
    this.l1Provider = l1Provider;
    this.l2Provider = l2Provider;
  }

  // 检查存款状态
  async checkDepositStatus(l1TxHash) {
    const receipt = await this.l1Provider.getTransactionReceipt(l1TxHash);
    if (!receipt) return { status: 'pending' };

    // 等待 Polygon 检查点（约 7-30 分钟）
    const l2BlockNumber = await this.l2Provider.getBlockNumber();

    // 查询 Polygon 上的 StateSync 事件
    const stateSenderAddress = '0x28e4F3a7f651294B9563200b5D633605D1ce4a29';
    const stateSenderAbi = [
      'event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data)',
    ];

    const stateSync = new ethers.Contract(stateSenderAddress, stateSenderAbi, this.l2Provider);

    // 简化的状态检查：等待 L2 上出现对应的 StateSynced 事件
    return {
      status: 'confirmed',
      l1Block: receipt.blockNumber,
      l2Block: l2BlockNumber,
    };
  }

  // 提款状态追踪（更复杂，需要 burn + confirm + exit）
  async checkWithdrawStatus(l2BurnTxHash) {
    const l2Receipt = await this.l2Provider.getTransactionReceipt(l2BurnTxHash);
    if (!l2Receipt) return { status: 'pending_burn' };

    // 提款流程：
    // 1. 在 Polygon 上 burn 代币（已完成）
    // 2. 等待检查点确认（约 7-30 分钟）
    // 3. 在以太坊上调用 exit 完成提款

    return {
      status: 'burnt',
      nextStep: '等待检查点确认',
      estimatedTime: '7-30 分钟',
    };
  }
}
```

## Gas 费对比

```javascript
// Gas 费比较工具
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

典型交易 Gas 费对比（2021 年中期数据）：

| 操作 | 以太坊 | Polygon | 节省 |
|---|---|---|---|
| ERC-20 转账 | $3-15 | $0.0001 | ~99% |
| Uniswap Swap | $30-100 | $0.01 | ~99% |
| 添加流动性 | $50-200 | $0.02 | ~99% |
| 合约部署 | $500-2000 | $0.5-2 | ~99% |

## 已有以太坊 DApp 的迁移步骤

### 1. 合约迁移

```javascript
// 跨链部署配置
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

// 部署脚本：同时部署到两条链
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

  // 注意：两条链上的合约地址通常不同！
  return deployments;
}
```

### 2. 前端多链配置

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
      throw new Error(`合约 ${name} 在 chainId=${this.chainId} 上未配置`);
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

### 3. 合约地址一致性

需要注意：使用 CREATE 部署的合约在不同链上地址通常不同（因为部署者 nonce 不同）。如果需要地址一致，可以使用 CREATE2：

```javascript
// 使用 CREATE2 确保跨链地址一致
async function deployWithCreate2(factory, salt, bytecode, constructorArgs) {
  // CREATE2: address = keccak256(0xff, factory, salt, keccak256(bytecode))
  const expectedAddress = ethers.utils.getCreate2Address(
    factory.address,
    salt,
    ethers.utils.keccak256(bytecode)
  );

  // 在每条链上用相同的 salt 和 factory 部署
  const tx = await factory.deploy(salt, bytecode, constructorArgs);
  await tx.wait();

  return expectedAddress;
}
```

## 常见问题

### 索引服务

Polygon 上的 The Graph 索引服务与以太坊略有不同。需要在 `subgraph.yaml` 中指定 Polygon 的网络配置：

```yaml
# subgraph.yaml (Polygon)
network: matic
```

同时需要使用 Polygon 的合约地址作为数据源。

### 事件解析差异

Polygon 的区块时间约 2 秒，事件过滤的 `fromBlock` 和 `toBlock` 参数需要适配更快的区块速度。查询历史事件时建议使用区块号而非 'latest'。

## 小结

Polygon 作为 Layer2 扩展方案，其 EVM 兼容性使得以太坊 DApp 的迁移成本极低——主要工作集中在网络配置、合约地址映射和前端网络切换。从用户体验角度看，Polygon 几乎消除了 Gas 费和确认时间两个最大痛点，使得链上交互体验接近传统 Web 应用。

但 Polygon 本质上是一条侧链而非真正的 Layer2——它不继承以太坊 L1 的安全性，而是依赖自身的 PoS 共识。对于高价值资产场景，这个安全假设需要谨慎评估。在实际项目中，推荐同时支持以太坊主网和 Polygon，让用户根据自身需求选择合适的网络。
