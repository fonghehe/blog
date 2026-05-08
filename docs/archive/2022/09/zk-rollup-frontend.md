---
title: "zkSync 前端集成：零知识证明 Layer2 交互"
date: 2022-09-19 13:53:40
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "zkSync 2.0 (era) 原生支持账户抽象和 Paymaster，前端集成方式与 EVM Layer1 有显著差异。本文覆盖 zkSync 前端开发的完整链路，从 SDK 使用到 Paymaster 集成。"
wordCount: 3100
---

zkSync 2.0（后更名为 zkSync Era）是 Matter Labs 开发的 zkRollup 方案。与 Optimistic Rollup 不同，zkSync 使用零知识证明（具体为 PLONK 证明系统）来保证 L2 状态的有效性，提款不需要 7 天挑战期。更重要的是，zkSync 从底层就原生支持账户抽象（Account Abstraction）和 Paymaster（Gas 代付），这使得前端交互模型与传统 EVM 有显著差异。

## zkSync Era 概述与 zkRollup 原理

### 零知识证明如何保证安全性

zkRollup 的核心思路是：L2 执行所有交易后，生成一个证明（proof），证明这些交易的执行是正确的。L1 只需要验证这个证明，而不需要重新执行所有交易。

```
L2 批量执行交易 → 生成 ZK Proof → 提交到 L1 → L1 验证 Proof → 状态确认
```

与 Optimistic Rollup 的关键区别：

- **OR**：假设所有交易有效，除非有人提交欺诈证明（7 天挑战期）
- **ZKR**：通过数学证明保证交易有效，不需要挑战期

这意味着 zkSync 的 L2 → L1 提款只需要等待证明被 L1 验证（通常几小时），而非 7 天。

### zkSync Era 的 EVM 兼容性

zkSync Era 不是 EVM 等效（EVM-equivalent），而是 EVM 兼容（EVM-compatible）。区别在于：

- **EVM 等效**（如 Optimism Bedrock）：字节码完全一致，现有合约可以直接部署
- **EVM 兼容**（如 zkSync）：支持 Solidity 语法，但编译为目标不同的虚拟机（zkEVM）

因此，部分操作码在 zkSync 上不可用或行为不同（如 `SELFDESTRUCT`、`CALLCODE`），需要特别注意。

## 账户抽象在 zkSync 上的原生支持

zkSync Era 原生支持 EIP-4337 风格的账户抽象，不需要额外的 EntryPoint 合约。每个账户都可以是智能合约钱包，支持自定义签名验证和交易执行逻辑。

```typescript
// zkSync 上的账户可以是：
// 1. EOAs（外部拥有账户）—— 与以太坊一致
// 2. 智能合约账户 —— 原生支持，无需 EntryPoint

// 这意味着前端可以支持：
// - 社交登录钱包（无需助记词）
// - 多签钱包（原生支持，非插件式）
// - Session Key（临时授权密钥）
// - Gas 代付（通过 Paymaster）
```

## Paymaster：Gas 费代付机制

Paymaster 是 zkSync 上最具特色的功能之一。它允许第三方为用户支付 Gas 费，用户可以用 ERC-20 代币（而非 ETH）支付 Gas，甚至完全免费。

### Paymaster 的工作原理

```
用户发起交易 → zkSync 协议检查是否有 Paymaster → Paymaster 支付 Gas
                                                      ↓
                                              用户按约定补偿（可选）
```

### 前端集成 Paymaster

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

