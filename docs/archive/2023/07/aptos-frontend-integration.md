---
title: "Aptos 链前端集成：Move 合约与 TypeScript SDK"
date: 2023-07-22 13:05:54
tags:
  - Web3
  - Blockchain
readingTime: 9
description: "Aptos 继承了 Diem 的 Move 血统，在资源模型和并行执行上有独到设计。本文覆盖 @aptos-labs/ts-sdk、Petra Wallet 集成和 Move 合约前端交互的完整方案。"
wordCount: 1247
---

Aptos 是由前 Meta（Facebook）Diem 项目核心成员创立的 Layer 1 区块链。与 Sui 类似，Aptos 也使用 Move 语言，但两者的 Move 实现有显著差异。Aptos 保留了 Diem 的 Move 标准实现，采用资源（Resource）模型而非 Sui 的 Object 模型。对前端开发者而言，Aptos 的 SDK 设计和钱包集成方式也自成一套体系。

## Aptos 网络概述与 Diem 血统

### 从 Diem 到 Aptos

Diem（原 Libra）项目被 Meta 出售后解散，其核心技术团队创立了 Aptos Labs。Aptos 继承了 Diem 的核心技术栈：

- **Move 语言**：Diem 团队为区块链场景设计的资源导向语言
- **Move 虚拟机**：执行 Move 字节码的虚拟机
- **DiemBFT 共识**：改良的 BFT 共识协议，现称 AptosBFT

### Aptos 的核心特性

- **并行执行**：Block-STM（Block Software Transactional Memory）并行执行引擎
- **Move 语言**：资源导向，强类型安全
- **账户模型**：与 EVM 类似的账户模型，但资源存储在账户下
- **Gas 代币**：APT
- **高 TPS**：理论可达 10 万+ TPS（并行执行场景）

### 网络信息

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

## Move 语言在 Aptos 上的实现

### Aptos Move vs Sui Move

虽然两者都使用 Move 语言，但实现和语义有显著差异：

| 维度 | Aptos Move | Sui Move |
|------|-----------|----------|
| 资源存储 | 账户的 resource space | 独立 Object |
| 数据模型 | Account-based | Object-based |
| 所有权 | 资源存储在账户地址下 | Object 有独立的 owner |
| 转账 | move_to / move_from | transfer Object |
| 全局存储 | 全局可访问 | 按 Object 隔离 |

### Aptos Move 模块示例

```move
// Aptos 上的 Move 合约
module my_app::token {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    // 定义资源类型
    struct Vault has key {
        balance: Coin<AptosCoin>,
    }

    // 初始化 Vault（存储在调用者账户下）
    public entry fun initialize(account: &signer, amount: Coin<AptosCoin>) {
        let vault = Vault { balance: amount };
        move_to(account, vault);
    }

    // 从 Vault 取款
    public entry fun withdraw(account: &signer, amount: u64): Coin<AptosCoin> acquires Vault {
        let vault = borrow_global_mut<Vault>(signer::address_of(account));
        coin::extract(&mut vault.balance, amount)
    }

    // 查询余额
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

关键区别：Aptos 使用 `move_to` 将资源存储在账户地址下，`borrow_global` 从任意地址读取资源。这是全局存储模型，而 Sui 的 Object 是独立寻址的。

## @aptos-labs/ts-sdk 使用

Aptos 推出了新的 `@aptos-labs/ts-sdk`（取代旧版 `aptos` SDK），API 设计更现代化。

### 安装与初始化

```bash
npm install @aptos-labs/ts-sdk
```

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

// 初始化 client
const aptosConfig = new AptosConfig({
  network: Network.TESTNET,
})
const aptos = new Aptos(aptosConfig)

// 或使用自定义 RPC
const customConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: 'https://my-aptos-node.com',
})
const customAptos = new Aptos(customConfig)
```

### 查询链上数据

```typescript
// 获取账户信息
const accountInfo = await aptos.getAccountInfo({
  accountAddress: '0xUserAddress...',
})
// {
//   sequence_number: '5',
//   authentication_key: '0x...',
// }

// 获取账户资源
const resources = await aptos.getAccountResources({
  accountAddress: '0xUserAddress...',
})
// 返回账户下所有资源
// [
//   { type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>', data: { coin: { value: '100000000' } } },
//   { type: '0x1::account::Account', data: { ... } },
//   ...
// ]

// 获取特定资源
const coinStore = await aptos.getAccountResource({
  accountAddress: '0xUserAddress...',
  resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
})
// { coin: { value: '100000000' } }

// 获取 APT 余额
async function getAptBalance(address: string): Promise<number> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
    })
    return parseInt(resource.coin.value) / 1e8 // APT 有 8 位小数
  } catch {
    return 0 // 账户可能没有 CoinStore 资源
  }
}

// 读取表（Table）
// Aptos 的 Table 类似 EVM 的 mapping
const tableItem = await aptos.getTableItem({
  tableHandle: '0xTableHandle...',
  data: {
    key_type: 'address',
    value_type: 'u64',
    key: '0xUserAddress...',
  },
})
```

