---
title: "Sui Move 生態前端開發：從 Move 到 Web"
date: 2023-05-11 19:14:49
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "Sui 採用 Object 模型而非 EVM 的 Account 模型，前端交互方式截然不同。本文覆蓋 @mysten/sui.js SDK、錢包連接、Object 讀取與交易構建的完整鏈路。"
wordCount: 1042
---

Sui 是 Mysten Labs 開發的 Layer 1 區塊鏈，使用 Move 語言和基於 Object 的數據模型。與 EVM 鏈的 Account 模型不同，Sui 的每個資產都是獨立的 Object，擁有自己的 ID 和所有權。這種架構差異直接影響了前端開發的方式——從數據讀取到交易構建，都需要重新理解。

## Sui 網絡概述與 Move 語言特點

### Sui 的核心特性

- **Object 模型**：所有資產和數據都是 Object，而非賬户餘額
- **Move 語言**：資源導向編程，資源不能被複制或丟棄
- **並行執行**：交易按 Object 依賴關係並行處理，不衝突的交易同時執行
- **Gas 代幣**：SUI
- **共識**：Narwhal & Bullshark（基於 DAG 的 BFT 共識）

### Move 語言的獨特之處

```move
// Move 模塊示例
module my_package::coin {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    // 定義一個資源類型
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

Move 的核心特性是資源導向：資源（Resource）是一等公民，不能被複制或丟棄，必須顯式轉移或銷燬。這與 Solidity 的 storage 變量模型完全不同。

## Sui 的 Object 模型 vs EVM 的 Account 模型

### EVM Account 模型

```
賬户地址 → 餘額映射
mapping(address => uint256) balances

// 轉賬：修改兩個賬户的餘額
balances[sender] -= amount;
balances[recipient] += amount;
```

### Sui Object 模型

```
每個 Coin 是獨立的 Object
Object {
  id: 0x...
  owner: 0x...
  value: 100
  type: 0x2::sui::SUI
}

// 轉賬：轉移 Object 的所有權
transfer_object(coin_object, new_owner)
```

這個差異對前端的影響是根本性的：

| 維度 | EVM Account 模型 | Sui Object 模型 |
|------|-----------------|-----------------|
| 資產表示 | 餘額（一個數字） | Object（獨立實體） |
| 轉賬 | 修改餘額映射 | 轉移 Object 所有權 |
| 數據查詢 | 讀取存儲槽 | 查詢 Object |
| 歷史追蹤 | 需要事件日誌 | Object 有完整歷史 |
| 並行處理 | 全局狀態鎖 | 按 Object 依賴並行 |

## @mysten/sui.js SDK 使用

`@mysten/sui.js` 是 Sui 官方 JavaScript SDK，提供與 Sui 網絡交互的完整 API。

### 安裝與初始化

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

// 連接到 Sui 網絡
const provider = new JsonRpcProvider(testnetConnection)

// 或使用自定義 RPC
const customProvider = new JsonRpcProvider({
  url: 'https://sui-testnet.nodeprovider.com/rpc',
})
```

### 查詢基本信息

```typescript
// 獲取鏈上信息
const chainId = await provider.getChainIdentifier()
const latestCheckpoint = await provider.getLatestCheckpointSequenceNumber()
const rpcApiVersion = await provider.getRpcApiVersion()

// 獲取某個地址擁有的所有 Object
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

## 前端連接 Sui 錢包

Sui Wallet 是 Sui 官方的瀏覽器擴展錢包，類似 MetaMask。

### 檢測與連接錢包

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

    // 檢測錢包是否安裝
    if (window.suiWallet) {
      // 檢查是否已連接
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
          // 未連接
        })
    }

    // 監聽賬户變化
    window.suiWallet?.on('accountChanged', (account: string) => {
      setAccount(account)
    })

    // 監聽斷開連接
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

## 讀取 Object

### getObject：獲取單個 Object

```typescript
import { JsonRpcProvider, testnetConnection } from '@mysten/sui.js'

const provider = new JsonRpcProvider(testnetConnection)

// 獲取單個 Object
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

// 獲取 Object 並指定返回選項
const objectWithOptions = await provider.getObject(
  '0xObjectId...',
  { showContent: true, showOwner: true, showType: true }
)

// 批量獲取多個 Object
const multiObjectResponse = await provider.multiGetObjects([
  '0xObjectId1...',
  '0xObjectId2...',
  '0xObjectId3...',
], { showContent: true })
```

### getObjectsOwnedByAddress：獲取地址擁有的所有 Object

```typescript
// 獲取地址擁有的所有 Object（分頁）
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

