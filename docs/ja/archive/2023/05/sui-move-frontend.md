---
title: "Sui Move エコシステムのフロントエンド開発：Move から Web へ"
date: 2023-05-11 19:14:49
tags:
  - Web3
  - Blockchain
readingTime: 11
description: "Sui は EVM の Account モデルではなく Object モデルを採用しており、フロントエンドのインタラクション方式が全く異なります。本記事では @mysten/sui.js SDK、ウォレット接続、Object 読み取りとトランザクション構築の完全なフローを網羅します。"
wordCount: 1711
---

Sui は Mysten Labs が開発した Layer 1 ブロックチェーンで、Move 言語と Object ベースのデータモデルを使用します。EVM チェーンの Account モデルとは異なり、Sui の各資産は独立した Object で、独自の ID と所有権を持ちます。このアーキテクチャの違いはフロントエンド開発の方法に直接的な影響を与えます——データの読み取りからトランザクションの構築まで、すべてを再理解する必要があります。

## Sui ネットワークの概要と Move 言語の特徴

### Sui の核心的な特徴

- **Object モデル**：すべての資産とデータは Account 残高ではなく Object
- **Move 言語**：リソース指向プログラミング、リソースはコピーも破棄もできない
- **並列実行**：トランザクションは Object の依存関係に従って並列処理、競合しないトランザクションは同時実行
- **Gas トークン**：SUI
- **コンセンサス**：Narwhal & Bullshark（DAG ベースの BFT コンセンサス）

### Move 言語のユニークな点

```move
// Move モジュールの例
module my_package::coin {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    // リソース型の定義
    struct Treasury has key {
        id: UID,
        balance: Coin<SUI>,
    }

    public fun create treasury(balance: Coin<SUI>, ctx: &mut TxContext) {
        let treasury = Treasury {
            id: object::new(ctx),
            balance,
        };
        transfer::share_object(treasury);
    }

    public fun withdraw(treasury: &mut Treasury, amount: u64, ctx: &mut TxContext) {
        let coin = coin::take(&mut treasury.balance, amount, ctx);
        transfer::transfer(coin, tx_context::sender(ctx));
    }
}
```

Move の核心的な特徴はリソース指向です：リソース（Resource）はファーストクラス市民であり、コピーも破棄もできず、明示的に転移または破棄しなければなりません。これは Solidity の storage 変数モデルとは全く異なります。

## Sui の Object モデル vs EVM の Account モデル

### EVM Account モデル

```
アカウントアドレス → 残高マッピング
mapping(address => uint256) balances

// 送金：2 つのアカウントの残高を変更
balances[sender] -= amount;
balances[recipient] += amount;
```

### Sui Object モデル

```
各 Coin は独立した Object
Object {
  id: 0x...
  owner: 0x...
  value: 100
  type: 0x2::sui::SUI
}

// 送金：Object の所有権を移転
transfer_object(coin_object, new_owner)
```

この違いがフロントエンドに与える影響は根本的なものです：

| 次元 | EVM Account モデル | Sui Object モデル |
|------|-----------------|-----------------|
| 資産表現 | 残高（一つの数値） | Object（独立したエンティティ） |
| 送金 | 残高マッピングの変更 | Object の所有権移転 |
| データ照会 | ストレージスロットの読み取り | Object の照会 |
| 履歴追跡 | イベントログが必要 | Object に完全な履歴がある |
| 並列処理 | グローバル状態ロック | Object 依存関係に基づく並列 |

## @mysten/sui.js SDK の使用

`@mysten/sui.js` は Sui 公式の JavaScript SDK で、Sui ネットワークとのインタラクションのための完全な API を提供します。

### インストールと初期化

```bash
npm install @mysten/sui.js
```

```typescript
import {
  JsonRpcProvider,
  localnetConnection,
  testnetConnection,
  mainnetConnection,
} from '@mysten/sui.js'

// Sui ネットワークに接続
const provider = new JsonRpcProvider(testnetConnection)

// またはカスタム RPC を使用
const customProvider = new JsonRpcProvider({
  url: 'https://sui-testnet.nodeprovider.com/rpc',
})
```

