---
title: "Rollup Stack フロントエンド対応：OP Stack と ZK Stack"
date: 2024-11-25 12:42:17
tags:
  - Web3
  - Blockchain
readingTime: 11
description: "OP Stack と ZK Stack のアーキテクチャの違いを比較し、マルチ Rollup 環境におけるフロントエンドのクロスチェーンインタラクション、メッセージング、ウィズドロワルフロー、確認時間対応を深く探求"
wordCount: 1777
---

## OP Stack アーキテクチャ：Optimism のモジュラー Rollup フレームワーク

OP Stack は Optimism が開発したオープンソースの Rollup フレームワークであり、その中核理念は Rollup の各コンポーネントをモジュール化し、誰でも OP Stack に基づいて独自の Rollup を構築できるようにすることです。OP Stack の技術アーキテクチャは以下の層に分かれています：

- **Data Availability Layer**：Ethereum L1 を DA 層として使用し、取引データを L1 calldata または blobs（EIP-4844）に公開
- **Sequencing Layer**：単一のシーケンサー（Sequencer）が取引を順序付けして L2 ブロックを生成
- **Derivation Layer**：L1 データから L2 状態を導出するルール
- **Execution Layer**：EVM を使用して取引を実行
- **Settlement Layer**：Ethereum L1 の不正証明（Fault Proof）に依存して安全性を保証

OP Stack の Optimistic モデルは取引が有効であると仮定し、7 日間のチャレンジ期間があります。誰かがチャレンジ期間内に不正証明を提出すると、無効な取引はロールバックされます。

## ZK Stack アーキテクチャ：zkSync のモジュラー ZK フレームワーク

ZK Stack は Matter Labs が開発したモジュラー ZK Rollup フレームワークです。OP Stack の Optimistic モデルとは異なり、ZK Stack はゼロ知識証明を使用して状態遷移の有効性を保証します：

- **Execution Layer**：zkEVM、EVM 互換だが各オペコードに zk 回路制約がある
- **Proving Layer**：ZK 証明を生成し、L2 状態遷移の正当性を証明
- **Verification Layer**：L1 上の検証コントラクトが ZK 証明を検証
- **Data Availability**：取引データを L1 に公開

ZK Stack の重要な利点はファイナリティがより速いことです——ZK 証明が L1 で検証されれば、状態は即座にファイナライズされ、7 日間のチャレンジ期間は不要です。ただし証明の生成には追加の時間と計算コストがかかります。

## フロントエンドクロスチェーンインタラクション：L1 <-> L2 メッセージング

OP Stack でも ZK Stack でも、L1 と L2 の間のメッセージングは特別なブリッジコントラクトを通じて実現されます。フロントエンドはメッセージのライフサイクルを理解する必要があります：

```
L1 -> L2 メッセージ：
┌─────────┐    depositTX     ┌──────────┐
│ L1 ユーザー  │ ──────────────▶ │ L2 エントリ  │
└─────────┘                  └──────────┘
     3-5 分の遅延（シーケンサー処理待ち）

L2 -> L1 メッセージ（Withdrawal）：
┌─────────┐  initiateWithdraw  ┌────────────┐  チャレンジ期間待ち  ┌──────────┐
│ L2 ユーザー  │ ────────────────▶ │ L1 ブリッジコントラクト │ ──────────▶ │ L1 ユーザー   │
└─────────┘                    └────────────┘              └──────────┘
   OP Stack: 7 日間の遅延
   ZK Stack: 証明生成後 約 1 時間
```

## OP Stack の withdrawal フロントエンドフロー

