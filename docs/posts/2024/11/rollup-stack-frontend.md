---
title: "Rollup Stack 前端适配：OP Stack 与 ZK Stack"
date: 2024-11-25 12:42:17
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "对比 OP Stack 与 ZK Stack 的架构差异，深入探讨多 Rollup 环境下的前端跨链交互、消息传递、提现流程及确认时间适配"
wordCount: 3800
---

## OP Stack 架构：Optimism 的模块化 Rollup 框架

OP Stack 是 Optimism 开发的开源 Rollup 框架，其核心理念是将 Rollup 的各组件模块化，使得任何人都能基于 OP Stack 构建自己的 Rollup。OP Stack 的技术架构分为以下层：

- **Data Availability Layer**：使用以太坊 L1 作为 DA 层，交易数据发布到 L1 calldata 或 blobs（EIP-4844）
- **Sequencing Layer**：单一排序器（Sequencer）对交易排序并产生 L2 区块
- **Derivation Layer**：从 L1 数据推导 L2 状态的规则
- **Execution Layer**：使用 EVM 执行交易
- **Settlement Layer**：依赖以太坊 L1 的欺诈证明（Fault Proof）保证安全性

OP Stack 的 Optimistic 模型假设交易是有效的，有 7 天的挑战期。如果有人在挑战期内提交欺诈证明，无效交易会被回滚。

## ZK Stack 架构：zkSync 的模块化 ZK 框架

ZK Stack 是 Matter Labs 开发的模块化 ZK Rollup 框架。与 OP Stack 的 Optimistic 模型不同，ZK Stack 使用零知识证明保证状态转换的有效性：

- **Execution Layer**：zkEVM，兼容 EVM 但每条操作码都有 zk 电路约束
- **Proving Layer**：生成 ZK 证明，证明 L2 状态转换的正确性
- **Verification Layer**：L1 上的验证合约验证 ZK 证明
- **Data Availability**：交易数据发布到 L1

ZK Stack 的关键优势是最终性更快——一旦 ZK 证明在 L1 上验证通过，状态就是最终化的，无需 7 天挑战期。但证明生成需要额外时间和计算成本。

## 前端跨链交互：L1 <-> L2 消息传递

无论是 OP Stack 还是 ZK Stack，L1 与 L2 之间的消息传递都通过特殊的桥接合约实现。前端需要理解消息传递的生命周期：

```
L1 -> L2 消息：
┌─────────┐    depositTX     ┌──────────┐
│ L1 用户  │ ──────────────▶ │ L2 入口   │
└─────────┘                  └──────────┘
     3-5 分钟延迟（等待排序器处理）

L2 -> L1 消息（Withdrawal）：
┌─────────┐  initiateWithdraw  ┌────────────┐  等待挑战期  ┌──────────┐
│ L2 用户  │ ────────────────▶ │ L1 桥接合约 │ ──────────▶ │ L1 用户   │
└─────────┘                    └────────────┘              └──────────┘
   OP Stack: 7 天延迟
   ZK Stack: 证明生成后 ~1 小时
```

## OP Stack 的 withdrawal 前端流程

OP Stack 的提现需要两个步骤：L2 上发起提现 -> L1 上 Claim。以下是完整的前端流程：

