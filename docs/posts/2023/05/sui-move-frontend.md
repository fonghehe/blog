---
title: "Sui Move 生态前端开发：从 Move 到 Web"
date: 2023-05-11 19:14:49
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "Sui 采用 Object 模型而非 EVM 的 Account 模型，前端交互方式截然不同。本文覆盖 @mysten/sui.js SDK、钱包连接、Object 读取与交易构建的完整链路。"
wordCount: 3100
---

Sui 是 Mysten Labs 开发的 Layer 1 区块链，使用 Move 语言和基于 Object 的数据模型。与 EVM 链的 Account 模型不同，Sui 的每个资产都是独立的 Object，拥有自己的 ID 和所有权。这种架构差异直接影响了前端开发的方式——从数据读取到交易构建，都需要重新理解。

## Sui 网络概述与 Move 语言特点

### Sui 的核心特性

- **Object 模型**：所有资产和数据都是 Object，而非账户余额
- **Move 语言**：资源导向编程，资源不能被复制或丢弃
- **并行执行**：交易按 Object 依赖关系并行处理，不冲突的交易同时执行
- **Gas 代币**：SUI
- **共识**：Narwhal & Bullshark（基于 DAG 的 BFT 共识）

### Move 语言的独特之处

```move
// Move 模块示例
module my_package::coin {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    // 定义一个资源类型
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

Move 的核心特性是资源导向：资源（Resource）是一等公民，不能被复制或丢弃，必须显式转移或销毁。这与 Solidity 的 storage 变量模型完全不同。

## Sui 的 Object 模型 vs EVM 的 Account 模型

### EVM Account 模型

```
账户地址 → 余额映射
mapping(address => uint256) balances

// 转账：修改两个账户的余额
balances[sender] -= amount;
balances[recipient] += amount;
```

### Sui Object 模型

```
每个 Coin 是独立的 Object
Object {
  id: 0x...
  owner: 0x...
  value: 100
  type: 0x2::sui::SUI
}

// 转账：转移 Object 的所有权
transfer_object(coin_object, new_owner)
```

这个差异对前端的影响是根本性的：

| 维度 | EVM Account 模型 | Sui Object 模型 |
|------|-----------------|-----------------|
| 资产表示 | 余额（一个数字） | Object（独立实体） |
| 转账 | 修改余额映射 | 转移 Object 所有权 |
| 数据查询 | 读取存储槽 | 查询 Object |
| 历史追踪 | 需要事件日志 | Object 有完整历史 |
| 并行处理 | 全局状态锁 | 按 Object 依赖并行 |

## @mysten/sui.js SDK 使用

`@mysten/sui.js` 是 Sui 官方 JavaScript SDK，提供与 Sui 网络交互的完整 API。

### 安装与初始化

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

// 连接到 Sui 网络
const provider = new JsonRpcProvider(testnetConnection)

// 或使用自定义 RPC
const customProvider = new JsonRpcProvider({
  url: 'https://sui-testnet.nodeprovider.com/rpc',
})
```

### 查询基本信息

```typescript
// 获取链上信息
const chainId = await provider.getChainIdentifier()
const latestCheckpoint = await provider.getLatestCheckpointSequenceNumber()
const rpcApiVersion = await provider.getRpcApiVersion()

// 获取某个地址拥有的所有 Object
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

## 前端连接 Sui 钱包

Sui Wallet 是 Sui 官方的浏览器扩展钱包，类似 MetaMask。

### 检测与连接钱包

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

    // 检测钱包是否安装
    if (window.suiWallet) {
      // 检查是否已连接
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
          // 未连接
        })
    }

    // 监听账户变化
    window.suiWallet?.on('accountChanged', (account: string) => {
      setAccount(account)
    })

    // 监听断开连接
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

## 读取 Object

### getObject：获取单个 Object

```typescript
import { JsonRpcProvider, testnetConnection } from '@mysten/sui.js'

const provider = new JsonRpcProvider(testnetConnection)

// 获取单个 Object
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

// 获取 Object 并指定返回选项
const objectWithOptions = await provider.getObject(
  '0xObjectId...',
  { showContent: true, showOwner: true, showType: true }
)

