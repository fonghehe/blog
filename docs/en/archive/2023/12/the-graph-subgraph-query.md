---
title: "The Graph Subgraph Queries: A DApp On-Chain Data Indexing Solution"
date: 2023-12-10 12:43:20
tags:
  - Web3
  - Blockchain
  - DApp
readingTime: 9
description: "Directly reading on-chain event logs cannot meet the complex query needs of DApps. The Graph provides decentralized indexing services through Subgraphs, supporting GraphQL queries. This article covers the complete solution from Subgraph definition to frontend integration."
wordCount: 530
---

DApp frontends need to display large amounts of on-chain data: users' transaction history, position changes, protocol statistics, and more. This data is scattered across event logs in countless blocks. Reading it directly via RPC is not only inefficient but also unable to support complex queries (such as pagination, filtering, and aggregation). The Graph protocol solves this problem through its Subgraph indexing mechanism, enabling frontends to efficiently query on-chain data using GraphQL.

## Challenges of DApp Data Indexing

### Limitations of Directly Reading Event Logs

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const contract = new ethers.Contract(address, abi, provider)

// Get all Transfer events
const filter = contract.filters.Transfer(null, userAddress, null)
const events = await contract.queryFilter(filter, 0, 'latest')

// Problem 1: Extremely poor performance — needs to scan all blocks
// Mainnet has 18M+ blocks, each block may contain multiple events
// RPC nodes typically limit the query range (e.g., max 10,000 blocks)

// Problem 2: Cannot perform complex queries
// "Query user's transactions in the last 30 days, sorted by amount, paginated"
// Would require fetching all events and manually sorting/paginating on the frontend

// Problem 3: Cannot perform aggregation queries
// "Calculate protocol's total TVL" requires iterating through all Deposit/Withdraw events

// Problem 4: Poor real-time performance
// Every refresh requires re-querying, no incremental update mechanism
```

### Issues with Self-Built Indexing Services

```typescript
// Build your own indexing service?
// 1. Need to listen to all blocks and events — a node cannot go offline
// 2. Need a database for storage and processing — PostgreSQL? MongoDB?
// 3. Need an API layer — REST? GraphQL?
// 4. Need to handle chain reorganizations — roll back indexed data
// 5. Need to deploy and maintain servers — ongoing costs
// 6. Need to handle multiple chains — one indexer per chain
```

## The Graph Protocol Overview

The Graph is a decentralized indexing protocol that uses the Subgraph mechanism to index on-chain data into queryable GraphQL APIs.

### Architecture Roles

```
┌──────────────┐     Deploy    ┌──────────────┐
│   Developer  │ ──────────→  │   Subgraph   │
│  (Writes Subgraph) │         │  (Index definition) │
└──────────────┘              └──────┬───────┘
                                     │ Index
                              ┌──────▼───────┐
┌──────────────┐     Query     │   Indexer    │
│   DApp Frontend │ ←─────────── │  (Indexer node) │
└──────────────┘              └──────────────┘
       ▲                            ▲
       │                            │
┌──────┴───────┐            ┌──────┴───────┐
│   Curator    │            │   Delegate   │
│ (Curation/Signal) │       │ (Delegated GRT) │
└──────────────┘            └──────────────┘
```

- **Developer**: Writes the Subgraph definition and deploys it to The Graph network
- **Indexer**: Runs indexer nodes, processes on-chain data, and provides query services
- **Curator**: Signals valuable Subgraphs to help Indexers allocate resources
- **Delegator**: Delegates GRT tokens to Indexers to share indexing revenue

## Subgraph Definition

A Subgraph consists of three core files:

### 1. schema.graphql — Data Model

```graphql
# schema.graphql

# User entity
type User @entity {
  id: ID!  # Wallet address
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  currentBalance: BigDecimal!
  deposits: [Deposit!]! @derivedFrom(field: "user")
  withdrawals: [Withdrawal!]! @derivedFrom(field: "user")
}

