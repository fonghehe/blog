---
title: "Layer2 Frontend Adaptation: Integrating Arbitrum and Optimism"
date: 2022-01-20 14:38:16
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 15
description: "Frontend adaptation differences between Arbitrum One and Optimism, cross-chain interaction, and multi-L2 network management practices"
wordCount: 4300
---

## The Layer2 Ecosystem Landscape

The Ethereum Layer2 ecosystem has matured into a clear landscape. Among Optimistic Rollup solutions, Arbitrum One and Optimism are both live on mainnet, with a combined TVL (Total Value Locked) exceeding $5 billion. Both are based on Optimistic Rollup technology, but there are significant differences in architecture implementation and frontend adaptation details.

### Arbitrum One vs Optimism

| Feature | Arbitrum One | Optimism |
|---|---|---|
| Challenge Period | 7 days | 7 days |
| EVM Compatibility | EVM equivalent (Arbitrum VM) | EVM equivalent (OVM -> EVM) |
| Chain ID | 42161 | 10 |
| Block Time | ~0.25 seconds | ~2 seconds |
| Confirmation | Soft + final | Soft + final |
| RPC Compatibility | Highly compatible | Highly compatible |
| Contract Deployment | Same as L1 | Same as L1 |

For frontend developers, the adaptation process is similar for both, but attention needs to be paid to the specific characteristics of each regarding RPC behavior, contract address mapping, and bridge interactions.

## Optimistic Rollup Frontend Adaptation Differences

### Transaction Confirmation Time Characteristics

Optimistic Rollup's transaction confirmation model differs from L1:

1. **Soft confirmation**: Transactions are quickly confirmed on L2 (within seconds); the frontend can display a "confirmed" status
2. **Final confirmation**: Transactions are only finalized after being included on L1 and passing the challenge period (7 days)

For frontend UX, soft confirmation is sufficient for users to consider the transaction complete. However, withdrawals to L1 must wait for the challenge period, which the frontend needs to clearly communicate to the user:

```javascript
const L2_CONFIRMATION_STATUS = {
  PENDING: 'pending',        // Transaction submitted, awaiting L2 confirmation
  SOFT_CONFIRMED: 'soft',    // L2 confirmed (typically seconds)
  FINALIZING: 'finalizing',  // Awaiting L1 final confirmation (7 days)
  FINALIZED: 'finalized',    // L1 finalized, can withdraw to L1
};

async function getL2TransactionStatus(provider, txHash, l1Provider) {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) return L2_CONFIRMATION_STATUS.PENDING;
  if (receipt.status === 0) return 'reverted';

  // Check final confirmation status on L1
  const l2ToL1TxHash = getL1FinalizationTxHash(receipt);
  if (l2ToL1TxHash) {
    const l1Receipt = await l1Provider.getTransactionReceipt(l2ToL1TxHash);
    if (l1Receipt) return L2_CONFIRMATION_STATUS.FINALIZED;
  }

  // Calculate remaining time from L2 block to L1 confirmation
  const currentL1Block = await l1Provider.getBlockNumber();
  const challengePeriodBlocks = 7 * 24 * 3600 / 13; // 7 days, approximately 46,472 blocks

  return {
    status: L2_CONFIRMATION_STATUS.FINALIZING,
    l2Block: receipt.blockNumber,
    estimatedFinalizationHours: 7 * 24, // 7 days
  };
}
```

### Gas Estimation Differences

Gas estimation on L2 is fundamentally different from L1. On Optimism, transaction Gas consists of two parts: L2 execution Gas and L1 data Gas (the cost of publishing transaction data to L1):

```javascript
// Optimism Gas estimation must account for L1 data cost
async function estimateOptimismGas(provider, tx) {
  const l2GasEstimate = await provider.estimateGas(tx);

  // L1 data cost: Gas cost of transaction calldata
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
  // Zero bytes: 4 gas (Optimism's compressed rate)
  // Non-zero bytes: 16 gas
  for (let i = 2; i < data.length; i += 2) {
    const byte = data.slice(i, i + 2);
    gas += byte === '00' ? 4 : 16;
  }
  return ethers.BigNumber.from(gas + 2100); // Base overhead
}
```

## RPC Endpoint and Chain ID Configuration

### Network Parameters

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

### MetaMask Network Addition

```javascript
class L2NetworkManager {
  constructor() {
    this.ethereum = window.ethereum;
  }

  async addNetwork(networkKey) {
    const config = L2_NETWORKS[networkKey];
    if (!config) throw new Error(`Unknown network: ${networkKey}`);

    try {
      // Try switching first
      await this.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: config.chainIdHex }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        // Network not added; add it
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

## Contract Address Mapping Between L1 and L2

### Address Mapping Relationships

On Optimism, contract addresses are consistent with L1 (deployed via CREATE2). On Arbitrum, contract addresses are usually different (deployed via ArbSys).

```javascript
// Contract address mapping configuration
const CONTRACT_ADDRESSES = {
  // L1 Mainnet
  1: {
    L1GatewayRouter: '0x70ced6202B7CF8e25C62c4f8a3CfbF1B4390E8e6', // Arbitrum Gateway
    L1StandardBridge: '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', // Optimism Bridge
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  },
  // Arbitrum One
  42161: {
    L2GatewayRouter: '0x5288c571Fd7aD6beD345abD6382f964f17F4aA9d',
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
    USDC: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8',
  },
  // Optimism
  10: {
    L2StandardBridge: '0x4200000000000000000000000000000000000010',
    WETH: '0x4200000000000000000000000000000000000006', // WETH on Optimism
    USDC: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607',
  },
};
```

Note that Optimism's standard contracts use predeployed addresses (starting with `0x4200...`), which are system contracts prebuilt into the Optimism OVM.

### Token Address Mapping Management

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

  // L1 to L2 address mapping
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

  // Reverse mapping: L2 to L1
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

## Cross-Chain Messaging Frontend Interaction

### L1 -> L2 Deposit

```javascript
// Arbitrum L1 -> L2 deposit
const ARBITRUM_L1_GATEWAY = '0x72Ce9C846789fdB6fC1f34aC4AD25Dd9ef7031ef'; // L1 Gateway Router

