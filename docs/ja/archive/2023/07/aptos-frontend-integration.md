---
title: "Aptos チェーンのフロントエンド統合：Move コントラクトと TypeScript SDK"
date: 2023-07-22 13:05:54
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "Aptos は Diem の Move の血統を引き継ぎ、リソースモデルと並列実行に独自の設計を持っています。本記事では @aptos-labs/ts-sdk、Petra Wallet の統合と Move コントラクトのフロントエンドインタラクションの完全な方案を網羅します。"
wordCount: 3000
---

Aptos は元 Meta（Facebook）Diem プロジェクトのコアメンバーが設立した Layer 1 ブロックチェーンで、2022年10月にメインネットがローンチされました。Sui と同様に Aptos も Move 言語を使用しますが、両者の Move 実装には顕著な違いがあります。Aptos は Diem の Move 標準実装を保持し、Sui の Object モデルではなくリソース（Resource）モデルを採用しています。フロントエンド開発者にとって、Aptos の SDK 設計とウォレット統合方式も独自の体系を持っています。

## Aptos ネットワークの概要と Diem の血統

### Diem から Aptos へ

Diem（旧 Libra）プロジェクトは Meta により売却・解散されましたが、そのコア技術チームが Aptos Labs を設立しました。Aptos は Diem のコア技術スタックを引き継いでいます：

- **Move 言語**：Diem チームがブロックチェーンシナリオのために設計したリソース指向言語
- **Move 仮想マシン**：Move バイトコードを実行する仮想マシン
- **DiemBFT コンセンサス**：改良された BFT コンセンサスプロトコル、現 AptosBFT と呼ばれる

### Aptos の核心的な特徴

- **並列実行**：Block-STM（Block Software Transactional Memory）並列実行エンジン
- **Move 言語**：リソース指向、強力な型安全性
- **アカウントモデル**：EVM に似たアカウントモデルだが、リソースはアカウント配下に保存
- **Gas トークン**：APT
- **高 TPS**：理論上 10 万+ TPS 可能（並列実行シナリオ）

### ネットワーク情報

```typescript
const APTOS_NETWORKS = {
  mainnet: {
    chainId: 1,
    name: 'Aptos Mainnet',
    nodeUrl: 'https://fullnode.mainnet.aptoslabs.com',
    explorerUrl: 'https://explorer.aptoslabs.com',
  },
  testnet: {
    chainId: 2,
    name: 'Aptos Testnet',
    nodeUrl: 'https://fullnode.testnet.aptoslabs.com',
    explorerUrl: 'https://explorer.aptoslabs.com?network=testnet',
  },
  devnet: {
    chainId: 47,
    name: 'Aptos Devnet',
    nodeUrl: 'https://fullnode.devnet.aptoslabs.com',
    explorerUrl: 'https://explorer.aptoslabs.com?network=devnet',
  },
}
```

## Move 言語の Aptos での実装

### Aptos Move vs Sui Move

両者とも Move 言語を使用しますが、実装とセマンティクスには顕著な違いがあります：

| 次元 | Aptos Move | Sui Move |
|------|-----------|----------|
| リソース保存 | アカウントの resource space | 独立した Object |
| データモデル | Account-based | Object-based |
| 所有権 | リソースはアカウントアドレス配下に保存 | Object に独立した owner がある |
| 送金 | move_to / move_from | transfer Object |
| グローバルストレージ | グローバルにアクセス可能 | Object 単位で隔離 |

### Aptos Move モジュールの例

```move
// Aptos 上の Move コントラクト
module my_app::token {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    // リソース型の定義
    struct Vault has key {
        balance: Coin<AptosCoin>,
    }

    // Vault の初期化（呼び出し元のアカウント配下に保存）
    public entry fun initialize(account: &signer, amount: Coin<AptosCoin>) {
        let vault = Vault { balance: amount };
        move_to(account, vault);
    }

    // Vault からの引き出し
    public entry fun withdraw(account: &signer, amount: u64): Coin<AptosCoin> acquires Vault {
        let vault = borrow_global_mut<Vault>(signer::address_of(account));
        coin::extract(&mut vault.balance, amount)
    }

    // 残高の照会
    #[view]
    public fun balance(addr: address): u64 acquires Vault {
        if (exists<Vault>(addr)) {
            coin::value(&borrow_global<Vault>(addr).balance)
        } else {
            0
        }
    }
}
```

