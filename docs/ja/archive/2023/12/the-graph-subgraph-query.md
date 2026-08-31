---
title: "The Graph サブグラフクエリ：DApp オンチェーンデータインデックスソリューション"
date: 2023-12-10 12:43:20
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 11
description: "オンチェーンイベントログの直接読み取りでは、DApp の複雑なクエリ要件を満たすことはできません。The Graph は Subgraph を通じて分散型のインデックスサービスを提供し、GraphQL クエリをサポートします。本記事では、Subgraph 定義からフロントエンド統合までの完全なソリューションをカバーします。"
wordCount: 1508
---

DApp フロントエンドは、ユーザーの履歴取引、ポジション変動、プロトコル統計など、大量のオンチェーンデータを表示する必要があります。これらのデータは無数のブロックのイベントログに分散しており、RPC 経由で直接読み取るのは非効率であるだけでなく、ページネーション、フィルタリング、集計といった複雑なクエリもサポートできません。The Graph プロトコルは、Subgraph インデックス機構を通じてこの問題を解決し、フロントエンドが GraphQL を用いて効率的にオンチェーンデータをクエリできるようにします。

## DApp データインデックスの課題

### イベントログ直接読み取りの限界

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const contract = new ethers.Contract(address, abi, provider)

// すべての Transfer イベントを取得
const filter = contract.filters.Transfer(null, userAddress, null)
const events = await contract.queryFilter(filter, 0, 'latest')

// 問題 1：パフォーマンスが極めて悪い —— すべてのブロックをスキャンする必要がある
// メインネットには 1800 万以上のブロックがあり、各ブロックに複数のイベントが含まれる可能性がある
// RPC ノードは通常クエリ範囲を制限する（例：最大 10000 ブロック）

// 問題 2：複雑なクエリが不可能
// 「ユーザーの直近 30 日間の取引を金額順にソートし、ページング表示」
// すべてのイベントをフロントエンドに取得して手動でソート・ページングする必要がある

// 問題 3：集計クエリが不可能
// 「プロトコルの総 TVL を集計」するにはすべての Deposit/Withdraw イベントを走査する必要がある

// 問題 4：リアルタイム性が低い
// 更新のたびに再クエリが必要で、増分更新機構がない
```

### 自作インデックスサービスの問題

```typescript
// 自分でインデックスサービスを構築する？
// 1. すべてのブロックとイベントを監視する必要がある —— ノードはダウンできない
// 2. データベースの保存と処理が必要 —— PostgreSQL? MongoDB?
// 3. API レイヤーを提供する必要がある —— REST? GraphQL?
// 4. チェーン再編成（reorg）に対処する必要がある —— インデックス済みデータのロールバック
// 5. サーバーのデプロイとメンテナンスが必要 —— 継続的なコスト
// 6. マルチチェーン対応が必要 —— チェーンごとにインデクサーが必要
```

## The Graph プロトコル概要

The Graph は分散型インデックスプロトコルであり、Subgraph 機構を通じてオンチェーンデータをクエリ可能な GraphQL API にインデックスします。

### アーキテクチャ上の役割

```
┌──────────────┐     デプロイ      ┌──────────────┐
│   Developer  │ ──────────→  │   Subgraph   │
│  (Subgraph を書く)│              │  (インデックス定義)   │
└──────────────┘              └──────┬───────┘
                                     │ インデックス
                              ┌──────▼───────┐
┌──────────────┐     クエリ     │   Indexer    │
│   DApp フロントエンド  │ ←─────────── │  (インデックスノード)   │
└──────────────┘              └──────────────┘
       ▲                            ▲
       │                            │
┌──────┴───────┐            ┌──────┴───────┐
│   Curator    │            │   Delegate   │
│ (キュレーション/シグナル) │            │ (GRT 委任)    │
└──────────────┘            └──────────────┘
```

- **Developer**：Subgraph 定義を作成し、The Graph ネットワークにデプロイする
- **Indexer**：インデックスノードを実行し、オンチェーンデータを処理してクエリサービスを提供する
- **Curator**：シグナルを通じて価値のある Subgraph を示し、Indexer のリソース配分を支援する
- **Delegator**：GRT トークンを Indexer に委任し、インデックス収益を共有する

## Subgraph 定義

一つの Subgraph には三つの中核ファイルが含まれます：

### 1. schema.graphql —— データモデル

```graphql
# schema.graphql

# ユーザーエンティティ
type User @entity {
  id: ID!  # ウォレットアドレス
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  currentBalance: BigDecimal!
  deposits: [Deposit!]! @derivedFrom(field: "user")
  withdrawals: [Withdrawal!]! @derivedFrom(field: "user")
}

