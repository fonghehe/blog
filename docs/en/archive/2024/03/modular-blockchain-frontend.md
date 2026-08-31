---
title: "Modular Blockchain Frontend: Celestia and EigenLayer Integration"
date: 2024-03-22 19:53:23
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "Exploring changes in frontend data reading under modular blockchain architecture, covering Celestia DA layer interaction, EigenLayer AVS integration, and multi-layer data source management"
wordCount: 631
---

## Modular Blockchain Concepts: DA Layer, Settlement Layer, Execution Layer

Modular blockchains split the functions of traditional monolithic chains into multiple specialized layers:

- **Data Availability Layer (DA Layer)**: Responsible for ensuring transaction data is accessible and verifiable, without caring about execution logic
- **Settlement Layer**: Provides finality guarantees and cross-Rollup settlement
- **Execution Layer**: Handles transaction execution and state transitions
- **Consensus Layer**: Reaches consensus on transaction ordering and finality

Celestia is a pure DA layer that only handles data availability broadcasting and verification. EigenLayer is a restaking protocol based on Ethereum that allows AVS (Actively Validated Services) to reuse Ethereum's security. These two represent two directions of modular blockchains: horizontally splitting functional layers and vertically reusing security layers.

## Frontend Reading from the Celestia Data Availability Layer

Celestia's core innovation is Data Availability Sampling (DAS). Light clients don't need to download complete block data — they only need to randomly sample a small number of data chunks to verify data availability. This is significant for frontend applications — DApps can verify whether on-chain data is available in the browser without trusting full nodes.

Frontend interaction with Celestia is primarily done through Celestia Node's RPC API. Below is the core interaction flow:

```typescript
// Celestia DA layer frontend reading module
import { createPublicClient, http, type Hash } from 'viem'

interface CelestiaClient {
  // Submit blob data to the DA layer
  submitBlob: (namespace: string, data: Uint8Array) => Promise<{ height: number; commitment: Uint8Array }>
  // Get blob by height and commitment
  getBlob: (height: number, namespace: string, commitment: Uint8Array) => Promise<Uint8Array | null>
  // Get DAS proof for a specified height
  getDASProof: (height: number) => Promise<DASProof>
  // Check data availability
  checkAvailability: (height: number) => Promise<boolean>
}

interface DASProof {
  blockHeight: number
  dataRoot: Uint8Array
  sampledShares: { row: number; column: number; data: Uint8Array }[]
  proofs: Uint8Array[]
}

function createCelestiaClient(nodeUrl: string): CelestiaClient {
  async function rpcCall(method: string, params: any[]) {
    const response = await fetch(nodeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params,
      }),
    })
    const json = await response.json()
    if (json.error) throw new Error(json.error.message)
    return json.result
  }

  return {
    async submitBlob(namespace: string, data: Uint8Array) {
      const base64Data = bytesToBase64(data)
      const result = await rpcCall('blob.Submit', [
        {
          namespace: namespaceToBase64(namespace),
          data: base64Data,
        },
      ])
      return {
        height: result.height,
        commitment: base64ToBytes(result.commitment),
      }
    },

    async getBlob(height: number, namespace: string, commitment: Uint8Array) {
      try {
        const result = await rpcCall('blob.Get', [
          height,
          namespaceToBase64(namespace),
          bytesToBase64(commitment),
        ])
        return base64ToBytes(result.data)
      } catch {
        return null
      }
    },

    async getDASProof(height: number) {
      const result = await rpcCall('daser.GetDASProof', [height])
      return {
        blockHeight: result.block_height,
        dataRoot: base64ToBytes(result.data_root),
        sampledShares: result.sampled_shares.map((s: any) => ({
          row: s.row,
          column: s.column,
          data: base64ToBytes(s.data),
        })),
        proofs: result.proofs.map((p: any) => base64ToBytes(p)),
      }
    },

    async checkAvailability(height: number) {
      const result = await rpcCall('daser.CheckAvailability', [height])
      return result.available
    },
  }
}

// Utility functions
function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
}

function base64ToBytes(b64: string): Uint8Array {
  return new Uint8Array(atob(b64).split('').map((c) => c.charCodeAt(0)))
}

function namespaceToBase64(ns: string): string {
  // namespace is a hex string, convert to base64
  const bytes = new Uint8Array(ns.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
  return bytesToBase64(bytes)
}

export { createCelestiaClient }
export type { CelestiaClient, DASProof }
```

