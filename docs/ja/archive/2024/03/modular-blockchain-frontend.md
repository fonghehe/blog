---
title: "モジュラーブロックチェーンフロントエンド：Celestia と EigenLayer 統合"
date: 2024-03-22 19:53:23
tags:
  - Web3
  - Blockchain
readingTime: 11
description: "モジュラーブロックチェーンアーキテクチャにおけるフロントエンドデータ読み取りの変化を探求し、Celestia DA レイヤーインタラクション、EigenLayer AVS 統合、多層データソース管理をカバー"
wordCount: 1933
---

## モジュラーブロックチェーンの概念：DA 層、決済層、実行層

モジュラーブロックチェーンは、従来のモノリシックチェーンの機能を複数の専用層に分割します：

- **データ可用性層（DA Layer）**：取引データがアクセス・検証可能であることを保証し、実行ロジックには関与しない
- **決済層（Settlement Layer）**：ファイナリティ保証とクロス Rollup 決済を提供
- **実行層（Execution Layer）**：取引実行と状態遷移を処理
- **コンセンサス層（Consensus Layer）**：取引順序とファイナリティについて合意形成

Celestia は純粋な DA 層であり、データ可用性のブロードキャストと検証のみを行います。EigenLayer は Ethereum ベースのリステーキングプロトコルであり、AVS（Active Validated Services）が Ethereum のセキュリティを再利用することを可能にします。この二つはモジュラーブロックチェーンの二つの方向性を代表しています：機能層の水平分割とセキュリティ層の垂直再利用です。

## Celestia データ可用性層のフロントエンド読み取り

Celestia の中核的な革新はデータ可用性サンプリング（Data Availability Sampling, DAS）です。ライトクライアントは完全なブロックデータをダウンロードする必要がなく、少数のデータブロックをランダムにサンプリングするだけでデータ可用性を検証できます。これはフロントエンドアプリケーションにとって重要な意味を持ちます——DApp はフルノードを信頼することなく、ブラウザ内でオンチェーンデータの可用性を検証できます。

Celestia のフロントエンドインタラクションは主に Celestia Node の RPC API を通じて行われます。以下は中核的なインタラクションフローです：

```typescript
// Celestia DA 層フロントエンド読み取りモジュール
import { createPublicClient, http, type Hash } from 'viem'

interface CelestiaClient {
  // blob データを DA 層に提出
  submitBlob: (namespace: string, data: Uint8Array) => Promise<{ height: number; commitment: Uint8Array }>
  // height と commitment に基づいて blob を取得
  getBlob: (height: number, namespace: string, commitment: Uint8Array) => Promise<Uint8Array | null>
  // 指定された高さの DAS 証明を取得
  getDASProof: (height: number) => Promise<DASProof>
  // データ可用性をチェック
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

// ユーティリティ関数
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)))
}

function namespaceToBase64(ns: string): string {
  // namespace は十六進数文字列、base64 に変換
  const bytes = new Uint8Array(ns.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytesToBase64(bytes)
}

export { createCelestiaClient }
export type { CelestiaClient, DASProof }
```

## EigenLayer AVS 概要

EigenLayer の中核的メカニズムはリステーキング（Restaking）です。バリデーターは Ethereum ビーコンチェーンに既にステーキングした ETH を EigenLayer に再度ステーキングし、AVS にセキュリティを提供できます。AVS は独立したサービスであり、例えばデータ可用性層、オラクル、ブリッジプロトコルなどが、独自のバリデーターセットを構築する代わりに Ethereum の経済的セキュリティを再利用します。

フロントエンドにとって、EigenLayer のインタラクションは主に以下を含みます：

- リステーカーのステーキング状態と収益のクエリ
- AVS 登録/解除のフロントエンドフロー
- スラッシング（Slashing）イベントの通知と表示

## モジュラーアーキテクチャがフロントエンドデータ読み取りに与える影響

