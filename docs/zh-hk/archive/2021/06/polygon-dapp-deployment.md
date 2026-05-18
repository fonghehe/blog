---
title: "Polygon Layer2 DApp 部署與前端適配"
date: 2021-06-15 10:05:24
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 14
description: "從合約部署到前端網絡切換，完整解析 Polygon Layer2 的 DApp 適配流程"
wordCount: 3800
---

## Polygon 網絡概述

Polygon（原名 Matic Network）是一條與以太坊 EVM 兼容的多鏈擴展框架，早期為 Plasma 側鏈方案。對於 DApp 開發者而言，最實用的是 Polygon PoS 側鏈——一條與以太坊 EVM 兼容的獨立區塊鏈，通過 PoS 檢查點機制與以太坊主網錨定。

Polygon PoS 的核心特點：

- **EVM 兼容**：Solidity 合約無需修改即可部署，以太坊開發工具鏈直接可用
- **低 Gas 費**：交易成本約為主網的 1/100，一筆 swap 交易 Gas 費通常不到 1 美分
- **快速確認**：區塊時間約 2 秒，交易幾乎即時確認
- **橋接機制**：通過官方 PoS 橋實現 ETH 和 ERC-20 的跨鏈轉移

### PoS Sidechain vs Plasma

Polygon 同時支持 Plasma 和 PoS 兩種安全模型。Plasma 使用欺詐證明確保安全性，但只支持特定類型的代幣（ETH 和 ERC-20），且退出週期長達 7 天。PoS 側鏈通過驗證人質押保證共識，支持所有 EVM 操作，資產跨鏈通過官方橋完成，退出週期約 7-30 分鐘。對於絕大多數 DApp，PoS 側鏈是正確的選擇。

## 合約部署到 Polygon

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
    // Polygon 主網
    polygon: {
      url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 137,
      gasPrice: 30000000000, // 30 Gwei
    },
    // Polygon Mumbai 測試網
    mumbai: {
      url: 'https://rpc-mumbai.maticvigil.com',
      accounts: [POLYGON_PRIVATE_KEY],
      chainId: 80001,
      gasPrice: 1000000000, // 1 Gwei
    },
    // 本地開發
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

### 部署腳本

