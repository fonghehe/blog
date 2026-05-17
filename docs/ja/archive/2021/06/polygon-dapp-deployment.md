---
title: "Polygon Layer2 DApp デプロイとフロントエンド適応"
date: 2021-06-15 10:05:24
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 14
description: "コントラクトデプロイからフロントエンドのネットワーク切替まで、Polygon Layer2 の DApp 適応フローを完全解説"
wordCount: 3800
---

## Polygon ネットワークの概要

Polygon（旧名 Matic Network）はブランドアップグレードにより、Plasma サイドチェーンソリューションからマルチチェーン拡張フレームワークへと進化しました。DApp 開発者にとって、現在最も実用的なのは Polygon PoS サイドチェーン——Ethereum と EVM 互換の独立したブロックチェーンで、PoS チェックポイントメカニズムで Ethereum メインネットにアンカーされています。

Polygon PoS の主な特徴：

- **EVM 互換**：Solidity コントラクトは修正なしでデプロイ可能、Ethereum 開発ツールチェーンがそのまま使用可能
- **低 Gas 費**：取引コストはメインネットの約 1/100、swap 取引の Gas 費は通常1セント未満
- **高速確認**：ブロックタイム約2秒、取引はほぼリアルタイムで確認
- **ブリッジメカニズム**：公式 PoS ブリッジで ETH と ERC-20 のクロスチェーン転送を実現

### PoS Sidechain vs Plasma

Polygon は Plasma と PoS の2つのセキュリティモデルを同時にサポートしています。Plasma はファウルプルーフで安全性を確保しますが、特定タイプのトークン（ETH と ERC-20）のみサポートし、退出期間は7日間です。PoS サイドチェーンはバリデーターのステーキングでコンセンサスを保証し、すべての EVM 操作をサポートし、アセットのクロスチェーン転送は公式ブリッジで完結し、退出期間は約7-30分です。ほとんどの DApp にとって、PoS サイドチェーンが正しい選択です。

## Polygon へのコントラクトデプロイ

### Hardhat 設定

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

### デプロイスクリプト

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

### デプロイコマンド

```bash
# 部署到 Mumbai 测试网
npx hardhat run scripts/deploy.js --network mumbai

# 部署到 Polygon 主网
npx hardhat run scripts/deploy.js --network polygon

# 验证合约
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

## RPC エンドポイント設定と Chain ID

Polygon ネットワークの主要パラメータ：

| ネットワーク | Chain ID | RPC エンドポイント | ブロックエクスプローラー |
|---|---|---|---|
| Polygon Mainnet | 137 | https://polygon-rpc.com | https://polygonscan.com |
| Mumbai Testnet | 80001 | https://rpc-mumbai.maticvigil.com | https://mumbai.polygonscan.com |

推奨 RPC エンドポイントの選択：

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

## フロントエンドのネットワーク切替

### MetaMask への Polygon ネットワーク追加

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

### ネットワーク切替 UI コンポーネント

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

## クロスチェーンブリッジ連携

### ETH -> Polygon へのアセット転送

Polygon 公式 PoS ブリッジは ETH と ERC-20 のクロスチェーン転送をサポートしています。入金（L1 -> L2）は通常7-30分で完了し、出金（L2 -> L1）は約7-30分（チェックポイント確認を含む）かかります。

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

### ブリッジ状態の追跡

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

## Gas 費の比較

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

典型的な取引の Gas 費比較（2021年中期のデータ）：

| 操作 | Ethereum | Polygon | 削減 |
|---|---|---|---|
| ERC-20 送金 | $3-15 | $0.0001 | ~99% |
| Uniswap Swap | $30-100 | $0.01 | ~99% |
| 流動性追加 | $50-200 | $0.02 | ~99% |
| コントラクトデプロイ | $500-2000 | $0.5-2 | ~99% |

## 既存 Ethereum DApp の移行ステップ

### 1. コントラクト移行

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

### 2. フロントエンドマルチチェーン設定

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

### 3. コントラクトアドレスの一貫性

注意が必要な点：CREATE でデプロイされたコントラクトは異なるチェーンで通常異なるアドレスになります（デプロイヤーの nonce が異なるため）。アドレスを一致させる必要がある場合は CREATE2 を使用できます：

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

## よくある問題

### インデックスサービス

Polygon 上の The Graph インデックスサービスは Ethereum とはやや異なります。`subgraph.yaml` で Polygon のネットワーク設定を指定する必要があります：

```yaml
# subgraph.yaml (Polygon)
network: matic
```

同時に Polygon のコントラクトアドレスをデータソースとして使用する必要があります。

### イベント解析の違い

Polygon のブロックタイムは約2秒で、イベントフィルターの `fromBlock` と `toBlock` パラメータはより速いブロック生成速度に適応する必要があります。履歴イベントの照会時は 'latest' ではなくブロック番号を使用することを推奨します。

## まとめ

Polygon は Layer2 拡張ソリューションとして、その EVM 互換性により Ethereum DApp の移行コストを極めて低く抑えられます——主な作業はネットワーク設定、コントラクトアドレスのマッピング、フロントエンドのネットワーク切替に集約されます。ユーザー体験の観点から見ると、Polygon は Gas 費と確認時間という2つの最大のペインポイントをほぼ解消し、オンチェーン連携体験を従来の Web アプリケーションに近づけています。

ただし Polygon は本質的にサイドチェンであり真の Layer2 ではありません——Ethereum L1 のセキュリティを継承せず、自身の PoS コンセンサスに依存しています。高価値アセットのシナリオでは、このセキュリティ前提を慎重に評価する必要があります。実際のプロジェクトでは、Ethereum メインネットと Polygon の両方をサポートし、ユーザーが自身のニーズに応じて適切なネットワークを選択できるすることを推奨します。