# デポジットイベント
type Deposit @entity {
  id: ID!  # トランザクションハッシュ + ログインデックス
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# ウィズドロワルイベント
type Withdrawal @entity {
  id: ID!
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# 日次統計
type DailyStat @entity {
  id: ID!  # 日付 (YYYY-MM-DD)
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  uniqueUsers: Int!
  depositCount: Int!
  withdrawalCount: Int!
}

# プロトコル概要
type ProtocolStat @entity {
  id: ID!  # "protocol"
  totalValueLocked: BigDecimal!
  totalUsers: Int!
  totalDeposits: Int!
  totalWithdrawals: Int!
  updatedAt: BigInt!
}
```

`@entity` はデータベースエンティティであることを示し、The Graph は各エンティティタイプに対してテーブルを作成します。`@derivedFrom` は逆参照を示し、実際の保存は不要です。

### 2. subgraph.yaml —— マニフェストファイル

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

### 3. mapping.ts —— イベントハンドラー

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

// BigInt を BigDecimal に変換（18 桁として処理）
function toBigDecimal(amount: BigInt): BigDecimal {
  return amount.toBigDecimal().div(
    BigDecimal.fromString('1000000000000000000')
  )
}

// 日付 ID を取得または作成
function getDayId(timestamp: BigInt): string {
  const day = timestamp.toI32() / 86400
  return day.toString()
}

// ProtocolStat を取得または作成
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

// Deposit イベントを処理
export function handleDeposit(event: DepositEvent): void {
  const userId = event.params.user.toHexString()
  const depositId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  // User を取得または作成
  let user = User.load(userId)
  if (user === null) {
    user = new User(userId)
    user.totalDeposited = BigDecimal.fromString('0')
    user.totalWithdrawn = BigDecimal.fromString('0')
    user.currentBalance = BigDecimal.fromString('0')

    // プロトコルユーザー数を更新
    const stat = getOrCreateProtocolStat()
    stat.totalUsers += 1
    stat.save()
  }

  const amount = toBigDecimal(event.params.amount)

  // User を更新
  user.totalDeposited = user.totalDeposited.plus(amount)
  user.currentBalance = user.currentBalance.plus(amount)
  user.save()

  // Deposit エンティティを作成
  const deposit = new Deposit(depositId)
  deposit.user = user.id
  deposit.amount = amount
  deposit.token = event.params.token.toHexString()
  deposit.blockTimestamp = event.block.timestamp
  deposit.transactionHash = event.transaction.hash.toHexString()
  deposit.save()

  // 日次統計を更新
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

  // プロトコル統計を更新
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.plus(amount)
  stat.totalDeposits += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}

// Withdrawal イベントを処理
export function handleWithdrawal(event: WithdrawalEvent): void {
  const userId = event.params.user.toHexString()
  const withdrawalId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  let user = User.load(userId)
  if (user === null) {
    // ユーザーが存在しないがウィズドロワルを開始した場合、コントラクトからの直接呼び出しの可能性がある
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

  // 日次統計を更新
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

  // プロトコル統計を更新
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.minus(amount)
  stat.totalWithdrawals += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}
```

## GraphQL クエリ

### ページネーションクエリ

```graphql
# ユーザーのデポジット履歴をクエリ（ページング）
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

### フィルタリングとソート

```graphql
# 大口デポジットをクエリ
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

# 特定の時間範囲内の取引をクエリ
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

### 集計クエリ

```graphql
# プロトコル概要をクエリ
query ProtocolOverview {
  protocolStat(id: "protocol") {
    totalValueLocked
    totalUsers
    totalDeposits
    totalWithdrawals
    updatedAt
  }

  # 直近 7 日間の日次統計
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

# ユーザーの完全な情報をクエリ
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

## フロントエンド統合

### graphql-request の使用

```typescript
// lib/graphClient.ts
import { GraphQLClient } from 'graphql-request'

const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/my-org/my-subgraph'

export const graphClient = new GraphQLClient(SUBGRAPH_URL)

// クエリ型定義
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

// ユーザーデポジットをクエリ
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

// プロトコル統計をクエリ
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

### urql の使用

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
    pause: !userAddress, // ウォレット未接続時にクエリを一時停止
  })

  return {
    deposits: result.data?.deposits || [],
    loading: result.fetching,
    error: result.error,
  }
}
```

### Apollo Client の使用

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

// GraphQL ドキュメント
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
    pollInterval: 30000, // 30 秒ごとにポーリング更新
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

## 完全な Subgraph 定義とフロントエンドクエリ

### フロントエンドコンポーネント

```tsx
// components/Dashboard.tsx
import { useAccount } from 'wagmi'
import { useProtocolStats, useUserActivity } from '../hooks'

