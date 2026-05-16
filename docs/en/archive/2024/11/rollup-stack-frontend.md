---
title: "Rollup Stack Frontend Adaptation: OP Stack and ZK Stack"
date: 2024-11-25 12:42:17
tags:
  - Web3
  - Blockchain
readingTime: 12
description: "Comparing the architectural differences between OP Stack and ZK Stack, with a deep dive into cross-chain interactions, message passing, withdrawal flows, and confirmation time adaptation in multi-Rollup environments"
wordCount: 3800
---

## OP Stack Architecture: Optimism's Modular Rollup Framework

OP Stack is an open-source Rollup framework developed by Optimism. Its core philosophy is to modularize the components of a Rollup so that anyone can build their own Rollup based on OP Stack. The OP Stack technical architecture is divided into the following layers:

- **Data Availability Layer**: Uses Ethereum L1 as the DA layer, with transaction data published to L1 calldata or blobs (EIP-4844)
- **Sequencing Layer**: A single sequencer orders transactions and produces L2 blocks
- **Derivation Layer**: Rules for deriving L2 state from L1 data
- **Execution Layer**: Uses EVM to execute transactions
- **Settlement Layer**: Relies on Ethereum L1's fault proofs for security

OP Stack's Optimistic model assumes transactions are valid, with a 7-day challenge period. If someone submits a fraud proof during the challenge period, invalid transactions are rolled back.

## ZK Stack Architecture: zkSync's Modular ZK Framework

ZK Stack is a modular ZK Rollup framework developed by Matter Labs. Unlike OP Stack's Optimistic model, ZK Stack uses zero-knowledge proofs to guarantee the validity of state transitions:

- **Execution Layer**: zkEVM, compatible with EVM but every opcode has zk circuit constraints
- **Proving Layer**: Generates ZK proofs that prove the correctness of L2 state transitions
- **Verification Layer**: A verification contract on L1 verifies ZK proofs
- **Data Availability**: Transaction data is published to L1

The key advantage of ZK Stack is faster finality — once a ZK proof is verified on L1, the state is finalized, without needing a 7-day challenge period. However, proof generation requires additional time and computational cost.

## Frontend Cross-Chain Interaction: L1 <-> L2 Message Passing

Whether it's OP Stack or ZK Stack, message passing between L1 and L2 is implemented through special bridge contracts. The frontend needs to understand the message passing lifecycle:

```
L1 -> L2 Message:
┌─────────┐    depositTX     ┌──────────┐
│ L1 User  │ ──────────────▶ │ L2 Entry  │
└─────────┘                  └──────────┘
     3-5 minute delay (waiting for sequencer to process)

L2 -> L1 Message (Withdrawal):
┌─────────┐  initiateWithdraw  ┌────────────┐  Wait for challenge period  ┌──────────┐
│ L2 User  │ ────────────────▶ │ L1 Bridge Contract │ ──────────▶ │ L1 User   │
└─────────┘                    └────────────┘              └──────────┘
   OP Stack: 7-day delay
   ZK Stack: ~1 hour after proof generation
```

## OP Stack Withdrawal Frontend Flow

OP Stack withdrawals require two steps: initiate withdrawal on L2 -> claim on L1. Below is the complete frontend flow:

```typescript
import { createPublicClient, createWalletClient, http, type Address, type Hash } from 'viem'
import { mainnet, optimism } from 'viem/chains'
import { writeContract, readContract } from 'viem/actions'

const L2_TO_L1_MESSENGER = '0x4200000000000000000000000000000000000007' as Address
const L1_STANDARD_BRIDGE = '0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1' as Address

class OPStackBridge {
  private l1Client: PublicClient
  private l2Client: PublicClient
  private l1Wallet: WalletClient | null = null

  constructor(l1Rpc: string, l2Rpc: string) {
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
    this.l2Client = createPublicClient({
      chain: optimism,
      transport: http(l2Rpc),
    })
  }

  // Step 1: Initiate withdrawal on L2
  async initiateWithdrawal(
    l2WalletClient: WalletClient,
    to: Address,
    amount: bigint,
    minGasLimit: bigint = 200000n,
    extraData: `0x${string}` = '0x',
  ): Promise<Hash> {
    const l2TxHash = await l2WalletClient.writeContract({
      address: L2_TO_L1_MESSENGER,
      abi: l2CrossDomainMessengerAbi,
      functionName: 'sendMessage',
      args: [to, amount, minGasLimit, extraData],
    })

    // Wait for L2 transaction confirmation
    const receipt = await this.l2Client.waitForTransactionReceipt({ hash: l2TxHash })

    // Parse WithdrawalInitiated event
    const logs = parseWithdrawalLogs(receipt.logs)
    return l2TxHash
  }

  // Step 2: Check if withdrawal can be claimed on L1
  async checkWithdrawalReadiness(l2TxHash: Hash): Promise<{
    status: 'pending' | 'ready' | 'claimed'
    proof: { outputRootProof: `0x${string}` | null; withdrawalProof: `0x${string}`[] | null }
    l2OutputIndex: bigint | null
    challengeWindowEnds: number | null
  }> {
    // Query the L2OutputOracle contract on L1
    const latestOutputIndex = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'latestOutputIndex',
    })

    // Find the L2 output index corresponding to this withdrawal
    const { withdrawalHash, l2BlockNumber } = await this.getWithdrawalInfo(l2TxHash)
    const l2OutputIndex = await this.findOutputIndex(l2BlockNumber)

    if (l2OutputIndex === null || l2OutputIndex > latestOutputIndex) {
      return {
        status: 'pending',
        proof: { outputRootProof: null, withdrawalProof: null },
        l2OutputIndex,
        challengeWindowEnds: null,
      }
    }

    // Check if the challenge window has passed
    const output = await this.l1Client.readContract({
      address: L2_OUTPUT_ORACLE,
      abi: outputOracleAbi,
      functionName: 'getL2Output',
      args: [l2OutputIndex],
    })

    const finalizationTime = Number(output.timestamp) + 604800 // 7 days
    if (Date.now() / 1000 < finalizationTime) {
      return {
        status: 'pending',
        proof: { outputRootProof: null, withdrawalProof: null },
        l2OutputIndex,
        challengeWindowEnds: finalizationTime,
      }
    }

    // Get Merkle proof
    const proof = await this.getWithdrawalProof(l2TxHash, l2OutputIndex)

    // Check if already claimed
    const isClaimed = await this.l1Client.readContract({
      address: L1_STANDARD_BRIDGE,
      abi: bridgeAbi,
      functionName: 'isWithdrawalClaimed',
      args: [withdrawalHash],
    })

    return {
      status: isClaimed ? 'claimed' : 'ready',
      proof,
      l2OutputIndex,
      challengeWindowEnds: finalizationTime,
    }
  }

  // Step 3: Claim withdrawal on L1
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const readiness = await this.checkWithdrawalReadiness(l2TxHash)

    if (readiness.status !== 'ready') {
      throw new Error(`Withdrawal not ready: ${readiness.status}`)
    }

    const { withdrawal } = await this.getWithdrawalMessage(l2TxHash)

    return l1WalletClient.writeContract({
      address: L2_TO_L1_MESSENGER,
      abi: l2CrossDomainMessengerAbi,
      functionName: 'relayMessage',
      args: [
        withdrawal.nonce,
        withdrawal.sender,
        withdrawal.target,
        withdrawal.value,
        withdrawal.minGasLimit,
        withdrawal.data,
        proof.outputRootProof!,
        proof.withdrawalProof!,
      ],
    })
  }

  // Helper methods
  private async getWithdrawalInfo(l2TxHash: Hash) {
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    // Parse logs to get withdrawal info
    return { withdrawalHash: '0x...', l2BlockNumber: receipt.blockNumber }
  }

  private async findOutputIndex(l2BlockNumber: bigint): Promise<bigint | null> {
    // Iterate L2OutputOracle to find the output containing this block
    return null // Simplified
  }

  private async getWithdrawalProof(l2TxHash: Hash, outputIndex: bigint) {
    // Get Merkle proof from L2 node
    return { outputRootProof: '0x...' as `0x${string}`, withdrawalProof: [] as `0x${string}`[] }
  }

  private async getWithdrawalMessage(l2TxHash: Hash) {
    return { withdrawal: { nonce: 0n, sender: '0x', target: '0x', value: 0n, minGasLimit: 0n, data: '0x' } }
  }
}
```

