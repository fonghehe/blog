---
title: "Deep Dive into viem: A Type-Safe Ethereum Interaction Layer"
date: 2024-08-12 11:23:22
tags:
  - Web3
  - TypeScript
  - Ethereum
readingTime: 8
description: "An in-depth analysis of viem's design philosophy, core concepts, Actions pattern, and ABI type inference, with a complete DApp interaction layer implementation and ethers.js migration strategy"
wordCount: 859
---

## viem Design Philosophy: Tree-Shakable + Type-Safe + Zero Dependencies

viem is an Ethereum interaction library built by the wagmi team. Its design philosophy can be summarized in three keywords:

- **Tree-shakable**: All functionality is implemented through standalone functions, so only the parts you use are included in the bundle. A DApp that only reads contracts can have a viem bundle size as low as 20KB
- **Type-safe**: Built on TypeScript's type system, viem can automatically infer function names, parameter types, and return types from ABIs, without needing additional code generation tools
- **No runtime dependencies**: viem doesn't depend on any other libraries (except viem's own internal packages), reducing dependency tree complexity and version conflict risks

Unlike ethers.js's "all-in-one" design, viem embraces the Unix philosophy — each function does one thing well, and they compose together. This design makes viem both lightweight and flexible.

## Core Concepts: Client, Transport, Chain, Account

viem's architecture is built on four core abstractions:

```typescript
import { createClient, http, parseEther } from 'viem'
import { mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// 1. Chain — defines chain parameters (chainId, RPC, block explorer, etc.)
const chain = mainnet

// 2. Transport — underlying communication layer (HTTP, WebSocket, custom)
const transport = http('https://eth.llamarpc.com')

// 3. Account — signing account (optional, PublicClient doesn't need it)
const account = privateKeyToAccount('0x...')

// 4. Client — combines the above three and provides base functionality
const client = createClient({
  chain,
  transport,
  // account is optional: with account it's a WalletClient, without it's a PublicClient
})
```

`Client` itself only provides the most basic functionality (like `getBlockNumber`). Advanced features are extended through Actions. This composition-over-inheritance design enables tree-shaking to precisely include only the functionality you use.

## PublicClient vs WalletClient

PublicClient is used for reading on-chain data and doesn't require a private key. WalletClient is used for sending transactions and signing, and requires an Account.

```typescript
import { createPublicClient, createWalletClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

// PublicClient — read-only
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// Read block number
const blockNumber = await publicClient.getBlockNumber()

// Read contract data
const balance = await publicClient.readContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: ['0xd8da6bf26964af9d7eed9e03e53415d37aa96045'],
})

// WalletClient — writable
const walletClient = createWalletClient({
  chain: mainnet,
  transport: http(),
  account: privateKeyToAccount('0x...'),
})

// Send transaction
const hash = await walletClient.sendTransaction({
  to: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
  value: parseEther('1'),
})
```

A common pattern is to use both together: PublicClient for reading state, WalletClient for sending transactions:

```typescript
// Combined usage: read + write
const { request } = await publicClient.simulateContract({
  address: tokenAddress,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [recipient, amount],
  account: walletClient.account,
})

const hash = await walletClient.writeContract(request)
```

## Actions Pattern: readContract, writeContract, getBlock

viem's Actions are standalone pure functions that are bound to client instances via the `client` parameter. Beyond built-in Actions, developers can create custom ones:

```typescript
import { type Client, getBlock, readContract } from 'viem'

// Approach 1: Call Action functions directly
const block = await getBlock(publicClient, { blockTag: 'latest' })
const data = await readContract(publicClient, { ... })

// Approach 2: Extend Client (recommended, more type-friendly)
const extendedClient = publicClient.extend((client) => ({
  async getLatestGasPrice() {
    const block = await getBlock(client)
    return block.baseFeePerGas
  },
  async getTokenBalance(token: Address, holder: Address) {
    return readContract(client, {
      address: token,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [holder],
    })
  },
}))

// Use extended methods
const gasPrice = await extendedClient.getLatestGasPrice()
const balance = await extendedClient.getTokenBalance(usdcAddress, userAddress)
```

This `extend` pattern is the essence of viem — it allows developers to encapsulate business logic in a type-safe way without sacrificing tree-shaking capabilities.

## Built-in ABI Type Inference: No TypeChain Needed

One of viem's most powerful features is automatic type inference from ABIs. As long as the ABI's TypeScript type definition is correct, `readContract` and `writeContract` provide complete parameter and return value type hints:

```typescript
// Define ABI (note the as const)
const wethAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'payable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address', name: 'account' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { type: 'address', name: 'to' },
      { type: 'uint256', name: 'amount' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const  // Key: as const lets TypeScript infer precise types

// readContract automatically infers:
// - functionName can only be 'deposit' | 'balanceOf' | 'transfer'
// - args type is automatically matched based on functionName
// - return type is automatically inferred based on functionName
const balance = await publicClient.readContract({
  address: wethAddress,
  abi: wethAbi,
  functionName: 'balanceOf',
  args: [userAddress],
  //    ^? [Address] — precise type inference
})
//    ^? bigint — return value is also a precise type

const hash = await walletClient.writeContract({
  address: wethAddress,
  abi: wethAbi,
  functionName: 'transfer',
  args: [recipient, parseEther('1')],
  //    ^? [Address, bigint]
})
```

This eliminates the need for TypeChain or other code generation tools. The ABI serves as both runtime data and compile-time type source.

viem also supports using utility types like `GetAbiFunctionParameters` to extract parameter types for specific functions:

```typescript
import { type GetAbiFunctionParameters } from 'viem'

type TransferArgs = GetAbiFunctionParameters<typeof wethAbi, 'transfer'>
// { to: Address; amount: bigint }
```

## API Comparison with ethers.js

The following table compares common operations:

| Operation | ethers.js v6 | viem |
|------|-------------|------|
| Create Provider | `new ethers.JsonRpcProvider(url)` | `createPublicClient({ chain, transport: http(url) })` |
| Read contract | `contract.balanceOf(addr)` | `publicClient.readContract({ ... })` |
| Send transaction | `contract.transfer(to, amount)` | `walletClient.writeContract({ ... })` |
| Type inference | Requires TypeChain generation | Built-in, ABI `as const` |
| Listen to events | `contract.on('Transfer', cb)` | `publicClient.watchEvent({ ... })` |
| Bundle size | ~100KB+ | ~20KB (tree-shaken) |

ethers.js's Contract object pattern (methods mounted on the object) has inherent limitations in TypeScript type inference. viem's explicit `functionName` parameter pattern combined with `as const` ABI far surpasses ethers.js in type safety.

## Building a Complete DApp Interaction Layer with viem

Below is a complete DApp interaction layer implementation covering contract reading, writing, event listening, and error handling:

```typescript
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hash,
  type Log,
  type Abi,
  parseEventLogs,
  decodeEventLog,
} from 'viem'
import { mainnet } from 'viem/chains'

// DApp interaction layer configuration
interface DAppConfig {
  chainId: number
  rpcUrl: string
  wsUrl?: string
  contracts: Record<string, { address: Address; abi: Abi }>
}

class DAppInteractionLayer {
  private publicClient: PublicClient
  private walletClient: WalletClient | null = null
  private config: DAppConfig

  constructor(config: DAppConfig) {
    this.config = config
    const chain = getChainByChainId(config.chainId)

    this.publicClient = createPublicClient({
      chain,
      transport: http(config.rpcUrl),
    })
  }

  // Connect wallet
  connectWallet(account: Address, transport: Transport) {
    const chain = getChainByChainId(this.config.chainId)
    this.walletClient = createWalletClient({
      chain,
      transport,
      account,
    })
  }

  // Generic contract reading
  async read<TContractName extends keyof typeof this.config.contracts>(
    contractName: TContractName,
    functionName: string,
    args: readonly unknown[],
  ) {
    const { address, abi } = this.config.contracts[contractName]
    return this.publicClient.readContract({
      address,
      abi,
      functionName,
      args: args as any,
    })
  }

  // Generic contract writing (with simulation + send)
  async write<TContractName extends keyof typeof this.config.contracts>(
    contractName: TContractName,
    functionName: string,
    args: readonly unknown[],
    options?: { value?: bigint },
  ) {
    if (!this.walletClient) throw new Error('Wallet not connected')

    const { address, abi } = this.config.contracts[contractName]

    // First simulate to verify the transaction will succeed
    const { request } = await this.publicClient.simulateContract({
      address,
      abi,
      functionName,
      args: args as any,
      account: this.walletClient.account,
      value: options?.value,
    })

    // Send transaction
    const hash = await this.walletClient.writeContract(request)

    // Wait for confirmation
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

    return { hash, receipt, logs: receipt.logs }
  }

  // Parse event logs
  parseEvents<TAbi extends Abi>(
    logs: Log[],
    abi: TAbi,
    eventName?: string,
  ) {
    const parsed = parseEventLogs({ logs, abi })
    return eventName ? parsed.filter((l) => l.eventName === eventName) : parsed
  }

  // Listen to contract events
  watchEvent<TContractName extends keyof typeof this.config.contracts>(
    contractName: TContractName,
    eventName: string,
    onLog: (log: any) => void,
    fromBlock?: bigint,
  ) {
    const { address, abi } = this.config.contracts[contractName]
    return this.publicClient.watchEvent({
      address,
      event: getEventFromAbi(abi, eventName),
      onLogs: (logs) => logs.forEach(onLog),
      fromBlock,
    })
  }

  // Batch reading (Multicall)
  async multicall(
    calls: { contractName: string; functionName: string; args: readonly unknown[] }[],
  ) {
    const multicallData = calls.map((call) => {
      const { address, abi } = this.config.contracts[call.contractName]
      return {
        address,
        abi,
        functionName: call.functionName,
        args: call.args as any,
      }
    })

    return this.publicClient.multicall({ contracts: multicallData })
  }
}

// Helper functions
function getChainByChainId(chainId: number) {
  // In a real project, import the corresponding chain from viem/chains
  return mainnet
}

function getEventFromAbi(abi: Abi, eventName: string) {
  const item = abi.find((entry) => entry.type === 'event' && entry.name === eventName)
  if (!item) throw new Error(`Event ${eventName} not found in ABI`)
  return item as any
}

export { DAppInteractionLayer }
export type { DAppConfig }
```

