---
title: "Layer2 フロントエンド適応：Arbitrum と Optimism の統合"
date: 2022-01-20 14:38:16
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 15
description: "Arbitrum One と Optimism のフロントエンド適応の違い、クロスチェーン連携とマルチ L2 ネットワーク管理の実践"
wordCount: 4300
---

## Layer2 エコシステムの状況

Ethereum の Layer2 エコシステムの状況は明確になっています。Optimistic Rollup ソリューションでは、Arbitrum One と Optimism がメインネットにローンチ済みの2つのネットワークで、TVL（総預かり残高）の合計は50億ドルを超えています。両者とも Optimistic Rollup 技術に基づいていますが、アーキテクチャ実装とフロントエンド適応の細部に顕著な差異があります。

### Arbitrum One vs Optimism

| 特徴 | Arbitrum One | Optimism |
|---|---|---|
| チャレンジ期間 | 7日 | 7日 |
| EVM 互換 | EVM 等価（Arbitrum VM） | EVM 等価（OVM -> EVM） |
| Chain ID | 42161 | 10 |
| ブロックタイム | ~0.25秒 | ~2秒 |
| 確認方式 | ソフト確認 + 最終確認 | ソフト確認 + 最終確認 |
| RPC 互換 | 高度に互換 | 高度に互換 |
| コントラクトデプロイ | L1 と一致 | L1 と一致 |

フロントエンド開発者にとって、両者の適応フローは似ていますが、RPC の挙動、コントラクトアドレスのマッピング、ブリッジ連携の面でそれぞれの特徴に注意する必要があります。

## Optimistic Rollup のフロントエンド適応の違い

### トランザクション確認時間の特徴

Optimistic Rollup のトランザクション確認モードは L1 とは異なります：

1. **ソフト確認**：トランザクションは L2 上で高速に確認され（数秒以内）、フロントエンドは「確認済み」ステータスを表示できます
2. **最終確認**：トランザクションが L1 に包含され、チャレンジ期間（7日）が経過した後に最終確認されます

フロントエンドの UX にとって、ソフト確認でユーザーは取引が完了したと見なすことができます。しかし L1 への出金はチャレンジ期間を待つ必要があり、これはフロントエンドがユーザーに明確に伝える必要がある事項です：

```javascript
const L2_CONFIRMATION_STATUS = {
  PENDING: 'pending',        // 交易已提交，等待 L2 确认
  SOFT_CONFIRMED: 'soft',    // L2 已确认（通常几秒）
  FINALIZING: 'finalizing',  // 等待 L1 最终确认（7 天）
  FINALIZED: 'finalized',    // L1 最终确认，可提款到 L1
};

async function getL2TransactionStatus(provider, txHash, l1Provider) {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) return L2_CONFIRMATION_STATUS.PENDING;
  if (receipt.status === 0) return 'reverted';

  // 检查 L1 上的最终确认状态
  const l2ToL1TxHash = getL1FinalizationTxHash(receipt);
  if (l2ToL1TxHash) {
    const l1Receipt = await l1Provider.getTransactionReceipt(l2ToL1TxHash);
    if (l1Receipt) return L2_CONFIRMATION_STATUS.FINALIZED;
  }

  // 计算 L2 区块到 L1 确认的剩余时间
  const currentL1Block = await l1Provider.getBlockNumber();
  const challengePeriodBlocks = 7 * 24 * 3600 / 13; // 7 天，约 46472 个区块

  return {
    status: L2_CONFIRMATION_STATUS.FINALIZING,
    l2Block: receipt.blockNumber,
    estimatedFinalizationHours: 7 * 24, // 7 天
  };
}
```

### Gas 見積もりの違い

L2 の Gas 見積もりは L1 とは本質的に異なります。Optimism では、トランザクション Gas は2つの部分で構成されます：L2 実行 Gas と L1 データ Gas（トランザクションデータを L1 に公開するコスト）：