### 使用 View 函数

Aptos 支持 `#[view]` 标注的函数，可以直接通过 RPC 调用（无需交易）：

```typescript
// 调用 view 函数
const viewResult = await aptos.view({
  payload: {
    function: '0xMyPackage::token::balance',
    functionArguments: ['0xUserAddress...'],
  },
})
// 返回值数组
// ['100000000']
const balance = parseInt(viewResult[0])
```

## Petra Wallet 前端集成

Petra Wallet 是 Aptos Labs 官方开发的浏览器扩展钱包。

### 检测与连接

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

    // 检测 Petra Wallet
    if (window.aptos) {
      // 检查是否已连接
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

      // 获取网络
      window.aptos.network().then((net: string) => {
        setNetwork(net)
      })
    }

    // 监听账户变化
    window.aptos?.onAccountChange((account: any) => {
      setAccount(account?.address || null)
    })

    // 监听网络变化
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

## 资源（Resource）模型与前端读取

Aptos 的资源存储在账户地址下，前端的读取方式与 EVM 有本质差异。

### 读取账户资源

```typescript
// 读取用户在某个模块下的资源
async function getUserVault(address: string) {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0xMyPackage::token::Vault',
    })

    // 资源数据结构取决于 Move 中定义的 struct
    return {
      balance: resource.balance, // Coin 对象的值
    }
  } catch (error: any) {
    // 404 表示账户没有这个资源
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

// 读取 CoinStore 余额
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

### 读取 Table 数据

Aptos 的 Table 是持久化存储的 key-value 结构，类似 EVM 的 mapping：

```typescript
// 读取 Table 中的数据
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

// 示例：读取用户的信用评分
// Move: struct CreditScore has key { scores: Table<address, u64> }
async function getCreditScore(
  contractAddress: string,
  userAddress: string
) {
  // 先获取合约资源中的 table handle
  const resource = await aptos.getAccountResource({
    accountAddress: contractAddress,
    resourceType: '0xMyApp::credit::CreditScore',
  })

  const tableHandle = resource.scores.handle

  // 然后查询 table 中的值
  const score = await getTableValue(
    tableHandle,
    userAddress,
    'address',
    'u64'
  )

  return score
}
```

## 交易构建：payload 类型与签名

### 构建交易 payload

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from '@aptos-labs/ts-sdk'

// 构建 entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0x1::coin::transfer',
  type_arguments: ['0x1::aptos_coin::AptosCoin'],
  arguments: [
    '0xRecipientAddress...', // 接收者地址
    '100000000',              // 金额（octas，1 APT = 10^8 octas）
  ],
}
```

### 签名与提交交易

```typescript
// 使用 Petra Wallet 签名并提交
async function submitTransaction(
  payload: any
): Promise<string> {
  // Petra Wallet 的 signAndSubmitTransaction 会同时签名和提交
  const transaction = await window.aptos.signAndSubmitTransaction(
    payload
  )

  // 等待交易确认
  await aptos.waitForTransaction({
    transactionHash: transaction.hash,
  })

  return transaction.hash
}

// 转账 APT
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

### 调用自定义 Move 合约

```typescript
// 调用自定义模块的函数
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

// 示例：在市场中上架 NFT
const txHash = await callMoveFunction(
  '0xMarketplaceAddress...',
  'market',
  'list_item',
  [],
  [
    '0xNftCreatorAddress...',
    'NFTCollectionName',
    '0xNftId...',           // NFT 的 token name 或 ID
    '100000000',            // 价格（octas）
  ]
)
```

### 多签交易

```typescript
import { MultiAgentTransaction } from '@aptos-labs/ts-sdk'

async function submitMultiAgentTransaction(
  sender: string,
  payload: any,
  secondarySigners: string[]
) {
  // 构建多签交易
  const rawTxn = await aptos.transaction.build.multiAgent({
    sender,
    secondarySigners,
    payload,
  })

  // 第一个签名者签名
  const senderSignature = await window.aptos.signTransaction(rawTxn)

  // 第二个签名者签名
  // 通常在不同设备/页面上完成
  const secondarySignatures = await Promise.all(
    secondarySigners.map((addr) =>
      getSignatureFromSecondary(addr, rawTxn)
    )
  )

  // 提交多签交易
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

## Aptos DApp 前端完整模块

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

  // 获取 APT 余额
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

  // 获取自定义代币余额
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

  // 转账 APT
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

  // 注册 CoinStore（接收新代币前需要注册）
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

  // 调用 view 函数
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

  // 获取交易事件
  async getTransactionEvents(txHash: string) {
    const txn = await this.aptos.getTransactionByHash({
      transactionHash: txHash,
    })

    return txn.events || []
  }

  // 解析事件数据
  parseEvent(event: any, moduleName: string, eventName: string) {
    if (event.type.includes(`::${moduleName}::${eventName}`)) {
      return event.data
    }
    return null
  }
}
```

## Aptos 与 Sui 的 Move 实现差异

### 资源存储方式

```typescript
// Aptos：资源存储在账户下
// 读取方式：getAccountResource(address, resourceType)
const vault = await aptos.getAccountResource({
  accountAddress: userAddress,
  resourceType: '0xPackage::module::Vault',
})
// Vault 资源存储在 userAddress 账户下