export function Dashboard() {
  const { address } = useAccount()
  const { stats, dailyStats, loading: statsLoading } = useProtocolStats()
  const { deposits, loading: depositsLoading } = useUserActivity(address)

  if (statsLoading) return <div>読み込み中...</div>

  return (
    <div className="dashboard">
      {/* プロトコル概要 */}
      <section>
        <h2>プロトコル概要</h2>
        <div className="stats-grid">
          <StatCard
            label="TVL"
            value={formatTokenAmount(stats?.totalValueLocked)}
          />
          <StatCard
            label="総ユーザー数"
            value={stats?.totalUsers || 0}
          />
          <StatCard
            label="総デポジット数"
            value={stats?.totalDeposits || 0}
          />
          <StatCard
            label="総ウィズドロワル数"
            value={stats?.totalWithdrawals || 0}
          />
        </div>
      </section>

      {/* 日次統計チャート */}
      <section>
        <h2>直近 30 日間</h2>
        <DailyChart data={dailyStats} />
      </section>

      {/* ユーザー取引履歴 */}
      {address && (
        <section>
          <h2>マイ取引</h2>
          {depositsLoading ? (
            <div>読み込み中...</div>
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

## Subgraph のデプロイ

### Graph CLI の使用

```bash
# Graph CLI をインストール
npm install -g @graphprotocol/graph-cli

# Graph Explorer にログイン
graph auth https://api.thegraph.com/deploy/ $GRAPH_ACCESS_TOKEN

# コード生成（TypeScript 型を生成）
graph codegen

# ビルド
graph build

# Hosted Service にデプロイ（旧バージョン、まもなく廃止）
graph deploy --node https://api.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/ \
  my-org/my-subgraph

# 分散型ネットワークにデプロイ
graph create --node https://api.thegraph.com/ my-org/my-subgraph
```

### デプロイ設定

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

## パフォーマンス最適化

### クエリ複雑度制御

```graphql
# ❌ 良くないクエリ：エンティティを join しすぎ
query BadQuery {
  users(first: 1000) {
    deposits(first: 100) {
      withdrawals(first: 50) {
        amount
      }
    }
  }
}
# 複雑度: 1000 * 100 * 50 = 5,000,000
# The Graph の複雑度制限を超過

# ✅ 良いクエリ：段階的にクエリ
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

### インデックス同期最適化

```yaml
# subgraph.yaml で startBlock を最適化
dataSources:
  - kind: ethereum
    name: Vault
    source:
      address: "0xVault..."
      startBlock: 15000000  # コントラクトデプロイブロック、0 から開始しない
```

### フロントエンドキャッシュ戦略

```typescript
// Apollo のキャッシュ戦略を使用
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
            // ページング結果をマージ
            return [...existing, ...incoming]
          },
        },
      },
    },
  },
})

// リクエスト重複排除
const dedupLink = new ApolloLink((operation, forward) => {
  // 短時間での重複クエリを回避
  return forward(operation)
})
```

## 自作インデックスサービスとの比較

| 次元 | The Graph | 自作インデックス |
|------|-----------|---------|
| 開発コスト | 低（Subgraph を書くだけ） | 高（フルスタック実装） |
| 運用コスト | ゼロ（分散型ネットワーク） | 継続的 |
| クエリ言語 | GraphQL | カスタム |
| リアルタイム性 | 約 1 ブロック遅延 | 設定可能 |
| マルチチェーン対応 | ネイティブサポート | チェーンごとにデプロイ必要 |
| コスト | GRT クエリ料金 | サーバー費用 |
| カスタマイズ性 | Subgraph に制限される | 完全自由 |
| データ集計 | mapping 内で事前計算が必要 | SQL 集計可能 |
| チェーン再編成処理 | 自動 | 独自実装が必要 |

## まとめ

The Graph は Subgraph 機構を通じてオンチェーンデータを GraphQL API にインデックスし、DApp フロントエンドのデータクエリにおける中核的な課題を解決します。Subgraph の三種の神器——schema.graphql でデータモデルを定義、subgraph.yaml でデータソースとイベントマッピングを宣言、mapping.ts でイベントを処理してエンティティを更新——が完全なインデックスパイプラインを構成します。

自作インデックスサービスと比較して、The Graph の強みは運用コストゼロと組み込みのチェーン再編成処理にあります。しかしその代償として柔軟性が制限されます：集計クエリは mapping 内で事前計算して保存する必要があり、SQL のようにリアルタイム集計はできません。複雑な複数テーブルの join も、複雑度を制御するために複数ステップのクエリに分割する必要があります。

フロントエンド統合においては、GraphQL の型システムは TypeScript と自然に調和します。graphql-codegen を使用することで、Subgraph の schema から TypeScript 型を自動生成し、エンドツーエンドの型安全性を実現できます。Apollo Client のキャッシュとページング機能は、増分読み込みシナリオをうまく処理します。

The Graph が完全な分散型ネットワークに移行するにつれて、クエリには GRT トークン手数料の支払いが必要になります。これは DApp のビジネスモデルに直接影響を与えます——製品設計においてデータクエリコストを考慮する必要があります。高頻度クエリシナリオでは、The Graph の上にキャッシュレイヤー（Redis など）を自前で構築し、Indexer への直接クエリ負荷を軽減することを検討できます。