```typescript
import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem'
import { mainnet, optimism } from 'viem/chains'
import { writeContract, readContract } from 'viem/actions'

const L2_TO_L1_MESSENGER = '0x4200000000000000000000000000000000000007' as Address
const L1_STANDARD_BRIDGE = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1' as Address

class OPStackBridge {
  private l1Client: PublicClient
  private l2Client: PublicClient
  private l1Wallet: WalletClient | null = null

  constructor(l1Rpc: string, l2Rpc: string) {
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
    this.l2Client = createPublicClient({
      chain: optimism,
      transport: http(l2Rpc),
    })
  }

  // 第一步：在 L2 上发起提现
  async initiateWithdrawal(
    l2WalletClient: WalletClient,
    to: Address,
    amount: bigint,
    minGasLimit: bigint = 200000n,
    extraData: `0x${string}` = '0x',
  ): Promise<Hash> {
    const l2TxHash = await l2WalletClient.writeContract({
      address: L2_TO_L1_MESSENGER,
      abi: l2CrossDomainMessengerAbi,
      functionName: 'sendMessage',
      args: [to, amount, minGasLimit, extraData],
    })

    // 等待 L2 交易确认
    const receipt = await this.l2Client.waitForTransactionReceipt({ hash: l2TxHash })

    // 解析 WithdrawalInitiated 事件
    const logs = parseWithdrawalLogs(receipt.logs)
    return l2TxHash
  }

  // 第二步：检查提现是否可以在 L1 上 Claim
  async checkWithdrawalReadiness(l2TxHash: Hash): Promise<{
    status: 'pending' | 'ready' | 'claimed'
    proof: { outputRootProof: `0x${string}` | null; withdrawalProof: `0x${string}`[] | null }
    l2OutputIndex: bigint | null
    challengeWindowEnds: number | null
  }> {
    // 查询 L1 上的 L2OutputOracle 合约
    const latestOutputIndex = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'latestOutputIndex',
    })

    // 查找该提现对应的 L2 输出索引
    const { withdrawalHash, l2BlockNumber } = await this.getWithdrawalInfo(l2TxHash)
    const l2OutputIndex = await this.findOutputIndex(l2BlockNumber)

    if (l2OutputIndex === null || l2OutputIndex > latestOutputIndex) {
      return {
        status: 'pending',
        proof: { outputRootProof: null, withdrawalProof: null },
        l2OutputIndex,
        challengeWindowEnds: null,
      }
    }

    // 检查挑战窗口是否已过
    const output = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'getL2Output',
      args: [l2OutputIndex],
    })

    const finalizationTime = Number(output.timestamp) + 604800 // 7 天
    if (Date.now() / 1000 < finalizationTime) {
      return {
        status: 'pending',
        proof: { outputRootProof: null, withdrawalProof: null },
        l2OutputIndex,
        challengeWindowEnds: finalizationTime,
      }
    }

    // 获取 Merkle 证明
    const proof = await this.getWithdrawalProof(l2TxHash, l2OutputIndex)

    // 检查是否已被 Claim
    const isClaimed = await this.l1Client.readContract({
      address: L1_STANDARD_BRIDGE,
      abi: bridgeAbi,
      functionName: 'isWithdrawalClaimed',
      args: [withdrawalHash],
    })

    return {
      status: isClaimed ? 'claimed' : 'ready',
      proof,
      l2OutputIndex,
      challengeWindowEnds: finalizationTime,
    }
  }

  // 第三步：在 L1 上 Claim 提现
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const readiness = await this.checkWithdrawalReadiness(l2TxHash)

    if (readiness.status !== 'ready') {
      throw new Error(`Withdrawal not ready: ${readiness.status}`)
    }

    const { withdrawal } = await this.getWithdrawalMessage(l2TxHash)

    return l1WalletClient.writeContract({
      address: L2_TO_L1_MESSENGER,
      abi: l2CrossDomainMessengerAbi,
      functionName: 'relayMessage',
      args: [
        withdrawal.nonce,
        withdrawal.sender,
        withdrawal.target,
        withdrawal.value,
        withdrawal.minGasLimit,
        withdrawal.data,
        proof.outputRootProof!,
        proof.withdrawalProof!,
      ],
    })
  }

  // 辅助方法
  private async getWithdrawalInfo(l2TxHash: Hash) {
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    // 解析日志获取提现信息
    return { withdrawalHash: '0x...', l2BlockNumber: receipt.blockNumber }
  }

  private async findOutputIndex(l2BlockNumber: bigint): Promise<bigint | null> {
    // 遍历 L2OutputOracle 查找包含该区块的输出
    return null // 简化
  }

  private async getWithdrawalProof(l2TxHash: Hash, outputIndex: bigint) {
    // 从 L2 节点获取 Merkle 证明
    return { outputRootProof: '0x...' as `0x${string}`, withdrawalProof: [] as `0x${string}`[] }
  }

  private async getWithdrawalMessage(l2TxHash: Hash) {
    return { withdrawal: { nonce: 0n, sender: '0x', target: '0x', value: 0n, minGasLimit: 0n, data: '0x' } }
  }
}
```

## ZK Stack 的 proof 验证前端适配

ZK Stack 的提现流程不同。它不依赖欺诈证明，而是等待 ZK 证明在 L1 上验证通过：

