---
title: "模块化区块链前端：Celestia 与 EigenLayer 集成"
date: 2024-03-22 19:53:23
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "探讨模块化区块链架构下前端数据读取的变化，涵盖 Celestia DA 层交互、EigenLayer AVS 集成及多层数据源管理"
wordCount: 1082
---

## 模块化区块链概念：DA 层、结算层、执行层

模块化区块链将传统单体链的功能拆分为多个专用层：

- **数据可用性层（DA Layer）**：负责保证交易数据可被访问和验证，不关心执行逻辑
- **结算层（Settlement Layer）**：提供最终性保证和跨 Rollup 结算
- **执行层（Execution Layer）**：处理交易执行和状态转换
- **共识层（Consensus Layer）**：就交易排序和最终性达成共识

Celestia 是纯粹的 DA 层，只做数据可用性广播和验证。EigenLayer 则是基于以太坊的再质押协议，允许 AVS（Active Validated Services）复用以太坊的安全性。这两者代表了模块化区块链的两个方向：横向拆分功能层和纵向复用安全层。

## Celestia 数据可用性层的前端读取

Celestia 的核心创新是数据可用性采样（Data Availability Sampling, DAS）。轻客户端无需下载完整区块数据，只需随机采样少量数据块即可验证数据可用性。这对前端应用意义重大——DApp 可以在浏览器中验证链上数据是否可用，而无需信任全节点。

Celestia 的前端交互主要通过 Celestia Node 的 RPC API 进行。以下是核心交互流程：

```typescript
// Celestia DA 层前端读取模块
import { createPublicClient, http, type Hash } from 'viem'

interface CelestiaClient {
  // 提交 blob 数据到 DA 层
  submitBlob: (namespace: string, data: Uint8Array) => Promise<{ height: number; commitment: Uint8Array }>
  // 根据 height 和 commitment 获取 blob
  getBlob: (height: number, namespace: string, commitment: Uint8Array) => Promise<Uint8Array | null>
  // 获取指定高度的 DAS 证明
  getDASProof: (height: number) => Promise<DASProof>
  // 检查数据可用性
  checkAvailability: (height: number) => Promise<boolean>
}

interface DASProof {
  blockHeight: number
  dataRoot: Uint8Array
  sampledShares: { row: number; column: number; data: Uint8Array }[]
  proofs: Uint8Array[]
}

function createCelestiaClient(nodeUrl: string): CelestiaClient {
  async function rpcCall(method: string, params: any[]) {
    const response = await fetch(nodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error.message)
    return json.result
  }

  return {
    async submitBlob(namespace: string, data: Uint8Array) {
      const base64Data = bytesToBase64(data)
      const result = await rpcCall('blob.Submit', [
        {
          namespace: namespaceToBase64(namespace),
          data: base64Data,
        },
      ])
      return {
        height: result.height,
        commitment: base64ToBytes(result.commitment),
      }
    },

    async getBlob(height: number, namespace: string, commitment: Uint8Array) {
      try {
        const result = await rpcCall('blob.Get', [
          height,
          namespaceToBase64(namespace),
          bytesToBase64(commitment),
        ])
        return base64ToBytes(result.data)
      } catch {
        return null
      }
    },

    async getDASProof(height: number) {
      const result = await rpcCall('daser.GetDASProof', [height])
      return {
        blockHeight: result.block_height,
        dataRoot: base64ToBytes(result.data_root),
        sampledShares: result.sampled_shares.map((s: any) => ({
          row: s.row,
          column: s.column,
          data: base64ToBytes(s.data),
        })),
        proofs: result.proofs.map((p: any) => base64ToBytes(p)),
      }
    },

    async checkAvailability(height: number) {
      const result = await rpcCall('daser.CheckAvailability', [height])
      return result.available
    },
  }
}

// 工具函数
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)))
}

function namespaceToBase64(ns: string): string {
  // namespace 是十六进制字符串，转为 base64
  const bytes = new Uint8Array(ns.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytesToBase64(bytes)
}

export { createCelestiaClient }
export type { CelestiaClient, DASProof }
```

## EigenLayer AVS 概述