## ZK Stack Proof Verification Frontend Adaptation

ZK Stack's withdrawal flow is different. It doesn't rely on fraud proofs — instead, it waits for ZK proofs to be verified on L1:

```typescript
class ZKStackBridge {
  private l1Client: PublicClient
  private l2Client: PublicClient

  constructor(l1Rpc: string, l2Rpc: string) {
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
    this.l2Client = createPublicClient({
      chain: zksync,
      transport: http(l2Rpc),
    })
  }

  // Initiate L2 -> L1 withdrawal
  async initiateWithdrawal(
    l2WalletClient: WalletClient,
    to: Address,
    amount: bigint,
  ): Promise<Hash> {
    return l2WalletClient.writeContract({
      address: ZK_L2_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'withdraw',
      args: [to, amount],
    })
  }

  // Check withdrawal status
  async getWithdrawalStatus(l2TxHash: Hash): Promise<{
    status: 'pending' | 'proven' | 'verified' | 'claimed'
    l1BatchNumber: bigint | null
    proofTxHash: Hash | null
  }> {
    // Query L2's withdrawal logs
    const receipt = await this.l2Client.getTransactionReceipt({ hash: l2TxHash })
    const withdrawalLog = receipt.logs.find((log) =>
      log.address.toLowerCase() === ZK_L2_BRIDGE.toLowerCase(),
    )

    if (!withdrawalLog) throw new Error('Withdrawal log not found')

    const { l1BatchNumber, l2MessageIndex } = decodeWithdrawalLog(withdrawalLog)

    // Check proof status on L1
    const isVerified = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalVerified',
      args: [l1BatchNumber, l2MessageIndex],
    })

    if (!isVerified) {
      // Check if proof is being generated
      const proofStatus = await this.checkProofStatus(l1BatchNumber)
      return {
        status: proofStatus === 'proven' ? 'proven' : 'pending',
        l1BatchNumber,
        proofTxHash: null,
      }
    }

    // Check if already claimed
    const isClaimed = await this.l1Client.readContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'isWithdrawalClaimed',
      args: [l1BatchNumber, l2MessageIndex],
    })

    return {
      status: isClaimed ? 'claimed' : 'verified',
      l1BatchNumber,
      proofTxHash: null,
    }
  }

  // Claim on L1 (requires proof verification first)
  async claimWithdrawal(
    l1WalletClient: WalletClient,
    l2TxHash: Hash,
  ): Promise<Hash> {
    const status = await this.getWithdrawalStatus(l2TxHash)

    if (status.status === 'pending') {
      // Need to submit proof first
      await this.submitProof(l1WalletClient, l2TxHash)
    }

    // Finalize withdrawal
    return l1WalletClient.writeContract({
      address: ZK_L1_BRIDGE,
      abi: zkBridgeAbi,
      functionName: 'finalizeWithdrawal',
      args: [status.l1BatchNumber!, /* message index */ 0n, /* proof data */ '0x'],
    })
  }

  private async checkProofStatus(batchNumber: bigint): Promise<string> {
    return 'pending'
  }

  private async submitProof(walletClient: WalletClient, l2TxHash: Hash): Promise<void> {
    // Submit proof via L1 verifier
  }
}
```

## Multi-Rollup Network Manager

In the Superchain era, DApps may be deployed on multiple Rollups simultaneously. Below is a multi-Rollup network manager:

```typescript
import { createPublicClient, http, type Chain, type Address } from 'viem'
import { mainnet, optimism, base, arbitrum } from 'viem/chains'

interface RollupConfig {
  chain: Chain
  rpcUrl: string
  stackType: 'op' | 'zk' | 'arbitrum'
  l1BridgeAddress: Address
  l2BridgeAddress: Address
  confirmationBlocks: number
  withdrawalDelay: number // seconds
}

class MultiRollupManager {
  private rollups: Map<number, { config: RollupConfig; client: PublicClient }>
  private l1Client: PublicClient

  constructor(l1Rpc: string) {
    this.rollups = new Map()
    this.l1Client = createPublicClient({
      chain: mainnet,
      transport: http(l1Rpc),
    })
  }

  registerRollup(config: RollupConfig) {
    const client = createPublicClient({
      chain: config.chain,
      transport: http(config.rpcUrl),
    })
    this.rollups.set(config.chain.id, { config, client })
  }

  // Get status of all Rollups
  async getAllRollupStatus(): Promise<{
    chainId: number
    chainName: string
    blockNumber: bigint
    finalizedBlock: bigint
    stackType: string
  }[]> {
    const statuses = await Promise.all(
      Array.from(this.rollups.entries()).map(async ([chainId, { config, client }]) => {
        const [blockNumber, finalizedBlock] = await Promise.all([
          client.getBlockNumber(),
          client.getBlock({ blockTag: 'finalized' }).then((b) => b.number),
        ])
        return {
          chainId,
          chainName: config.chain.name,
          blockNumber,
          finalizedBlock,
          stackType: config.stackType,
        }
      }),
    )
    return statuses
  }

  // Cross-chain asset transfer
  async bridgeAsset(
    fromChainId: number,
    toChainId: number,
    amount: bigint,
    token: Address,
    recipient: Address,
    walletClient: WalletClient,
  ): Promise<Hash> {
    const source = this.rollups.get(fromChainId)
    if (!source) throw new Error(`Chain ${fromChainId} not registered`)

    // Check if target chain is registered
    const target = this.rollups.get(toChainId)
    if (!target) throw new Error(`Chain ${toChainId} not registered`)

    // Choose bridging method based on source chain's stack type
    switch (source.config.stackType) {
      case 'op':
        return this.bridgeViaOPStack(walletClient, source, target, amount, token, recipient)
      case 'zk':
        return this.bridgeViaZKStack(walletClient, source, target, amount, token, recipient)
      default:
        return this.bridgeViaL1(walletClient, source, target, amount, token, recipient)
    }
  }

  private async bridgeViaOPStack(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    // For L2 -> L2 (via L1 relay), first withdraw to L1 then deposit to target L2
    // For L1 -> L2, direct deposit
    throw new Error('Not implemented')
  }

  private async bridgeViaZKStack(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    throw new Error('Not implemented')
  }

  private async bridgeViaL1(
    walletClient: WalletClient,
    source: { config: RollupConfig; client: PublicClient },
    target: { config: RollupConfig; client: PublicClient },
    amount: bigint,
    token: Address,
    recipient: Address,
  ): Promise<Hash> {
    throw new Error('Not implemented')
  }
}

// Usage example
const manager = new MultiRollupManager('https://eth.llamarpc.com')
manager.registerRollup({
  chain: optimism,
  rpcUrl: 'https://mainnet.optimism.io',
  stackType: 'op',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  confirmationBlocks: 1,
  withdrawalDelay: 604800, // 7 days
})
manager.registerRollup({
  chain: base,
  rpcUrl: 'https://mainnet.base.org',
  stackType: 'op',
  l1BridgeAddress: '0x...',
  l2BridgeAddress: '0x...',
  confirmationBlocks: 1,
  withdrawalDelay: 604800,
})
```

## Superchain Concept and Frontend Cross-Chain UX

Superchain is a collection of OP Stack chains that share L1 security and bridging infrastructure. Within the Superchain, message passing between chains is native and doesn't need to go through L1 relay.

In terms of frontend UX, cross-chain within the Superchain should be transparent to the user. The ideal experience is: the user clicks "Transfer to Optimism" on Base, and the assets arrive a few seconds later — no need to switch networks or sign multiple times.

Achieving this experience requires backend relayer support. The frontend only needs to initiate the L2 transaction and poll the target chain for arrival status.

## Frontend Adaptation: Confirmation Time Differences Across Rollups

Block times and finality differ significantly across Rollups, and the frontend must adapt:

| Rollup | Block Time | Safe Confirmations | Finality |
|--------|---------|-----------|--------|
| Ethereum L1 | ~12s | 12-64 blocks | ~6.4 minutes (1 epoch) |
| Optimism | ~2s | 1 block (soft) | 7 days (hard) |
| Base | ~2s | 1 block (soft) | 7 days (hard) |
| Arbitrum | ~250ms | 1 block (soft) | 7 days (hard) |
| zkSync Era | ~2s | 1 block (soft) | After proof verification |

```typescript
interface ConfirmationConfig {
  softConfirmations: number  // Blocks needed for the frontend to show "confirmed"
  hardFinalityTime: number   // Time needed for true finalization (seconds)
  label: string              // Confirmation level shown to the user
}

function getConfirmationConfig(chainId: number): ConfirmationConfig {
  switch (chainId) {
    case 1: // Ethereum
      return { softConfirmations: 12, hardFinalityTime: 384, label: 'Block confirmations' }
    case 10: // Optimism
      return { softConfirmations: 1, hardFinalityTime: 604800, label: 'Fast confirmation (7 days to finalize)' }
    case 8453: // Base
      return { softConfirmations: 1, hardFinalityTime: 604800, label: 'Fast confirmation (7 days to finalize)' }
    case 42161: // Arbitrum
      return { softConfirmations: 1, hardFinalityTime: 604800, label: 'Instant confirmation (7 days to finalize)' }
    case 324: // zkSync Era
      return { softConfirmations: 1, hardFinalityTime: 3600, label: 'Fast confirmation (finalized after proof verification)' }
    default:
      return { softConfirmations: 12, hardFinalityTime: 384, label: 'Block confirmations' }
  }
}

// Frontend transaction confirmation tracker
async function trackTransaction(
  chainId: number,
  txHash: Hash,
  publicClient: PublicClient,
  onStatusChange: (status: string, confirmations: number) => void,
) {
  const config = getConfirmationConfig(chainId)

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

  if (receipt.status === 'reverted') {
    onStatusChange('failed', 0)
    return
  }

  onStatusChange('confirmed', 0)

  // Track confirmation count
  let currentBlock = await publicClient.getBlockNumber()
  while (currentBlock - receipt.blockNumber < config.softConfirmations) {
    onStatusChange('confirming', Number(currentBlock - receipt.blockNumber))
    await new Promise((r) => setTimeout(r, 2000))
    currentBlock = await publicClient.getBlockNumber()
  }

  onStatusChange('finalized', config.softConfirmations)
}
```

## Contract Deployment Differences: OP Stack vs ZK Stack

OP Stack uses standard EVM, so Solidity contracts can be deployed directly. ZK Stack uses zkEVM — while most opcodes are compatible, some precompiled contracts and opcodes have differences:

```typescript
// Deployment script differences
async function deployContract(
  stackType: 'op' | 'zk',
  walletClient: WalletClient,
  bytecode: `0x${string}`,
  abi: Abi,
  args: unknown[],
) {
  if (stackType === 'op') {
    // OP Stack: standard EVM deployment
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  } else {
    // ZK Stack: need to check contract compatibility
    // 1. Ensure no unsupported opcodes are used
    // 2. For complex contracts, may need to recompile with zkSync's compiler
    // 3. Use zksync-specific deployment method
    const hash = await walletClient.deployContract({ abi, bytecode, args })
    return hash
  }
}
```

## Summary

OP Stack and ZK Stack represent two technical approaches to Rollups: Optimistic and ZK. For frontend developers, the core differences lie in withdrawal flows and confirmation times — OP Stack's 7-day challenge period vs ZK Stack's proof verification. In multi-Rollup environments, the frontend needs a unified network manager to handle cross-chain interactions, multiple confirmation standards, and different bridging protocols. Superchain's vision is to make cross-chain seamless, but this requires the coordination of backend relayers and frontend state tracking. The rise of Rollup as a Service (RaaS) means there will be more Rollup chains in the future, and frontend adaptability will become a key challenge. Understanding the architectural differences and adaptation strategies of different Stacks is the foundation for building cross-Rollup DApps.
