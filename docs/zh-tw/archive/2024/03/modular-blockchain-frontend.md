---
title: "模塊化區塊鏈前端：Celestia 與 EigenLayer 集成"
date: 2024-03-22 19:53:23
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "探討模塊化區塊鏈架構下前端數據讀取的變化，涵蓋 Celestia DA 層交互、EigenLayer AVS 集成及多層數據源管理"
wordCount: 1084
---

## 模塊化區塊鏈概念：DA 層、結算層、執行層

模塊化區塊鏈將傳統單體鏈的功能拆分為多個專用層：

- **數據可用性層（DA Layer）**：負責保證交易數據可被訪問和驗證，不關心執行邏輯
- **結算層（Settlement Layer）**：提供最終性保證和跨 Rollup 結算
- **執行層（Execution Layer）**：處理交易執行和狀態轉換
- **共識層（Consensus Layer）**：就交易排序和最終性達成共識

Celestia 是純粹的 DA 層，只做數據可用性廣播和驗證。EigenLayer 則是基於以太坊的再質押協議，允許 AVS（Active Validated Services）複用以太坊的安全性。這兩者代表了模塊化區塊鏈的兩個方向：橫向拆分功能層和縱向複用安全層。

## Celestia 數據可用性層的前端讀取

Celestia 的核心創新是數據可用性採樣（Data Availability Sampling, DAS）。輕客戶端無需下載完整區塊數據，只需隨機採樣少量數據塊即可驗證數據可用性。這對前端應用意義重大——DApp 可以在瀏覽器中驗證鏈上數據是否可用，而無需信任全節點。

Celestia 的前端交互主要通過 Celestia Node 的 RPC API 進行。以下是核心交互流程：

```typescript
// Celestia DA 層前端讀取模塊
import { createPublicClient, http, type Hash } from 'viem'

interface CelestiaClient {
  // 提交 blob 數據到 DA 層
  submitBlob: (namespace: string, data: Uint8Array) => Promise<{ height: number; commitment: Uint8Array }>
  // 根據 height 和 commitment 獲取 blob
  getBlob: (height: number, namespace: string, commitment: Uint8Array) => Promise<Uint8Array | null>
  // 獲取指定高度的 DAS 證明
  getDASProof: (height: number) => Promise<DASProof>
  // 檢查數據可用性
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

// 工具函數
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)))
}

function namespaceToBase64(ns: string): string {
  // namespace 是十六進制字符串，轉為 base64
  const bytes = new Uint8Array(ns.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytesToBase64(bytes)
}

export { createCelestiaClient }
export type { CelestiaClient, DASProof }
```

## EigenLayer AVS 概述

EigenLayer 的核心機制是再質押（Restaking）。驗證者可以將已經質押在以太坊信標鏈上的 ETH 再次質押到 EigenLayer，為 AVS 提供安全性。AVS 是獨立的服務，例如數據可用性層、預言機、橋接協議等，它們不再需要建立自己的驗證者集合，而是複用以太坊的經濟安全性。

對前端而言，EigenLayer 的交互主要涉及：

- 查詢再質押者的質押狀態和收益
- AVS 註冊/註銷的前端流程
- 罰沒（Slashing）事件的通知與展示

## 模塊化架構對前端數據讀取的影響

在單體鏈架構下，前端數據讀取模式很簡單：一個 RPC 端點搞定一切。模塊化架構下，數據散佈在不同層：

```
┌─────────────────────────────────────────┐
│           DApp Frontend                  │
├──────────┬──────────┬───────────────────┤
│  執行層   │  結算層   │    DA 層          │
│ (Rollup) │(Ethereum)│  (Celestia)       │
│ RPC #1   │  RPC #2  │   RPC #3          │
└──────────┴──────────┴───────────────────┘
```

前端需要管理多個數據源，每層有不同的延遲和最終性保證。一個典型的查詢流程可能是：

1. 從執行層查詢當前狀態
2. 從結算層確認該狀態已最終化
3. 從 DA 層驗證交易數據可用

## 輕客戶端與數據可用性採樣

在瀏覽器中運行輕客戶端是模塊化區塊鏈的重要願景。DAS 允許瀏覽器端驗證數據可用性而無需信任任何中心化 RPC。

```typescript
// 瀏覽器端 DAS 驗證
import { createCelestiaClient, type DASProof } from './celestia-client'

class LightClientDAS {
  private celestia: CelestiaClient
  private sampledHeights = new Map<number, boolean>()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // 驗證指定高度的區塊數據可用性
  async verifyDataAvailability(height: number): Promise<boolean> {
    // 如果已經驗證過，返回緩存結果
    if (this.sampledHeights.has(height)) {
      return this.sampledHeights.get(height)!
    }

    // 獲取 DAS 證明
    const proof = await this.celestia.getDASProof(height)

    // 在瀏覽器中驗證採樣證明
    const isValid = this.verifyDASProof(proof)

    this.sampledHeights.set(height, isValid)
    return isValid
  }

  private verifyDASProof(proof: DASProof): boolean {
    // 1. 驗證 Merkle 證明
    for (let i = 0; i < proof.sampledShares.length; i++) {
      const share = proof.sampledShares[i]
      const merkleProof = proof.proofs[i]
      if (!this.verifyMerkleProof(share.data, merkleProof, proof.dataRoot)) {
        return false
      }
    }

    // 2. 驗證採樣數量是否足夠（通常需要 > 75% 的列）
    // Celestia 使用 2D Reed-Solomon 編碼，採樣足夠多即可高概率確認可用
    const sampledColumns = new Set(proof.sampledShares.map((s) => s.column))
    const minRequired = Math.ceil(proof.sampledShares.length * 0.75)

    return sampledColumns.size >= minRequired
  }

  private verifyMerkleProof(data: Uint8Array, proof: Uint8Array, root: Uint8Array): boolean {
    // 實現簡化的 Merkle 證明驗證
    // 實際項目中使用 celestia-node 提供的驗證庫
    const hash = sha256(data)
    let current = hash
    const proofNodes = splitProof(proof)
    for (const node of proofNodes) {
      current = sha256(concatBytes(current, node))
    }
    return bytesEqual(current, root)
  }
}

// 持續監控多個區塊的數據可用性
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
  }, 15000) // Celestia 出塊約 15 秒
}
```