```typescript
class ZKStackBridge {
  private l1Client: PublicClient
  private l2Client: PublicClient

  constructor(l1Rpc: string, l2Rpc: string) {
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
    this.l2Client = createPublicClient({
      chain: zksync,
      transport: http(l2Rpc),
    })
  }

  // 发起 L2 -> L1 提现
  async initiateWithdrawal(
    l2WalletClient: WalletClient,
    to: Address,
    amount: bigint,
  ): Promise<Hash> {
    return l2WalletClient.writeContract({
      address: ZK_L2_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'withdraw',
      args: [to, amount],
    })
  }

  // 检查提现状态
  async getWithdrawalStatus(l2TxHash: Hash): Promise<{
    status: 'pending' | 'proven' | 'verified' | 'claimed'
    l1BatchNumber: bigint | null
    proofTxHash: Hash | null
  }> {
    // 查询 L2 的提现日志
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    const withdrawalLog = receipt.logs.find((log) =>
      log.address.toLowerCase() === ZK_L2_BRIDGE.toLowerCase(),
    )

    if (!withdrawalLog) throw new Error('Withdrawal log not found')

    const { l1BatchNumber, l2MessageIndex } = decodeWithdrawalLog(withdrawalLog)

    // 检查 L1 上的证明状态
    const isVerified = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalVerified',
      args: [l1BatchNumber, l2MessageIndex],
    })

    if (!isVerified) {
      // 检查证明是否正在生成中
      const proofStatus = await this.checkProofStatus(l1BatchNumber)
      return {
        status: proofStatus === 'proven' ? 'proven' : 'pending',
        l1BatchNumber,
        proofTxHash: null,
      }
    }

    // 检查是否已被 Claim
    const isClaimed = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalClaimed',
      args: [l1BatchNumber, l2MessageIndex],
    })

    return {
      status: isClaimed ? 'claimed' : 'verified',
      l1BatchNumber,
      proofTxHash: null,
    }
  }

  // 在 L1 上 Claim（需要先验证证明）
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const status = await this.getWithdrawalStatus(l2TxHash)

    if (status.status === 'pending') {
      // 需要先提交证明
      await this.submitProof(l1WalletClient, l2TxHash)
    }

    // 最终化提现
    return l1WalletClient.writeContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'finalizeWithdrawal',
      args: [status.l1BatchNumber!, /* message index */ 0n, /* proof data */ '0x'],
    })
  }

  private async checkProofStatus(batchNumber: bigint): Promise<string> {
    return 'pending'
  }

  private async submitProof(walletClient: WalletClient, l2TxHash: Hash): Promise<void> {
    // 通过 L1 验证器提交证明
  }
}
```

## 多 Rollup 网络管理器

在 Superchain 时代，DApp 可能同时部署在多个 Rollup 上。以下是一个多 Rollup 网络管理器：

```typescript
import { createPublicClient, http, type Chain, type Address } from 'viem'
import { mainnet, optimism, base, arbitrum } from 'viem/chains'

interface RollupConfig {
  chain: Chain
  rpcUrl: string
  stackType: 'op' | 'zk' | 'arbitrum'
  l1BridgeAddress: Address
  l2BridgeAddress: Address
  confirmationBlocks: number
  withdrawalDelay: number // 秒
}

class MultiRollupManager {
  private rollups: Map<number, { config: RollupConfig; client: PublicClient }>
  private l1Client: PublicClient

  constructor(l1Rpc: string) {
    this.rollups = new Map()
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
  }

  registerRollup(config: RollupConfig) {
    const client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    })
    this.rollups.set(config.chain.id, { config, client })
  }

  // 获取所有 Rollup 的状态
  async getAllRollupStatus(): Promise<{
    chainId: number
    chainName: string
    blockNumber: bigint
    finalizedBlock: bigint
    stackType: string
  }[]> {
    const statuses = await Promise.all(
      Array.from(this.rollups.entries()).map(async ([chainId, { config, client }]) => {
        const [blockNumber, finalizedBlock] = await Promise.all([
          client.getBlockNumber(),
          client.getBlock({ blockTag: 'finalized' }).then((b) => b.number),
        ])
        return {
          chainId,
          chainName: config.chain.name,
          blockNumber,
          finalizedBlock,
          stackType: config.stackType,
        }
      }),
    )
    return statuses
  }

  // 跨链资产转移
  async bridgeAsset(
    fromChainId: number,
    toChainId: number,
    amount: bigint,
    token: Address,
    recipient: Address,
    walletClient: WalletClient,
  ): Promise<Hash> {
    const source = this.rollups.get(fromChainId)
    if (!source) throw new Error(`Chain ${fromChainId} not registered`)

    // 检查目标链是否已注册
    const target = this.rollups.get(toChainId)
    if (!target) throw new Error(`Chain ${toChainId} not registered`)

    // 根据源链的 stack 类型选择桥接方式
    switch (source.config.stackType) {
      case 'op':
        return this.bridgeViaOPStack(walletClient, source, target, amount, token, recipient)
      case 'zk':
        return this.bridgeViaZKStack(walletClient, source, target, amount, token, recipient)
      default:
        return this.bridgeViaL1(walletClient, source, target, amount, token, recipient)
    }
  }

  private async bridgeViaOPStack(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    // 如果是 L2 -> L2（通过 L1 中转），先提现到 L1 再存入目标 L2
    // 如果是 L1 -> L2，直接 deposit
    throw new Error('Not implemented')
  }

  private async bridgeViaZKStack(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    throw new Error('Not implemented')
  }

  private async bridgeViaL1(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    throw new Error('Not implemented')
  }
}

// 使用示例
const manager = new MultiRollupManager('https://eth.llamarpc.com')
manager.registerRollup({
  chain: optimism,
  rpcUrl: 'https://mainnet.optimism.io',
  stackType: 'op',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  confirmationBlocks: 1,
  withdrawalDelay: 604800, // 7 天
})
manager.registerRollup({
  chain: base,
  rpcUrl: 'https://mainnet.base.org',
  stackType: 'op',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  confirmationBlocks: 1,
  withdrawalDelay: 604800,
})
```