### 基本情報の照会

```typescript
// オンチェーン情報の取得
const chainId = await provider.getChainIdentifier()
const latestCheckpoint = await provider.getLatestCheckpointSequenceNumber()
const rpcApiVersion = await provider.getRpcApiVersion()

// あるアドレスが保有するすべての Object の取得
const objects = await provider.getObjectsOwnedByAddress(
  '0xUserAddress...'
)

console.log(objects.data)
// [
//   {
//     objectId: '0x...',
//     version: 1,
//     digest: '...',
//     type: '0x2::coin::Coin<0x2::sui::SUI>',
//     owner: { AddressOwner: '0x...' }
//   },
//   ...
// ]
```

## フロントエンドからの Sui ウォレット接続

Sui Wallet は Sui 公式のブラウザ拡張ウォレットで、MetaMask に類似しています。

### ウォレットの検出と接続

```typescript
// hooks/useSuiWallet.ts
import { useState, useEffect } from 'react'

declare global {
  interface Window {
    suiWallet?: any
  }
}

export function useSuiWallet() {
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // ウォレットがインストールされているか検出
    if (window.suiWallet) {
      // 接続済みかチェック
      window.suiWallet
        .hasPermissions()
        .then(() => {
          setConnected(true)
          return window.suiWallet.getAccounts()
        })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0])
          }
        })
        .catch(() => {
          // 未接続
        })
    }

    // アカウント変化の監視
    window.suiWallet?.on('accountChanged', (account: string) => {
      setAccount(account)
    })

    // 切断の監視
    window.suiWallet?.on('disconnect', () => {
      setConnected(false)
      setAccount(null)
    })
  }, [])

  const connect = async () => {
    if (!window.suiWallet) {
      window.open('https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmaojdnfgeibjlmn')
      return
    }

    try {
      await window.suiWallet.requestPermissions()
      const accounts = await window.suiWallet.getAccounts()
      setAccount(accounts[0])
      setConnected(true)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const disconnect = async () => {
    await window.suiWallet.disconnect()
    setConnected(false)
    setAccount(null)
  }

  return { connected, account, connect, disconnect }
}
```

## Object の読み取り

### getObject：単一 Object の取得

```typescript
import { JsonRpcProvider, testnetConnection } from '@mysten/sui.js'

const provider = new JsonRpcProvider(testnetConnection)

// 単一 Object の取得
const objectResponse = await provider.getObject(
  '0xObjectId...'
)

const object = objectResponse.details
console.log(object)
// {
//   data: {
//     objectId: '0x...',
//     version: 1,
//     type: '0x2::coin::Coin<0x2::sui::SUI>',
//     content: { fields: { balance: '1000000000', id: {...} } }
//   }
// }

// Object を取得し返却オプションを指定
const objectWithOptions = await provider.getObject(
  '0xObjectId...',
  { showContent: true, showOwner: true, showType: true }
)

// 複数 Object のバッチ取得
const multiObjectResponse = await provider.multiGetObjects([
  '0xObjectId1...',
  '0xObjectId2...',
  '0xObjectId3...',
], { showContent: true })
```

### getObjectsOwnedByAddress：アドレスが保有するすべての Object の取得

```typescript
// アドレスが保有するすべての Object を取得（ページネーション）
async function getAllObjects(address: string) {
  const allObjects: any[] = []
  let cursor: string | null = null

  do {
    const response = await provider.getObjectsOwnedByAddress(
      address,
      { cursor, limit: 50 }
    )

    allObjects.push(...response.data)
    cursor = response.nextCursor

  } while (cursor)

  return allObjects
}

// タイプで Object をフィルタリング
async function getCoinsByType(address: string, coinType: string) {
  const objects = await getAllObjects(address)

  return objects.filter(
    (obj) => obj.type === `0x2::coin::Coin<${coinType}>`
  )
}

// すべての SUI トークンを取得
const suiCoins = await getCoinsByType(
  account,
  '0x2::sui::SUI'
)

// SUI の総残高を集約
const totalSui = suiCoins.reduce((sum, coin) => {
  // 各 Object の詳細コンテンツを取得する必要がある
  return sum
}, BigInt(0))

// Coin 詳細のバッチ取得
const coinDetails = await provider.multiGetObjects(
  suiCoins.map((c) => c.objectId),
  { showContent: true }
)

const totalBalance = coinDetails.reduce((sum, resp) => {
  const balance = resp.details?.data?.content?.fields?.balance
  return sum + BigInt(balance || 0)
}, BigInt(0))

console.log('Total SUI:', totalBalance.toString())
```

