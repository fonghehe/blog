---
title: "Rollup Stack 前端適配：OP Stack 與 ZK Stack"
date: 2024-11-25 12:42:17
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "對比 OP Stack 與 ZK Stack 的架構差異，深入探討多 Rollup 環境下的前端跨鏈交互、消息傳遞、提現流程及確認時間適配"
wordCount: 3800
---

## OP Stack 架構：Optimism 的模塊化 Rollup 框架

OP Stack 是 Optimism 開發的開源 Rollup 框架，其核心理念是將 Rollup 的各組件模塊化，使得任何人都能基於 OP Stack 構建自己的 Rollup。OP Stack 的技術架構分為以下層：

- **Data Availability Layer**：使用以太坊 L1 作為 DA 層，交易數據發佈到 L1 calldata 或 blobs（EIP-4844）
- **Sequencing Layer**：單一排序器（Sequencer）對交易排序併產生 L2 區塊
- **Derivation Layer**：從 L1 數據推導 L2 狀態的規則
- **Execution Layer**：使用 EVM 執行交易
- **Settlement Layer**：依賴以太坊 L1 的欺詐證明（Fault Proof）保證安全性

OP Stack 的 Optimistic 模型假設交易是有效的，有 7 天的挑戰期。如果有人在挑戰期內提交欺詐證明，無效交易會被回滾。

## ZK Stack 架構：zkSync 的模塊化 ZK 框架

ZK Stack 是 Matter Labs 開發的模塊化 ZK Rollup 框架。與 OP Stack 的 Optimistic 模型不同，ZK Stack 使用零知識證明保證狀態轉換的有效性：

- **Execution Layer**：zkEVM，兼容 EVM 但每條操作碼都有 zk 電路約束
- **Proving Layer**：生成 ZK 證明，證明 L2 狀態轉換的正確性
- **Verification Layer**：L1 上的驗證合約驗證 ZK 證明
- **Data Availability**：交易數據發佈到 L1

ZK Stack 的關鍵優勢是最終性更快——一旦 ZK 證明在 L1 上驗證通過，狀態就是最終化的，無需 7 天挑戰期。但證明生成需要額外時間和計算成本。

## 前端跨鏈交互：L1 <-> L2 消息傳遞

無論是 OP Stack 還是 ZK Stack，L1 與 L2 之間的消息傳遞都通過特殊的橋接合約實現。前端需要理解消息傳遞的生命週期：

```
L1 -> L2 消息：
┌─────────┐    depositTX     ┌──────────┐
│ L1 用戶  │ ──────────────▶ │ L2 入口   │
└─────────┘                  └──────────┘
     3-5 分鐘延遲（等待排序器處理）

L2 -> L1 消息（Withdrawal）：
┌─────────┐  initiateWithdraw  ┌────────────┐  等待挑戰期  ┌──────────┐
│ L2 用戶  │ ────────────────▶ │ L1 橋接合約 │ ──────────▶ │ L1 用戶   │
└─────────┘                    └────────────┘              └──────────┘
   OP Stack: 7 天延遲
   ZK Stack: 證明生成後 ~1 小時
```

## OP Stack 的 withdrawal 前端流程

