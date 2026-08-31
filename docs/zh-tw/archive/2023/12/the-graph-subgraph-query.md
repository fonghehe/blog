---
title: "The Graph 子圖查詢：DApp 鏈上數據索引方案"
date: 2023-12-10 12:43:20
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 9
description: "直接讀取鏈上事件日誌無法滿足 DApp 的複雜查詢需求。The Graph 通過 Subgraph 提供去中心化的索引服務，支持 GraphQL 查詢。本文覆蓋從 Subgraph 定義到前端集成的完整方案。"
wordCount: 880
---

DApp 前端需要展示大量鏈上數據：用戶的歷史交易、持倉變化、協議統計等。這些數據分散在無數區塊的事件日誌中，直接通過 RPC 讀取不僅效率低下，而且無法支持複雜查詢（如分頁、過濾、聚合）。The Graph 協議通過 Subgraph 索引機制解決了這個問題，讓前端可以用 GraphQL 高效查詢鏈上數據。

## DApp 數據索引的挑戰

### 直接讀取事件日誌的侷限

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const contract = new ethers.Contract(address, abi, provider)

// 獲取所有 Transfer 事件
const filter = contract.filters.Transfer(null, userAddress, null)
const events = await contract.queryFilter(filter, 0, 'latest')

// 問題 1：性能極差 —— 需要掃描所有區塊
// 主網有 1800 萬+ 區塊，每個區塊可能有多個事件
// RPC 節點通常會限制查詢範圍（如最多 10000 個區塊）

// 問題 2：無法複雜查詢
// "查詢用戶最近 30 天的交易，按金額排序，分頁展示"
// 需要在前端拉取所有事件後手動排序分頁

// 問題 3：無法聚合查詢
// "統計協議總 TVL" 需要遍歷所有 Deposit/Withdraw 事件

// 問題 4：實時性差
// 每次刷新都要重新查詢，沒有增量更新機制
```

### 自建索引服務的問題

```typescript
// 自己搭一個索引服務？
// 1. 需要監聽所有區塊和事件 —— 一個節點不能掉線
// 2. 需要數據庫存儲和處理 —— PostgreSQL? MongoDB?
// 3. 需要提供 API 層 —— REST? GraphQL?
// 4. 需要處理鏈重組（reorg）—— 回滾已索引的數據
// 5. 需要部署和維護服務器 —— 持續成本
// 6. 需要處理多鏈 —— 每條鏈一個索引器
```

## The Graph 協議概述

The Graph 是一個去中心化的索引協議，通過 Subgraph 機制將鏈上數據索引為可查詢的 GraphQL API。

### 架構角色

```
┌──────────────┐     部署      ┌──────────────┐
│   Developer  │ ──────────→  │   Subgraph   │
│  (寫 Subgraph) │              │  (索引定義)   │
└──────────────┘              └──────┬───────┘
                                     │ 索引
                              ┌──────▼───────┐
┌──────────────┐     查詢      │   Indexer    │
│   DApp 前端   │ ←─────────── │  (索引節點)   │
└──────────────┘              └──────────────┘
       ▲                            ▲
       │                            │
┌──────┴───────┐            ┌──────┴───────┐
│   Curator    │            │   Delegate   │
│ (策展/信號)   │            │ (委託 GRT)    │
└──────────────┘            └──────────────┘
```

- **Developer**：編寫 Subgraph 定義，部署到 The Graph 網絡
- **Indexer**：運行索引節點，處理鏈上數據並提供查詢服務
- **Curator**：通過信號（signal）指引用價值的 Subgraph，幫助 Indexer 分配資源
- **Delegator**：將 GRT 代幣委託給 Indexer，分享索引收益

## Subgraph 定義

一個 Subgraph 包含三個核心文件：

### 1. schema.graphql —— 數據模型

```graphql
# schema.graphql

# 用戶實體
type User @entity {
  id: ID!  # 錢包地址
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  currentBalance: BigDecimal!
  deposits: [Deposit!]! @derivedFrom(field: "user")
  withdrawals: [Withdrawal!]! @derivedFrom(field: "user")
}