モノリシックチェーンの時代、フロントエンドのデータ読み取りパターンはシンプルでした：一つの RPC エンドポイントですべてを処理。モジュラーアーキテクチャでは、データは異なる層に分散しています：

```
┌─────────────────────────────────────────┐
│           DApp Frontend                  │
├──────────┬──────────┬───────────────────┤
│  実行層   │  決済層   │    DA 層          │
│ (Rollup) │(Ethereum)│  (Celestia)       │
│ RPC #1   │  RPC #2  │   RPC #3          │
└──────────┴──────────┴───────────────────┘
```

フロントエンドは複数のデータソースを管理する必要があり、各層で異なる遅延とファイナリティ保証があります。典型的なクエリフローは以下のようになります：

1. 実行層から現在の状態をクエリ
2. 決済層からその状態がファイナライズされたことを確認
3. DA 層から取引データの可用性を検証

## ライトクライアントとデータ可用性サンプリング

ブラウザ内でライトクライアントを実行することは、モジュラーブロックチェーンの重要なビジョンです。DAS はブラウザ側で、中央集権的な RPC を信頼することなくデータ可用性を検証することを可能にします。

```typescript
// ブラウザ側 DAS 検証
import { createCelestiaClient, type DASProof } from './celestia-client'

class LightClientDAS {
  private celestia: CelestiaClient
  private sampledHeights = new Map<number, boolean>()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // 指定された高さのブロックデータ可用性を検証
  async verifyDataAvailability(height: number): Promise<boolean> {
    // 既に検証済みの場合、キャッシュ結果を返す
    if (this.sampledHeights.has(height)) {
      return this.sampledHeights.get(height)!
    }

    // DAS 証明を取得
    const proof = await this.celestia.getDASProof(height)

    // ブラウザ内でサンプリング証明を検証
    const isValid = this.verifyDASProof(proof)

    this.sampledHeights.set(height, isValid)
    return isValid
  }

  private verifyDASProof(proof: DASProof): boolean {
    // 1. Merkle 証明を検証
    for (let i = 0; i < proof.sampledShares.length; i++) {
      const share = proof.sampledShares[i]
      const merkleProof = proof.proofs[i]
      if (!this.verifyMerkleProof(share.data, merkleProof, proof.dataRoot)) {
        return false
      }
    }

    // 2. サンプリング数が十分か検証（通常 75% 以上の列が必要）
    // Celestia は 2D Reed-Solomon 符号化を使用し、十分なサンプリングで高確率に可用性を確認可能
    const sampledColumns = new Set(proof.sampledShares.map((s) => s.column))
    const minRequired = Math.ceil(proof.sampledShares.length * 0.75)

    return sampledColumns.size >= minRequired
  }

  private verifyMerkleProof(data: Uint8Array, proof: Uint8Array, root: Uint8Array): boolean {
    // 簡略化された Merkle 証明検証を実装
    // 実際のプロジェクトでは celestia-node 提供の検証ライブラリを使用
    const hash = sha256(data)
    let current = hash
    const proofNodes = splitProof(proof)
    for (const node of proofNodes) {
      current = sha256(concatBytes(current, node))
    }
    return bytesEqual(current, root)
  }
}

// 複数ブロックのデータ可用性を継続監視
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
  }, 15000) // Celestia のブロック生成は約 15 秒
}
```

## Celestia から blob データを読み取るフロントエンドモジュール

Rollup は取引データを Celestia の blob に公開します。フロントエンドはこれらのデータを読み取って状態を再構築したり取引履歴を検証したりする必要があります：