OP Stack 的提現需要兩個步驟：L2 上發起提現 -> L1 上 Claim。以下是完整的前端流程：

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

  // 第一步：在 L2 上發起提現
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

    // 等待 L2 交易確認
    const receipt = await this.l2Client.waitForTransactionReceipt({ hash: l2TxHash })

    // 解析 WithdrawalInitiated 事件
    const logs = parseWithdrawalLogs(receipt.logs)
    return l2TxHash
  }

  // 第二步：檢查提現是否可以在 L1 上 Claim
  async checkWithdrawalReadiness(l2TxHash: Hash): Promise<{
    status: 'pending' | 'ready' | 'claimed'
    proof: { outputRootProof: `0x${string}` | null; withdrawalProof: `0x${string}`[] | null }
    l2OutputIndex: bigint | null
    challengeWindowEnds: number | null
  }> {
    // 查詢 L1 上的 L2OutputOracle 合約
    const latestOutputIndex = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'latestOutputIndex',
    })

    // 查找該提現對應的 L2 輸出索引
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

    // 檢查挑戰窗口是否已過
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

    // 獲取 Merkle 證明
    const proof = await this.getWithdrawalProof(l2TxHash, l2OutputIndex)

    // 檢查是否已被 Claim
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

  // 第三步：在 L1 上 Claim 提現
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

  // 輔助方法
  private async getWithdrawalInfo(l2TxHash: Hash) {
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    // 解析日誌獲取提現信息
    return { withdrawalHash: '0x...', l2BlockNumber: receipt.blockNumber }
  }

  private async findOutputIndex(l2BlockNumber: bigint): Promise<bigint | null> {
    // 遍歷 L2OutputOracle 查找包含該區塊的輸出
    return null // 簡化
  }

  private async getWithdrawalProof(l2TxHash: Hash, outputIndex: bigint) {
    // 從 L2 節點獲取 Merkle 證明
    return { outputRootProof: '0x...' as `0x${string}`, withdrawalProof: [] as `0x${string}`[] }
  }

  private async getWithdrawalMessage(l2TxHash: Hash) {
    return { withdrawal: { nonce: 0n, sender: '0x', target: '0x', value: 0n, minGasLimit: 0n, data: '0x' } }
  }
}
```

## ZK Stack 的 proof 驗證前端適配

ZK Stack 的提現流程不同。它不依賴欺詐證明，而是等待 ZK 證明在 L1 上驗證通過：

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

  // 發起 L2 -> L1 提現
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

  // 檢查提現狀態
  async getWithdrawalStatus(l2TxHash: Hash): Promise<{
    status: 'pending' | 'proven' | 'verified' | 'claimed'
    l1BatchNumber: bigint | null
    proofTxHash: Hash | null
  }> {
    // 查詢 L2 的提現日誌
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    const withdrawalLog = receipt.logs.find((log) =>
      log.address.toLowerCase() === ZK_L2_BRIDGE.toLowerCase(),
    )

    if (!withdrawalLog) throw new Error('Withdrawal log not found')

    const { l1BatchNumber, l2MessageIndex } = decodeWithdrawalLog(withdrawalLog)

    // 檢查 L1 上的證明狀態
    const isVerified = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalVerified',
      args: [l1BatchNumber, l2MessageIndex],
    })

    if (!isVerified) {
      // 檢查證明是否正在生成中
      const proofStatus = await this.checkProofStatus(l1BatchNumber)
      return {
        status: proofStatus === 'proven' ? 'proven' : 'pending',
        l1BatchNumber,
        proofTxHash: null,
      }
    }

    // 檢查是否已被 Claim
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

  // 在 L1 上 Claim（需要先驗證證明）
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const status = await this.getWithdrawalStatus(l2TxHash)

    if (status.status === 'pending') {
      // 需要先提交證明
      await this.submitProof(l1WalletClient, l2TxHash)
    }

    // 最終化提現
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
    // 通過 L1 驗證器提交證明
  }
}
```

## 多 Rollup 網絡管理器

在 Superchain 中，DApp 可能同時部署在多個 Rollup 上。以下是一個多 Rollup 網絡管理器：

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

  // 獲取所有 Rollup 的狀態
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

  // 跨鏈資產轉移
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

    // 檢查目標鏈是否已註冊
    const target = this.rollups.get(toChainId)
    if (!target) throw new Error(`Chain ${toChainId} not registered`)

    // 根據源鏈的 stack 類型選擇橋接方式
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
    // 如果是 L2 -> L2（通過 L1 中轉），先提現到 L1 再存入目標 L2
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

## Superchain 概念與前端跨鏈 UX

Superchain 是 OP Stack 鏈的集合，共享 L1 安全性和橋接基礎設施。在 Superchain 中，鏈之間的消息傳遞是原生的，無需經過 L1 中轉。

