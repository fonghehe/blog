---
title: "The Graph 子图查询：DApp 链上数据索引方案"
date: 2023-12-10 12:43:20
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 12
description: "直接读取链上事件日志无法满足 DApp 的复杂查询需求。The Graph 通过 Subgraph 提供去中心化的索引服务，支持 GraphQL 查询。本文覆盖从 Subgraph 定义到前端集成的完整方案。"
wordCount: 3100
---

DApp 前端需要展示大量链上数据：用户的历史交易、持仓变化、协议统计等。这些数据分散在无数区块的事件日志中，直接通过 RPC 读取不仅效率低下，而且无法支持复杂查询（如分页、过滤、聚合）。The Graph 协议通过 Subgraph 索引机制解决了这个问题，让前端可以用 GraphQL 高效查询链上数据。

## DApp 数据索引的挑战

### 直接读取事件日志的局限

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const contract = new ethers.Contract(address, abi, provider)

// 获取所有 Transfer 事件
const filter = contract.filters.Transfer(null, userAddress, null)
const events = await contract.queryFilter(filter, 0, 'latest')

// 问题 1：性能极差 —— 需要扫描所有区块
// 主网有 1800 万+ 区块，每个区块可能有多个事件
// RPC 节点通常会限制查询范围（如最多 10000 个区块）

// 问题 2：无法复杂查询
// "查询用户最近 30 天的交易，按金额排序，分页展示"
// 需要在前端拉取所有事件后手动排序分页

// 问题 3：无法聚合查询
// "统计协议总 TVL" 需要遍历所有 Deposit/Withdraw 事件

// 问题 4：实时性差
// 每次刷新都要重新查询，没有增量更新机制
```

### 自建索引服务的问题

```typescript
// 自己搭一个索引服务？
// 1. 需要监听所有区块和事件 —— 一个节点不能掉线
// 2. 需要数据库存储和处理 —— PostgreSQL? MongoDB?
// 3. 需要提供 API 层 —— REST? GraphQL?
// 4. 需要处理链重组（reorg）—— 回滚已索引的数据
// 5. 需要部署和维护服务器 —— 持续成本
// 6. 需要处理多链 —— 每条链一个索引器
```

## The Graph 协议概述

The Graph 是一个去中心化的索引协议，通过 Subgraph 机制将链上数据索引为可查询的 GraphQL API。

### 架构角色

```
┌──────────────┐     部署      ┌──────────────┐
│   Developer  │ ──────────→  │   Subgraph   │
│  (写 Subgraph) │              │  (索引定义)   │
└──────────────┘              └──────┬───────┘
                                     │ 索引
                              ┌──────▼───────┐
┌──────────────┐     查询      │   Indexer    │
│   DApp 前端   │ ←─────────── │  (索引节点)   │
└──────────────┘              └──────────────┘
       ▲                            ▲
       │                            │
┌──────┴───────┐            ┌──────┴───────┐
│   Curator    │            │   Delegate   │
│ (策展/信号)   │            │ (委托 GRT)    │
└──────────────┘            └──────────────┘
```

- **Developer**：编写 Subgraph 定义，部署到 The Graph 网络
- **Indexer**：运行索引节点，处理链上数据并提供查询服务
- **Curator**：通过信号（signal）指引用价值的 Subgraph，帮助 Indexer 分配资源
- **Delegator**：将 GRT 代币委托给 Indexer，分享索引收益

## Subgraph 定义

一个 Subgraph 包含三个核心文件：

### 1. schema.graphql —— 数据模型

```graphql
# schema.graphql

# 用户实体
type User @entity {
  id: ID!  # 钱包地址
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  currentBalance: BigDecimal!
  deposits: [Deposit!]! @derivedFrom(field: "user")
  withdrawals: [Withdrawal!]! @derivedFrom(field: "user")
}