// 按類型過濾 Object
async function getCoinsByType(address: string, coinType: string) {
  const objects = await getAllObjects(address)

  return objects.filter(
    (obj) => obj.type === `0x2::coin::Coin<${coinType}>`
  )
}

// 獲取所有 SUI 代幣
const suiCoins = await getCoinsByType(
  account,
  '0x2::sui::SUI'
)

// 聚合 SUI 總餘額
const totalSui = suiCoins.reduce((sum, coin) => {
  // 需要獲取每個 Object 的詳細內容
  return sum
}, BigInt(0))

// 批量獲取 Coin 詳情
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

## 交易構建與簽名

### paySui：轉移 SUI 代幣

```typescript
// 發送 SUI 代幣
async function sendSui(
  recipient: string,
  amount: bigint,
  sender: string
) {
  // 獲取發送者的 SUI Coin
  const coins = await provider.getObjectsOwnedByAddress(sender)
  const suiCoins = coins.data.filter(
    (c) => c.type === '0x2::coin::Coin<0x2::sui::SUI>'
  )

  // 獲取足夠的 Coin 來支付
  const coinObjects = await provider.multiGetObjects(
    suiCoins.map((c) => c.objectId),
    { showContent: true }
  )

  // 篩選餘額足夠的 Coin
  const sufficientCoins = coinObjects.filter((resp) => {
    const balance = resp.details?.data?.content?.fields?.balance
    return BigInt(balance || 0) >= amount
  })

  if (sufficientCoins.length === 0) {
    throw new Error('Insufficient SUI balance')
  }

  // 構建 paySui 交易
  const tx = new TransactionBlock()
  const coin = tx.object(sufficientCoins[0].details.reference.objectId)
  const splitCoin = tx.splitCoins(coin, [tx.pure(amount)])

  // 轉移給接收者
  tx.transferObjects([splitCoin], tx.pure(recipient))

  // 使用錢包簽名併發送
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

### moveCall：調用 Move 合約

```typescript
import { TransactionBlock } from '@mysten/sui.js'

// 調用 Move 模塊的函數
async function callMoveFunction(
  packageId: string,
  moduleName: string,
  functionName: string,
  typeArgs: string[],
  args: any[],
  gasBudget: number
) {
  const tx = new TransactionBlock()

  // 構建 moveCall
  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    typeArguments: typeArgs,
    arguments: args.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('0x')) {
        return tx.object(arg) // Object ID
      }
      return tx.pure(arg)    // 純參數
    }),
  })

  tx.setGasBudget(gasBudget)

  // 簽名併發送
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

// 示例：調用自定義 Move 合約
const result = await callMoveFunction(
  '0xPackageId...',
  'marketplace',
  'list_item',
  [], // 無泛型參數
  [
    '0xNftObjectId...',  // NFT Object ID
    1000000000,          // 價格（MIST）
  ],
  100000000 // Gas budget
)
```

### 合併 Coin

```typescript
// 合併多個 SUI Coin 為一個
async function mergeCoins(coinIds: string[]) {
  const tx = new TransactionBlock()

  // 第一個 Coin 作為主 Coin
  const primaryCoin = tx.object(coinIds[0])

  // 其餘 Coin 合併到主 Coin
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

## Sui DApp 前端完整模塊

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

  // 獲取 SUI 餘額
  async getSuiBalance(address: string): Promise<bigint> {
    const coins = await this.provider.getCoins(address, {
      coinType: '0x2::sui::SUI',
    })

    return coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    )
  }

  // 獲取所有 NFT
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

  // 鑄造 NFT
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

  // 轉移 SUI
  async transferSui(recipient: string, amount: bigint) {
    const tx = new TransactionBlock()

    // 使用 gas coin 分割出指定金額
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

  // 監聽交易確認
  async waitForTransaction(digest: string) {
    return this.provider.waitForTransaction({
      digest,
      options: { showEffects: true, showEvents: true },
    })
  }

  // 讀取 Move 合約事件
  async queryEvents(packageId: string, limit: number = 50) {
    const events = await this.provider.queryEvents({
      query: { MoveModule: { package: packageId, module: 'marketplace' } },
      limit,
    })

    return events.data
  }
}
```

## Move 合約模塊的 TypeScript 類型映射

Move 的類型系統與 TypeScript 差異較大，需要手動建立映射關係。

```typescript
// types/sui.ts