```javascript
// Optimism 的 Gas 估算需要考虑 L1 data cost
async function estimateOptimismGas(provider, tx) {
  const l2GasEstimate = await provider.estimateGas(tx);

  // L1 data cost：交易 calldata 的 Gas 成本
  const calldataGas = estimateCalldataGas(tx.data);
  const l1GasPrice = await getL1GasPrice();
  const l2GasPrice = await provider.getGasPrice();

  const l2Cost = l2GasEstimate.mul(l2GasPrice);
  const l1DataCost = calldataGas.mul(l1GasPrice);

  const totalCost = l2Cost.add(l1DataCost);

  return {
    l2Gas: l2GasEstimate.toString(),
    l1DataGas: calldataGas.toString(),
    l2Cost: ethers.utils.formatEther(l2Cost),
    l1DataCost: ethers.utils.formatEther(l1DataCost),
    totalCost: ethers.utils.formatEther(totalCost),
    totalCostGwei: ethers.utils.formatUnits(totalCost, 'gwei'),
  };
}

function estimateCalldataGas(data) {
  let gas = 0;
  // 0 字节：4 gas（Optimism 的压缩费率）
  // 非零字节：16 gas
  for (let i = 2; i < data.length; i += 2) {
    const byte = data.slice(i, i + 2);
    gas += byte === '00' ? 4 : 16;
  }
  return ethers.BigNumber.from(gas + 2100); // 基础开销
}
```

## RPC エンドポイントと Chain ID の設定

### ネットワークパラメータ

