---
title: "Aptos 鏈前端集成：Move 合約與 TypeScript SDK"
date: 2023-07-22 13:05:54
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "Aptos 繼承了 Diem 的 Move 血統，在資源模型和並行執行上有獨到設計。本文覆蓋 @aptos-labs/ts-sdk、Petra Wallet 集成和 Move 合約前端交互的完整方案。"
wordCount: 3000
---

Aptos 是由前 Meta（Facebook）Diem 項目核心成員創立的 Layer 1 區塊鏈，目前已主網上線。與 Sui 類似，Aptos 也使用 Move 語言，但兩者的 Move 實現有顯著差異。Aptos 保留了 Diem 的 Move 標準實現，採用資源（Resource）模型而非 Sui 的 Object 模型。對前端開發者而言，Aptos 的 SDK 設計和錢包集成方式也自成一套體系。

## Aptos 網絡概述與 Diem 血統

### 從 Diem 到 Aptos

Diem（原 Libra）項目被 Meta 出售後解散，其核心技術團隊創立了 Aptos Labs。Aptos 繼承了 Diem 的核心技術棧：

- **Move 語言**：Diem 團隊為區塊鏈場景設計的資源導向語言
- **Move 虛擬機**：執行 Move 字節碼的虛擬機
- **DiemBFT 共識**：改良的 BFT 共識協議，現稱 AptosBFT

### Aptos 的核心特性

- **並行執行**：Block-STM（Block Software Transactional Memory）並行執行引擎
- **Move 語言**：資源導向，強類型安全
- **賬户模型**：與 EVM 類似的賬户模型，但資源存儲在賬户下
- **Gas 代幣**：APT
- **高 TPS**：理論可達 10 萬+ TPS（並行執行場景）

### 網絡信息

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

## Move 語言在 Aptos 上的實現

### Aptos Move vs Sui Move

雖然兩者都使用 Move 語言，但實現和語義有顯著差異：

| 維度 | Aptos Move | Sui Move |
|------|-----------|----------|
| 資源存儲 | 賬户的 resource space | 獨立 Object |
| 數據模型 | Account-based | Object-based |
| 所有權 | 資源存儲在賬户地址下 | Object 有獨立的 owner |
| 轉賬 | move_to / move_from | transfer Object |
| 全局存儲 | 全局可訪問 | 按 Object 隔離 |

### Aptos Move 模塊示例

```move
// Aptos 上的 Move 合約
module my_app::token {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    // 定義資源類型
    struct Vault has key {
        balance: Coin<AptosCoin>,
    }

    // 初始化 Vault（存儲在調用者賬户下）
    public entry fun initialize(account: &signer, amount: Coin<AptosCoin>) {
        let vault = Vault { balance: amount };
        move_to(account, vault);
    }

    // 從 Vault 取款
    public entry fun withdraw(account: &signer, amount: u64): Coin<AptosCoin> acquires Vault {
        let vault = borrow_global_mut<Vault>(signer::address_of(account));
        coin::extract(&mut vault.balance, amount)
    }

    // 查詢餘額
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

關鍵區別：Aptos 使用 `move_to` 將資源存儲在賬户地址下，`borrow_global` 從任意地址讀取資源。這是全局存儲模型，而 Sui 的 Object 是獨立尋址的。

## @aptos-labs/ts-sdk 使用

2023 年中，Aptos 推出了新的 `@aptos-labs/ts-sdk`（取代舊版 `aptos` SDK），API 設計更現代化。

### 安裝與初始化

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

// 或使用自定義 RPC
const customConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: 'https://my-aptos-node.com',
})
const customAptos = new Aptos(customConfig)
```

### 查詢鏈上數據

```typescript
// 獲取賬户信息
const accountInfo = await aptos.getAccountInfo({
  accountAddress: '0xUserAddress...',
})
// {
//   sequence_number: '5',
//   authentication_key: '0x...',
// }

// 獲取賬户資源
const resources = await aptos.getAccountResources({
  accountAddress: '0xUserAddress...',
})
// 返回賬户下所有資源
// [
//   { type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>', data: { coin: { value: '100000000' } } },
//   { type: '0x1::account::Account', data: { ... } },
//   ...
// ]

// 獲取特定資源
const coinStore = await aptos.getAccountResource({
  accountAddress: '0xUserAddress...',
  resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
})
// { coin: { value: '100000000' } }

// 獲取 APT 餘額
async function getAptBalance(address: string): Promise<number> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
    })
    return parseInt(resource.coin.value) / 1e8 // APT 有 8 位小數
  } catch {
    return 0 // 賬户可能沒有 CoinStore 資源
  }
}

// 讀取表（Table）
// Aptos 的 Table 類似 EVM 的 mapping
const tableItem = await aptos.getTableItem({
  tableHandle: '0xTableHandle...',
  data: {
    key_type: 'address',
    value_type: 'u64',
    key: '0xUserAddress...',
  },
})
```