// 批量获取多个 Object
const multiObjectResponse = await provider.multiGetObjects([
  '0xObjectId1...',
  '0xObjectId2...',
  '0xObjectId3...',
], { showContent: true })
```

### getObjectsOwnedByAddress：获取地址拥有的所有 Object

```typescript
// 获取地址拥有的所有 Object（分页）
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

// 按类型过滤 Object
async function getCoinsByType(address: string, coinType: string) {
  const objects = await getAllObjects(address)

  return objects.filter(
    (obj) => obj.type === `0x2::coin::Coin<${coinType}>`
  )
}

// 获取所有 SUI 代币
const suiCoins = await getCoinsByType(
  account,
  '0x2::sui::SUI'
)

// 聚合 SUI 总余额
const totalSui = suiCoins.reduce((sum, coin) => {
  // 需要获取每个 Object 的详细内容
  return sum
}, BigInt(0))

// 批量获取 Coin 详情
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

## 交易构建与签名

### paySui：转移 SUI 代币

```typescript
// 发送 SUI 代币
async function sendSui(
  recipient: string,
  amount: bigint,
  sender: string
) {
  // 获取发送者的 SUI Coin
  const coins = await provider.getObjectsOwnedByAddress(sender)
  const suiCoins = coins.data.filter(
    (c) => c.type === '0x2::coin::Coin<0x2::sui::SUI>'
  )

  // 获取足够的 Coin 来支付
  const coinObjects = await provider.multiGetObjects(
    suiCoins.map((c) => c.objectId),
    { showContent: true }
  )

  // 筛选余额足够的 Coin
  const sufficientCoins = coinObjects.filter((resp) => {
    const balance = resp.details?.data?.content?.fields?.balance
    return BigInt(balance || 0) >= amount
  })

  if (sufficientCoins.length === 0) {
    throw new Error('Insufficient SUI balance')
  }

  // 构建 paySui 交易
  const tx = new TransactionBlock()
  const coin = tx.object(sufficientCoins[0].details.reference.objectId)
  const splitCoin = tx.splitCoins(coin, [tx.pure(amount)])

  // 转移给接收者
  tx.transferObjects([splitCoin], tx.pure(recipient))

  // 使用钱包签名并发送
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

### moveCall：调用 Move 合约

```typescript
import { TransactionBlock } from '@mysten/sui.js'

// 调用 Move 模块的函数
async function callMoveFunction(
  packageId: string,
  moduleName: string,
  functionName: string,
  typeArgs: string[],
  args: any[],
  gasBudget: number
) {
  const tx = new TransactionBlock()

  // 构建 moveCall
  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    typeArguments: typeArgs,
    arguments: args.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('0x')) {
        return tx.object(arg) // Object ID
      }
      return tx.pure(arg)    // 纯参数
    }),
  })

  tx.setGasBudget(gasBudget)

  // 签名并发送
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

// 示例：调用自定义 Move 合约
const result = await callMoveFunction(
  '0xPackageId...',
  'marketplace',
  'list_item',
  [], // 无泛型参数
  [
    '0xNftObjectId...',  // NFT Object ID
    1000000000,          // 价格（MIST）
  ],
  100000000 // Gas budget
)
```

### 合并 Coin

```typescript
// 合并多个 SUI Coin 为一个
async function mergeCoins(coinIds: string[]) {
  const tx = new TransactionBlock()

  // 第一个 Coin 作为主 Coin
  const primaryCoin = tx.object(coinIds[0])

  // 其余 Coin 合并到主 Coin
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

## Sui DApp 前端完整模块

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

  // 获取 SUI 余额
  async getSuiBalance(address: string): Promise<bigint> {
    const coins = await this.provider.getCoins(address, {
      coinType: '0x2::sui::SUI',
    })

    return coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    )
  }

  // 获取所有 NFT
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

  // 铸造 NFT
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

  // 转移 SUI
  async transferSui(recipient: string, amount: bigint) {
    const tx = new TransactionBlock()

    // 使用 gas coin 分割出指定金额
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

  // 监听交易确认
  async waitForTransaction(digest: string) {
    return this.provider.waitForTransaction({
      digest,
      options: { showEffects: true, showEvents: true },
    })
  }

  // 读取 Move 合约事件
  async queryEvents(packageId: string, limit: number = 50) {
    const events = await this.provider.queryEvents({
      query: { MoveModule: { package: packageId, module: 'marketplace' } },
      limit,
    })

    return events.data
  }
}
```

## Move 合约模块的 TypeScript 类型映射

Move 的类型系统与 TypeScript 差异较大，需要手动建立映射关系。

```typescript
// types/sui.ts