OP Stack のウィズドロワルには二つのステップが必要です：L2 でウィズドロワルを開始 -> L1 で Claim。以下は完全なフロントエンドフローです：

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

  // ステップ 1：L2 でウィズドロワルを開始
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

    // L2 取引の確認待ち
    const receipt = await this.l2Client.waitForTransactionReceipt({ hash: l2TxHash })

    // WithdrawalInitiated イベントを解析
    const logs = parseWithdrawalLogs(receipt.logs)
    return l2TxHash
  }

  // ステップ 2：ウィズドロワルが L1 で Claim 可能かチェック
  async checkWithdrawalReadiness(l2TxHash: Hash): Promise<{
    status: 'pending' | 'ready' | 'claimed'
    proof: { outputRootProof: `0x${string}` | null; withdrawalProof: `0x${string}`[] | null }
    l2OutputIndex: bigint | null
    challengeWindowEnds: number | null
  }> {
    // L1 上の L2OutputOracle コントラクトをクエリ
    const latestOutputIndex = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'latestOutputIndex',
    })

    // このウィズドロワルに対応する L2 出力インデックスを検索
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

    // チャレンジウィンドウが経過したかチェック
    const output = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'getL2Output',
      args: [l2OutputIndex],
    })

    const finalizationTime = Number(output.timestamp) + 604800 // 7 日間
    if (Date.now() / 1000 < finalizationTime) {
      return {
        status: 'pending',
        proof: { outputRootProof: null, withdrawalProof: null },
        l2OutputIndex,
        challengeWindowEnds: finalizationTime,
      }
    }

    // Merkle 証明を取得
    const proof = await this.getWithdrawalProof(l2TxHash, l2OutputIndex)

    // 既に Claim されたかチェック
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

  // ステップ 3：L1 でウィズドロワルを Claim
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

  // 補助メソッド
  private async getWithdrawalInfo(l2TxHash: Hash) {
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    // ログを解析してウィズドロワル情報を取得
    return { withdrawalHash: '0x...', l2BlockNumber: receipt.blockNumber }
  }

  private async findOutputIndex(l2BlockNumber: bigint): Promise<bigint | null> {
    // L2OutputOracle を走査してこのブロックを含む出力を検索
    return null // 簡略化
  }

  private async getWithdrawalProof(l2TxHash: Hash, outputIndex: bigint) {
    // L2 ノードから Merkle 証明を取得
    return { outputRootProof: '0x...' as `0x${string}`, withdrawalProof: [] as `0x${string}`[] }
  }

  private async getWithdrawalMessage(l2TxHash: Hash) {
    return { withdrawal: { nonce: 0n, sender: '0x', target: '0x', value: 0n, minGasLimit: 0n, data: '0x' } }
  }
}
```

## ZK Stack の proof 検証フロントエンド対応

ZK Stack のウィズドロワルフローは異なります。不正証明に依存せず、ZK 証明が L1 で検証されるのを待ちます：

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

  // L2 -> L1 ウィズドロワルを開始
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

  // ウィズドロワル状態をチェック
  async getWithdrawalStatus(l2TxHash: Hash): Promise<{
    status: 'pending' | 'proven' | 'verified' | 'claimed'
    l1BatchNumber: bigint | null
    proofTxHash: Hash | null
  }> {
    // L2 のウィズドロワルログをクエリ
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    const withdrawalLog = receipt.logs.find((log) =>
      log.address.toLowerCase() === ZK_L2_BRIDGE.toLowerCase(),
    )

    if (!withdrawalLog) throw new Error('Withdrawal log not found')

    const { l1BatchNumber, l2MessageIndex } = decodeWithdrawalLog(withdrawalLog)

    // L1 上の証明状態を確認
    const isVerified = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalVerified',
      args: [l1BatchNumber, l2MessageIndex],
    })

    if (!isVerified) {
      // 証明が生成中かどうかを確認
      const proofStatus = await this.checkProofStatus(l1BatchNumber)
      return {
        status: proofStatus === 'proven' ? 'proven' : 'pending',
        l1BatchNumber,
        proofTxHash: null,
      }
    }

    // 既に Claim されたか確認
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

  // L1 で Claim（先に証明検証が必要）
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const status = await this.getWithdrawalStatus(l2TxHash)

    if (status.status === 'pending') {
      // 先に証明を提出する必要がある
      await this.submitProof(l1WalletClient, l2TxHash)
    }

    // ウィズドロワルをファイナライズ
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
    // L1 バリデーターを通じて証明を提出
  }
}
```

## マルチ Rollup ネットワークマネージャー

Superchain では、DApp は同時に複数の Rollup にデプロイされる可能性があります。以下はマルチ Rollup ネットワークマネージャーです：

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

  // すべての Rollup の状態を取得
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

  // クロスチェーン資産移転
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

    // ターゲットチェーンが登録済みかチェック
    const target = this.rollups.get(toChainId)
    if (!target) throw new Error(`Chain ${toChainId} not registered`)

    // ソースチェーンの stack タイプに応じてブリッジ方式を選択
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
    // L2 -> L2 の場合（L1 経由中継）、先に L1 にウィズドロワルしてからターゲット L2 にデポジット
    // L1 -> L2 の場合、直接 deposit
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