EigenLayer 的核心机制是再质押（Restaking）。验证者可以将已经质押在以太坊信标链上的 ETH 再次质押到 EigenLayer，为 AVS 提供安全性。AVS 是独立的服务，例如数据可用性层、预言机、桥接协议等，它们不再需要建立自己的验证者集合，而是复用以太坊的经济安全性。

对前端而言，EigenLayer 的交互主要涉及：

- 查询再质押者的质押状态和收益
- AVS 注册/注销的前端流程
- 罚没（Slashing）事件的通知与展示

## 模块化架构对前端数据读取的影响

单体链时代，前端数据读取模式很简单：一个 RPC 端点搞定一切。模块化架构下，数据散布在不同层：

```
┌─────────────────────────────────────────┐
│           DApp Frontend                  │
├──────────┬──────────┬───────────────────┤
│  执行层   │  结算层   │    DA 层          │
│ (Rollup) │(Ethereum)│  (Celestia)       │
│ RPC #1   │  RPC #2  │   RPC #3          │
└──────────┴──────────┴───────────────────┘
```

前端需要管理多个数据源，每层有不同的延迟和最终性保证。一个典型的查询流程可能是：

1. 从执行层查询当前状态
2. 从结算层确认该状态已最终化
3. 从 DA 层验证交易数据可用

## 轻客户端与数据可用性采样

在浏览器中运行轻客户端是模块化区块链的重要愿景。DAS 允许浏览器端验证数据可用性而无需信任任何中心化 RPC。

```typescript
// 浏览器端 DAS 验证
import { createCelestiaClient, type DASProof } from './celestia-client'

class LightClientDAS {
  private celestia: CelestiaClient
  private sampledHeights = new Map<number, boolean>()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // 验证指定高度的区块数据可用性
  async verifyDataAvailability(height: number): Promise<boolean> {
    // 如果已经验证过，返回缓存结果
    if (this.sampledHeights.has(height)) {
      return this.sampledHeights.get(height)!
    }

    // 获取 DAS 证明
    const proof = await this.celestia.getDASProof(height)

    // 在浏览器中验证采样证明
    const isValid = this.verifyDASProof(proof)

    this.sampledHeights.set(height, isValid)
    return isValid
  }

  private verifyDASProof(proof: DASProof): boolean {
    // 1. 验证 Merkle 证明
    for (let i = 0; i < proof.sampledShares.length; i++) {
      const share = proof.sampledShares[i]
      const merkleProof = proof.proofs[i]
      if (!this.verifyMerkleProof(share.data, merkleProof, proof.dataRoot)) {
        return false
      }
    }

    // 2. 验证采样数量是否足够（通常需要 > 75% 的列）
    // Celestia 使用 2D Reed-Solomon 编码，采样足够多即可高概率确认可用
    const sampledColumns = new Set(proof.sampledShares.map((s) => s.column))
    const minRequired = Math.ceil(proof.sampledShares.length * 0.75)

    return sampledColumns.size >= minRequired
  }

  private verifyMerkleProof(data: Uint8Array, proof: Uint8Array, root: Uint8Array): boolean {
    // 实现简化的 Merkle 证明验证
    // 实际项目中使用 celestia-node 提供的验证库
    const hash = sha256(data)
    let current = hash
    const proofNodes = splitProof(proof)
    for (const node of proofNodes) {
      current = sha256(concatBytes(current, node))
    }
    return bytesEqual(current, root)
  }
}

// 持续监控多个区块的数据可用性
async function monitorDataAvailability(
  das: LightClientDAS,
  onVerified: (height: number, available: boolean) => void,
) {
  let latestHeight = await getLatestCelestiaHeight()

  setInterval(async () => {
    const newHeight = await getLatestCelestiaHeight()
    if (newHeight > latestHeight) {
      for (let h = latestHeight + 1; h <= newHeight; h++) {
        const available = await das.verifyDataAvailability(h)
        onVerified(h, available)
      }
      latestHeight = newHeight
    }
  }, 15000) // Celestia 出块约 15 秒
}
```

## 从 Celestia 读取 blob 数据的前端模块