# 存款事件
type Deposit @entity {
  id: ID!  # 交易哈希 + 日志索引
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

# 每日统计
type DailyStat @entity {
  id: ID!  # 日期 (YYYY-MM-DD)
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  uniqueUsers: Int!
  depositCount: Int!
  withdrawalCount: Int!
}

# 协议总览
type ProtocolStat @entity {
  id: ID!  # "protocol"
  totalValueLocked: BigDecimal!
  totalUsers: Int!
  totalDeposits: Int!
  totalWithdrawals: Int!
  updatedAt: BigInt!
}
```

`@entity` 表示这是一个数据库实体，The Graph 会为每个实体类型创建一张表。`@derivedFrom` 表示这是一个反向引用，不需要实际存储。

### 2. subgraph.yaml —— 清单文件

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

### 3. mapping.ts —— 事件处理器

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

// 将 BigInt 转为 BigDecimal（以 18 位小数处理）
function toBigDecimal(amount: BigInt): BigDecimal {
  return amount.toBigDecimal().div(
    BigDecimal.fromString('1000000000000000000')
  )
}

// 获取或创建日期 ID
function getDayId(timestamp: BigInt): string {
  const day = timestamp.toI32() / 86400
  return day.toString()
}

// 获取或创建 ProtocolStat
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

// 处理 Deposit 事件
export function handleDeposit(event: DepositEvent): void {
  const userId = event.params.user.toHexString()
  const depositId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  // 获取或创建 User
  let user = User.load(userId)
  if (user === null) {
    user = new User(userId)
    user.totalDeposited = BigDecimal.fromString('0')
    user.totalWithdrawn = BigDecimal.fromString('0')
    user.currentBalance = BigDecimal.fromString('0')

    // 更新协议用户数
    const stat = getOrCreateProtocolStat()
    stat.totalUsers += 1
    stat.save()
  }

  const amount = toBigDecimal(event.params.amount)

  // 更新 User
  user.totalDeposited = user.totalDeposited.plus(amount)
  user.currentBalance = user.currentBalance.plus(amount)
  user.save()

  // 创建 Deposit 实体
  const deposit = new Deposit(depositId)
  deposit.user = user.id
  deposit.amount = amount
  deposit.token = event.params.token.toHexString()
  deposit.blockTimestamp = event.block.timestamp
  deposit.transactionHash = event.transaction.hash.toHexString()
  deposit.save()

  // 更新每日统计
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

  // 更新协议统计
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.plus(amount)
  stat.totalDeposits += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}

// 处理 Withdrawal 事件
export function handleWithdrawal(event: WithdrawalEvent): void {
  const userId = event.params.user.toHexString()
  const withdrawalId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  let user = User.load(userId)
  if (user === null) {
    // 用户不存在但发起取款，可能是合约直接调用
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

  // 更新每日统计
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

  // 更新协议统计
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.minus(amount)
  stat.totalWithdrawals += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}
```

## GraphQL 查询

### 分页查询

```graphql
# 查询用户的历史存款（分页）
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

### 过滤与排序

```graphql
# 查询大额存款
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

# 查询特定时间范围内的交易
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

### 聚合查询

```graphql
# 查询协议总览
query ProtocolOverview {
  protocolStat(id: "protocol") {
    totalValueLocked
    totalUsers
    totalDeposits
    totalWithdrawals
    updatedAt
  }

  # 最近 7 天的每日统计
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

# 查询用户完整信息
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

// 查询类型定义
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

// 查询用户存款
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

// 查询协议统计
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
    pause: !userAddress, // 未连接钱包时暂停查询
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

// GraphQL 文档
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
    pollInterval: 30000, // 每 30 秒轮询更新
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

## 完整的 Subgraph 定义与前端查询

### 前端组件

```tsx
// components/Dashboard.tsx
import { useAccount } from 'wagmi'
import { useProtocolStats, useUserActivity } from '../hooks'

export function Dashboard() {
  const { address } = useAccount()
  const { stats, dailyStats, loading: statsLoading } = useProtocolStats()
  const { deposits, loading: depositsLoading } = useUserActivity(address)

  if (statsLoading) return <div>加载中...</div>

  return (
    <div className="dashboard">
      {/* 协议总览 */}
      <section>
        <h2>协议总览</h2>
        <div className="stats-grid">
          <StatCard
            label="TVL"
            value={formatTokenAmount(stats?.totalValueLocked)}
          />
          <StatCard
            label="总用户"
            value={stats?.totalUsers || 0}
          />
          <StatCard
            label="总存款"
            value={stats?.totalDeposits || 0}
          />
          <StatCard
            label="总取款"
            value={stats?.totalWithdrawals || 0}
          />
        </div>
      </section>

      {/* 每日统计图表 */}
      <section>
        <h2>最近 30 天</h2>
        <DailyChart data={dailyStats} />
      </section>

      {/* 用户交易历史 */}
      {address && (
        <section>
          <h2>我的交易</h2>
          {depositsLoading ? (
            <div>加载中...</div>
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
# 安装 Graph CLI
npm install -g @graphprotocol/graph-cli

# 登录 Graph Explorer
graph auth https://api.thegraph.com/deploy/ $GRAPH_ACCESS_TOKEN

# 代码生成（生成 TypeScript 类型）
graph codegen

# 构建
graph build

# 部署到 Hosted Service（旧版，即将废弃）
graph deploy --node https://api.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/ \
  my-org/my-subgraph

# 部署去中心化网络
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

## 性能优化

### 查询复杂度控制

```graphql
# ❌ 不好的查询：join 太多实体
query BadQuery {
  users(first: 1000) {
    deposits(first: 100) {
      withdrawals(first: 50) {
        amount
      }
    }
  }
}
# 复杂度: 1000 * 100 * 50 = 5,000,000
# 超过 The Graph 的复杂度限制

# ✅ 好的查询：分步查询
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

### 索引同步优化

```yaml
# subgraph.yaml 中优化 startBlock
dataSources:
  - kind: ethereum
    name: Vault
    source:
      address: "0xVault..."
      startBlock: 15000000  # 合约部署区块，不要从 0 开始
```

### 前端缓存策略

```typescript
// 使用 Apollo 的缓存策略
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
            // 合并分页结果
            return [...existing, ...incoming]
          },
        },
      },
    },
  },
})