// 使用例
const manager = new MultiRollupManager('https://eth.llamarpc.com')
manager.registerRollup({
  chain: optimism,
  rpcUrl: 'https://mainnet.optimism.io',
  stackType: 'op',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  confirmationBlocks: 1,
  withdrawalDelay: 604800, // 7 日間
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

## Superchain の概念とフロントエンドクロスチェーン UX

Superchain は OP Stack チェーンの集合であり、L1 セキュリティとブリッジインフラストラクチャを共有します。Superchain 内では、チェーン間のメッセージングはネイティブであり、L1 経由の中継は不要です。

フロントエンド UX において、Superchain 内のクロスチェーンはユーザーに対して透明であるべきです。理想的な体験は：ユーザーが Base で "Transfer to Optimism" をクリックすると、数秒後に資産が到着し、ネットワークの切り替えや複数回の署名は不要です。

この体験を実現するにはバックエンドリレイヤー（Relayer）のサポートが必要であり、フロントエンドは L2 取引を発起してターゲットチェーンの到着状態をポーリングするだけです。

## フロントエンド対応：異なる Rollup の確認時間の違い

異なる Rollup のブロック生成時間とファイナリティの違いは顕著であり、フロントエンドは対応が必要です：

| Rollup | ブロック時間 | 安全確認数 | ファイナリティ |
|--------|---------|-----------|--------|
| Ethereum L1 | ~12s | 12-64 ブロック | ~6.4 分（1 epoch）|
| Optimism | ~2s | 1 ブロック（ソフト）| 7 日間（ハード）|
| Base | ~2s | 1 ブロック（ソフト）| 7 日間（ハード）|
| Arbitrum | ~250ms | 1 ブロック（ソフト）| 7 日間（ハード）|
| zkSync Era | ~2s | 1 ブロック（ソフト）| 証明検証後 |

```typescript
interface ConfirmationConfig {
  softConfirmations: number  // フロントエンドで「確認済み」と表示するのに必要なブロック数
  hardFinalityTime: number   // 真のファイナライズに必要な時間（秒）
  label: string              // ユーザーに表示する確認レベル
}

function getConfirmationConfig(chainId: number): ConfirmationConfig {
  switch (chainId) {
    case 1: // Ethereum
      return { softConfirmations: 12, hardFinalityTime: 384, label: 'ブロック確認' }
    case 10: // Optimism
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '高速確認（ファイナライズまで 7 日間）' }
    case 8453: // Base
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '高速確認（ファイナライズまで 7 日間）' }
    case 42161: // Arbitrum
      return { softConfirmations: 1, hardFinalityTime: 604800, label: '即時確認（ファイナライズまで 7 日間）' }
    case 324: // zkSync Era
      return { softConfirmations: 1, hardFinalityTime: 3600, label: '高速確認（証明検証後にファイナライズ）' }
    default:
      return { softConfirmations: 12, hardFinalityTime: 384, label: 'ブロック確認' }
  }
}

// フロントエンド取引確認トラッカー
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

  // 確認数を追跡
  let currentBlock = await publicClient.getBlockNumber()
  while (currentBlock - receipt.blockNumber < config.softConfirmations) {
    onStatusChange('confirming', Number(currentBlock - receipt.blockNumber))
    await new Promise((r) => setTimeout(r, 2000))
    currentBlock = await publicClient.getBlockNumber()
  }

  onStatusChange('finalized', config.softConfirmations)
}
```

## コントラクトデプロイの違い：OP Stack vs ZK Stack

OP Stack は標準 EVM を使用し、Solidity コントラクトを直接デプロイできます。ZK Stack は zkEVM を使用し、大部分のオペコードは互換性がありますが、一部のプリコンパイル済みコントラクトとオペコードに違いがあります：

```typescript
// デプロイスクリプトの違い
async function deployContract(
  stackType: 'op' | 'zk',
  walletClient: WalletClient,
  bytecode: `0x${string}`,
  abi: Abi,
  args: unknown[],
) {
  if (stackType === 'op') {
    // OP Stack: 標準 EVM デプロイ
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  } else {
    // ZK Stack: コントラクト互換性のチェックが必要
    // 1. 非サポートのオペコードが使用されていないことを確認
    // 2. 複雑なコントラクトは zkSync のコンパイラで再コンパイルが必要な場合がある
    // 3. zksync 固有のデプロイメソッドを使用
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  }
}
```

## まとめ

OP Stack と ZK Stack は Rollup の二つの技術路線を代表しています：Optimistic と ZK です。フロントエンド開発者にとって、核心的な違いはウィズドロワルフローと確認時間にあります——OP Stack の 7 日間チャレンジ期間 vs ZK Stack の証明検証。マルチ Rollup 環境では、フロントエンドはクロスチェーンインタラクション、複数の確認基準、異なるブリッジプロトコルを処理するための統一ネットワークマネージャーが必要です。Superchain のビジョンはクロスチェーンをシームレスにすることですが、これにはバックエンドリレイヤーとフロントエンド状態追跡の連携が必要です。Rollup as a Service (RaaS) の台頭は、将来的により多くの Rollup チェーンが登場することを意味し、フロントエンドの対応能力が重要な課題となります。異なる Stack のアーキテクチャの違いと対応戦略を理解することが、クロス Rollup DApp を構築する基盤です。