async function sendTransactionWithPaymaster(
  wallet: Wallet,
  to: string,
  data: string,
  paymasterAddress: string
) {
  // 构建交易
  const tx = {
    to,
    data,
    from: wallet.address,
    // 指定 Paymaster
    customData: {
      paymasterParams: {
        paymaster: paymasterAddress,
        paymasterInput: '0x', // Paymaster 特定的输入
      },
      // 如果用 ERC-20 支付 Gas，还需要指定 gasPerPubdata
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  // 估算 gas（包含 Paymaster 逻辑）
  const gasEstimate = await wallet.estimateGas(tx)

  // 发送交易
  const txHash = await wallet.sendTransaction({
    ...tx,
    gasLimit: gasEstimate,
  })

  return txHash
}

// 使用 ERC-20 代币支付 Gas 的 Paymaster
async function payGasWithToken(
  wallet: Wallet,
  tokenAddress: string,
  paymasterAddress: string
) {
  const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
    type: 'ERC20',
    token: tokenAddress,
    // Paymaster 允许的最低汇率
    minAllowance: ethers.BigNumber.from('100'),
  })

  const tx = {
    to: wallet.address,
    value: 0,
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  const gasEstimate = await wallet.estimateGas(tx)
  return wallet.sendTransaction({ ...tx, gasLimit: gasEstimate })
}
```

## zksync-web3 SDK 使用

`zksync-web3` 是 zkSync 官方的 JavaScript SDK，API 设计与 ethers.js 高度兼容，但增加了 zkSync 特有的功能。

### 基础使用

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

// 初始化 Provider
const zkSyncProvider = new Provider('https://zksync-era-mainnet.chainstacklabs.com')
const ethereumProvider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY'
)

// 从以太坊钱包创建 zkSync 钱包
const ethWallet = new ethers.Wallet(PRIVATE_KEY, ethereumProvider)
const zkSyncWallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethWallet)

// 查询余额
const ethBalance = await zkSyncWallet.getBalance()
const tokenBalances = await zkSyncWallet.getBalances()

// L1 -> L2 充值
async function depositETH(amount: string) {
  const tx = await zkSyncWallet.deposit({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
    // 可选：refundRecipient
  })

  // 等待 L1 交易确认
  await tx.wait()

  // 等待 L2 上反映（通常需要几分钟）
  await tx.waitFinalize()

  return tx
}

// L2 转账
async function transfer(token: string, to: string, amount: string) {
  const tx = await zkSyncWallet.transfer({
    to,
    token,
    amount: ethers.utils.parseEther(amount),
  })

  await tx.wait()
  return tx
}

// L2 -> L1 提款
async function withdrawETH(amount: string) {
  const tx = await zkSyncWallet.withdraw({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
  })

  // L2 交易确认（通常几秒）
  await tx.wait()

  // 注意：虽然不需要 7 天挑战期
  // 但仍需等待 ZK Proof 被验证（几小时）
  // 用户不需要手动 finalize！
  return tx
}
```

### ethers v6 adapter

对于需要使用 ethers v6 的项目，zkSync 提供了适配器：

```typescript
import { ethers } from 'ethers'
import { ZkSyncEthersAdapter } from 'zksync-web3'

const adapter = new ZkSyncEthersAdapter({
  zkSyncProvider,
  ethProvider,
})

// 通过 adapter 使用 ethers v6 的 Contract
const contract = adapter.getContract(
  contractAddress,
  abi,
  zkSyncWallet
)

// 调用合约方法与 ethers v6 一致
const tx = await contract.transfer(recipient, amount)
await tx.wait()
```

## 合约部署到 zkSync

### 编译器差异

zkSync 使用自己的编译器 `zksolc`，而非标准的 `solc`。`zksolc` 接受 `solc` 的输出作为输入，然后编译为 zkEVM 字节码。

```bash
# 安装 zksolc
npm install -g @matterlabs/zksolc-bin

# 编译合约
zksolc --combined-json bin,abi contracts/MyContract.sol
```

### 使用 Hardhat 插件部署

```typescript
// hardhat.config.ts
import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'

export default {
  solidity: {
    version: '0.8.17',
  },
  zksolc: {
    version: '1.3.1',
    compilerSource: 'binary',
    settings: {
      optimizer: {
        enabled: true,
        mode: 'z',
      },
    },
  },
  networks: {
    zkSyncTestnet: {
      url: 'https://zksync2-testnet.zksync.dev',
      ethNetwork: 'goerli',
      zksync: true,
    },
    zkSyncMainnet: {
      url: 'https://zksync2-mainnet.zksync.io',
      ethNetwork: 'mainnet',
      zksync: true,
    },
  },
}
```

```typescript
// deploy/deploy.ts
import { Wallet, utils, ContractFactory } from 'zksync-web3'
import * as ethers from 'ethers'
import { readFileSync } from 'fs'

async function deploy() {
  const wallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethProvider)

  // 读取编译后的 ABI 和字节码
  const artifact = JSON.parse(
    readFileSync('./artifacts/MyContract.json', 'utf8')
  )

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  )

  // 部署合约
  const contract = await factory.deploy(
    constructorArg1,
    constructorArg2
  )

  await contract.deployed()
  console.log('Contract deployed to:', contract.address)
}

deploy()
```

## 前端网络配置与 MetaMask 集成

### MetaMask 添加 zkSync 网络

```typescript
// lib/network.ts
export const ZK_SYNC_MAINNET = {
  chainId: '0x144', // 324
  chainName: 'zkSync Era Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-mainnet.zksync.io'],
  blockExplorerUrls: ['https://explorer.zksync.io'],
}

export const ZK_SYNC_TESTNET = {
  chainId: '0x118', // 280
  chainName: 'zkSync Era Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-testnet.zksync.dev'],
  blockExplorerUrls: ['https://goerli.explorer.zksync.io'],
}

export async function switchToZkSync(
  provider: ethers.providers.Web3Provider
) {
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: ZK_SYNC_MAINNET.chainId },
    ])
  } catch (switchError: any) {
    // 链尚未添加到 MetaMask
    if (switchError.code === 4902) {
      await provider.send('wallet_addEthereumChain', [ZK_SYNC_MAINNET])
    } else {
      throw switchError
    }
  }
}
```

### 前端连接 zkSync 钱包

```typescript
// hooks/useZkSyncWallet.ts
import { useState, useEffect } from 'react'
import { Provider, Wallet } from 'zksync-web3'
import { ethers } from 'ethers'

export function useZkSyncWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [l1Provider, setL1Provider] =
    useState<ethers.providers.Web3Provider | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    const ethProvider = new ethers.providers.Web3Provider(
      window.ethereum
    )
    const zkProvider = new Provider(
      'https://zksync2-mainnet.zksync.io'
    )

    setL1Provider(ethProvider)
    setProvider(zkProvider)

    // 检查已连接的账户
    ethProvider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0])
      }
    })

    // 监听账户切换
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // 监听链切换
    window.ethereum.on('chainChanged', () => {
      window.location.reload()
    })
  }, [])

  const connect = async () => {
    if (!l1Provider) return
    const accounts = await l1Provider.send('eth_requestAccounts', [])
    setAccount(accounts[0])
  }

  return { account, provider, l1Provider, connect }
}
```

## L1 <-> L2 消息传递

zkSync 支持 L1 和 L2 之间的双向消息传递。与 Optimistic Rollup 不同，L2 → L1 的消息不需要 7 天挑战期，但需要等待 ZK Proof 验证。

### L1 → L2 消息

```typescript
// 从 L1 向 L2 发送消息（不仅仅是存款）
async function sendL1ToL2Message(
  l1Wallet: ethers.Wallet,
  zkSyncProvider: Provider,
  l2ContractAddress: string,
  calldata: string
) {
  // 使用 zkSync 的 Mailbox 合约
  const mailboxAddress = '0x...'
  const mailbox = new ethers.Contract(
    mailboxAddress,
    [
      'function requestL2Transaction(address _contract, uint256 _l2Value, bytes _calldata, uint256 _l2GasLimit, uint256 _l2GasPerPubdataByteLimit, bytes[] _factoryDeps, address _refundRecipient) external payable',
    ],
    l1Wallet
  )

  const tx = await mailbox.requestL2Transaction(
    l2ContractAddress,
    0, // L2 value
    calldata,
    1_000_000, // L2 gas limit
    800, // gas per pubdata byte
    [], // factory deps
    l1Wallet.address // refund recipient
  )

  await tx.wait()

  // 等待 L2 上执行
  const l2TxHash = await zkSyncProvider.getL2TxHashFromPriorityOp(tx)
  await zkSyncProvider.wait(l2TxHash)

  return { l1TxHash: tx.hash, l2TxHash }
}
```

### L2 → L1 消息

```typescript
// 从 L2 向 L1 发送消息
async function sendL2ToL1Message(
  zkSyncWallet: Wallet,
  l1ContractAddress: string,
  calldata: string
) {
  const tx = await zkSyncWallet.sendTransaction({
    to: l1ContractAddress,
    data: calldata,
    // L1 gas limit
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  })

  await tx.wait()
  return tx.hash
}
```

## zkSync DApp 前端完整模块

```typescript
// lib/zkSyncDApp.ts
import { Provider, Wallet, utils, types } from 'zksync-web3'
import { ethers, BigNumber } from 'ethers'

export class ZkSyncDApp {
  private provider: Provider
  private l1Provider: ethers.providers.JsonRpcProvider
  private wallet: Wallet | null = null

  constructor(
    zkSyncRpcUrl: string,
    l1RpcUrl: string
  ) {
    this.provider = new Provider(zkSyncRpcUrl)
    this.l1Provider = new ethers.providers.JsonRpcProvider(l1RpcUrl)
  }

  // 连接钱包
  connect(privateKey: string) {
    this.wallet = new Wallet(
      privateKey,
      this.provider,
      new ethers.Wallet(privateKey, this.l1Provider)
    )
  }

  // 获取余额（ETH + ERC-20）
  async getAllBalances(address: string) {
    const balances = await this.provider.getAllBalances(address)
    return balances
  }

  // 充值（L1 -> L2）
  async deposit(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.deposit({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L1 确认
    await tx.waitFinalize() // L2 确认

    return tx
  }

  // L2 转账
  async transfer(token: string, to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.transfer({
      to,
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    return tx.wait()
  }

  // 提款（L2 -> L1）
  async withdraw(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.withdraw({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L2 确认
    // 不需要手动 finalize！ZK Proof 验证后自动到账

    return tx
  }

  // 使用 Paymaster 发送交易（ERC-20 支付 Gas）
  async sendWithPaymaster(
    to: string,
    data: string,
    paymasterAddress: string,
    gasToken: string
  ) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
      type: 'ERC20',
      token: gasToken,
      minAllowance: BigNumber.from('0'),
    })

    const gasEstimate = await this.wallet.estimateGas({
      to,
      data,
      from: this.wallet.address,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    const tx = await this.wallet.sendTransaction({
      to,
      data,
      gasLimit: gasEstimate,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    return tx.wait()
  }

  // 获取交易状态
  async getTransactionStatus(txHash: string) {
    const receipt = await this.provider.getTransactionReceipt(txHash)
    if (!receipt) return null

    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.transactionIndex,
      gasUsed: receipt.gasUsed.toString(),
      // zkSync 特有：公数据字节 gas
      gasPerPubdataUsed: receipt.gasPerPubdataUsed?.toString(),
    }
  }
}
```

## Gas 估算与交易确认特点

zkSync 的 Gas 模型与 L1 有显著差异，引入了"公数据"（pubdata）的概念：

```typescript
// zkSync Gas 模型
// 总 Gas = L2 Gas + L1 Gas（用于发布 pubdata）

// pubdata 是发布到 L1 的数据，决定了成本
// 每笔交易有一个 gasPerPubdata 参数

async function estimateGas(
  wallet: Wallet,
  tx: types.TransactionRequest
) {
  // zkSync 特有的 Gas 估算
  const gasEstimate = await wallet.estimateGas(tx)

  // 还需要估算 pubdata gas
  const pubdataGas = await wallet.estimateGasL1ToL2(tx)

  return {
    l2Gas: gasEstimate,
    pubdataGas,
    total: gasEstimate.add(pubdataGas),
  }
}
```

交易确认特点：

- **L2 交易**：通常 1-2 秒确认（即时）
- **L1 → L2 充值**：需要 L1 确认 + L2 最终确认（几分钟）
- **L2 → L1 提款**：需要 ZK Proof 验证（几小时），但无需用户手动 finalize

## 与 Optimistic Rollup 的前端适配差异

| 维度 | Optimistic Rollup | zkSync Era |
|------|------------------|------------|
| 提款时间 | ~7 天 | 几小时 |
| 提款操作 | 需要手动 finalize | 自动完成 |
| Gas 支付 | 仅 ETH | ETH + ERC-20（Paymaster） |
| 账户模型 | EOA + 智能合约 | 原生账户抽象 |
| SDK | ethers.js 兼容 | zksync-web3（ethers 衍生） |
| 合约部署 | 直接部署 | 需要 zksolc 编译 |
| 状态轮询 | 复杂（跨链） | 简单（自动确认） |

## 小结

zkSync Era 的前端开发在许多方面比 Optimistic Rollup 简单——提款不需要手动 finalize、不需要管理 7 天等待期的状态机。但 zkSync 引入了新的概念：Paymaster、账户抽象、pubdata Gas 模型，这些都需要前端开发者学习新的交互模式。

Paymaster 是 zkSync 最具创新性的功能。它让 DApp 可以补贴用户的 Gas 费，或者让用户用稳定币支付 Gas，这对降低用户门槛有巨大价值。在传统 EVM 上实现 Gas 代付需要复杂的 relayer 基础设施，而在 zkSync 上是原生支持的能力。

SDK 的选择上，`zksync-web3` 与 ethers v5 高度兼容，迁移成本较低。但需要注意 zkSync 特有的 `customData` 字段和 Gas 估算方式。对于已有 EVM DApp，迁移到 zkSync 的主要工作量在于：调整合约编译流程（使用 zksolc）、适配 Paymaster、以及测试 zkEVM 兼容性（某些操作码不可用）。

随着 zkRollup 生态的快速发展和零知识证明技术的成熟，zkSync 代表了 Layer 2 扩容的一个重要方向。前端开发者应该尽早熟悉这种新的交互模型。
