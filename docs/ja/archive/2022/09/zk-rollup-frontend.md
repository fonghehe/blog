---
title: "zkSync フロントエンド統合：ゼロ知識証明 Layer2 インタラクション"
date: 2022-09-19 13:53:40
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "zkSync 2.0 (era) はネイティブでアカウントアブストラクションと Paymaster をサポートしており、フロントエンドの統合方式は EVM Layer1 とは大きく異なります。本記事では SDK の使用から Paymaster 統合まで、zkSync フロントエンド開発の完全なフローを網羅します。"
wordCount: 3100
---

zkSync 2.0（後に zkSync Era に改名）は Matter Labs が開発した zkRollup 方案で、メインネットがローンチされています。Optimistic Rollup とは異なり、zkSync はゼロ知識証明（具体的には PLONK 証明システム）を使用して L2 状態の有効性を保証し、出金に 7 日間のチャレンジ期間を必要としません。さらに重要なのは、zkSync が基盤からネイティブにアカウントアブストラクション（Account Abstraction）と Paymaster（Gas 代払い）をサポートしており、これが従来の EVM とは大きく異なるフロントエンドインタラクションモデルをもたらしている点です。

## zkSync Era の概要と zkRollup の原理

### ゼロ知識証明によるセキュリティ保証

zkRollup の核心的なアプローチは：L2 がすべてのトランザクションを実行した後、証明（proof）を生成し、これらのトランザクションの実行が正しいことを証明します。L1 はこの証明を検証するだけで済み、すべてのトランザクションを再実行する必要はありません。

```
L2 がバッチでトランザクションを実行 → ZK Proof を生成 → L1 に提出 → L1 が Proof を検証 → 状態確認
```

Optimistic Rollup との主な違い：

- **OR**：すべてのトランザクションが有効と仮定し、誰かがフロードプルーフを提出しない限り例外（7 日間のチャレンジ期間）
- **ZKR**：数学的証明でトランザクションの有効性を保証し、チャレンジ期間は不要

つまり zkSync の L2 → L1 出金は証明が L1 で検証されるまでの待機のみで済み（通常数時間）、7 日間ではありません。

### zkSync Era の EVM 互換性

zkSync Era は EVM 等価（EVM-equivalent）ではなく、EVM 互換（EVM-compatible）です。違いは以下の通り：

- **EVM 等価**（Optimism Bedrock など）：バイトコードが完全に同一で、既存のコントラクトをそのままデプロイ可能
- **EVM 互換**（zkSync など）：Solidity 構文をサポートするが、異なる仮想マシン（zkEVM）向けにコンパイル

そのため、一部のオペコードは zkSync では使用不可または動作が異なります（`SELFDESTRUCT`、`CALLCODE` など）、特に注意が必要です。

## zkSync でのアカウントアブストラクションのネイティブサポート

zkSync Era は EIP-4337 スタイルのアカウントアブストラクションをネイティブにサポートし、追加の EntryPoint コントラクトを必要としません。各アカウントはスマートコントラクトウォレットになれ、カスタム署名検証とトランザクション実行ロジックをサポートします。

```typescript
// zkSync 上のアカウントは以下のいずれか：
// 1. EOAs（外部所有アカウント）—— Ethereum と同様
// 2. スマートコントラクトアカウント —— ネイティブサポート、EntryPoint 不要

// つまりフロントエンドは以下をサポート可能：
// - ソーシャルログインウォレット（ニーモニック不要）
// - マルチシグウォレット（ネイティブサポート、プラグイン式ではない）
// - Session Key（一時認証キー）
// - Gas 代払い（Paymaster 経由）
```

## Paymaster：Gas 代払いメカニズム

Paymaster は zkSync で最も特徴的な機能の一つです。第三者がユーザーの Gas 代を支払うことを可能にし、ユーザーは ERC-20 トークン（ETH ではなく）で Gas を支払ったり、完全に無料にしたりできます。

### Paymaster の仕組み

```
ユーザーがトランザクションを開始 → zkSync プロトコルが Paymaster の有無をチェック → Paymaster が Gas を支払う
                                                      ↓
                                              ユーザーが約束に従って補償（オプション）
```

### フロントエンドへの Paymaster 統合

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