## EigenLayer AVS Overview

EigenLayer's core mechanism is restaking. Validators can restake ETH already staked on the Ethereum Beacon Chain onto EigenLayer to provide security for AVS. AVS are independent services — such as data availability layers, oracles, bridge protocols, etc. — that no longer need to build their own validator sets but instead reuse Ethereum's economic security.

For the frontend, EigenLayer interactions mainly involve:

- Querying restakers' staking status and rewards
- AVS registration/deregistration frontend flows
- Slashing event notifications and display

## Impact of Modular Architecture on Frontend Data Reading

In the monolithic chain era, the frontend data reading model was simple: one RPC endpoint handled everything. Under modular architecture, data is scattered across different layers:

```
┌─────────────────────────────────────────┐
│           DApp Frontend                  │
├──────────┬──────────┬───────────────────┤
│  Execution Layer   │  Settlement Layer   │    DA Layer          │
│ (Rollup) │(Ethereum)│  (Celestia)       │
│ RPC #1   │  RPC #2  │   RPC #3          │
└──────────┴──────────┴───────────────────┘
```

The frontend needs to manage multiple data sources, with each layer having different latency and finality guarantees. A typical query flow might be:

1. Query current state from the execution layer
2. Confirm that the state has been finalized from the settlement layer
3. Verify transaction data availability from the DA layer

## Light Clients and Data Availability Sampling

Running a light client in the browser is an important vision of modular blockchains. DAS allows browser-side verification of data availability without trusting any centralized RPC.

```typescript
// Browser-side DAS verification
import { createCelestiaClient, type DASProof } from './celestia-client'

class LightClientDAS {
  private celestia: CelestiaClient
  private sampledHeights = new Map<number, boolean>()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // Verify data availability for a specified block height
  async verifyDataAvailability(height: number): Promise<boolean> {
    // Return cached result if already verified
    if (this.sampledHeights.has(height)) {
      return this.sampledHeights.get(height)!
    }

    // Get DAS proof
    const proof = await this.celestia.getDASProof(height)

    // Verify sampling proof in the browser
    const isValid = this.verifyDASProof(proof)

    this.sampledHeights.set(height, isValid)
    return isValid
  }

  private verifyDASProof(proof: DASProof): boolean {
    // 1. Verify Merkle proofs
    for (let i = 0; i < proof.sampledShares.length; i++) {
      const share = proof.sampledShares[i]
      const merkleProof = proof.proofs[i]
      if (!this.verifyMerkleProof(share.data, merkleProof, proof.dataRoot)) {
        return false
      }
    }

    // 2. Verify that enough samples were collected (typically need > 75% of columns)
    // Celestia uses 2D Reed-Solomon encoding, sampling enough can confirm availability with high probability
    const sampledColumns = new Set(proof.sampledShares.map((s) => s.column))
    const minRequired = Math.ceil(proof.sampledShares.length * 0.75)

    return sampledColumns.size >= minRequired
  }

  private verifyMerkleProof(data: Uint8Array, proof: Uint8Array, root: Uint8Array): boolean {
    // Implement simplified Merkle proof verification
    // In production, use the verification library provided by celestia-node
    const hash = sha256(data)
    let current = hash
    const proofNodes = splitProof(proof)
    for (const node of proofNodes) {
      current = sha256(concatBytes(current, node))
    }
    return bytesEqual(current, root)
  }
}

// Continuously monitor data availability across multiple blocks
async function monitorDataAvailability(
  das: LightClientDAS,
  onVerified: (height: number, available: boolean) => void,
) {
  let latestHeight = await getLatestCelestiaHeight()

  setInterval(async () => {
    const newHeight = await getLatestCelestiaHeight()
    if (newHeight > latestHeight) {
      for (let h = latestHeight + 1; h <= newHeight; h++) {
        const available = await das.verifyDataAvailability(h)
        onVerified(h, available)
      }
      latestHeight = newHeight
    }
  }, 15000) // Celestia block time is approximately 15 seconds
}
```

## Frontend Module for Reading Blob Data from Celestia

Rollups publish transaction data to Celestia's blobs. The frontend needs to read this data to reconstruct state or verify transaction history:

```typescript
// Frontend module for reading Rollup data from Celestia
import { createCelestiaClient } from './celestia-client'

const ROLLUP_NAMESPACE = '00000000000000000000000000000000000000000008e5f679bf7116cb' // Rollup's namespace

interface RollupBatchData {
  batchNumber: number
  transactions: { type: string; from: string; to: string; value: string; data: string }[]
  stateRoot: string
  prevHash: string
}

class RollupDataReader {
  private celestia: CelestiaClient
  private dataRoots: Map<number, Uint8Array> = new Map()

  constructor(nodeUrl: string) {
    this.celestia = createCelestiaClient(nodeUrl)
  }

  // Read Rollup data for a specified batch from Celestia
  async fetchBatch(height: number, commitment: Uint8Array): Promise<RollupBatchData> {
    const blobData = await this.celestia.getBlob(height, ROLLUP_NAMESPACE, commitment)

    if (!blobData) {
      throw new Error(`Blob not found at height ${height}`)
    }

    // Parse blob data
    const batch = this.parseBatch(blobData)

    // Verify data availability
    const isAvailable = await this.celestia.checkAvailability(height)
    if (!isAvailable) {
      throw new Error(`Data not available at height ${height}`)
    }

    return batch
  }

  private parseBatch(data: Uint8Array): RollupBatchData {
    const decoder = new TextDecoder()
    const json = decoder.decode(data)
    const raw = JSON.parse(json)

    return {
      batchNumber: raw.batchNumber,
      transactions: raw.txs.map((tx: any) => ({
        type: tx.type,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        data: tx.data,
      })),
      stateRoot: raw.stateRoot,
      prevHash: raw.prevHash,
    }
  }

  // Listen for new data availability events
  async watchNewBatches(
    onNewBatch: (height: number, commitment: Uint8Array) => void,
  ) {
    // Subscribe to new events via Celestia Node's WebSocket
    const ws = new WebSocket(`wss://celestia-node-rpc/ws`)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'blob.Subscribe',
        params: [ROLLUP_NAMESPACE],
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.method === 'blob.Notification') {
        const { height, commitment } = msg.params.result
        onNewBatch(height, base64ToBytes(commitment))
      }
    }
  }
}

export { RollupDataReader }
export type { RollupBatchData }
```

## Frontend Adaptation: Multi-Layer Data Source Management

Under modular architecture, the frontend needs a unified data source manager to coordinate queries across different layers:

```typescript
interface DataSourceConfig {
  executionRpc: string   // Rollup execution layer RPC
  settlementRpc: string  // Ethereum settlement layer RPC
  daNodeUrl: string      // Celestia DA layer RPC
}

class ModularDataSource {
  private executionClient: PublicClient
  private settlementClient: PublicClient
  private rollupReader: RollupDataReader

  constructor(config: DataSourceConfig) {
    this.executionClient = createPublicClient({
      chain: rollupChain,
      transport: http(config.executionRpc),
    })
    this.settlementClient = createPublicClient({
      chain: mainnet,
      transport: http(config.settlementRpc),
    })
    this.rollupReader = new RollupDataReader(config.daNodeUrl)
  }

  // Query transaction finality: execution layer confirmation -> settlement layer finalization -> DA layer availability
  async getTransactionFinality(txHash: Hash): Promise<{
    executed: boolean
    settled: boolean
    dataAvailable: boolean
    finalized: boolean
  }> {
    // 1. Execution layer query
    const receipt = await this.executionClient.getTransactionReceipt({ hash: txHash })
    if (!receipt) {
      return { executed: false, settled: false, dataAvailable: false, finalized: false }
    }

    // 2. Settlement layer query (check if Rollup has been committed to L1)
    const l1Finalized = await this.checkSettlement(receipt.blockNumber)

    // 3. DA layer query
    const daAvailable = l1Finalized
      ? await this.checkDataAvailability(l1Finalized.daHeight)
      : false

    return {
      executed: true,
      settled: l1Finalized.settled,
      dataAvailable: daAvailable,
      finalized: l1Finalized.settled && daAvailable,
    }
  }