### 使用 View 函數

Aptos 支持 `#[view]` 標註的函數，可以直接通過 RPC 調用（無需交易）：

```typescript
// 調用 view 函數
const viewResult = await aptos.view({
  payload: {
    function: '0xMyPackage::token::balance',
    functionArguments: ['0xUserAddress...'],
  },
})
// 返回值數組
// ['100000000']
const balance = parseInt(viewResult[0])
```

## Petra Wallet 前端集成

Petra Wallet 是 Aptos Labs 官方開發的瀏覽器擴展錢包。

### 檢測與連接

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

    // 檢測 Petra Wallet
    if (window.aptos) {
      // 檢查是否已連接
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

      // 獲取網絡
      window.aptos.network().then((net: string) => {
        setNetwork(net)
      })
    }

    // 監聽賬户變化
    window.aptos?.onAccountChange((account: any) => {
      setAccount(account?.address || null)
    })

    // 監聽網絡變化
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

## 資源（Resource）模型與前端讀取

Aptos 的資源存儲在賬户地址下，前端的讀取方式與 EVM 有本質差異。

### 讀取賬户資源

```typescript
// 讀取用户在某個模塊下的資源
async function getUserVault(address: string) {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0xMyPackage::token::Vault',
    })

    // 資源數據結構取決於 Move 中定義的 struct
    return {
      balance: resource.balance, // Coin 對象的值
    }
  } catch (error: any) {
    // 404 表示賬户沒有這個資源
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

// 讀取 CoinStore 餘額
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

### 讀取 Table 數據

Aptos 的 Table 是持久化存儲的 key-value 結構，類似 EVM 的 mapping：

```typescript
// 讀取 Table 中的數據
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

// 示例：讀取用户的信用評分
// Move: struct CreditScore has key { scores: Table<address, u64> }
async function getCreditScore(
  contractAddress: string,
  userAddress: string
) {
  // 先獲取合約資源中的 table handle
  const resource = await aptos.getAccountResource({
    accountAddress: contractAddress,
    resourceType: '0xMyApp::credit::CreditScore',
  })

  const tableHandle = resource.scores.handle

  // 然後查詢 table 中的值
  const score = await getTableValue(
    tableHandle,
    userAddress,
    'address',
    'u64'
  )

  return score
}
```

## 交易構建：payload 類型與簽名

### 構建交易 payload

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from '@aptos-labs/ts-sdk'

// 構建 entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0x1::coin::transfer',
  type_arguments: ['0x1::aptos_coin::AptosCoin'],
  arguments: [
    '0xRecipientAddress...', // 接收者地址
    '100000000',              // 金額（octas，1 APT = 10^8 octas）
  ],
}
```

### 簽名與提交交易

```typescript
// 使用 Petra Wallet 簽名並提交
async function submitTransaction(
  payload: any
): Promise<string> {
  // Petra Wallet 的 signAndSubmitTransaction 會同時簽名和提交
  const transaction = await window.aptos.signAndSubmitTransaction(
    payload
  )

  // 等待交易確認
  await aptos.waitForTransaction({
    transactionHash: transaction.hash,
  })

  return transaction.hash
}

// 轉賬 APT
async function transferAPT(
  recipient: string,
  amount: number // APT 數量
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

### 調用自定義 Move 合約

```typescript
// 調用自定義模塊的函數
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

// 示例：在市場中上架 NFT
const txHash = await callMoveFunction(
  '0xMarketplaceAddress...',
  'market',
  'list_item',
  [],
  [
    '0xNftCreatorAddress...',
    'NFTCollectionName',
    '0xNftId...',           // NFT 的 token name 或 ID
    '100000000',            // 價格（octas）
  ]
)
```

### 多籤交易

```typescript
import { MultiAgentTransaction } from '@aptos-labs/ts-sdk'