## トランザクションの構築と署名

### paySui：SUI トークンの送金

```typescript
// SUI トークンの送信
async function sendSui(
  recipient: string,
  amount: bigint,
  sender: string
) {
  // 送信者の SUI Coin を取得
  const coins = await provider.getObjectsOwnedByAddress(sender)
  const suiCoins = coins.data.filter(
    (c) => c.type === '0x2::coin::Coin<0x2::sui::SUI>'
  )

  // 支払いに十分な Coin を取得
  const coinObjects = await provider.multiGetObjects(
    suiCoins.map((c) => c.objectId),
    { showContent: true }
  )

  // 残高が十分な Coin をフィルタリング
  const sufficientCoins = coinObjects.filter((resp) => {
    const balance = resp.details?.data?.content?.fields?.balance
    return BigInt(balance || 0) >= amount
  })

  if (sufficientCoins.length === 0) {
    throw new Error('Insufficient SUI balance')
  }

  // paySui トランザクションの構築
  const tx = new TransactionBlock()
  const coin = tx.object(sufficientCoins[0].details.reference.objectId)
  const splitCoin = tx.splitCoins(coin, [tx.pure(amount)])

  // 受信者に移転
  tx.transferObjects([splitCoin], tx.pure(recipient))

  // ウォレットで署名して送信
  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  const result = await provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
  })

  return result
}
```

### moveCall：Move コントラクトの呼び出し

```typescript
import { TransactionBlock } from '@mysten/sui.js'

// Move モジュールの関数を呼び出し
async function callMoveFunction(
  packageId: string,
  moduleName: string,
  functionName: string,
  typeArgs: string[],
  args: any[],
  gasBudget: number
) {
  const tx = new TransactionBlock()

  // moveCall の構築
  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    typeArguments: typeArgs,
    arguments: args.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('0x')) {
        return tx.object(arg) // Object ID
      }
      return tx.pure(arg)    // 純粋パラメータ
    }),
  })

  tx.setGasBudget(gasBudget)

  // 署名して送信
  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  const result = await provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
    options: {
      showEffects: true,
      showEvents: true,
    },
  })

  return result
}

// 例：カスタム Move コントラクトの呼び出し
const result = await callMoveFunction(
  '0xPackageId...',
  'marketplace',
  'list_item',
  [], // ジェネリックパラメータなし
  [
    '0xNftObjectId...',  // NFT Object ID
    1000000000,          // 価格（MIST）
  ],
  100000000 // Gas budget
)
```

### Coin のマージ

```typescript
// 複数の SUI Coin を1つにマージ
async function mergeCoins(coinIds: string[]) {
  const tx = new TransactionBlock()

  // 最初の Coin をメイン Coin にする
  const primaryCoin = tx.object(coinIds[0])

  // 残りの Coin をメイン Coin にマージ
  const coinsToMerge = coinIds.slice(1).map((id) => tx.object(id))
  tx.mergeCoins(primaryCoin, coinsToMerge)

  tx.setGasBudget(50000000)

  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  return provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
  })
}
```

## Sui DApp フロントエンド完全モジュール