  private async checkSettlement(l2BlockNumber: bigint): Promise<{
    settled: boolean
    daHeight: number
  }> {
    // Query the Rollup bridge contract on L1
    const latestBatch = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'latestBatch',
    })

    // Check if the L2 block is included in the committed batch
    const batchInfo = await this.settlementClient.readContract({
      address: ROLLUP_BRIDGE_ADDRESS,
      abi: bridgeAbi,
      functionName: 'getBatchInfo',
      args: [latestBatch],
    })

    return {
      settled: l2BlockNumber <= batchInfo.endBlock,
      daHeight: Number(batchInfo.daHeight),
    }
  }

  private async checkDataAvailability(daHeight: number): Promise<boolean> {
    return this.rollupReader['celestia'].checkAvailability(daHeight)
  }
}
```

## Differences from Monolithic Chain Frontend Development

| Dimension | Monolithic Chain | Modular Chain |
|------|--------|----------|
| RPC endpoints | Single | Multiple (execution + settlement + DA) |
| Finality | Single confirmation standard | Multi-layer confirmation (execution -> settlement -> DA) |
| Data verification | Trust full nodes | DAS light verification |
| Latency | Uniform | Varies by layer (DA ~15s, L1 ~12m) |
| Frontend complexity | Low | High, requires managing multi-layer data sources |

## EigenLayer Restaking Protocol Frontend Interaction

EigenLayer's frontend interactions primarily revolve around restaking and AVS selection:

```typescript
// EigenLayer restaking frontend module
import { createPublicClient, http, type Address } from 'viem'
import { mainnet } from 'viem/chains'

const EIGENLAYER_DELEGATION_MANAGER = '0x...' as Address

class EigenLayerClient {
  private client: PublicClient

  constructor(rpcUrl: string) {
    this.client = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl),
    })
  }

  // Query user's total restaked ETH
  async getRestakedBalance(user: Address): Promise<{
    activeBalance: bigint
    withdrawableBalance: bigint
    slashingBalance: bigint
  }> {
    const result = await this.client.readContract({
      address: EIGENLAYER_DELEGATION_MANAGER,
      abi: delegationManagerAbi,
      functionName: 'getStaker',
      args: [user],
    })

    return {
      activeBalance: result.activeBalance,
      withdrawableBalance: result.withdrawableBalance,
      slashingBalance: result.slashingBalance,
    }
  }

  // Query AVS list and their status
  async getAVSList(): Promise<AVSInfo[]> {
    // Query from EigenLayer's subgraph
    const query = `
      query {
        avses {
          id
          name
          status
          totalStaked
          operatorCount
          slashingNonce
        }
      }
    `
    const response = await fetch(EIGENLAYER_SUBGRAPH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    const { data } = await response.json()
    return data.avses.map((avs: any) => ({
      address: avs.id,
      name: avs.name,
      status: avs.status,
      totalStaked: BigInt(avs.totalStaked),
      operatorCount: avs.operatorCount,
    }))
  }

  // Delegate restaked ETH to an AVS
  async delegateToAVS(
    user: Address,
    avsAddress: Address,
    amount: bigint,
  ): Promise<Hash> {
    // Frontend constructs delegation transaction
    // Actually needs to be sent via WalletClient
    throw new Error('Implement with WalletClient')
  }

  // Listen for slashing events
  watchSlashingEvents(
    avsAddress: Address,
    onSlash: (operator: Address, amount: bigint, reason: string) => void,
  ) {
    return this.client.watchEvent({
      address: avsAddress,
      eventName: 'Slashing',
      onLogs: (logs) => {
        for (const log of logs) {
          onSlash(log.args.operator, log.args.amount, log.args.reason)
        }
      },
    })
  }
}

interface AVSInfo {
  address: Address
  name: string
  status: string
  totalStaked: bigint
  operatorCount: number
}

export { EigenLayerClient }
export type { AVSInfo }
```

## Summary

Modular blockchains are changing the frontend's data acquisition paradigm. From a single RPC to multi-layer data source management, from trusting full nodes to DAS light verification, the complexity of frontend architecture has indeed increased. But this also brings benefits: DApps can verify rather than trust data, can choose the most cost-effective DA layer, and can combine services from different layers. Celestia makes data availability cheap and verifiable, and EigenLayer allows new services to reuse existing security without building their own. For frontend developers, understanding the layered model of modular architecture is essential — future DApp frontends will inevitably interact with multiple chain layers. Encapsulating a unified data source manager is the current best practice.