async function submitMultiAgentTransaction(
  sender: string,
  payload: any,
  secondarySigners: string[]
) {
  // 構建多籤交易
  const rawTxn = await aptos.transaction.build.multiAgent({
    sender,
    secondarySigners,
    payload,
  })

  // 第一個簽名者簽名
  const senderSignature = await window.aptos.signTransaction(rawTxn)

  // 第二個簽名者簽名
  // 通常在不同設備/頁面上完成
  const secondarySignatures = await Promise.all(
    secondarySigners.map((addr) =>
      getSignatureFromSecondary(addr, rawTxn)
    )
  )

  // 提交多籤交易
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

## Aptos DApp 前端完整模塊

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

  // 獲取 APT 餘額
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

  // 獲取自定義代幣餘額
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

  // 轉賬 APT
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

  // 註冊 CoinStore（接收新代幣前需要註冊）
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

  // 調用 view 函數
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

  // 獲取交易事件
  async getTransactionEvents(txHash: string) {
    const txn = await this.aptos.getTransactionByHash({
      transactionHash: txHash,
    })

    return txn.events || []
  }

  // 解析事件數據
  parseEvent(event: any, moduleName: string, eventName: string) {
    if (event.type.includes(`::${moduleName}::${eventName}`)) {
      return event.data
    }
    return null
  }
}
```

## Aptos 與 Sui 的 Move 實現差異

### 資源存儲方式

```typescript
// Aptos：資源存儲在賬户下
// 讀取方式：getAccountResource(address, resourceType)
const vault = await aptos.getAccountResource({
  accountAddress: userAddress,
  resourceType: '0xPackage::module::Vault',
})
// Vault 資源存儲在 userAddress 賬户下

// Sui：資源是獨立 Object
// 讀取方式：getObject(objectId)
const object = await provider.getObject(objectId)
// Object 有獨立 ID，不屬於任何賬户
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
// 一個交易調用一個 entry function

// Sui：TransactionBlock（可包含多個 Move 調用）
const tx = new TransactionBlock()
tx.moveCall({ target: '0xAddr::module::func1', arguments: [...] })
tx.moveCall({ target: '0xAddr::module::func2', arguments: [...] })
// 一個交易可以原子性地執行多個操作
```

### Gas 機制

```typescript
// Aptos：Gas Unit Price * Max Gas Amount
// 類似 EVM 的 Gas Price * Gas Limit
const txn = {
  ...payload,
  max_gas_amount: '2000',
  gas_unit_price: '100',
}
// 交易費用 = gas_used * gas_unit_price

// Sui：Gas Budget
// 指定總預算，未用完的退還
tx.setGasBudget(50000000)
```

## 前端開發體驗對比：Aptos vs EVM

| 維度 | Aptos | EVM |
|------|-------|-----|
| 賬户模型 | 賬户存儲資源 | 賬户存儲餘額 |
| 數據查詢 | getAccountResource | eth_call |
| 交易構建 | entry function payload | ABI calldata |
| 類型系統 | Move 強類型 | ABI + 手動類型 |
| 並行執行 | Block-STM | 串行 |
| 交易確認 | ~1 秒 | ~12 秒（主網） |
| 錢包 | Petra Wallet | MetaMask |
| SDK | @aptos-labs/ts-sdk | ethers.js / viem |

### 事件監聽對比

```typescript
// EVM：監聽合約事件
contract.on('Transfer', (from, to, value) => {
  console.log(from, to, value)
})

// Aptos：查詢交易事件（無實時 WebSocket 監聽）
// 需要輪詢或使用 SDK 的事件訂閲
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

## 生態工具鏈評估

Aptos 生態工具鏈的發展狀況：

**SDK**：`@aptos-labs/ts-sdk` 在 2023 年中進行了大版本升級，API 更現代化但文檔遷移跟不上。舊版 `aptos` SDK 仍在使用，遷移成本較高。

**錢包**：Petra Wallet 是主流選擇，功能穩定但擴展性有限。Martian Wallet、Fewcha Wallet 等第三方錢包也存在，但兼容性參差不齊。

**開發工具**：Aptos CLI 用於合約編譯、測試和部署。Move 語言的學習曲線對有 Rust 經驗的開發者較友好，Solidity 開發者需要適應資源導向編程的思維方式。

**索引服務**：Aptos 的索引基礎設施不如 The Graph 成熟。需要自建索引服務或使用 Aptos 官方的 Indexer（基於 PostgreSQL）。

## 小結

Aptos 繼承了 Diem 的技術積累，在 Move 語言和並行執行方面有紮實的基礎。資源導向編程提供了比 Solidity 更強的類型安全保證——資源不能被複制或丟棄，這在資產管理場景中尤為重要。

與 Sui 相比，Aptos 的賬户模型更接近 EVM 的思維模式——資源存儲在賬户地址下，而不是作為獨立 Object 存在。這使得從 EVM 遷移到 Aptos 的學習曲線比遷移到 Sui 更平緩。但 Aptos 的 Table 查詢和事件系統在實時性方面不如 EVM 的 WebSocket 事件監聽。

前端開發體驗上，`@aptos-labs/ts-sdk` 的 API 設計清晰但仍在快速迭代中。Petra Wallet 的集成方式比早期的 Sui Wallet 更成熟，但與 MetaMask 的生態成熟度仍有差距。交易確認速度快（~1 秒）是 Aptos 的顯著優勢，這讓前端的狀態管理比 EVM 的多區塊等待更簡單。

Move 生態的工具鏈和開發者社區仍在持續成長。但技術基礎是紮實的，值得前端開發者投入學習。