```typescript
// Celestia から Rollup データを読み取るフロントエンドモジュール
import { createCelestiaClient } from './celestia-client'

const ROLLUP_NAMESPACE = '00000000000000000000000000000000000000000008e5f679bf7116cb' // Rollup のネームスペース

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

  // Celestia から指定バッチの Rollup データを読み取り
  async fetchBatch(height: number, commitment: Uint8Array): Promise<RollupBatchData> {
    const blobData = await this.celestia.getBlob(height, ROLLUP_NAMESPACE, commitment)

    if (!blobData) {
      throw new Error(`Blob not found at height ${height}`)
    }

    // blob データを解析
    const batch = this.parseBatch(blobData)

    // データ可用性を検証
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

  // 新しいデータ可用性イベントを監視
  async watchNewBatches(
    onNewBatch: (height: number, commitment: Uint8Array) => void,
  ) {
    // Celestia Node の WebSocket を通じて新しいイベントを購読
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

## フロントエンド対応：多層データソース管理

モジュラーアーキテクチャでは、フロントエンドは異なる層のクエリを調整するための統一データソースマネージャーが必要です：

```typescript
interface DataSourceConfig {
  executionRpc: string   // Rollup 実行層 RPC
  settlementRpc: string  // Ethereum 決済層 RPC
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

  // 取引ファイナリティをクエリ：実行層確認 -> 決済層ファイナライズ -> DA 層利用可能
  async getTransactionFinality(txHash: Hash): Promise<{
    executed: boolean
    settled: boolean
    dataAvailable: boolean
    finalized: boolean
  }> {
    // 1. 実行層クエリ
    const receipt = await this.executionClient.getTransactionReceipt({ hash: txHash })
    if (!receipt) {
      return { executed: false, settled: false, dataAvailable: false, finalized: false }
    }

    // 2. 決済層クエリ（Rollup が L1 に提出されたかチェック）
    const l1Finalized = await this.checkSettlement(receipt.blockNumber)

    // 3. DA 層クエリ
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
    // L1 上の Rollup bridge コントラクトをクエリ
    const latestBatch = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'latestBatch',
    })

    // L2 ブロックが提出済みバッチに含まれるかチェック
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

## モノリシックチェーンのフロントエンド開発との違い

| 次元 | モノリシックチェーン | モジュラーチェーン |
|------|--------|----------|
| RPC エンドポイント | 単一 | 複数（実行層 + 決済層 + DA 層）|
| ファイナリティ | 単一確認基準 | 多層確認（実行 -> 決済 -> DA）|
| データ検証 | フルノードを信頼 | DAS 軽量検証 |
| 遅延 | 統一 | 層ごとに異なる（DA ~15s, L1 ~12m）|
| フロントエンド複雑度 | 低 | 高、多層データソース管理が必要 |

## EigenLayer リステーキングプロトコルのフロントエンドインタラクション

EigenLayer のフロントエンドインタラクションは主にリステーキングと AVS 選択を中心とします：

```typescript
// EigenLayer リステーキングフロントエンドモジュール
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

  // ユーザーのリステーキング ETH 総量をクエリ
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

  // AVS リストとその状態をクエリ
  async getAVSList(): Promise<AVSInfo[]> {
    // EigenLayer のサブグラフからクエリ
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

  // AVS にリステーキングを委任
  async delegateToAVS(
    user: Address,
    avsAddress: Address,
    amount: bigint,
  ): Promise<Hash> {
    // フロントエンドで委任取引を構築
    // 実際には WalletClient を通じて送信する必要がある
    throw new Error('Implement with WalletClient')
  }

  // スラッシングイベントを監視
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

## まとめ

モジュラーブロックチェーンはフロントエンドのデータ取得パラダイムを変えつつあります。単一 RPC から多層データソース管理へ、フルノード信頼から DAS 軽量検証へ、フロントエンドアーキテクチャの複雑さは確かに増加しました。しかしこれには利点もあります：DApp は信頼ではなく検証が可能になり、最適なコストの DA 層を選択でき、異なる層のサービスを組み合わせることができます。Celestia はデータ可用性を安価で検証可能なものにし、EigenLayer は新しいサービスが独自にセキュリティを構築する必要をなくします。フロントエンド開発者にとって、モジュラーアーキテクチャの階層モデルを理解することは必要不可欠です——将来の DApp フロントエンドは、不可避的に複数のチェーン層とやり取りすることになります。統一データソースマネージャーをカプセル化することが現在のベストプラクティスです。