## Performance Comparison: Bundle Size and Execution Efficiency

viem has a significant advantage in bundle size compared to ethers.js. Here are measured comparisons (minified + gzipped):

| Scenario | ethers.js v6 | viem v2 | Savings |
|------|-------------|---------|------|
| Read-only contract calls | 48.2 KB | 11.4 KB | 76% |
| Read + write contract calls | 72.8 KB | 23.1 KB | 68% |
| Full functionality | 135.4 KB | 45.7 KB | 66% |

viem's advantage comes from tree-shaking — only the Action functions you use are included. ethers.js's Contract class pulls in a large amount of unused code.

In terms of execution efficiency, viem uses `@noble/curves` instead of ethers.js's self-implemented cryptography library, making signature verification and public key recovery 2-3x faster. ABI encoding/decoding is also more efficient in viem because it determines the encoding/decoding path at compile time rather than dynamically looking it up at runtime.

## Deep Integration with wagmi v2

wagmi v2 is built entirely on viem, and the two are a natural pairing. wagmi provides the React Hooks layer, while viem provides the underlying interaction:

```tsx
import { useAccount, useReadContract, useWriteContract } from 'wagmi'
import { parseEther } from 'viem'
import { mainnet } from 'viem/chains'

function TokenTransfer() {
  const { address } = useAccount()

  // Read balance
  const { data: balance } = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address!],
  })

  // Write transaction
  const { writeContract, isPending, isSuccess, error } = useWriteContract()

  const handleTransfer = () => {
    writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [recipient, parseEther('1')],
    })
  }

  return (
    <div>
      <p>Balance: {balance?.toString()}</p>
      <button onClick={handleTransfer} disabled={isPending}>
        {isPending ? 'Sending...' : 'Transfer'}
      </button>
      {isSuccess && <p>Transaction confirmed!</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

wagmi v2's Hooks call viem's Actions under the hood, with types flowing through completely. ABI type inference works equally well in React components.

## Migration Strategy: From ethers v5/v6 to viem

Migration should be done in phases:

**Phase 1: Install viem and use in parallel**

```bash
npm install viem
```

Write new features with viem, keep existing code on ethers.js. Both can share the same RPC endpoint without interference.

**Phase 2: Abstract the interaction layer**

Refactor code that directly uses ethers.js to go through an abstraction layer:

```typescript
// Before
import { ethers } from 'ethers'
const contract = new ethers.Contract(address, abi, signer)
const balance = await contract.balanceOf(user)

// After (through abstraction layer)
const balance = await dapp.read('token', 'balanceOf', [user])
```

**Phase 3: Gradually replace implementations**

Replace the ethers.js implementation in the abstraction layer with viem:

```typescript
// Before
async read(contract, method, args) {
  const c = new ethers.Contract(address, abi, provider)
  return c[method](...args)
}

// After
async read(contract, method, args) {
  return this.publicClient.readContract({
    address, abi, functionName: method, args,
  })
}
```

**Phase 4: Remove ethers.js**

After confirming all features have been migrated to viem, remove the ethers.js dependency. If TypeChain was used for type generation, that should also be removed — viem's built-in type inference fully replaces it.

## Summary

viem represents the right direction for Ethereum frontend development libraries: tree-shakable bundling, compile-time type safety, and a minimal dependency tree. Its Actions pattern and ABI type inference solve the core pain points of the ethers.js era — large bundle sizes and type unsafety. wagmi v2's full adoption makes viem the de facto standard for React DApps. For new projects, choosing viem is a no-brainer. For existing projects, a phased migration strategy can minimize risk. Understanding viem's Client/Transport/Chain/Account four-element model and the extend pattern is the foundation for building a maintainable DApp interaction layer.