```typescript
// lib/suiDApp.ts
import {
  JsonRpcProvider,
  TransactionBlock,
  testnetConnection,
} from '@mysten/sui.js'

export class SuiDApp {
  private provider: JsonRpcProvider
  private account: string | null = null

  constructor() {
    this.provider = new JsonRpcProvider(testnetConnection)
  }

  setAccount(account: string | null) {
    this.account = account
  }

  // SUI 残高の取得
  async getSuiBalance(address: string): Promise<bigint> {
    const coins = await this.provider.getCoins(address, {
      coinType: '0x2::sui::SUI',
    })

    return coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    )
  }

  // すべての NFT の取得
  async getNFTs(address: string) {
    const objects = await this.provider.getOwnedObjects({
      owner: address,
      filter: { StructType: '0x2::devnet_nft::DevNetNFT' },
      options: { showContent: true, showType: true },
    })

    return objects.data.map((obj) => ({
      id: obj.data?.objectId,
      name: obj.data?.content?.fields?.name,
      url: obj.data?.content?.fields?.url,
      description: obj.data?.content?.fields?.description,
    }))
  }

  // NFT の鋳造
  async mintNFT(
    name: string,
    description: string,
    url: string
  ) {
    const tx = new TransactionBlock()

    tx.moveCall({
      target: '0x2::devnet_nft::mint',
      arguments: [tx.pure(name), tx.pure(description), tx.pure(url)],
    })

    tx.setGasBudget(100000000)

    const signedTx = await window.suiWallet.signTransactionBlock({
      transactionBlock: tx,
    })

    const result = await this.provider.executeTransactionBlock({
      transactionBlock: signedTx.transactionBlockBytes,
      signature: signedTx.signature,
      options: { showEffects: true, showEvents: true },
    })

    return result
  }

  // SUI の送金
  async transferSui(recipient: string, amount: bigint) {
    const tx = new TransactionBlock()

    // gas coin から指定額を分割
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)])
    tx.transferObjects([coin], tx.pure(recipient))

    tx.setGasBudget(50000000)

    const signedTx = await window.suiWallet.signTransactionBlock({
      transactionBlock: tx,
    })

    return this.provider.executeTransactionBlock({
      transactionBlock: signedTx.transactionBlockBytes,
      signature: signedTx.signature,
    })
  }

  // トランザクション確認の待機
  async waitForTransaction(digest: string) {
    return this.provider.waitForTransaction({
      digest,
      options: { showEffects: true, showEvents: true },
    })
  }

  // Move コントラクトイベントの読み取り
  async queryEvents(packageId: string, limit: number = 50) {
    const events = await this.provider.queryEvents({
      query: { MoveModule: { package: packageId, module: 'marketplace' } },
      limit,
    })

    return events.data
  }
}
```

## Move コントラクトモジュールの TypeScript 型マッピング

Move の型システムは TypeScript とは大きく異なり、手動でマッピング関係を構築する必要があります。

```typescript
// types/sui.ts

// Move の Coin<SUI> に対応する TypeScript 型
interface SuiCoinObject {
  objectId: string
  version: number
  digest: string
  type: '0x2::coin::Coin<0x2::sui::SUI>'
  content: {
    dataType: 'moveObject'
    type: '0x2::coin::Coin<0x2::sui::SUI>'
    fields: {
      balance: string
      id: { id: string }
    }
  }
}

// Move の struct に対応する TypeScript 型
// move:
// struct Listing has key {
//   id: UID,
//   item: ID,
//   price: u64,
//   seller: address,
// }
interface ListingObject {
  objectId: string
  type: '0xPackage::marketplace::Listing'
  content: {
    fields: {
      item: { id: string }
      price: string
      seller: string
    }
  }
}

// 型ガード
function isSuiCoin(obj: any): obj is SuiCoinObject {
  return obj?.type === '0x2::coin::Coin<0x2::sui::SUI>'
}

function isListing(obj: any): obj is ListingObject {
  return obj?.type?.includes('::marketplace::Listing')
}

// 汎用 Object パーサー
function parseObject<T>(raw: any): T | null {
  if (!raw?.details?.data?.content) return null

  const fields = raw.details.data.content.fields
  // Move の struct fields は content.fields 内にある
  // ネストされた struct にも独自の fields がある
  return fields as T
}

// 使用
const listing = parseObject<ListingFields>(rawListing)
if (listing) {
  console.log('Price:', listing.price)
  console.log('Seller:', listing.seller)
}
```