// 请求去重
const dedupLink = new ApolloLink((operation, forward) => {
  // 避免短时间内重复查询
  return forward(operation)
})
```

## 与自建索引服务的对比

| 维度 | The Graph | 自建索引 |
|------|-----------|---------|
| 开发成本 | 低（写 Subgraph） | 高（全栈实现） |
| 运维成本 | 零（去中心化网络） | 持续 |
| 查询语言 | GraphQL | 自定义 |
| 实时性 | ~1 区块延迟 | 可配置 |
| 多链支持 | 原生支持 | 需每链部署 |
| 成本 | GRT 查询费 | 服务器费 |
| 可定制性 | 受 Subgraph 限制 | 完全自由 |
| 数据聚合 | 需在 mapping 中预计算 | 可用 SQL 聚合 |
| 链重组处理 | 自动 | 需自行实现 |

## 小结

The Graph 通过 Subgraph 机制将链上数据索引为 GraphQL API，解决了 DApp 前端数据查询的核心痛点。Subgraph 的三件套——schema.graphql 定义数据模型、subgraph.yaml 声明数据源和事件映射、mapping.ts 处理事件并更新实体——构成了一个完整的索引管线。

与自建索引服务相比，The Graph 的优势在于零运维成本和内置的链重组处理。但代价是灵活性受限：聚合查询需要在 mapping 中预先计算并存储，无法像 SQL 那样实时聚合。复杂的多表 join 也需要拆分为多步查询以控制复杂度。

前端集成方面，GraphQL 的类型系统与 TypeScript 天然契合。通过 graphql-codegen 可以从 Subgraph 的 schema 自动生成 TypeScript 类型，实现端到端的类型安全。Apollo Client 的缓存和分页能力可以很好地处理增量加载场景。

随着 The Graph 迁移到完全去中心化的网络，查询将需要支付 GRT 代币费用。这对 DApp 的商业模式有直接影响——需要在产品设计中考虑数据查询成本。对于高频查询场景，可以考虑在 The Graph 之上自建一层缓存（如 Redis），减少对 Indexer 的直接查询压力。