# Deposit event
type Deposit @entity {
  id: ID!  # Transaction hash + log index
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# Withdrawal event
type Withdrawal @entity {
  id: ID!
  user: User!
  amount: BigDecimal!
  token: String!
  blockTimestamp: BigInt!
  transactionHash: String!
}

# Daily statistics
type DailyStat @entity {
  id: ID!  # Date (YYYY-MM-DD)
  totalDeposited: BigDecimal!
  totalWithdrawn: BigDecimal!
  uniqueUsers: Int!
  depositCount: Int!
  withdrawalCount: Int!
}

# Protocol overview
type ProtocolStat @entity {
  id: ID!  # "protocol"
  totalValueLocked: BigDecimal!
  totalUsers: Int!
  totalDeposits: Int!
  totalWithdrawals: Int!
  updatedAt: BigInt!
}
```

`@entity` indicates that this is a database entity — The Graph creates a table for each entity type. `@derivedFrom` indicates a reverse reference that doesn't require actual storage.

### 2. subgraph.yaml — Manifest File

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

### 3. mapping.ts — Event Handlers

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

// Convert BigInt to BigDecimal (handling 18 decimal places)
function toBigDecimal(amount: BigInt): BigDecimal {
  return amount.toBigDecimal().div(
    BigDecimal.fromString('1000000000000000000')
  )
}

// Get or create day ID
function getDayId(timestamp: BigInt): string {
  const day = timestamp.toI32() / 86400
  return day.toString()
}

// Get or create ProtocolStat
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

// Handle Deposit event
export function handleDeposit(event: DepositEvent): void {
  const userId = event.params.user.toHexString()
  const depositId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  // Get or create User
  let user = User.load(userId)
  if (user === null) {
    user = new User(userId)
    user.totalDeposited = BigDecimal.fromString('0')
    user.totalWithdrawn = BigDecimal.fromString('0')
    user.currentBalance = BigDecimal.fromString('0')

    // Update protocol user count
    const stat = getOrCreateProtocolStat()
    stat.totalUsers += 1
    stat.save()
  }

  const amount = toBigDecimal(event.params.amount)

  // Update User
  user.totalDeposited = user.totalDeposited.plus(amount)
  user.currentBalance = user.currentBalance.plus(amount)
  user.save()

  // Create Deposit entity
  const deposit = new Deposit(depositId)
  deposit.user = user.id
  deposit.amount = amount
  deposit.token = event.params.token.toHexString()
  deposit.blockTimestamp = event.block.timestamp
  deposit.transactionHash = event.transaction.hash.toHexString()
  deposit.save()

  // Update daily statistics
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

  // Update protocol statistics
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.plus(amount)
  stat.totalDeposits += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}

// Handle Withdrawal event
export function handleWithdrawal(event: WithdrawalEvent): void {
  const userId = event.params.user.toHexString()
  const withdrawalId = event.transaction.hash.toHexString() +
    '-' + event.logIndex.toString()

  let user = User.load(userId)
  if (user === null) {
    // User doesn't exist but initiated a withdrawal, possibly a direct contract call
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

  // Update daily statistics
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

  // Update protocol statistics
  const stat = getOrCreateProtocolStat()
  stat.totalValueLocked = stat.totalValueLocked.minus(amount)
  stat.totalWithdrawals += 1
  stat.updatedAt = event.block.timestamp
  stat.save()
}
```

## GraphQL Queries

### Pagination Query

```graphql
# Query user's historical deposits (paginated)
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

### Filtering and Sorting

```graphql
# Query large deposits
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

# Query transactions within a specific time range
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

### Aggregation Query

```graphql
# Query protocol overview
query ProtocolOverview {
  protocolStat(id: "protocol") {
    totalValueLocked
    totalUsers
    totalDeposits
    totalWithdrawals
    updatedAt
  }

  # Daily statistics for the last 7 days
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

# Query complete user information
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

## Frontend Integration

### Using graphql-request

```typescript
// lib/graphClient.ts
import { GraphQLClient } from 'graphql-request'

const SUBGRAPH_URL =
  'https://api.thegraph.com/subgraphs/name/my-org/my-subgraph'

export const graphClient = new GraphQLClient(SUBGRAPH_URL)

// Query type definitions
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

// Query user deposits
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

// Query protocol statistics
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

### Using urql

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
    pause: !userAddress, // Pause query when wallet is not connected
  })

  return {
    deposits: result.data?.deposits || [],
    loading: result.fetching,
    error: result.error,
  }
}
```

### Using Apollo Client

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

// GraphQL documents
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
    pollInterval: 30000, // Poll for updates every 30 seconds
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

## Complete Subgraph Definition and Frontend Query

### Frontend Component

```tsx
// components/Dashboard.tsx
import { useAccount } from 'wagmi'
import { useProtocolStats, useUserActivity } from '../hooks'