```javascript
const L2_NETWORKS = {
  arbitrum: {
    chainId: 42161,
    chainName: 'Arbitrum One',
    chainIdHex: '0xa4b1',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
      `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
    ],
    explorerUrls: ['https://arbiscan.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    bridgeUrl: 'https://bridge.arbitrum.io',
  },
  arbitrumTestnet: {
    chainId: 421611,
    chainName: 'Arbitrum Rinkeby',
    chainIdHex: '0x66eeb',
    rpcUrls: ['https://rinkeby.arbitrum.io/rpc'],
    explorerUrls: ['https://testnet.arbiscan.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  optimism: {
    chainId: 10,
    chainName: 'Optimism',
    chainIdHex: '0xa',
    rpcUrls: [
      'https://mainnet.optimism.io',
      `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
    ],
    explorerUrls: ['https://optimistic.etherscan.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    bridgeUrl: 'https://app.optimism.io/bridge',
  },
  optimismTestnet: {
    chainId: 69,
    chainName: 'Optimism Kovan',
    chainIdHex: '0x45',
    rpcUrls: ['https://kovan.optimism.io'],
    explorerUrls: ['https://kovan-optimistic.etherscan.io'],
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
};
```

### MetaMask ネットワーク追加

```javascript
class L2NetworkManager {
  constructor() {
    this.ethereum = window.ethereum;
  }

  async addNetwork(networkKey) {
    const config = L2_NETWORKS[networkKey];
    if (!config) throw new Error(`Unknown network: ${networkKey}`);

    try {
      // 先尝试切换
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainIdHex }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        // 网络未添加，添加网络
        await this.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.chainIdHex,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: config.explorerUrls,
          }],
        });
      } else {
        throw switchError;
      }
    }
  }

  async getCurrentNetwork() {
    const chainIdHex = await this.ethereum.request({ method: 'eth_chainId' });
    const chainId = parseInt(chainIdHex, 16);

    return Object.entries(L2_NETWORKS).find(
      ([_, config]) => config.chainId === chainId
    )?.[0] || 'unknown';
  }

  onNetworkChange(callback) {
    this.ethereum.on('chainChanged', (chainIdHex) => {
      const chainId = parseInt(chainIdHex, 16);
      const network = Object.entries(L2_NETWORKS).find(
        ([_, config]) => config.chainId === chainId
      );
      callback(network?.[0] || 'unknown', chainId);
    });
  }
}
```

## L1 と L2 でのコントラクトアドレスのマッピング

### アドレスマッピング関係

Optimism では、コントラクトアドレスは L1 と一致します（CREATE2 でデプロイ）。Arbitrum では、コントラクトアドレスは通常異なります（ArbSys でデプロイ）。

```javascript
// 合约地址映射配置
const CONTRACT_ADDRESSES = {
  // L1 主网
  1: {
    L1GatewayRouter: '0x70ced6202B7CF8e25C62c4f8a3CfbF1B4390E8e6', // Arbitrum Gateway
    L1StandardBridge: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // Optimism Bridge
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  // Arbitrum One
  42161: {
    L2GatewayRouter: '0x5288c571Fd7aD6beD345abD6382f964f17F4aA9d',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum 上的 WETH
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  // Optimism
  10: {
    L2StandardBridge: '0x4200000000000000000000000000000000000010',
    WETH: '0x4200000000000000000000000000000000000006', // Optimism 上的 WETH
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  },
};
```

Optimism の標準コントラクトはプレデプロイアドレス（`0x4200...` で始まる）を使用していることに注意してください。これらは Optimism OVM にプリセットされたシステムコントラクトです。

### トークンアドレスマッピングの管理

```javascript
class TokenAddressMapper {
  constructor() {
    this.mapping = CONTRACT_ADDRESSES;
  }

  getTokenAddress(symbol, chainId) {
    const chainTokens = this.mapping[chainId];
    if (!chainTokens || !chainTokens[symbol]) {
      throw new Error(`Token ${symbol} not found on chain ${chainId}`);
    }
    return chainTokens[symbol];
  }

  // L1 到 L2 的地址映射
  mapL1ToL2(l1Address, l2ChainId) {
    const mapping = {
      // USDC
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': {
        42161: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
        10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
      },
      // WETH
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': {
        42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        10: '0x4200000000000000000000000000000000000006',
      },
    };

    const l2Address = mapping[l1Address]?.[l2ChainId];
    if (!l2Address) {
      throw new Error(`No L2 mapping for ${l1Address} on chain ${l2ChainId}`);
    }
    return l2Address;
  }

  // 反向映射：L2 到 L1
  mapL2ToL1(l2Address, l2ChainId) {
    const reverseMapping = {};
    for (const [l1Addr, l2Map] of Object.entries(mapping)) {
      if (l2Map[l2ChainId]?.toLowerCase() === l2Address.toLowerCase()) {
        return l1Addr;
      }
    }
    return null;
  }
}
```

## クロスチェーンメッセージパッシングのフロントエンド連携

### L1 -> L2 入金

```javascript
// Arbitrum L1 -> L2 存款
const ARBITRUM_L1_GATEWAY = '0x72Ce9C846789fdB6fC1f34aC4AD25Dd9ef7031ef'; // L1 Gateway Router

const GATEWAY_ABI = [
  'function depositERC1(uint256 maxSubmissionCost, address erc20L1, uint256 amount, uint256 maxGas, uint256 gasPriceBid, bytes callHookData) payable returns (uint256)',
  'function outboundTransferCustomRefund(address _token, address _refundTo, address _to, uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, bytes _data) payable returns (bytes)',
  'function getOutboundCalldata(address _token, address _from, address _to, uint256 _amount, bytes _data) view returns (bytes)',
];

async function depositToArbitrum(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const gateway = new ethers.Contract(ARBITRUM_L1_GATEWAY, GATEWAY_ABI, signer);

  // 获取 L2 Gas 预估
  const maxGas = 1000000;
  const gasPriceBid = await getArbitrumGasPrice(); // L2 gas price

  // 提交存款交易
  const submissionCost = estimateSubmissionCost(tokenAddress, amount);

  if (tokenAddress === ethers.constants.AddressZero) {
    // ETH 存款
    const tx = await gateway.depositETH(
      submissionCost,
      { value: amount }
    );
  } else {
    // ERC-20 存款（需要先授权）
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const allowance = await token.allowance(
      await signer.getAddress(),
      ARBITRUM_L1_GATEWAY
    );
    if (allowance.lt(amount)) {
      await (await token.approve(ARBITRUM_L1_GATEWAY, amount)).wait();
    }

    const tx = await gateway.outboundTransferCustomRefund(
      tokenAddress,
      await signer.getAddress(),
      await signer.getAddress(),
      amount,
      maxGas,
      gasPriceBid,
      ethers.utils.defaultAbiCoder.encode(['uint256'], [submissionCost])
    );
  }

  return { txHash: tx.hash, estimatedL2Time: '~10 分钟' };
}

// Optimism L1 -> L2 存款（更简单）
const OPTIMISM_L1_BRIDGE = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1';

const OPTIMISM_BRIDGE_ABI = [
  'function depositETH(uint32 _l2Gas, bytes _data) payable',
  'function depositERC20(address _l1Token, address _l2Token, uint32 _l2Gas, bytes _data) payable',
];

async function depositToOptimism(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const bridge = new ethers.Contract(OPTIMISM_L1_BRIDGE, OPTIMISM_BRIDGE_ABI, signer);

  if (tokenAddress === ethers.constants.AddressZero) {
    const tx = await bridge.depositETH(2000000, '0x', { value: amount });
    return { txHash: tx.hash, estimatedL2Time: '~5 分钟' };
  } else {
    const l2TokenAddress = tokenMapper.mapL1ToL2(tokenAddress, 10);
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

    const allowance = await token.allowance(
      await signer.getAddress(),
      OPTIMISM_L1_BRIDGE
    );
    if (allowance.lt(amount)) {
      await (await token.approve(OPTIMISM_L1_BRIDGE, amount)).wait();
    }

    const tx = await bridge.depositERC20(tokenAddress, l2TokenAddress, 2000000, '0x', { value: 0 });
    return { txHash: tx.hash, estimatedL2Time: '~5 分钟' };
  }
}
```

### L2 -> L1 出金

出金は Layer2 連携の中で最も複雑な部分です。7日のチャレンジ期間が関係するためです：

```javascript
async function withdrawFromArbitrum(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const l2Gateway = '0x5288c571Fd7aD6beD345abD6382f964f17F4aA9d';

  const gateway = new ethers.Contract(l2Gateway, [
    'function outboundTransfer(address _token, address _to, uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, bytes _data) payable returns (bytes)',
  ], signer);

  const maxGas = 1000000;
  const gasPriceBid = await provider.getGasPrice();
  const data = '0x';

  if (tokenAddress === ethers.constants.AddressZero) {
    const tx = await gateway.outboundTransfer(
      ethers.constants.AddressZero,
      await signer.getAddress(),
      amount,
      maxGas,
      gasPriceBid,
      data,
      { value: amount }
    );
  } else {
    const tx = await gateway.outboundTransfer(
      tokenAddress,
      await signer.getAddress(),
      amount,
      maxGas,
      gasPriceBid,
      data
    );
  }

  return {
    txHash: tx.hash,
    estimatedL1Time: '7 天', // 挑战期
    nextStep: '等待 7 天挑战期后，在 L1 上执行 claim',
  };
}

// 提款状态追踪
class WithdrawalTracker {
  constructor(l1Provider, l2Provider) {
    this.l1Provider = l1Provider;
    this.l2Provider = l2Provider;
  }

  async trackArbitrumWithdrawal(l2TxHash) {
    const receipt = await this.l2Provider.getTransactionReceipt(l2TxHash);

    if (!receipt) return { status: 'pending' };

    // 查找 L2 到 L1 的消息
    const messageHash = this.extractMessageHash(receipt);

    // 检查挑战期是否已过
    const l2Block = await this.l2Provider.getBlock(receipt.blockNumber);
    const challengeEndTime = l2Block.timestamp + 7 * 24 * 3600;

    const currentL1Time = (await this.l1Provider.getBlock('latest')).timestamp;

    if (currentL1Time < challengeEndTime) {
      const remainingHours = Math.ceil((challengeEndTime - currentL1Time) / 3600);
      return {
        status: 'challenge_period',
        remainingHours,
        canClaim: false,
      };
    }

    return {
      status: 'ready_to_claim',
      canClaim: true,
      claimTx: '需要调用 L1 上的 Outbox.execute()',
    };
  }

  extractMessageHash(receipt) {
    // 解析 Arbitrum 的 L2ToL1Transaction 事件
    const iface = new ethers.utils.Interface([
      'event L2ToL1Transaction(address caller, address indexed destination, uint256 indexed uniqueTxNumber, uint256 indexed batchNumber, uint256 indexInBatch, uint256 arbBlockNum, uint256 ethBlockNum, uint256 timestamp, uint256 callvalue, bytes data)',
    ]);

    for (const log of receipt.logs) {
      try {
        const event = iface.parseLog(log);
        if (event) return event.args;
      } catch { continue; }
    }
    return null;
  }
}
```

## マルチ Layer2 ネットワークマネージャー

```javascript
class MultiL2Manager {
  constructor() {
    this.ethereum = window.ethereum;
    this.currentNetwork = null;
    this.providers = {};
    this.initProviders();
  }

  initProviders() {
    for (const [name, config] of Object.entries(L2_NETWORKS)) {
      this.providers[name] = {
        rpc: new ethers.providers.StaticJsonRpcProvider(
          config.rpcUrls[0],
          { chainId: config.chainId, name: config.chainName }
        ),
        config,
      };
    }
  }

  getProvider(networkName) {
    return this.providers[networkName]?.rpc;
  }

  getExplorerUrl(networkName, txHash) {
    const config = L2_NETWORKS[networkName];
    return `${config.explorerUrls[0]}/tx/${txHash}`;
  }

  // 统一的网络切换
  async switchNetwork(networkName) {
    const config = L2_NETWORKS[networkName];
    if (!config) throw new Error(`Unknown network: ${networkName}`);

    try {
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainIdHex }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await this.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: config.chainIdHex,
            chainName: config.chainName,
            nativeCurrency: config.nativeCurrency,
            rpcUrls: config.rpcUrls,
            blockExplorerUrls: config.explorerUrls,
          }],
        });
      } else {
        throw switchError;
      }
    }

    this.currentNetwork = networkName;
  }

  // 获取当前链上的合约地址
  getContractAddress(contractName) {
    if (!this.currentNetwork) {
      throw new Error('Network not initialized');
    }
    const chainId = L2_NETWORKS[this.currentNetwork].chainId;
    return CONTRACT_ADDRESSES[chainId]?.[contractName];
  }

  // 检查合约是否在当前网络部署
  async isContractDeployed(contractAddress) {
    const provider = new ethers.providers.Web3Provider(this.ethereum);
    const code = await provider.getCode(contractAddress);
    return code !== '0x';
  }
}
```

## アセットブリッジのフロントエンドフロー

```jsx
import React, { useState, useEffect } from 'react';

function BridgeInterface({ provider, l2Manager }) {
  const [sourceNetwork, setSourceNetwork] = useState('ethereum');
  const [targetNetwork, setTargetNetwork] = useState('arbitrum');
  const [token, setToken] = useState('ETH');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const handleBridge = async () => {
    setStatus('pending');
    try {
      let result;
      const parsedAmount = ethers.utils.parseEther(amount);

      if (sourceNetwork === 'ethereum' && targetNetwork === 'arbitrum') {
        result = await depositToArbitrum(provider, ethers.constants.AddressZero, parsedAmount);
      } else if (sourceNetwork === 'ethereum' && targetNetwork === 'optimism') {
        result = await depositToOptimism(provider, ethers.constants.AddressZero, parsedAmount);
      } else if (sourceNetwork === 'arbitrum' && targetNetwork === 'ethereum') {
        result = await withdrawFromArbitrum(
          l2Manager.getProvider('arbitrum'),
          ethers.constants.AddressZero,
          parsedAmount
        );
      }

      setTxHash(result.txHash);
      setStatus('submitted');
    } catch (err) {
      setStatus('error');
      console.error(err);
    }
  };

  return (
    <div className="bridge-interface">
      <div className="bridge-networks">
        <select value={sourceNetwork} onChange={e => setSourceNetwork(e.target.value)}>
          <option value="ethereum">Ethereum L1</option>
          <option value="arbitrum">Arbitrum One</option>
          <option value="optimism">Optimism</option>
        </select>
        <span>→</span>
        <select value={targetNetwork} onChange={e => setTargetNetwork(e.target.value)}>
          <option value="ethereum">Ethereum L1</option>
          <option value="arbitrum">Arbitrum One</option>
          <option value="optimism">Optimism</option>
        </select>
      </div>

      <input
        type="text"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        placeholder="Amount (ETH)"
      />

      <button onClick={handleBridge} disabled={!amount || status === 'pending'}>
        {status === 'pending' ? 'Bridging...' : 'Bridge'}
      </button>

      {status === 'submitted' && txHash && (
        <div className="bridge-result">
          <p>Transaction submitted!</p>
          <p>Estimated time: {sourceNetwork === 'ethereum' ? '~10 min' : '~7 days'}</p>
          <a href={l2Manager.getExplorerUrl(sourceNetwork, txHash)} target="_blank">
            View on explorer
          </a>
        </div>
      )}
    </div>
  );
}
```

## Gas の比較

```javascript
async function compareGasAcrossNetworks() {
  const networks = {
    ethereum: { provider: ethProvider, gasPrice: await ethProvider.getGasPrice() },
    arbitrum: { provider: arbProvider, gasPrice: await arbProvider.getGasPrice() },
    optimism: { provider: opProvider, gasPrice: await opProvider.getGasPrice() },
  };

  const gasLimit = 150000; // 典型 ERC-20 transfer gas
  const ethPrice = await getTokenPrice('ethereum');

  const results = {};
  for (const [name, config] of Object.entries(networks)) {
    const cost = config.gasPrice.mul(gasLimit);
    const costEth = parseFloat(ethers.utils.formatEther(cost));
    results[name] = {
      gasPrice: ethers.utils.formatUnits(config.gasPrice, 'gwei') + ' Gwei',
      costEth: costEth.toFixed(6),
      costUsd: (costEth * ethPrice).toFixed(4),
    };
  }

  return results;
}
```

典型的な Gas 費比較（2022年初頭）：

| 操作 | Ethereum | Arbitrum | Optimism |
|---|---|---|---|
| ERC-20 送金 | $5-20 | $0.10-0.30 | $0.10-0.20 |
| Swap (DEX) | $50-150 | $0.50-1.50 | $0.40-1.20 |
| 流動性追加 | $80-250 | $0.80-2.00 | $0.60-1.50 |

## まとめ

Arbitrum と Optimism のフロントエンド適応の中核はネットワーク切替、アドレスマッピング、ブリッジ連携にあります。両者の EVM 互換性によりコントラクトコードはほぼ修正なしで済みますが、Optimistic Rollup の7日のチャレンジ期間が出金フローに独自の UX チャレンジをもたらします——フロントエンドは「高速入金、遅延出金」という非対称な体験を明確に伝える必要があります。

マルチ L2 ネットワーク管理は DApp フロントエンドの新たな課題です。ユーザーは Ethereum、Arbitrum、Optimism の間で頻繁に切替える可能性があり、フロントエンドはネットワーク検出、自動切替、アセットマッピングをエレガントに処理する必要があります。良好なプラクティスは統一されたネットワーク設定センターを維持し、Chain ID、RPC、コントラクトアドレス、ブリッジロジックを一元管理し、各所に分散されたハードコーディングを避けることです。