重要な違い：Aptos は `move_to` でリソースをアカウントアドレス配下に保存し、`borrow_global` で任意のアドレスからリソースを読み取ります。これはグローバルストレージモデルであり、Sui の Object は独立してアドレス指定されます。

## @aptos-labs/ts-sdk の使用

Aptos は新しい `@aptos-labs/ts-sdk`（旧版 `aptos` SDK を置き換え）をリリースし、API 設計がよりモダンになりました。

### インストールと初期化

```bash
npm install @aptos-labs/ts-sdk
```

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

// client の初期化
const aptosConfig = new AptosConfig({
  network: Network.TESTNET,
})
const aptos = new Aptos(aptosConfig)

// またはカスタム RPC を使用
const customConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: 'https://my-aptos-node.com',
})
const customAptos = new Aptos(customConfig)
```

### オンチェーンデータの照会

```typescript
// アカウント情報の取得
const accountInfo = await aptos.getAccountInfo({
  accountAddress: '0xUserAddress...',
})
// {
//   sequence_number: '5',
//   authentication_key: '0x...',
// }

// アカウントリソースの取得
const resources = await aptos.getAccountResources({
  accountAddress: '0xUserAddress...',
})
// アカウント配下のすべてのリソースを返す
// [
//   { type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>', data: { coin: { value: '100000000' } } },
//   { type: '0x1::account::Account', data: { ... } },
//   ...
// ]

// 特定リソースの取得
const coinStore = await aptos.getAccountResource({
  accountAddress: '0xUserAddress...',
  resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
})
// { coin: { value: '100000000' } }

// APT 残高の取得
async function getAptBalance(address: string): Promise<number> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
    })
    return parseInt(resource.coin.value) / 1e8 // APT は小数点以下 8 桁
  } catch {
    return 0 // アカウントに CoinStore リソースがない可能性
  }
}

// Table の読み取り
// Aptos の Table は EVM の mapping に類似
const tableItem = await aptos.getTableItem({
  tableHandle: '0xTableHandle...',
  data: {
    key_type: 'address',
    value_type: 'u64',
    key: '0xUserAddress...',
  },
})
```

### View 関数の使用

Aptos は `#[view]` アノテーション付きの関数をサポートし、RPC 経由で直接呼び出し可能です（トランザクション不要）：

```typescript
// view 関数の呼び出し
const viewResult = await aptos.view({
  payload: {
    function: '0xMyPackage::token::balance',
    functionArguments: ['0xUserAddress...'],
  },
})
// 戻り値の配列
// ['100000000']
const balance = parseInt(viewResult[0])
```

## Petra Wallet のフロントエンド統合

Petra Wallet は Aptos Labs が公式開発するブラウザ拡張ウォレットです。

### 検出と接続

```typescript
// hooks/usePetraWallet.ts
import { useState, useEffect } from 'react'

declare global {
  interface Window {
    aptos?: any
  }
}

export function usePetraWallet() {
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)
  const [network, setNetwork] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Petra Wallet の検出
    if (window.aptos) {
      // 接続済みかチェック
      window.aptos
        .isConnected()
        .then((isConnected: boolean) => {
          if (isConnected) {
            setConnected(true)
            return window.aptos.account()
          }
        })
        .then((acc: any) => {
          if (acc) setAccount(acc.address)
        })
        .catch(console.error)

      // ネットワークの取得
      window.aptos.network().then((net: string) => {
        setNetwork(net)
      })
    }

    // アカウント変化の監視
    window.aptos?.onAccountChange((account: any) => {
      setAccount(account?.address || null)
    })

    // ネットワーク変化の監視
    window.aptos?.onNetworkChange((net: string) => {
      setNetwork(net)
    })
  }, [])

  const connect = async () => {
    if (!window.aptos) {
      window.open(
        'https://chrome.google.com/webstore/detail/petra-wallet/ejjladinnckhdjngfhkpeeebnmgbnklk'
      )
      return
    }

    try {
      const response = await window.aptos.connect()
      setConnected(true)
      setAccount(response.address)
      const net = await window.aptos.network()
      setNetwork(net)
    } catch (error) {
      console.error('Failed to connect Petra Wallet:', error)
    }
  }

  const disconnect = async () => {
    await window.aptos.disconnect()
    setConnected(false)
    setAccount(null)
  }

  return { connected, account, network, connect, disconnect }
}
```

## リソース（Resource）モデルとフロントエンドの読み取り