async function sendTransactionWithPaymaster(
  wallet: Wallet,
  to: string,
  data: string,
  paymasterAddress: string
) {
  // トランザクションの構築
  const tx = {
    to,
    data,
    from: wallet.address,
    // Paymaster を指定
    customData: {
      paymasterParams: {
        paymaster: paymasterAddress,
        paymasterInput: '0x', // Paymaster 固有の入力
      },
      // ERC-20 で Gas を支払う場合、gasPerPubdata も指定
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  // Gas 見積もり（Paymaster ロジックを含む）
  const gasEstimate = await wallet.estimateGas(tx)

  // トランザクション送信
  const txHash = await wallet.sendTransaction({
    ...tx,
    gasLimit: gasEstimate,
  })

  return txHash
}

// ERC-20 トークンで Gas を支払う Paymaster
async function payGasWithToken(
  wallet: Wallet,
  tokenAddress: string,
  paymasterAddress: string
) {
  const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
    type: 'ERC20',
    token: tokenAddress,
    // Paymaster が許可する最低レート
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

## zksync-web3 SDK の使用

`zksync-web3` は zkSync 公式の JavaScript SDK で、API 設計は ethers.js と高い互換性を持ちつつ、zkSync 固有の機能を追加しています。

### 基本的な使用

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

// Provider の初期化
const zkSyncProvider = new Provider('https://zksync-era-mainnet.chainstacklabs.com')
const ethereumProvider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY'
)

// Ethereum ウォレットから zkSync ウォレットを作成
const ethWallet = new ethers.Wallet(PRIVATE_KEY, ethereumProvider)
const zkSyncWallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethWallet)

// 残高の照会
const ethBalance = await zkSyncWallet.getBalance()
const tokenBalances = await zkSyncWallet.getBalances()

// L1 -> L2 入金
async function depositETH(amount: string) {
  const tx = await zkSyncWallet.deposit({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
    // オプション：refundRecipient
  })

  // L1 トランザクション確認の待機
  await tx.wait()

  // L2 への反映を待機（通常数分必要）
  await tx.waitFinalize()

  return tx
}

// L2 送金
async function transfer(token: string, to: string, amount: string) {
  const tx = await zkSyncWallet.transfer({
    to,
    token,
    amount: ethers.utils.parseEther(amount),
  })

  await tx.wait()
  return tx
}

// L2 -> L1 出金
async function withdrawETH(amount: string) {
  const tx = await zkSyncWallet.withdraw({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
  })

  // L2 トランザクション確認（通常数秒）
  await tx.wait()

  // 注意：7 日間のチャレンジ期間は不要
  // ただし ZK Proof が検証されるまでの待機は必要（数時間）
  // ユーザーが手動で finalize する必要はない！
  return tx
}
```

### ethers v6 adapter

ethers v6 を使用する必要があるプロジェクト向けに、zkSync はアダプターを提供しています：

```typescript
import { ethers } from 'ethers'
import { ZkSyncEthersAdapter } from 'zksync-web3'

const adapter = new ZkSyncEthersAdapter({
  zkSyncProvider,
  ethProvider,
})

// adapter 経由で ethers v6 の Contract を使用
const contract = adapter.getContract(
  contractAddress,
  abi,
  zkSyncWallet
)

// コントラクトメソッドの呼び出しは ethers v6 と同様
const tx = await contract.transfer(recipient, amount)
await tx.wait()
```

## コントラクトの zkSync へのデプロイ

### コンパイラの違い

zkSync は標準の `solc` ではなく独自のコンパイラ `zksolc` を使用します。`zksolc` は `solc` の出力を入力として受け取り、zkEVM バイトコードにコンパイルします。

```bash
# zksolc のインストール
npm install -g @matterlabs/zksolc-bin

# コントラクトのコンパイル
zksolc --combined-json bin,abi contracts/MyContract.sol
```

### Hardhat プラグインを使用したデプロイ

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

  // コンパイル済みの ABI とバイトコードの読み取り
  const artifact = JSON.parse(
    readFileSync('./artifacts/MyContract.json', 'utf8')
  )

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  )

  // コントラクトのデプロイ
  const contract = await factory.deploy(
    constructorArg1,
    constructorArg2
  )

  await contract.deployed()
  console.log('Contract deployed to:', contract.address)
}

deploy()
```

## フロントエンドのネットワーク設定と MetaMask 統合

### MetaMask への zkSync ネットワーク追加

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
    // チェーンがまだ MetaMask に追加されていない
    if (switchError.code === 4902) {
      await provider.send('wallet_addEthereumChain', [ZK_SYNC_MAINNET])
    } else {
      throw switchError
    }
  }
}
```

### フロントエンドからの zkSync ウォレット接続

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

    // 接続済みアカウントの確認
    ethProvider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0])
      }
    })

    // アカウント切り替えの監視
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // チェーン切り替えの監視
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

## L1 <-> L2 メッセージパッシング

zkSync は L1 と L2 間の双方向メッセージパッシングをサポートしています。Optimistic Rollup とは異なり、L2 → L1 のメッセージは 7 日間のチャレンジ期間を必要としませんが、ZK Proof の検証を待つ必要があります。

### L1 → L2 メッセージ

```typescript
// L1 から L2 へメッセージを送信（送金だけでなく）
async function sendL1ToL2Message(
  l1Wallet: ethers.Wallet,
  zkSyncProvider: Provider,
  l2ContractAddress: string,
  calldata: string
) {
  // zkSync の Mailbox コントラクトを使用
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

  // L2 での実行を待機
  const l2TxHash = await zkSyncProvider.getL2TxHashFromPriorityOp(tx)
  await zkSyncProvider.wait(l2TxHash)

  return { l1TxHash: tx.hash, l2TxHash }
}
```

### L2 → L1 メッセージ

```typescript
// L2 から L1 へメッセージを送信
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