// Sui：资源是独立 Object
// 读取方式：getObject(objectId)
const object = await provider.getObject(objectId)
// Object 有独立 ID，不属于任何账户
```

### 交易模型

```typescript
// Aptos：entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0xAddr::module::function',
  type_arguments: [],
  arguments: [arg1, arg2],
}
// 一个交易调用一个 entry function

// Sui：TransactionBlock（可包含多个 Move 调用）
const tx = new TransactionBlock()
tx.moveCall({ target: '0xAddr::module::func1', arguments: [...] })
tx.moveCall({ target: '0xAddr::module::func2', arguments: [...] })
// 一个交易可以原子性地执行多个操作
```

### Gas 机制

```typescript
// Aptos：Gas Unit Price * Max Gas Amount
// 类似 EVM 的 Gas Price * Gas Limit
const txn = {
  ...payload,
  max_gas_amount: '2000',
  gas_unit_price: '100',
}
// 交易费用 = gas_used * gas_unit_price

// Sui：Gas Budget
// 指定总预算，未用完的退还
tx.setGasBudget(50000000)
```

## 前端开发体验对比：Aptos vs EVM

| 维度 | Aptos | EVM |
|------|-------|-----|
| 账户模型 | 账户存储资源 | 账户存储余额 |
| 数据查询 | getAccountResource | eth_call |
| 交易构建 | entry function payload | ABI calldata |
| 类型系统 | Move 强类型 | ABI + 手动类型 |
| 并行执行 | Block-STM | 串行 |
| 交易确认 | ~1 秒 | ~12 秒（主网） |
| 钱包 | Petra Wallet | MetaMask |
| SDK | @aptos-labs/ts-sdk | ethers.js / viem |

### 事件监听对比

```typescript
// EVM：监听合约事件
contract.on('Transfer', (from, to, value) => {
  console.log(from, to, value)
})

// Aptos：查询交易事件（无实时 WebSocket 监听）
// 需要轮询或使用 SDK 的事件订阅
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

## 生态工具链评估

Aptos 生态工具链的发展状况：

**SDK**：`@aptos-labs/ts-sdk` 进行了大版本升级，API 更现代化但文档迁移跟不上。旧版 `aptos` SDK 仍在使用，迁移成本较高。

**钱包**：Petra Wallet 是主流选择，功能稳定但扩展性有限。Martian Wallet、Fewcha Wallet 等第三方钱包也存在，但兼容性参差不齐。

**开发工具**：Aptos CLI 用于合约编译、测试和部署。Move 语言的学习曲线对有 Rust 经验的开发者较友好，Solidity 开发者需要适应资源导向编程的思维方式。

**索引服务**：Aptos 的索引基础设施不如 The Graph 成熟。需要自建索引服务或使用 Aptos 官方的 Indexer（基于 PostgreSQL）。

## 小结

Aptos 继承了 Diem 的技术积累，在 Move 语言和并行执行方面有扎实的基础。资源导向编程提供了比 Solidity 更强的类型安全保证——资源不能被复制或丢弃，这在资产管理场景中尤为重要。

与 Sui 相比，Aptos 的账户模型更接近 EVM 的思维模式——资源存储在账户地址下，而不是作为独立 Object 存在。这使得从 EVM 迁移到 Aptos 的学习曲线比迁移到 Sui 更平缓。但 Aptos 的 Table 查询和事件系统在实时性方面不如 EVM 的 WebSocket 事件监听。

前端开发体验上，`@aptos-labs/ts-sdk` 的 API 设计清晰但仍在快速迭代中。Petra Wallet 的集成方式比早期的 Sui Wallet 更成熟，但与 MetaMask 的生态成熟度仍有差距。交易确认速度快（~1 秒）是 Aptos 的显著优势，这让前端的状态管理比 EVM 的多区块等待更简单。

Move 生态整体仍在成长中，工具链和开发者社区需要时间发展。但技术基础是扎实的，值得前端开发者投入学习。