Aptos のリソースはアカウントアドレス配下に保存され、フロントエンドの読み取り方式は EVM とは本質的に異なります。

### アカウントリソースの読み取り

```typescript
// ユーザーの特定モジュール配下のリソースを読み取り
async function getUserVault(address: string) {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0xMyPackage::token::Vault',
    })

    // リソースのデータ構造は Move で定義された struct に依存
    return {
      balance: resource.balance, // Coin オブジェクトの値
    }
  } catch (error: any) {
    // 404 はアカウントにこのリソースがないことを意味する
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

// CoinStore 残高の読み取り
async function getCoinBalance(
  address: string,
  coinType: string // e.g. "0x1::aptos_coin::AptosCoin"
): Promise<number> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: `0x1::coin::CoinStore<${coinType}>`,
    })

    return parseInt(resource.coin.value)
  } catch {
    return 0
  }
}
```

### Table データの読み取り

Aptos の Table は永続化された key-value 構造で、EVM の mapping に類似しています：

```typescript
// Table 内のデータの読み取り
async function getTableValue(
  tableHandle: string,
  key: string,
  keyType: string,
  valueType: string
) {
  return aptos.getTableItem({
    tableHandle,
    data: {
      key_type: keyType,
      value_type: valueType,
      key,
    },
  })
}

// 例：ユーザーの信用スコアの読み取り
// Move: struct CreditScore has key { scores: Table<address, u64> }
async function getCreditScore(
  contractAddress: string,
  userAddress: string
) {
  // まずコントラクトリソースから table handle を取得
  const resource = await aptos.getAccountResource({
    accountAddress: contractAddress,
    resourceType: '0xMyApp::credit::CreditScore',
  })

  const tableHandle = resource.scores.handle

  // その後 table 内の値を照会
  const score = await getTableValue(
    tableHandle,
    userAddress,
    'address',
    'u64'
  )

  return score
}
```

## トランザクションの構築：payload 型と署名

### トランザクション payload の構築

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from '@aptos-labs/ts-sdk'

// entry function payload の構築
const payload = {
  type: 'entry_function_payload',
  function: '0x1::coin::transfer',
  type_arguments: ['0x1::aptos_coin::AptosCoin'],
  arguments: [
    '0xRecipientAddress...', // 受信者アドレス
    '100000000',              // 金額（octas、1 APT = 10^8 octas）
  ],
}
```

### 署名とトランザクションの送信

```typescript
// Petra Wallet で署名して送信
async function submitTransaction(
  payload: any
): Promise<string> {
  // Petra Wallet の signAndSubmitTransaction は署名と送信を同時に行う
  const transaction = await window.aptos.signAndSubmitTransaction(
    payload
  )

  // トランザクション確認の待機
  await aptos.waitForTransaction({
    transactionHash: transaction.hash,
  })

  return transaction.hash
}

// APT の送金
async function transferAPT(
  recipient: string,
  amount: number // APT 数量
) {
  const octas = Math.floor(amount * 1e8).toString()

  const payload = {
    type: 'entry_function_payload',
    function: '0x1::coin::transfer',
    type_arguments: ['0x1::aptos_coin::AptosCoin'],
    arguments: [recipient, octas],
  }

  return submitTransaction(payload)
}
```

### カスタム Move コントラクトの呼び出し

```typescript
// カスタムモジュールの関数の呼び出し
async function callMoveFunction(
  moduleAddress: string,
  moduleName: string,
  functionName: string,
  typeArgs: string[],
  args: any[]
) {
  const payload = {
    type: 'entry_function_payload',
    function: `${moduleAddress}::${moduleName}::${functionName}`,
    type_arguments: typeArgs,
    arguments: args,
  }

  return submitTransaction(payload)
}

// 例：マーケットプレイスで NFT を出品
const txHash = await callMoveFunction(
  '0xMarketplaceAddress...',
  'market',
  'list_item',
  [],
  [
    '0xNftCreatorAddress...',
    'NFTCollectionName',
    '0xNftId...',           // NFT の token name または ID
    '100000000',            // 価格（octas）
  ]
)
```

### マルチシグトランザクション

```typescript
import { MultiAgentTransaction } from '@aptos-labs/ts-sdk'