// Move 中的 Coin<SUI> 對應 TypeScript 類型
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

// Move 中的 struct 對應 TypeScript 類型
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

// 類型守衞
function isSuiCoin(obj: any): obj is SuiCoinObject {
  return obj?.type === '0x2::coin::Coin<0x2::sui::SUI>'
}

function isListing(obj: any): obj is ListingObject {
  return obj?.type?.includes('::marketplace::Listing')
}

// 通用 Object 解析器
function parseObject<T>(raw: any): T | null {
  if (!raw?.details?.data?.content) return null

  const fields = raw.details.data.content.fields
  // Move 的 struct fields 在 content.fields 中
  // 嵌套的 struct 也有自己的 fields
  return fields as T
}

// 使用
const listing = parseObject<ListingFields>(rawListing)
if (listing) {
  console.log('Price:', listing.price)
  console.log('Seller:', listing.seller)
}
```

## 與 EVM DApp 開發的差異對比

### 數據查詢方式

```typescript
// EVM：讀取合約存儲
const balance = await tokenContract.balanceOf(userAddress)
// 返回一個數字

// Sui：查詢 Object 列表
const coins = await provider.getCoins(userAddress, { coinType: '0x2::sui::SUI' })
// 返回一組 Object，每個有獨立的 ID
const totalBalance = coins.data.reduce(
  (sum, c) => sum + BigInt(c.balance),
  BigInt(0)
)
```

### 交易構建方式

```typescript
// EVM：發送 calldata
const tx = await contract.transfer(recipient, amount)
// ABI 編碼函數選擇器 + 參數

// Sui：構建 TransactionBlock
const tx = new TransactionBlock()
tx.moveCall({
  target: `${packageId}::coin::transfer`,
  arguments: [tx.object(coinId), tx.pure(recipient)],
})
// 交易是一組 Move 調用的序列
```

### Gas 機制

```typescript
// EVM：Gas Price * Gas Used
// Gas Price 由 EIP-1559 的 base fee + priority fee 決定

// Sui：Gas Budget（預算制）
// 交易指定 Gas Budget，實際消耗從 Budget 中扣除
tx.setGasBudget(50000000) // 0.05 SUI
// 未用完的 Gas 退還
```

### 交易確認

```typescript
// EVM：等待區塊確認
const receipt = await tx.wait(1) // 1 個區塊

// Sui：按 Object 依賴並行確認
// 不衝突的交易幾乎即時確認
const result = await provider.waitForTransaction({ digest })
// 衝突的交易需要經過共識，稍慢
```

## Sui 生態的成熟度評估

Sui 生態目前仍處於發展階段：

**SDK 成熟度**：`@mysten/sui.js` API 變化頻繁，版本間存在 breaking changes。文檔覆蓋面廣但缺乏深度示例。

**錢包生態**：Sui Wallet 是主要的瀏覽器擴展錢包，但用户體驗和功能不如 MetaMask 成熟。Ethos Wallet、Martian Wallet 等第三方錢包也在發展中。

**開發者工具**：Sui CLI 用於合約開發和部署，功能基本完整但學習曲線陡峭。Move 語言本身對有 Rust 經驗的開發者較為友好。

**DApp 生態**：DeFi、NFT、GameFi 領域有項目在建設，但用户量和 TVL 與 EVM 生態差距明顯。

## 小結

Sui 的 Object 模型為前端開發帶來了全新的思維範式。不再有"餘額"這個簡單概念，取而代之的是一組組獨立的 Object，每個都有自己的 ID、版本和所有權。這種模型在某些場景下更直觀——NFT 轉移就是 Object 所有權變更，不需要 ERC-721 的複雜接口；但在另一些場景下更復雜——獲取用户總餘額需要遍歷所有 Coin Object 並聚合。

Move 語言的資源導向編程從類型系統層面保證了資產安全，資源不能被複制或丟棄。這是比 Solidity 更強的安全保證，但也增加了前端類型映射的複雜度。

從 EVM 遷移到 Sui 的前端開發者需要適應三個核心變化：從查詢合約存儲到查詢 Object、從 ABI 調用到 TransactionBlock 構建、從 Gas Price 到 Gas Budget。這些變化不是漸進式的改良，而是思維方式的轉換。

Sui 生態的成熟度有待提升，SDK 和工具鏈的穩定性仍在完善中。但 Object 模型和並行執行的技術優勢是明確的，值得前端開發者關注和學習。