// Move 中的 Coin<SUI> 对应 TypeScript 类型
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

// Move 中的 struct 对应 TypeScript 类型
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

// 类型守卫
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

## 与 EVM DApp 开发的差异对比

### 数据查询方式

```typescript
// EVM：读取合约存储
const balance = await tokenContract.balanceOf(userAddress)
// 返回一个数字

// Sui：查询 Object 列表
const coins = await provider.getCoins(userAddress, { coinType: '0x2::sui::SUI' })
// 返回一组 Object，每个有独立的 ID
const totalBalance = coins.data.reduce(
  (sum, c) => sum + BigInt(c.balance),
  BigInt(0)
)
```

### 交易构建方式

```typescript
// EVM：发送 calldata
const tx = await contract.transfer(recipient, amount)
// ABI 编码函数选择器 + 参数

// Sui：构建 TransactionBlock
const tx = new TransactionBlock()
tx.moveCall({
  target: `${packageId}::coin::transfer`,
  arguments: [tx.object(coinId), tx.pure(recipient)],
})
// 交易是一组 Move 调用的序列
```

### Gas 机制

```typescript
// EVM：Gas Price * Gas Used
// Gas Price 由 EIP-1559 的 base fee + priority fee 决定

// Sui：Gas Budget（预算制）
// 交易指定 Gas Budget，实际消耗从 Budget 中扣除
tx.setGasBudget(50000000) // 0.05 SUI
// 未用完的 Gas 退还
```

### 交易确认

```typescript
// EVM：等待区块确认
const receipt = await tx.wait(1) // 1 个区块

// Sui：按 Object 依赖并行确认
// 不冲突的交易几乎即时确认
const result = await provider.waitForTransaction({ digest })
// 冲突的交易需要经过共识，稍慢
```

## Sui 生态的成熟度评估

到 2023 年中期，Sui 生态仍处于早期阶段：

**SDK 成熟度**：`@mysten/sui.js` API 变化频繁，版本间存在 breaking changes。文档覆盖面广但缺乏深度示例。

**钱包生态**：Sui Wallet 是主要的浏览器扩展钱包，但用户体验和功能不如 MetaMask 成熟。Ethos Wallet、Martian Wallet 等第三方钱包也在发展中。

**开发者工具**：Sui CLI 用于合约开发和部署，功能基本完整但学习曲线陡峭。Move 语言本身对有 Rust 经验的开发者较为友好。

**DApp 生态**：DeFi、NFT、GameFi 领域有项目在建设，但用户量和 TVL 与 EVM 生态差距明显。

## 小结

Sui 的 Object 模型为前端开发带来了全新的思维范式。不再有"余额"这个简单概念，取而代之的是一组组独立的 Object，每个都有自己的 ID、版本和所有权。这种模型在某些场景下更直观——NFT 转移就是 Object 所有权变更，不需要 ERC-721 的复杂接口；但在另一些场景下更复杂——获取用户总余额需要遍历所有 Coin Object 并聚合。

Move 语言的资源导向编程从类型系统层面保证了资产安全，资源不能被复制或丢弃。这是比 Solidity 更强的安全保证，但也增加了前端类型映射的复杂度。

从 EVM 迁移到 Sui 的前端开发者需要适应三个核心变化：从查询合约存储到查询 Object、从 ABI 调用到 TransactionBlock 构建、从 Gas Price 到 Gas Budget。这些变化不是渐进式的改良，而是思维方式的转换。

Sui 生态的成熟度仍在早期，SDK 和工具链的稳定性有待提升。但 Object 模型和并行执行的技术优势是明确的，值得前端开发者关注和学习。