Rollup 将交易数据发布到 Celestia 的 blob 中，前端需要读取这些数据来重建状态或验证交易历史：

```typescript
// 从 Celestia 读取 Rollup 数据的前端模块
import { createCelestiaClient } from './celestia-client'

const ROLLUP_NAMESPACE = '00000000000000000000000000000000000000000008e5f679bf7116cb' // Rollup 的命名空间

interface RollupBatchData {
  batchNumber: number
  transactions: { type: string; from: string; to: string; value: string; data: string }[]
  stateRoot: string
  prevHash: string
}

class RollupDataReader {
  private celestia: CelestiaClient
  private dataRoots: Map<number, Uint8Array> = new Map()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // 从 Celestia 读取指定批次的 Rollup 数据
  async fetchBatch(height: number, commitment: Uint8Array): Promise<RollupBatchData> {
    const blobData = await this.celestia.getBlob(height, ROLLUP_NAMESPACE, commitment)

    if (!blobData) {
      throw new Error(`Blob not found at height ${height}`)
    }

    // 解析 blob 数据
    const batch = this.parseBatch(blobData)

    // 验证数据可用性
    const isAvailable = await this.celestia.checkAvailability(height)
    if (!isAvailable) {
      throw new Error(`Data not available at height ${height}`)
    }

    return batch
  }

  private parseBatch(data: Uint8Array): RollupBatchData {
    const decoder = new TextDecoder()
    const json = decoder.decode(data)
    const raw = JSON.parse(json)

    return {
      batchNumber: raw.batchNumber,
      transactions: raw.txs.map((tx: any) => ({
        type: tx.type,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
      })),
      stateRoot: raw.stateRoot,
      prevHash: raw.prevHash,
    }
  }

  // 监听新的数据可用性事件
  async watchNewBatches(
    onNewBatch: (height: number, commitment: Uint8Array) => void,
  ) {
    // 通过 Celestia Node 的 WebSocket 订阅新事件
    const ws = new WebSocket(`wss://celestia-node-rpc/ws`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'blob.Subscribe',
        params: [ROLLUP_NAMESPACE],
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'blob.Notification') {
        const { height, commitment } = msg.params.result
        onNewBatch(height, base64ToBytes(commitment))
      }
    }
  }
}

export { RollupDataReader }
export type { RollupBatchData }
```

## 前端适配：多层数据源管理

模块化架构下，前端需要一个统一的数据源管理器来协调不同层的查询：

```typescript
interface DataSourceConfig {
  executionRpc: string   // Rollup 执行层 RPC
  settlementRpc: string  // 以太坊结算层 RPC
  daNodeUrl: string      // Celestia DA 层 RPC
}

class ModularDataSource {
  private executionClient: PublicClient
  private settlementClient: PublicClient
  private rollupReader: RollupDataReader

  constructor(config: DataSourceConfig) {
    this.executionClient = createPublicClient({
      chain: rollupChain,
      transport: http(config.executionRpc),
    })
    this.settlementClient = createPublicClient({
      chain: mainnet,
      transport: http(config.settlementRpc),
    })
    this.rollupReader = new RollupDataReader(config.daNodeUrl)
  }

  // 查询交易最终性：执行层确认 -> 结算层最终化 -> DA 层可用
  async getTransactionFinality(txHash: Hash): Promise<{
    executed: boolean
    settled: boolean
    dataAvailable: boolean
    finalized: boolean
  }> {
    // 1. 执行层查询
    const receipt = await this.executionClient.getTransactionReceipt({ hash: txHash })
    if (!receipt) {
      return { executed: false, settled: false, dataAvailable: false, finalized: false }
    }

    // 2. 结算层查询（检查 Rollup 是否已提交到 L1）
    const l1Finalized = await this.checkSettlement(receipt.blockNumber)

    // 3. DA 层查询
    const daAvailable = l1Finalized
      ? await this.checkDataAvailability(l1Finalized.daHeight)
      : false

    return {
      executed: true,
      settled: l1Finalized.settled,
      dataAvailable: daAvailable,
      finalized: l1Finalized.settled && daAvailable,
    }
  }