前端 UX 上，Superchain 內的跨鏈應該對用戶透明。理想的體驗是：用戶在 Base 上點擊 "Transfer to Optimism"，幾秒鐘後資產就到賬了，無需切換網絡或簽名多次。

實現這種體驗需要後端中繼器（Relayer）支持，前端只需發起 L2 交易並輪詢目標鏈的到賬狀態。

## 前端適配：不同 Rollup 的確認時間差異

不同 Rollup 的出塊時間和最終性差異顯著，前端必須適配：

| Rollup | 出塊時間 | 安全確認數 | 最終性 |
|--------|---------|-----------|--------|
| Ethereum L1 | ~12s | 12-64 塊 | ~6.4 分鐘（1 epoch）|
| Optimism | ~2s | 1 塊（軟）| 7 天（硬）|
| Base | ~2s | 1 塊（軟）| 7 天（硬）|
| Arbitrum | ~250ms | 1 塊（軟）| 7 天（硬）|
| zkSync Era | ~2s | 1 塊（軟）| 證明驗證後 |

```typescript
interface ConfirmationConfig {
  softConfirmations: number  // 前端展示 "已確認" 所需的區塊數
  hardFinalityTime: number   // 真正最終化所需時間（秒）
  label: string              // 給用戶展示的確認級別
}

function getConfirmationConfig(chainId: number): ConfirmationConfig {
  switch (chainId) {
    case 1: // Ethereum
      return { softConfirmations: 12, hardFinalityTime: 384, label: '區塊確認' }
    case 10: // Optimism
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '快速確認（最終化需 7 天）' }
    case 8453: // Base
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '快速確認（最終化需 7 天）' }
    case 42161: // Arbitrum
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '即時確認（最終化需 7 天）' }
    case 324: // zkSync Era
      return { softConfirmations: 1, hardFinalityTime: 3600, label: '快速確認（證明驗證後最終化）' }
    default:
      return { softConfirmations: 12, hardFinalityTime: 384, label: '區塊確認' }
  }
}

// 前端交易確認追蹤器
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

  // 跟蹤確認數
  let currentBlock = await publicClient.getBlockNumber()
  while (currentBlock - receipt.blockNumber < config.softConfirmations) {
    onStatusChange('confirming', Number(currentBlock - receipt.blockNumber))
    await new Promise((r) => setTimeout(r, 2000))
    currentBlock = await publicClient.getBlockNumber()
  }

  onStatusChange('finalized', config.softConfirmations)
}
```

## 合約部署差異：OP Stack vs ZK Stack

OP Stack 使用標準 EVM，Solidity 合約可以直接部署。ZK Stack 使用 zkEVM，雖然大部分操作碼兼容，但某些預編譯合約和操作碼有差異：

```typescript
// 部署腳本差異
async function deployContract(
  stackType: 'op' | 'zk',
  walletClient: WalletClient,
  bytecode: `0x${string}`,
  abi: Abi,
  args: unknown[],
) {
  if (stackType === 'op') {
    // OP Stack: 標準 EVM 部署
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  } else {
    // ZK Stack: 需要檢查合約兼容性
    // 1. 確保沒有使用不支持的操作碼
    // 2. 對於複雜合約，可能需要使用 zkSync 的編譯器重新編譯
    // 3. 使用 zksync-specific 的部署方法
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  }
}
```

## 小結

OP Stack 和 ZK Stack 代表了 Rollup 的兩種技術路線：Optimistic 和 ZK。對前端開發者而言，核心差異在於提現流程和確認時間——OP Stack 的 7 天挑戰期 vs ZK Stack 的證明驗證。多 Rollup 環境下，前端需要一個統一的網絡管理器來處理跨鏈交互、多確認標準和不同的橋接協議。Superchain 的願景是讓跨鏈變得無縫，但這需要後端中繼器和前端狀態追蹤的配合。Rollup as a Service (RaaS) 的興起意味著未來會有更多 Rollup 鏈，前端的適配能力將成為關鍵挑戰。理解不同 Stack 的架構差異和適配策略，是構建跨 Rollup DApp 的基礎。