## EVM DApp 開発との違いの比較

### データ照会方式

```typescript
// EVM：コントラクトストレージの読み取り
const balance = await tokenContract.balanceOf(userAddress)
// 一つの数値を返す

// Sui：Object リストの照会
const coins = await provider.getCoins(userAddress, { coinType: '0x2::sui::SUI' })
// Object のグループを返す、各々に独立した ID がある
const totalBalance = coins.data.reduce(
  (sum, c) => sum + BigInt(c.balance),
  BigInt(0)
)
```

### トランザクション構築方式

```typescript
// EVM：calldata の送信
const tx = await contract.transfer(recipient, amount)
// ABI が関数セレクタ + パラメータをエンコード

// Sui：TransactionBlock の構築
const tx = new TransactionBlock()
tx.moveCall({
  target: `${packageId}::coin::transfer`,
  arguments: [tx.object(coinId), tx.pure(recipient)],
})
// トランザクションは Move 呼び出しのシーケンス
```

### Gas メカニズム

```typescript
// EVM：Gas Price * Gas Used
// Gas Price は EIP-1559 の base fee + priority fee で決定

// Sui：Gas Budget（予算制）
// トランザクションが Gas Budget を指定し、実際の消費は Budget から差し引かれる
tx.setGasBudget(50000000) // 0.05 SUI
// 未使用の Gas は返金
```

### トランザクション確認

```typescript
// EVM：ブロック確認の待機
const receipt = await tx.wait(1) // 1 ブロック

// Sui：Object 依存関係に基づく並列確認
// 競合しないトランザクションはほぼ即時に確認
const result = await provider.waitForTransaction({ digest })
// 競合するトランザクションはコンセンサスを経るため少し遅い
```

## Sui エコシステムの成熟度評価

Sui エコシステムは初期段階にあります：

**SDK の成熟度**：`@mysten/sui.js` の API は頻繁に変化し、バージョン間に breaking changes が存在します。ドキュメントのカバレッジは広いですが、深い例が不足しています。

**ウォレットエコシステム**：Sui Wallet が主要なブラウザ拡張ウォレットですが、ユーザー体験と機能は MetaMask ほど成熟していません。Ethos Wallet、Martian Wallet などのサードパーティウォレットも発展中です。

**開発者ツール**：Sui CLI はコントラクト開発とデプロイに使用され、機能は基本的に完璧ですが学習曲線が急です。Move 言語自体は Rust の経験がある開発者にとって比較的フレンドリーです。

**DApp エコシステム**：DeFi、NFT、GameFi 領域でプロジェクトが構築されていますが、ユーザー数と TVL は EVM エコシステムとの差が顕著です。

## まとめ

Sui の Object モデルはフロントエンド開発に全く新しい思考パラダイムをもたらしました。「残高」というシンプルな概念はなくなり、代わりに一つ一つが独自の ID、バージョン、所有権を持つ Object のグループが登場します。このモデルは一部のシナリオではより直感的です——NFT の転送は Object の所有権変更であり、ERC-721 の複雑なインターフェースは不要です。しかし別のシナリオではより複雑です——ユーザーの総残高を取得するにはすべての Coin Object をトラバースして集約する必要があります。

Move 言語のリソース指向プログラミングは型システムレベルで資産の安全性を保証し、リソースはコピーも破棄もできません。これは Solidity よりも強い安全保証ですが、フロントエンドの型マッピングの複雑さも増しています。

EVM から Sui へ移行するフロントエンド開発者は3つの核心的な変化に適応する必要があります：コントラクトストレージの照会から Object の照会へ、ABI 呼び出しから TransactionBlock の構築へ、Gas Price から Gas Budget へ。これらの変化は漸進的な改良ではなく、考え方の転換です。

Sui エコシステムの成熟度は初期段階にあり、SDK とツールチェーンの安定性には向上の余地があります。しかし Object モデルと並列実行の技術的優位性は明確であり、フロントエンド開発者が注目し学習する価値があります。