  private async checkSettlement(l2BlockNumber: bigint): Promise<{
    settled: boolean
    daHeight: number
  }> {
    // 查询 L1 上的 Rollup bridge 合约
    const latestBatch = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'latestBatch',
    })

    // 检查 L2 区块是否包含在已提交的批次中
    const batchInfo = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'getBatchInfo',
      args: [latestBatch],
    })

    return {
      settled: l2BlockNumber <= batchInfo.endBlock,
      daHeight: Number(batchInfo.daHeight),
    }
  }

  private async checkDataAvailability(daHeight: number): Promise<boolean> {
    return this.rollupReader['celestia'].checkAvailability(daHeight)
  }
}
```

## 与单体链前端开发的差异

| 维度 | 单体链 | 模块化链 |
|------|--------|----------|
| RPC 端点 | 单一 | 多个（执行层 + 结算层 + DA 层）|
| 最终性 | 单一确认标准 | 多层确认（执行 -> 结算 -> DA）|
| 数据验证 | 信任全节点 | DAS 轻验证 |
| 延迟 | 统一 | 各层不同（DA ~15s, L1 ~12m）|
| 前端复杂度 | 低 | 高，需管理多层数据源 |

## EigenLayer 重质押协议的前端交互

EigenLayer 的前端交互主要围绕再质押和 AVS 选择：

```typescript
// EigenLayer 再质押前端模块
import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const EIGENLAYER_DELEGATION_MANAGER = '0x...' as Address

class EigenLayerClient {
  private client: PublicClient

  constructor(rpcUrl: string) {
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // 查询用户再质押的 ETH 总量
  async getRestakedBalance(user: Address): Promise<{
    activeBalance: bigint
    withdrawableBalance: bigint
    slashingBalance: bigint
  }> {
    const result = await this.client.readContract({
      address: EIGENLAYER_DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: 'getStaker',
      args: [user],
    })

    return {
      activeBalance: result.activeBalance,
      withdrawableBalance: result.withdrawableBalance,
      slashingBalance: result.slashingBalance,
    }
  }

  // 查询 AVS 列表及其状态
  async getAVSList(): Promise<AVSInfo[]> {
    // 从 EigenLayer 的子图中查询
    const query = `
      query {
        avses {
          id
          name
          status
          totalStaked
          operatorCount
          slashingNonce
        }
      }
    `
    const response = await fetch(EIGENLAYER_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const { data } = await response.json()
    return data.avses.map((avs: any) => ({
      address: avs.id,
      name: avs.name,
      status: avs.status,
      totalStaked: BigInt(avs.totalStaked),
      operatorCount: avs.operatorCount,
    }))
  }

  // 委托再质押到 AVS
  async delegateToAVS(
    user: Address,
    avsAddress: Address,
    amount: bigint,
  ): Promise<Hash> {
    // 前端构造委托交易
    // 实际需要通过 WalletClient 发送
    throw new Error('Implement with WalletClient')
  }

  // 监听罚没事件
  watchSlashingEvents(
    avsAddress: Address,
    onSlash: (operator: Address, amount: bigint, reason: string) => void,
  ) {
    return this.client.watchEvent({
      address: avsAddress,
      eventName: 'Slashing',
      onLogs: (logs) => {
        for (const log of logs) {
          onSlash(log.args.operator, log.args.amount, log.args.reason)
        }
      },
    })
  }
}

interface AVSInfo {
  address: Address
  name: string
  status: string
  totalStaked: bigint
  operatorCount: number
}

export { EigenLayerClient }
export type { AVSInfo }
```

## 小结

模块化区块链正在改变前端的数据获取范式。从单一 RPC 到多层数据源管理，从信任全节点到 DAS 轻验证，前端架构的复杂度确实增加了。但这也带来了好处：DApp 可以验证而非信任数据，可以选择最优成本的 DA 层，可以组合不同层的服务。Celestia 让数据可用性变得廉价和可验证，EigenLayer 让新服务无需自建安全性。对前端开发者而言，理解模块化架构的分层模型是必要的——未来的 DApp 前端将不可避免地与多个链层交互。封装一个统一的数据源管理器是当前最佳实践。