async function submitMultiAgentTransaction(
  sender: string,
  payload: any,
  secondarySigners: string[]
) {
  // マルチシグトランザクションの構築
  const rawTxn = await aptos.transaction.build.multiAgent({
    sender,
    secondarySigners,
    payload,
  })

  // 最初の署名者の署名
  const senderSignature = await window.aptos.signTransaction(rawTxn)

  // 2番目の署名者の署名
  // 通常は異なるデバイス/ページで完了
  const secondarySignatures = await Promise.all(
    secondarySigners.map((addr) =>
      getSignatureFromSecondary(addr, rawTxn)
    )
  )

  // マルチシグトランザクションの送信
  const pendingTxn = await aptos.transaction.submit.multiAgent({
    transaction: rawTxn,
    senderAuthenticator: senderSignature,
    secondarySignerAuthenticators: secondarySignatures,
  })

  await aptos.waitForTransaction({
    transactionHash: pendingTxn.hash,
  })

  return pendingTxn.hash
}
```

## Aptos DApp フロントエンド完全モジュール

```typescript
// lib/aptosDApp.ts
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

const APT_DECIMALS = 8

export class AptosDApp {
  private aptos: Aptos
  private account: string | null = null

  constructor(network: Network = Network.TESTNET) {
    const config = new AptosConfig({ network })
    this.aptos = new Aptos(config)
  }

  setAccount(account: string | null) {
    this.account = account
  }

  // APT 残高の取得
  async getAptBalance(address: string): Promise<number> {
    try {
      const resource = await this.aptos.getAccountResource({
        accountAddress: address,
        resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
      })
      return parseInt(resource.coin.value) / Math.pow(10, APT_DECIMALS)
    } catch {
      return 0
    }
  }

  // カスタムトークン残高の取得
  async getTokenBalance(
    address: string,
    coinType: string
  ): Promise<number> {
    try {
      const resource = await this.aptos.getAccountResource({
        accountAddress: address,
        resourceType: `0x1::coin::CoinStore<${coinType}>`,
      })
      return parseInt(resource.coin.value)
    } catch {
      return 0
    }
  }

  // APT の送金
  async transferApt(recipient: string, amount: number): Promise<string> {
    const octas = (amount * Math.pow(10, APT_DECIMALS)).toString()

    const payload = {
      type: 'entry_function_payload',
      function: '0x1::coin::transfer',
      type_arguments: ['0x1::aptos_coin::AptosCoin'],
      arguments: [recipient, octas],
    }

    const tx = await window.aptos.signAndSubmitTransaction(payload)
    await this.aptos.waitForTransaction({ transactionHash: tx.hash })
    return tx.hash
  }

  // CoinStore の登録（新規トークンを受け取る前に登録が必要）
  async registerCoin(coinType: string): Promise<string> {
    const payload = {
      type: 'entry_function_payload',
      function: '0x1::coin::register',
      type_arguments: [coinType],
      arguments: [],
    }

    const tx = await window.aptos.signAndSubmitTransaction(payload)
    await this.aptos.waitForTransaction({ transactionHash: tx.hash })
    return tx.hash
  }

  // view 関数の呼び出し
  async viewFunction(
    functionId: string,
    typeArgs: string[],
    args: any[]
  ): Promise<any[]> {
    return this.aptos.view({
      payload: {
        function: functionId,
        typeArguments: typeArgs,
        functionArguments: args,
      },
    })
  }

  // トランザクションイベントの取得
  async getTransactionEvents(txHash: string) {
    const txn = await this.aptos.getTransactionByHash({
      transactionHash: txHash,
    })

    return txn.events || []
  }

  // イベントデータの解析
  parseEvent(event: any, moduleName: string, eventName: string) {
    if (event.type.includes(`::${moduleName}::${eventName}`)) {
      return event.data
    }
    return null
  }
}
```

## Aptos と Sui の Move 実装の違い

### リソース保存方式

```typescript
// Aptos：リソースはアカウント配下に保存
// 読み取り方式：getAccountResource(address, resourceType)
const vault = await aptos.getAccountResource({
  accountAddress: userAddress,
  resourceType: '0xPackage::module::Vault',
})
// Vault リソースは userAddress アカウント配下に保存

// Sui：リソースは独立した Object
// 読み取り方式：getObject(objectId)
const object = await provider.getObject(objectId)
// Object に独立した ID があり、どのアカウントにも属さない
```

### トランザクションモデル

```typescript
// Aptos：entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0xAddr::module::function',
  type_arguments: [],
  arguments: [arg1, arg2],
}
// 1 つのトランザクションで 1 つの entry function を呼び出し