## 從 Celestia 讀取 blob 數據的前端模塊

Rollup 將交易數據發佈到 Celestia 的 blob 中，前端需要讀取這些數據來重建狀態或驗證交易歷史：

```typescript
// 從 Celestia 讀取 Rollup 數據的前端模塊
import { createCelestiaClient } from './celestia-client'

const ROLLUP_NAMESPACE = '00000000000000000000000000000000000000000008e5f679bf7116cb' // Rollup 的命名空間

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

  // 從 Celestia 讀取指定批次的 Rollup 數據
  async fetchBatch(height: number, commitment: Uint8Array): Promise<RollupBatchData> {
    const blobData = await this.celestia.getBlob(height, ROLLUP_NAMESPACE, commitment)

    if (!blobData) {
      throw new Error(`Blob not found at height ${height}`)
    }

    // 解析 blob 數據
    const batch = this.parseBatch(blobData)

    // 驗證數據可用性
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

  // 監聽新的數據可用性事件
  async watchNewBatches(
    onNewBatch: (height: number, commitment: Uint8Array) => void,
  ) {
    // 通過 Celestia Node 的 WebSocket 訂閱新事件
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

## 前端適配：多層數據源管理

模塊化架構下，前端需要一個統一的數據源管理器來協調不同層的查詢：

```typescript
interface DataSourceConfig {
  executionRpc: string   // Rollup 執行層 RPC
  settlementRpc: string  // 以太坊結算層 RPC
  daNodeUrl: string      // Celestia DA 層 RPC
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

  // 查詢交易最終性：執行層確認 -> 結算層最終化 -> DA 層可用
  async getTransactionFinality(txHash: Hash): Promise<{
    executed: boolean
    settled: boolean
    dataAvailable: boolean
    finalized: boolean
  }> {
    // 1. 執行層查詢
    const receipt = await this.executionClient.getTransactionReceipt({ hash: txHash })
    if (!receipt) {
      return { executed: false, settled: false, dataAvailable: false, finalized: false }
    }

    // 2. 結算層查詢（檢查 Rollup 是否已提交到 L1）
    const l1Finalized = await this.checkSettlement(receipt.blockNumber)

    // 3. DA 層查詢
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
    // 查詢 L1 上的 Rollup bridge 合約
    const latestBatch = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'latestBatch',
    })

    // 檢查 L2 區塊是否包含在已提交的批次中
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

## 與單體鏈前端開發的差異

| 維度 | 單體鏈 | 模塊化鏈 |
|------|--------|----------|
| RPC 端點 | 單一 | 多個（執行層 + 結算層 + DA 層）|
| 最終性 | 單一確認標準 | 多層確認（執行 -> 結算 -> DA）|
| 數據驗證 | 信任全節點 | DAS 輕驗證 |
| 延遲 | 統一 | 各層不同（DA ~15s, L1 ~12m）|
| 前端複雜度 | 低 | 高，需管理多層數據源 |

## EigenLayer 重質押協議的前端交互

EigenLayer 的前端交互主要圍繞再質押和 AVS 選擇：

```typescript
// EigenLayer 再質押前端模塊
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

  // 查詢用戶再質押的 ETH 總量
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

  // 查詢 AVS 列表及其狀態
  async getAVSList(): Promise<AVSInfo[]> {
    // 從 EigenLayer 的子圖中查詢
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

  // 委託再質押到 AVS
  async delegateToAVS(
    user: Address,
    avsAddress: Address,
    amount: bigint,
  ): Promise<Hash> {
    // 前端構造委託交易
    // 實際需要通過 WalletClient 發送
    throw new Error('Implement with WalletClient')
  }

  // 監聽罰沒事件
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

## 小結

模塊化區塊鏈正在改變前端的數據獲取範式。從單一 RPC 到多層數據源管理，從信任全節點到 DAS 輕驗證，前端架構的複雜度確實增加了。但這也帶來了好處：DApp 可以驗證而非信任數據，可以選擇最優成本的 DA 層，可以組合不同層的服務。Celestia 讓數據可用性變得廉價和可驗證，EigenLayer 讓新服務無需自建安全性。對前端開發者而言，理解模塊化架構的分層模型是必要的——未來的 DApp 前端將不可避免地與多個鏈層交互。封裝一個統一的數據源管理器是當前最佳實踐。