```javascript
// scripts/deploy.js
const { ethers } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  const balance = await deployer.getBalance();
  console.log('Account balance:', ethers.utils.formatEther(balance), 'MATIC');

  // 部署合約
  const MyContract = await ethers.getContractFactory('MyContract');
  const contract = await MyContract.deploy();
  await contract.deployed();

  console.log('Contract deployed to:', contract.address);
  console.log('Transaction hash:', contract.deployTransaction.hash);

  // 等待幾個區塊確認
  console.log('Waiting for confirmations...');
  await contract.deployTransaction.wait(5);
  console.log('Confirmed!');

  // 驗證合約
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
# 部署到 Mumbai 測試網
npx hardhat run scripts/deploy.js --network mumbai

# 部署到 Polygon 主網
npx hardhat run scripts/deploy.js --network polygon

# 驗證合約
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

## RPC 端點配置與 Chain ID

Polygon 網絡的關鍵參數：

| 網絡 | Chain ID | RPC 端點 | 區塊瀏覽器 |
|---|---|---|---|
| Polygon Mainnet | 137 | https://polygon-rpc.com | https://polygonscan.com |
| Mumbai Testnet | 80001 | https://rpc-mumbai.maticvigil.com | https://mumbai.polygonscan.com |

推薦的 RPC 端點選擇：

```javascript
const POLYGON_RPC_CONFIG = {
  // 公共 RPC（免費，但可能有速率限制）
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

// RPC 故障轉移
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

  // 故障轉移
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
        this.currentIndex = index; // 記錄成功的 RPC
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

## 前端網絡切換

### 添加 Polygon 網絡到 MetaMask

```javascript
const POLYGON_NETWORK_PARAMS = {
  chainId: '0x89', // 137 的十六進制
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
  chainId: '0x13881', // 80001 的十六進制
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

  // 獲取當前網絡
  async getCurrentChainId() {
    const chainIdHex = await this.ethereum.request({ method: 'eth_chainId' });
    return parseInt(chainIdHex, 16);
  }

  // 檢查是否在 Polygon 網絡
  async isOnPolygon() {
    const chainId = await this.getCurrentChainId();
    return chainId === 137;
  }

  // 切換到 Polygon 網絡
  async switchToPolygon() {
    const currentChainId = await this.getCurrentChainId();

    if (currentChainId === 137) return; // 已在 Polygon

    try {
      // 嘗試切換（如果用户已添加過 Polygon 網絡）
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }],
      });
    } catch (switchError) {
      // 錯誤碼 4902 表示網絡未添加
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

  // 監聽網絡切換
  onChainChanged(callback) {
    this.ethereum.on('chainChanged', (chainIdHex) => {
      callback(parseInt(chainIdHex, 16));
    });
  }
}
```

### 網絡切換 UI 組件

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
            當前網絡不支持，請切換到 Polygon
          </p>
          <button onClick={handleSwitch} disabled={switching}>
            {switching ? '切換中...' : '切換到 Polygon'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
```

## 跨鏈橋交互

### ETH -> Polygon 資產轉移

Polygon 官方 PoS 橋支持 ETH 和 ERC-20 的跨鏈轉移。存款（L1 -> L2）通常在 7-30 分鐘內完成，提款（L2 -> L1）需要約 7-30 分鐘（包含檢查點確認）。

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

// 存款：從以太坊轉移到 Polygon
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
    estimatedTime: '7-30 分鐘',
  };
}

// ERC-20 存款到 Polygon
async function depositERC20ToPolygon(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const userAddress = await signer.getAddress();

  // 1. 先在以太坊上授權 Predicate 合約
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const allowance = await token.allowance(userAddress, ERC20_PREDICATE);
  const rawAmount = ethers.utils.parseUnits(amount, await token.decimals());

  if (allowance.lt(rawAmount)) {
    const approveTx = await token.approve(ERC20_PREDICATE, rawAmount);
    await approveTx.wait();
  }

  // 2. 調用 depositFor
  const rootChain = new ethers.Contract(ROOT_CHAIN_MANAGER, ROOT_CHAIN_ABI, signer);
  const data = ethers.utils.defaultAbiCoder.encode(['uint256'], [rawAmount]);

  const tx = await rootChain.depositFor(userAddress, tokenAddress, data);
  const receipt = await tx.wait();

  return {
    txHash: receipt.transactionHash,
    estimatedTime: '7-30 分鐘',
  };
}
```

### 橋接狀態追蹤

```javascript
class BridgeTracker {
  constructor(l1Provider, l2Provider) {
    this.l1Provider = l1Provider;
    this.l2Provider = l2Provider;
  }

  // 檢查存款狀態
  async checkDepositStatus(l1TxHash) {
    const receipt = await this.l1Provider.getTransactionReceipt(l1TxHash);
    if (!receipt) return { status: 'pending' };

    // 等待 Polygon 檢查點（約 7-30 分鐘）
    const l2BlockNumber = await this.l2Provider.getBlockNumber();

    // 查詢 Polygon 上的 StateSync 事件
    const stateSenderAddress = '0x28e4F3a7f651294B9563200b5D633605D1ce4a29';
    const stateSenderAbi = [
      'event StateSynced(uint256 indexed id, address indexed contractAddress, bytes data)',
    ];

    const stateSync = new ethers.Contract(stateSenderAddress, stateSenderAbi, this.l2Provider);

    // 簡化的狀態檢查：等待 L2 上出現對應的 StateSynced 事件
    return {
      status: 'confirmed',
      l1Block: receipt.blockNumber,
      l2Block: l2BlockNumber,
    };
  }

  // 提款狀態追蹤（更復雜，需要 burn + confirm + exit）
  async checkWithdrawStatus(l2BurnTxHash) {
    const l2Receipt = await this.l2Provider.getTransactionReceipt(l2BurnTxHash);
    if (!l2Receipt) return { status: 'pending_burn' };

    // 提款流程：
    // 1. 在 Polygon 上 burn 代幣（已完成）
    // 2. 等待檢查點確認（約 7-30 分鐘）
    // 3. 在以太坊上調用 exit 完成提款

    return {
      status: 'burnt',
      nextStep: '等待檢查點確認',
      estimatedTime: '7-30 分鐘',
    };
  }
}
```

## Gas 費對比

```javascript
// Gas 費比較工具
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

典型交易 Gas 費對比（歷史數據參考）：

| 操作 | 以太坊 | Polygon | 節省 |
|---|---|---|---|
| ERC-20 轉賬 | $3-15 | $0.0001 | ~99% |
| Uniswap Swap | $30-100 | $0.01 | ~99% |
| 添加流動性 | $50-200 | $0.02 | ~99% |
| 合約部署 | $500-2000 | $0.5-2 | ~99% |

## 已有以太坊 DApp 的遷移步驟

### 1. 合約遷移

```javascript
// 跨鏈部署配置
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

// 部署腳本：同時部署到兩條鏈
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

  // 注意：兩條鏈上的合約地址通常不同！
  return deployments;
}
```

### 2. 前端多鏈配置

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
      throw new Error(`合約 ${name} 在 chainId=${this.chainId} 上未配置`);
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

### 3. 合約地址一致性

需要注意：使用 CREATE 部署的合約在不同鏈上地址通常不同（因為部署者 nonce 不同）。如果需要地址一致，可以使用 CREATE2：

```javascript
// 使用 CREATE2 確保跨鏈地址一致
async function deployWithCreate2(factory, salt, bytecode, constructorArgs) {
  // CREATE2: address = keccak256(0xff, factory, salt, keccak256(bytecode))
  const expectedAddress = ethers.utils.getCreate2Address(
    factory.address,
    salt,
    ethers.utils.keccak256(bytecode)
  );

  // 在每條鏈上用相同的 salt 和 factory 部署
  const tx = await factory.deploy(salt, bytecode, constructorArgs);
  await tx.wait();

  return expectedAddress;
}
```

## 常見問題

### 索引服務

Polygon 上的 The Graph 索引服務與以太坊略有不同。需要在 `subgraph.yaml` 中指定 Polygon 的網絡配置：

```yaml
# subgraph.yaml (Polygon)
network: matic
```

同時需要使用 Polygon 的合約地址作為數據源。

### 事件解析差異

Polygon 的區塊時間約 2 秒，事件過濾的 `fromBlock` 和 `toBlock` 參數需要適配更快的區塊速度。查詢歷史事件時建議使用區塊號而非 'latest'。

## 小結

Polygon 作為 Layer2 擴展方案，其 EVM 兼容性使得以太坊 DApp 的遷移成本極低——主要工作集中在網絡配置、合約地址映射和前端網絡切換。從用户體驗角度看，Polygon 幾乎消除了 Gas 費和確認時間兩個最大痛點，使得鏈上交互體驗接近傳統 Web 應用。

但 Polygon 本質上是一條側鏈而非真正的 Layer2——它不繼承以太坊 L1 的安全性，而是依賴自身的 PoS 共識。對於高價值資產場景，這個安全假設需要謹慎評估。在實際項目中，推薦同時支持以太坊主網和 Polygon，讓用户根據自身需求選擇合適的網絡。