// Sui：TransactionBlock（複数の Move 呼び出しを含む可能）
const tx = new TransactionBlock()
tx.moveCall({ target: '0xAddr::module::func1', arguments: [...] })
tx.moveCall({ target: '0xAddr::module::func2', arguments: [...] })
// 1 つのトランザクションで複数の操作を原子的に実行可能
```

### Gas メカニズム

```typescript
// Aptos：Gas Unit Price * Max Gas Amount
// EVM の Gas Price * Gas Limit に類似
const txn = {
  ...payload,
  max_gas_amount: '2000',
  gas_unit_price: '100',
}
// トランザクション費用 = gas_used * gas_unit_price

// Sui：Gas Budget
// 総予算を指定し、未使用分は返金
tx.setGasBudget(50000000)
```

## フロントエンド開発体験の比較：Aptos vs EVM

| 次元 | Aptos | EVM |
|------|-------|-----|
| アカウントモデル | アカウントがリソースを保存 | アカウントが残高を保存 |
| データ照会 | getAccountResource | eth_call |
| トランザクション構築 | entry function payload | ABI calldata |
| 型システム | Move 強型 | ABI + 手動型 |
| 並列実行 | Block-STM | 直列 |
| トランザクション確認 | ~1 秒 | ~12 秒（メインネット） |
| ウォレット | Petra Wallet | MetaMask |
| SDK | @aptos-labs/ts-sdk | ethers.js / viem |

### イベントリスナーの比較

```typescript
// EVM：コントラクトイベントのリスナー
contract.on('Transfer', (from, to, value) => {
  console.log(from, to, value)
})

// Aptos：トランザクションイベントの照会（リアルタイム WebSocket リスナーなし）
// ポーリングまたは SDK のイベントサブスクリプションが必要
async function pollEvents(
  contractAddress: string,
  eventName: string,
  fromVersion: number
) {
  const events = await aptos.getEventsByEventHandle({
    accountAddress: contractAddress,
    eventHandle: '0xPackage::module::EventHandle',
    fieldName: 'transfer_events',
  })

  return events.filter((e) => e.type.includes(eventName))
}
```

## エコシステムツールチェーンの評価

Aptos エコシステムツールチェーンの発展状況：

**SDK**：`@aptos-labs/ts-sdk` は大幅なバージョンアップを行い、API はよりモダンになりましたがドキュメントの移行が追いついていません。旧版 `aptos` SDK はまだ使用されており、移行コストは高めです。

**ウォレット**：Petra Wallet が主流の選択肢で、機能は安定していますが拡張性に限界があります。Martian Wallet、Fewcha Wallet などのサードパーティウォレットも存在しますが、互換性はまちまちです。

**開発ツール**：Aptos CLI はコントラクトのコンパイル、テスト、デプロイに使用されます。Move 言語の学習曲線は Rust の経験がある開発者には比較的フレンドリーですが、Solidity 開発者はリソース指向プログラミングの考え方に適応する必要があります。

**インデックスサービス**：Aptos のインデックスインフラは The Graph ほど成熟していません。自前でのインデックスサービス構築や Aptos 公式 Indexer（PostgreSQL ベース）の使用が必要です。

## まとめ

Aptos は Diem の技術的蓄積を引き継ぎ、Move 言語と並列実行の面で堅実な基盤を持っています。リソース指向プログラミングは Solidity より強い型安全性の保証を提供します——リソースはコピーも破棄もできず、これは資産管理のシナリオで特に重要です。

Sui と比較して、Aptos のアカウントモデルは EVM の思考パターンに近いです——リソースは独立した Object としてではなくアカウントアドレス配下に保存されます。これにより EVM から Aptos への移行の学習曲線は Sui への移行よりも緩やかになります。ただし Aptos の Table 照会とイベントシステムはリアルタイム性の面で EVM の WebSocket イベントリスナーに劣ります。

フロントエンド開発体験について、`@aptos-labs/ts-sdk` の API 設計は明確ですがまだ急速なイテレーション中です。Petra Wallet の統合方式は初期の Sui Wallet より成熟していますが、MetaMask のエコシステムの成熟度にはまだ及びません。トランザクション確認の速さ（~1 秒）は Aptos の顕著な優位性であり、これによりフロントエンドの状態管理は EVM の複数ブロック待機よりもシンプルになります。

Move エコシステム全体は初期段階にあり、ツールチェーンと開発者コミュニティの成長には時間が必要です。しかし技術的基盤は堅実であり、フロントエンド開発者が学習に投資する価値があります。