## zkSync DApp フロントエンド完全モジュール

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

  // ウォレット接続
  connect(privateKey: string) {
    this.wallet = new Wallet(
      privateKey,
      this.provider,
      new ethers.Wallet(privateKey, this.l1Provider)
    )
  }

  // 残高取得（ETH + ERC-20）
  async getAllBalances(address: string) {
    const balances = await this.provider.getAllBalances(address)
    return balances
  }

  // 入金（L1 -> L2）
  async deposit(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.deposit({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L1 確認
    await tx.waitFinalize() // L2 確認

    return tx
  }

  // L2 送金
  async transfer(token: string, to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.transfer({
      to,
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    return tx.wait()
  }

  // 出金（L2 -> L1）
  async withdraw(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.withdraw({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L2 確認
    // 手動での finalize は不要！ZK Proof 検証後に自動で着金

    return tx
  }

  // Paymaster を使用したトランザクション送信（ERC-20 で Gas 支払い）
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

  // トランザクション状態の取得
  async getTransactionStatus(txHash: string) {
    const receipt = await this.provider.getTransactionReceipt(txHash)
    if (!receipt) return null

    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.transactionIndex,
      gasUsed: receipt.gasUsed.toString(),
      // zkSync 固有：pubdata バイト Gas
      gasPerPubdataUsed: receipt.gasPerPubdataUsed?.toString(),
    }
  }
}
```

## Gas 見積もりとトランザクション確認の特徴

zkSync の Gas モデルは L1 とは大きく異なり、「pubdata」（公データ）の概念を導入しています：

```typescript
// zkSync Gas モデル
// 総 Gas = L2 Gas + L1 Gas（pubdata 公開用）

// pubdata は L1 に公開されるデータで、コストを決定する
// 各トランザクションには gasPerPubdata パラメータがある

async function estimateGas(
  wallet: Wallet,
  tx: types.TransactionRequest
) {
  // zkSync 固有の Gas 見積もり
  const gasEstimate = await wallet.estimateGas(tx)

  // pubdata gas の見積もりも必要
  const pubdataGas = await wallet.estimateGasL1ToL2(tx)

  return {
    l2Gas: gasEstimate,
    pubdataGas,
    total: gasEstimate.add(pubdataGas),
  }
}
```

トランザクション確認の特徴：

- **L2 トランザクション**：通常 1-2 秒で確認（即時）
- **L1 → L2 入金**：L1 確認 + L2 最終確認が必要（数分）
- **L2 → L1 出金**：ZK Proof 検証が必要（数時間）だが、ユーザーの手動 finalize は不要

## Optimistic Rollup とのフロントエンド適応の違い

| 次元 | Optimistic Rollup | zkSync Era |
|------|------------------|------------|
| 出金時間 | ~7 日 | 数時間 |
| 出金操作 | 手動 finalize が必要 | 自動完了 |
| Gas 支払い | ETH のみ | ETH + ERC-20（Paymaster） |
| アカウントモデル | EOA + スマートコントラクト | ネイティブアカウントアブストラクション |
| SDK | ethers.js 互換 | zksync-web3（ethers 派生） |
| コントラクトデプロイ | 直接デプロイ | zksolc コンパイルが必要 |
| 状態ポーリング | 複雑（クロスチェーン） | シンプル（自動確認） |

## まとめ

zkSync Era のフロントエンド開発は多くの面で Optimistic Rollup よりシンプルです——出金に手動 finalize が不要で、7 日間の待機期間の状態マシンを管理する必要もありません。しかし zkSync は新しい概念を導入しています：Paymaster、アカウントアブストラクション、pubdata Gas モデルであり、これらはフロントエンド開発者に新しいインタラクションモデルの学習を要求します。

Paymaster は zkSync で最も革新的な機能です。DApp がユーザーの Gas 代を補助したり、ユーザーがステーブルコインで Gas を支払えるようにしたりすることで、ユーザーの参入障壁を下げる巨大な価値があります。従来の EVM で Gas 代払いを実現するには複雑な relayer インフラが必要ですが、zkSync ではネイティブサポートの機能です。

SDK の選択において、`zksync-web3` は ethers v5 と高い互換性を持ち、移行コストは低いです。ただし zkSync 固有の `customData` フィールドと Gas 見積もり方式に注意が必要です。既存の EVM DApp について、zkSync への移行の主な作業量は：コントラクトコンパイルフローの調整（zksolc の使用）、Paymaster の適応、zkEVM 互換性のテスト（一部のオペコードが使用不可）にあります。

zkRollup エコシステムの急速な発展とゼロ知識証明技術の成熟に伴い、zkSync は Layer 2 スケーリングの重要な方向性を代表しています。フロントエンド開発者は早めにこの新しいインタラクションモデルに慣れておくべきです。