# 存款事件
type Deposit @entity {
  id: ID!  # 交易哈希 + 日誌索引
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# 取款事件
type Withdrawal @entity {
  id: ID!
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# 每日統計
type DailyStat @entity {
  id: ID!  # 日期 (YYYY-MM-DD)
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  uniqueUsers: Int!
  depositCount: Int!
  withdrawalCount: Int!
}

# 協議總覽
type ProtocolStat @entity {
  id: ID!  # "protocol"
  totalValueLocked: BigDecimal!
  totalUsers: Int!
  totalDeposits: Int!
  totalWithdrawals: Int!
  updatedAt: BigInt!
}
```

`@entity` 表示這是一個數據庫實體，The Graph 會為每個實體類型創建一張表。`@derivedFrom` 表示這是一個反向引用，不需要實際存儲。

### 2. subgraph.yaml —— 清單文件

```yaml
# subgraph.yaml
specVersion: 0.0.4
description: My DeFi Protocol Subgraph
repository: https://github.com/my-org/my-subgraph
schema:
  file: ./schema.graphql

dataSources:
  - kind: ethereum
    name: Vault
    network: mainnet
    source:
      address: "0xVaultContractAddress..."
      abi: Vault
      startBlock: 15000000
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      entities:
        - User
        - Deposit
        - Withdrawal
        - DailyStat
        - ProtocolStat
      abis:
        - name: Vault
          file: ./abis/Vault.json
        - name: ERC20
          file: ./abis/ERC20.json
      eventHandlers:
        - event: Deposit(indexed address,indexed address,uint256)
          handler: handleDeposit
        - event: Withdrawal(indexed address,indexed address,uint256)
          handler: handleWithdrawal
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTransfer
      file: ./src/mapping.ts

templates:
  - kind: ethereum
    name: Token
    network: mainnet
    source:
      abi: ERC20
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.6
      language: wasm/assemblyscript
      entities:
        - Token
      abis:
        - name: ERC20
          file: ./abis/ERC20.json
      eventHandlers:
        - event: Transfer(indexed address,indexed address,uint256)
          handler: handleTokenTransfer
      file: ./src/mapping.ts
```

### 3. mapping.ts —— 事件處理器

```typescript
// src/mapping.ts
import {
  Deposit as DepositEvent,
  Withdrawal as WithdrawalEvent,
} from '../generated/Vault/Vault'
import {
  User,
  Deposit,
  Withdrawal,
  DailyStat,
  ProtocolStat,
} from '../generated/schema'
import { BigInt, BigDecimal, Bytes } from '@graphprotocol/graph-ts'

// 將 BigInt 轉為 BigDecimal（以 18 位小數處理）
function toBigDecimal(amount: BigInt): BigDecimal {
  return amount.toBigDecimal().div(
    BigDecimal.fromString('1000000000000000000')
  )
}

// 獲取或創建日期 ID
function getDayId(timestamp: BigInt): string {
  const day = timestamp.toI32() / 86400
  return day.toString()
}

// 獲取或創建 ProtocolStat
function getOrCreateProtocolStat(): ProtocolStat {
  let stat = ProtocolStat.load('protocol')
  if (stat === null) {
    stat = new ProtocolStat('protocol')
    stat.totalValueLocked = BigDecimal.fromString('0')
    stat.totalUsers = 0
    stat.totalDeposits = 0
    stat.totalWithdrawals = 0
    stat.updatedAt = BigInt.fromI32(0)
  }
  return stat
}

// 處理 Deposit 事件
export function handleDeposit(event: DepositEvent): void {
  const userId = event.params.user.toHexString()
  const depositId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  // 獲取或創建 User
  let user = User.load(userId)
  if (user === null) {
    user = new User(userId)
    user.totalDeposited = BigDecimal.fromString('0')
    user.totalWithdrawn = BigDecimal.fromString('0')
    user.currentBalance = BigDecimal.fromString('0')

    // 更新協議用戶數
    const stat = getOrCreateProtocolStat()
    stat.totalUsers += 1
    stat.save()
  }

  const amount = toBigDecimal(event.params.amount)

  // 更新 User
  user.totalDeposited = user.totalDeposited.plus(amount)
  user.currentBalance = user.currentBalance.plus(amount)
  user.save()

  // 創建 Deposit 實體
  const deposit = new Deposit(depositId)
  deposit.user = user.id
  deposit.amount = amount
  deposit.token = event.params.token.toHexString()
  deposit.blockTimestamp = event.block.timestamp
  deposit.transactionHash = event.transaction.hash.toHexString()
  deposit.save()

  // 更新每日統計
  const dayId = getDayId(event.block.timestamp)
  let dailyStat = DailyStat.load(dayId)
  if (dailyStat === null) {
    dailyStat = new DailyStat(dayId)
    dailyStat.totalDeposited = BigDecimal.fromString('0')
    dailyStat.totalWithdrawn = BigDecimal.fromString('0')
    dailyStat.uniqueUsers = 0
    dailyStat.depositCount = 0
    dailyStat.withdrawalCount = 0
  }
  dailyStat.totalDeposited = dailyStat.totalDeposited.plus(amount)
  dailyStat.depositCount += 1
  dailyStat.save()

  // 更新協議統計
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.plus(amount)
  stat.totalDeposits += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}

// 處理 Withdrawal 事件
export function handleWithdrawal(event: WithdrawalEvent): void {
  const userId = event.params.user.toHexString()
  const withdrawalId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  let user = User.load(userId)
  if (user === null) {
    // 用戶不存在但發起取款，可能是合約直接調用
    user = new User(userId)
    user.totalDeposited = BigDecimal.fromString('0')
    user.totalWithdrawn = BigDecimal.fromString('0')
    user.currentBalance = BigDecimal.fromString('0')
  }

  const amount = toBigDecimal(event.params.amount)

  user.totalWithdrawn = user.totalWithdrawn.plus(amount)
  user.currentBalance = user.currentBalance.minus(amount)
  user.save()

  const withdrawal = new Withdrawal(withdrawalId)
  withdrawal.user = user.id
  withdrawal.amount = amount
  withdrawal.token = event.params.token.toHexString()
  withdrawal.blockTimestamp = event.block.timestamp
  withdrawal.transactionHash = event.transaction.hash.toHexString()
  withdrawal.save()

  // 更新每日統計
  const dayId = getDayId(event.block.timestamp)
  let dailyStat = DailyStat.load(dayId)
  if (dailyStat === null) {
    dailyStat = new DailyStat(dayId)
    dailyStat.totalDeposited = BigDecimal.fromString('0')
    dailyStat.totalWithdrawn = BigDecimal.fromString('0')
    dailyStat.uniqueUsers = 0
    dailyStat.depositCount = 0
    dailyStat.withdrawalCount = 0
  }
  dailyStat.totalWithdrawn = dailyStat.totalWithdrawn.plus(amount)
  dailyStat.withdrawalCount += 1
  dailyStat.save()

  // 更新協議統計
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.minus(amount)
  stat.totalWithdrawals += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}
```

## GraphQL 查詢

### 分頁查詢

```graphql
# 查詢用戶的歷史存款（分頁）
query UserDeposits($userAddress: String!, $first: Int!, $skip: Int!) {
  deposits(
    where: { user: $userAddress }
    orderBy: blockTimestamp
    orderDirection: desc
    first: $first
    skip: $skip
  ) {
    id
    amount
    token
    blockTimestamp
    transactionHash
  }
}
```

### 過濾與排序

```graphql
# 查詢大額存款
query LargeDeposits($minAmount: BigDecimal) {
  deposits(
    where: { amount_gt: $minAmount }
    orderBy: amount
    orderDirection: desc
    first: 100
  ) {
    id
    user {
      id
    }
    amount
    blockTimestamp
  }
}

# 查詢特定時間範圍內的交易
query TransactionsInRange($startTime: BigInt!, $endTime: BigInt!) {
  deposits(
    where: { blockTimestamp_gte: $startTime, blockTimestamp_lte: $endTime }
    orderBy: blockTimestamp
    orderDirection: asc
  ) {
    id
    amount
    blockTimestamp
  }
  withdrawals(
    where: { blockTimestamp_gte: $startTime, blockTimestamp_lte: $endTime }
    orderBy: blockTimestamp
    direction: asc
  ) {
    id
    amount
    blockTimestamp
  }
}
```

### 聚合查詢

```graphql
# 查詢協議總覽
query ProtocolOverview {
  protocolStat(id: "protocol") {
    totalValueLocked
    totalUsers
    totalDeposits
    totalWithdrawals
    updatedAt
  }

  # 最近 7 天的每日統計
  dailyStats(
    orderBy: id
    orderDirection: desc
    first: 7
  ) {
    id
    totalDeposited
    totalWithdrawn
    uniqueUsers
    depositCount
    withdrawalCount
  }
}

# 查詢用戶完整信息
query UserFullInfo($address: ID!) {
  user(id: $address) {
    id
    totalDeposited
    totalWithdrawn
    currentBalance
    deposits(orderBy: blockTimestamp, orderDirection: desc, first: 10) {
      id
      amount
      blockTimestamp
      transactionHash
    }
    withdrawals(orderBy: blockTimestamp, orderDirection: desc, first: 10) {
      id
      amount
      blockTimestamp
      transactionHash
    }
  }
}
```

## 前端集成

### 使用 graphql-request

```typescript
// lib/graphClient.ts
import { GraphQLClient } from 'graphql-request'

const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/my-org/my-subgraph'

export const graphClient = new GraphQLClient(SUBGRAPH_URL)

// 查詢類型定義
interface Deposit {
  id: string
  amount: string
  token: string
  blockTimestamp: string
  transactionHash: string
}

interface UserDepositsResponse {
  deposits: Deposit[]
}

// 查詢用戶存款
export async function getUserDeposits(
  userAddress: string,
  page: number = 0,
  pageSize: number = 10
): Promise<Deposit[]> {
  const query = `
    query UserDeposits($userAddress: String!, $first: Int!, $skip: Int!) {
      deposits(
        where: { user: $userAddress }
        orderBy: blockTimestamp
        orderDirection: desc
        first: $first
        skip: $skip
      ) {
        id
        amount
        token
        blockTimestamp
        transactionHash
      }
    }
  `

  const data = await graphClient.request<UserDepositsResponse>(query, {
    userAddress: userAddress.toLowerCase(),
    first: pageSize,
    skip: page * pageSize,
  })

  return data.deposits
}

// 查詢協議統計
export async function getProtocolStats() {
  const query = `
    query ProtocolOverview {
      protocolStat(id: "protocol") {
        totalValueLocked
        totalUsers
        totalDeposits
        totalWithdrawals
      }
      dailyStats(orderBy: id, orderDirection: desc, first: 30) {
        id
        totalDeposited
        totalWithdrawn
        uniqueUsers
        depositCount
      }
    }
  `

  return graphClient.request(query)
}
```

### 使用 urql

```typescript
// lib/urqlClient.ts
import { createClient } from 'urql'

export const urqlClient = createClient({
  url: 'https://api.thegraph.com/subgraphs/name/my-org/my-subgraph',
})

// hooks/useDeposits.ts
import { useQuery } from 'urql'

const DEPOSITS_QUERY = `
  query UserDeposits($userAddress: String!, $first: Int!, $skip: Int!) {
    deposits(
      where: { user: $userAddress }
      orderBy: blockTimestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      amount
      token
      blockTimestamp
      transactionHash
    }
  }
`

export function useDeposits(
  userAddress: string | null,
  page: number = 0
) {
  const [result] = useQuery({
    query: DEPOSITS_QUERY,
    variables: {
      userAddress: userAddress?.toLowerCase(),
      first: 10,
      skip: page * 10,
    },
    pause: !userAddress, // 未連接錢包時暫停查詢
  })

  return {
    deposits: result.data?.deposits || [],
    loading: result.fetching,
    error: result.error,
  }
}
```

### 使用 Apollo Client

```typescript
// lib/apolloClient.ts
import {
  ApolloClient,
  InMemoryCache,
  gql,
} from '@apollo/client'

export const apolloClient = new ApolloClient({
  uri: 'https://api.thegraph.com/subgraphs/name/my-org/my-subgraph',
  cache: new InMemoryCache(),
})

// GraphQL 文檔
export const GET_USER_DEPOSITS = gql`
  query UserDeposits($userAddress: String!, $first: Int!, $skip: Int!) {
    deposits(
      where: { user: $userAddress }
      orderBy: blockTimestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      amount
      token
      blockTimestamp
      transactionHash
    }
  }
`

export const GET_PROTOCOL_STATS = gql`
  query ProtocolOverview {
    protocolStat(id: "protocol") {
      totalValueLocked
      totalUsers
      totalDeposits
      totalWithdrawals
    }
    dailyStats(orderBy: id, orderDirection: desc, first: 30) {
      id
      totalDeposited
      totalWithdrawn
      uniqueUsers
    }
  }
`

// hooks/useProtocolStats.ts
import { useQuery } from '@apollo/client'

export function useProtocolStats() {
  const { loading, error, data, refetch } = useQuery(GET_PROTOCOL_STATS, {
    pollInterval: 30000, // 每 30 秒輪詢更新
  })

  return {
    stats: data?.protocolStat,
    dailyStats: data?.dailyStats || [],
    loading,
    error,
    refetch,
  }
}

// hooks/useUserActivity.ts
export function useUserActivity(userAddress: string | null, page: number = 0) {
  const { loading, error, data, fetchMore } = useQuery(
    GET_USER_DEPOSITS,
    {
      variables: {
        userAddress: userAddress?.toLowerCase(),
        first: 10,
        skip: page * 10,
      },
      skip: !userAddress,
    }
  )

  return {
    deposits: data?.deposits || [],
    loading,
    error,
    loadMore: () =>
      fetchMore({
        variables: {
          skip: (page + 1) * 10,
        },
      }),
  }
}
```

## 完整的 Subgraph 定義與前端查詢

### 前端組件

```tsx
// components/Dashboard.tsx
import { useAccount } from 'wagmi'
import { useProtocolStats, useUserActivity } from '../hooks'

export function Dashboard() {
  const { address } = useAccount()
  const { stats, dailyStats, loading: statsLoading } = useProtocolStats()
  const { deposits, loading: depositsLoading } = useUserActivity(address)

  if (statsLoading) return <div>加載中...</div>

  return (
    <div className="dashboard">
      {/* 協議總覽 */}
      <section>
        <h2>協議總覽</h2>
        <div className="stats-grid">
          <StatCard
            label="TVL"
            value={formatTokenAmount(stats?.totalValueLocked)}
          />
          <StatCard
            label="總用戶"
            value={stats?.totalUsers || 0}
          />
          <StatCard
            label="總存款"
            value={stats?.totalDeposits || 0}
          />
          <StatCard
            label="總取款"
            value={stats?.totalWithdrawals || 0}
          />
        </div>
      </section>

      {/* 每日統計圖表 */}
      <section>
        <h2>最近 30 天</h2>
        <DailyChart data={dailyStats} />
      </section>

      {/* 用戶交易歷史 */}
      {address && (
        <section>
          <h2>我的交易</h2>
          {depositsLoading ? (
            <div>加載中...</div>
          ) : (
            <DepositTable deposits={deposits} />
          )}
        </section>
      )}
    </div>
  )
}

function formatTokenAmount(value: string | undefined): string {
  if (!value) return '0'
  const num = parseFloat(value)
  if (num > 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`
  if (num > 1_000) return `${(num / 1_000).toFixed(2)}K`
  return num.toFixed(4)
}
```

## 部署 Subgraph

### 使用 Graph CLI

```bash
# 安裝 Graph CLI
npm install -g @graphprotocol/graph-cli

# 登錄 Graph Explorer
graph auth https://api.thegraph.com/deploy/ $GRAPH_ACCESS_TOKEN

# 代碼生成（生成 TypeScript 類型）
graph codegen

# 構建
graph build

# 部署到 Hosted Service（舊版，即將廢棄）
graph deploy --node https://api.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/ \
  my-org/my-subgraph

# 部署去中心化網絡
graph create --node https://api.thegraph.com/ my-org/my-subgraph
```

### 部署配置

```json
// package.json
{
  "scripts": {
    "codegen": "graph codegen",
    "build": "graph build",
    "deploy": "graph codegen && graph build && graph deploy --node https://api.thegraph.com/deploy/ --ipfs https://api.thegraph.com/ipfs/ my-org/my-subgraph",
    "deploy:mainnet": "graph codegen && graph build && graph deploy --network mainnet my-org/my-subgraph",
    "deploy:arbitrum": "graph codegen && graph build && graph deploy --network arbitrum my-org/my-subgraph-arb"
  }
}
```

## 性能優化

### 查詢複雜度控制

```graphql
# ❌ 不好的查詢：join 太多實體
query BadQuery {
  users(first: 1000) {
    deposits(first: 100) {
      withdrawals(first: 50) {
        amount
      }
    }
  }
}
# 複雜度: 1000 * 100 * 50 = 5,000,000
# 超過 The Graph 的複雜度限制

# ✅ 好的查詢：分步查詢
query Step1 {
  users(first: 100, orderBy: totalDeposited, orderDirection: desc) {
    id
    totalDeposited
  }
}

query Step2($userId: ID!) {
  user(id: $userId) {
    deposits(first: 20, orderBy: blockTimestamp, orderDirection: desc) {
      id
      amount
    }
  }
}
```

### 索引同步優化

```yaml
# subgraph.yaml 中優化 startBlock
dataSources:
  - kind: ethereum
    name: Vault
    source:
      address: "0xVault..."
      startBlock: 15000000  # 合約部署區塊，不要從 0 開始
```

### 前端緩存策略

```typescript
// 使用 Apollo 的緩存策略
import { InMemoryCache, ApolloLink } from '@apollo/client'

const cache = new InMemoryCache({
  typePolicies: {
    Deposit: {
      keyFields: ['id'],
    },
    User: {
      keyFields: ['id'],
      fields: {
        deposits: {
          merge: (existing = [], incoming = []) => {
            // 合併分頁結果
            return [...existing, ...incoming]
          },
        },
      },
    },
  },
})

// 請求去重
const dedupLink = new ApolloLink((operation, forward) => {
  // 避免短時間內重複查詢
  return forward(operation)
})
```

## 與自建索引服務的對比

| 維度 | The Graph | 自建索引 |
|------|-----------|---------|
| 開發成本 | 低（寫 Subgraph） | 高（全棧實現） |
| 運維成本 | 零（去中心化網絡） | 持續 |
| 查詢語言 | GraphQL | 自定義 |
| 實時性 | ~1 區塊延遲 | 可配置 |
| 多鏈支持 | 原生支持 | 需每鏈部署 |
| 成本 | GRT 查詢費 | 服務器費 |
| 可定製性 | 受 Subgraph 限制 | 完全自由 |
| 數據聚合 | 需在 mapping 中預計算 | 可用 SQL 聚合 |
| 鏈重組處理 | 自動 | 需自行實現 |

## 小結

The Graph 通過 Subgraph 機制將鏈上數據索引為 GraphQL API，解決了 DApp 前端數據查詢的核心痛點。Subgraph 的三件套——schema.graphql 定義數據模型、subgraph.yaml 聲明數據源和事件映射、mapping.ts 處理事件並更新實體——構成了一個完整的索引管線。

與自建索引服務相比，The Graph 的優勢在於零運維成本和內置的鏈重組處理。但代價是靈活性受限：聚合查詢需要在 mapping 中預先計算並存儲，無法像 SQL 那樣實時聚合。複雜的多表 join 也需要拆分為多步查詢以控制複雜度。

前端集成方面，GraphQL 的類型系統與 TypeScript 天然契合。通過 graphql-codegen 可以從 Subgraph 的 schema 自動生成 TypeScript 類型，實現端到端的類型安全。Apollo Client 的緩存和分頁能力可以很好地處理增量加載場景。

隨著 The Graph 遷移到完全去中心化的網絡，查詢將需要支付 GRT 代幣費用。這對 DApp 的商業模式有直接影響——需要在產品設計中考慮數據查詢成本。對於高頻查詢場景，可以考慮在 The Graph 之上自建一層緩存（如 Redis），減少對 Indexer 的直接查詢壓力。