## Superchain 概念与前端跨链 UX

Superchain 是 OP Stack 链的集合，共享 L1 安全性和桥接基础设施。在 Superchain 中，链之间的消息传递是原生的，无需经过 L1 中转。

前端 UX 上，Superchain 内的跨链应该对用户透明。理想的体验是：用户在 Base 上点击 "Transfer to Optimism"，几秒钟后资产就到账了，无需切换网络或签名多次。

实现这种体验需要后端中继器（Relayer）支持，前端只需发起 L2 交易并轮询目标链的到账状态。

## 前端适配：不同 Rollup 的确认时间差异

不同 Rollup 的出块时间和最终性差异显著，前端必须适配：

| Rollup | 出块时间 | 安全确认数 | 最终性 |
|--------|---------|-----------|--------|
| Ethereum L1 | ~12s | 12-64 块 | ~6.4 分钟（1 epoch）|
| Optimism | ~2s | 1 块（软）| 7 天（硬）|
| Base | ~2s | 1 块（软）| 7 天（硬）|
| Arbitrum | ~250ms | 1 块（软）| 7 天（硬）|
| zkSync Era | ~2s | 1 块（软）| 证明验证后 |

```typescript
interface ConfirmationConfig {
  softConfirmations: number  // 前端展示 "已确认" 所需的区块数
  hardFinalityTime: number   // 真正最终化所需时间（秒）
  label: string              // 给用户展示的确认级别
}

function getConfirmationConfig(chainId: number): ConfirmationConfig {
  switch (chainId) {
    case 1: // Ethereum
      return { softConfirmations: 12, hardFinalityTime: 384, label: '区块确认' }
    case 10: // Optimism
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '快速确认（最终化需 7 天）' }
    case 8453: // Base
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '快速确认（最终化需 7 天）' }
    case 42161: // Arbitrum
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '即时确认（最终化需 7 天）' }
    case 324: // zkSync Era
      return { softConfirmations: 1, hardFinalityTime: 3600, label: '快速确认（证明验证后最终化）' }
    default:
      return { softConfirmations: 12, hardFinalityTime: 384, label: '区块确认' }
  }
}

// 前端交易确认追踪器
async function trackTransaction(
  chainId: number,
  txHash: Hash,
  publicClient: PublicClient,
  onStatusChange: (status: string, confirmations: number) => void,
) {
  const config = getConfirmationConfig(chainId)

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  if (receipt.status === 'reverted') {
    onStatusChange('failed', 0)
    return
  }

  onStatusChange('confirmed', 0)

  // 跟踪确认数
  let currentBlock = await publicClient.getBlockNumber()
  while (currentBlock - receipt.blockNumber < config.softConfirmations) {
    onStatusChange('confirming', Number(currentBlock - receipt.blockNumber))
    await new Promise((r) => setTimeout(r, 2000))
    currentBlock = await publicClient.getBlockNumber()
  }

  onStatusChange('finalized', config.softConfirmations)
}
```

## 合约部署差异：OP Stack vs ZK Stack

OP Stack 使用标准 EVM，Solidity 合约可以直接部署。ZK Stack 使用 zkEVM，虽然大部分操作码兼容，但某些预编译合约和操作码有差异：

```typescript
// 部署脚本差异
async function deployContract(
  stackType: 'op' | 'zk',
  walletClient: WalletClient,
  bytecode: `0x${string}`,
  abi: Abi,
  args: unknown[],
) {
  if (stackType === 'op') {
    // OP Stack: 标准 EVM 部署
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  } else {
    // ZK Stack: 需要检查合约兼容性
    // 1. 确保没有使用不支持的操作码
    // 2. 对于复杂合约，可能需要使用 zkSync 的编译器重新编译
    // 3. 使用 zksync-specific 的部署方法
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  }
}
```

## 小结

OP Stack 和 ZK Stack 代表了 Rollup 的两种技术路线：Optimistic 和 ZK。对前端开发者而言，核心差异在于提现流程和确认时间——OP Stack 的 7 天挑战期 vs ZK Stack 的证明验证。多 Rollup 环境下，前端需要一个统一的网络管理器来处理跨链交互、多确认标准和不同的桥接协议。Superchain 的愿景是让跨链变得无缝，但这需要后端中继器和前端状态追踪的配合。Rollup as a Service (RaaS) 的兴起意味着未来会有更多 Rollup 链，前端的适配能力将成为关键挑战。理解不同 Stack 的架构差异和适配策略，是构建跨 Rollup DApp 的基础。