const GATEWAY_ABI = [
  'function depositERC1(uint256 maxSubmissionCost, address erc20L1, uint256 amount, uint256 maxGas, uint256 gasPriceBid, bytes callHookData) payable returns (uint256)',
  'function outboundTransferCustomRefund(address _token, address _refundTo, address _to, uint256 _amount, uint256 _maxGas, uint256 _gasPriceBid, bytes _data) payable returns (bytes)',
  'function getOutboundCalldata(address _token, address _from, address _to, uint256 _amount, bytes _data) view returns (bytes)',
];

async function depositToArbitrum(provider, tokenAddress, amount) {
  const signer = provider.getSigner();
  const gateway = new ethers.Contract(ARBITRUM_L1_GATEWAY, GATEWAY_ABI, signer);

  // Get L2 Gas estimate
  const maxGas = 1000000;
  const gasPriceBid = await getArbitrumGasPrice(); // L2 gas price

  // Submit deposit transaction
  const submissionCost = estimateSubmissionCost(tokenAddress, amount);

  if (tokenAddress === ethers.constants.AddressZero) {
    // ETH deposit
    const tx = await gateway.depositETH(
      submissionCost,
      { value: amount }
    );
  } else {
    // ERC-20 deposit (needs prior approval)
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

  return { txHash: tx.hash, estimatedL2Time: '~10 minutes' };
}

// Optimism L1 -> L2 deposit (simpler)
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
    return { txHash: tx.hash, estimatedL2Time: '~5 minutes' };
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
    return { txHash: tx.hash, estimatedL2Time: '~5 minutes' };
  }
}
```

### L2 -> L1 Withdrawal

Withdrawal is the most complex part of Layer2 interaction, as it involves a 7-day challenge period:

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
    estimatedL1Time: '7 days', // Challenge period
    nextStep: 'After the 7-day challenge period, execute claim on L1',
  };
}

// Withdrawal status tracking
class WithdrawalTracker {
  constructor(l1Provider, l2Provider) {
    this.l1Provider = l1Provider;
    this.l2Provider = l2Provider;
  }

  async trackArbitrumWithdrawal(l2TxHash) {
    const receipt = await this.l2Provider.getTransactionReceipt(l2TxHash);

    if (!receipt) return { status: 'pending' };

    // Find L2 to L1 message
    const messageHash = this.extractMessageHash(receipt);

    // Check if challenge period has passed
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
      claimTx: 'Need to call Outbox.execute() on L1',
    };
  }

  extractMessageHash(receipt) {
    // Parse Arbitrum's L2ToL1Transaction event
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

## Multi-Layer2 Network Manager

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

  // Unified network switching
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

  // Get contract address on the current chain
  getContractAddress(contractName) {
    if (!this.currentNetwork) {
      throw new Error('Network not initialized');
    }
    const chainId = L2_NETWORKS[this.currentNetwork].chainId;
    return CONTRACT_ADDRESSES[chainId]?.[contractName];
  }

  // Check if contract is deployed on the current network
  async isContractDeployed(contractAddress) {
    const provider = new ethers.providers.Web3Provider(this.ethereum);
    const code = await provider.getCode(contractAddress);
    return code !== '0x';
  }
}
```

## Asset Bridging Frontend Flow

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

## Gas Comparison

```javascript
async function compareGasAcrossNetworks() {
  const networks = {
    ethereum: { provider: ethProvider, gasPrice: await ethProvider.getGasPrice() },
    arbitrum: { provider: arbProvider, gasPrice: await arbProvider.getGasPrice() },
    optimism: { provider: opProvider, gasPrice: await opProvider.getGasPrice() },
  };

  const gasLimit = 150000; // Typical ERC-20 transfer gas
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

Typical Gas fee comparison:

| Operation | Ethereum | Arbitrum | Optimism |
|---|---|---|---|
| ERC-20 transfer | $5-20 | $0.10-0.30 | $0.10-0.20 |
| Swap (DEX) | $50-150 | $0.50-1.50 | $0.40-1.20 |
| Add liquidity | $80-250 | $0.80-2.00 | $0.60-1.50 |

## Summary

The core of frontend adaptation for Arbitrum and Optimism lies in network switching, address mapping, and bridge interactions. The EVM compatibility of both means that contract code requires almost no modification, but the Optimistic Rollup's 7-day challenge period introduces unique UX challenges for the withdrawal flow—the frontend needs to clearly convey the asymmetric experience of "fast deposits, delayed withdrawals."

Multi-L2 network management is an important topic for DApp frontends. Users may frequently switch between Ethereum, Arbitrum, and Optimism, and the frontend needs to gracefully handle network detection, automatic switching, and asset mapping. A good practice is to maintain a unified network configuration center that centrally manages chain IDs, RPC URLs, contract addresses, and bridging logic, avoiding scattered hardcoded values throughout the codebase.