export function Dashboard() {
  const { address } = useAccount()
  const { stats, dailyStats, loading: statsLoading } = useProtocolStats()
  const { deposits, loading: depositsLoading } = useUserActivity(address)

  if (statsLoading) return <div>Loading...</div>

  return (
    <div className="dashboard">
      {/* Protocol overview */}
      <section>
        <h2>Protocol Overview</h2>
        <div className="stats-grid">
          <StatCard
            label="TVL"
            value={formatTokenAmount(stats?.totalValueLocked)}
          />
          <StatCard
            label="Total Users"
            value={stats?.totalUsers || 0}
          />
          <StatCard
            label="Total Deposits"
            value={stats?.totalDeposits || 0}
          />
          <StatCard
            label="Total Withdrawals"
            value={stats?.totalWithdrawals || 0}
          />
        </div>
      </section>

      {/* Daily statistics chart */}
      <section>
        <h2>Last 30 Days</h2>
        <DailyChart data={dailyStats} />
      </section>

      {/* User transaction history */}
      {address && (
        <section>
          <h2>My Transactions</h2>
          {depositsLoading ? (
            <div>Loading...</div>
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

## Deploying a Subgraph

### Using Graph CLI

```bash
# Install Graph CLI
npm install -g @graphprotocol/graph-cli

# Authenticate with Graph Explorer
graph auth https://api.thegraph.com/deploy/ $GRAPH_ACCESS_TOKEN

# Code generation (generate TypeScript types)
graph codegen

# Build
graph build

# Deploy to Hosted Service (legacy, being deprecated)
graph deploy --node https://api.thegraph.com/deploy/ \
  --ipfs https://api.thegraph.com/ipfs/ \
  my-org/my-subgraph

# Deploy to decentralized network
graph create --node https://api.thegraph.com/ my-org/my-subgraph
```

### Deployment Configuration

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

## Performance Optimization

### Query Complexity Control

```graphql
# ❌ Bad query: too many entity joins
query BadQuery {
  users(first: 1000) {
    deposits(first: 100) {
      withdrawals(first: 50) {
        amount
      }
    }
  }
}
# Complexity: 1000 * 100 * 50 = 5,000,000
# Exceeds The Graph's complexity limit

# ✅ Good query: step-by-step queries
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

### Index Sync Optimization

```yaml
# Optimize startBlock in subgraph.yaml
dataSources:
  - kind: ethereum
    name: Vault
    source:
      address: "0xVault..."
      startBlock: 15000000  # Contract deployment block, don't start from 0
```

### Frontend Caching Strategy

```typescript
// Using Apollo's caching strategy
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
            // Merge paginated results
            return [...existing, ...incoming]
          },
        },
      },
    },
  },
})

// Request deduplication
const dedupLink = new ApolloLink((operation, forward) => {
  // Avoid duplicate queries within a short time window
  return forward(operation)
})
```

## Comparison with Self-Built Indexing Services

| Dimension | The Graph | Self-Built Indexing |
|------|-----------|---------|
| Development cost | Low (write Subgraph) | High (full-stack implementation) |
| Operational cost | Zero (decentralized network) | Ongoing |
| Query language | GraphQL | Custom |
| Real-time performance | ~1 block delay | Configurable |
| Multi-chain support | Native | Requires deployment per chain |
| Cost | GRT query fees | Server costs |
| Customizability | Limited by Subgraph | Fully flexible |
| Data aggregation | Must pre-compute in mapping | Can use SQL aggregation |
| Chain reorg handling | Automatic | Must implement yourself |

## Summary

The Graph solves the core pain point of DApp frontend data querying by indexing on-chain data into a GraphQL API through the Subgraph mechanism. The Subgraph trio — schema.graphql for defining the data model, subgraph.yaml for declaring data sources and event mappings, and mapping.ts for processing events and updating entities — constitutes a complete indexing pipeline.

Compared to self-built indexing services, The Graph's advantages lie in zero operational cost and built-in chain reorganization handling. The trade-off is limited flexibility: aggregation queries must be pre-computed and stored in the mapping, and cannot be aggregated in real-time like SQL. Complex multi-table joins also need to be split into multi-step queries to control complexity.

On the frontend integration side, GraphQL's type system naturally aligns with TypeScript. Through graphql-codegen, TypeScript types can be automatically generated from the Subgraph's schema, achieving end-to-end type safety. Apollo Client's caching and pagination capabilities handle incremental loading scenarios well.

As The Graph migrates to a fully decentralized network, queries will require paying GRT token fees. This directly impacts DApp business models — data query costs need to be considered in product design. For high-frequency query scenarios, consider building a caching layer (such as Redis) on top of The Graph to reduce direct query pressure on Indexers.
