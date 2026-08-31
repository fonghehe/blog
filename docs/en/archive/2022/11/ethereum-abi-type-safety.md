---
title: "Ethereum ABI Type Safety: From TypeChain to viem"
date: 2022-11-05 18:56:55
tags:
  - Web3
  - TypeScript
  - Ethereum
readingTime: 7
description: "Manually maintaining type definitions for contract calls is a common pain point in Web3 frontend development. This article traces the evolution from TypeChain to viem's built-in type inference, showing how to achieve compile-time ABI type checking."
wordCount: 631
---

In Ethereum DApp development, the frontend interacts with smart contracts through the ABI (Application Binary Interface). The ABI defines the contract's function signatures, event structures, and parameter types. However, when directly using ABI JSON with ethers.js or web3.js, type safety is virtually nonexistent—misspelled function names, mismatched parameter types, and incorrect parameter ordering only surface at runtime. This article traces the complete evolution from manual type definitions to TypeChain to viem's built-in type inference.

## ABI JSON Structure

The ABI is a JSON array where each element describes a contract interface (function, event, error, etc.):

```json
[
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      { "name": "from", "type": "address", "indexed": true },
      { "name": "to", "type": "address", "indexed": true },
      { "name": "value", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  }
]
```

The `type` field in the ABI uses Solidity's type system: `uint256`, `address`, `bytes32`, `string`, `bool`, as well as composite types `tuple` (corresponding to struct) and arrays `uint256[]`.

## Pain Points of Manual Type Definitions

Without code generation, developers need to manually write types:

```typescript
// Manual type definitions — tedious and error-prone
interface ERC20Contract {
  transfer(to: string, amount: BigNumber): Promise<BigNumber>
  balanceOf(address: string): Promise<BigNumber>
  allowance(owner: string, spender: string): Promise<BigNumber>
  // ... every function needs to be manually written
}

// Problem 1: Function name typos won't be caught by the compiler
contract.transer(to, amount) // Typo, only errors at runtime

// Problem 2: Parameter type mismatch
contract.transfer(to, '100') // Should pass BigNumber, passed string

// Problem 3: Parameter order errors
contract.transfer(amount, to) // Order reversed, compiler doesn't complain

// Problem 4: Event listeners have no types
contract.on('Transfer', (from, to, value) => {
  // from, to, value are all type any
})
```

These issues are tolerable in small projects, but when a contract has dozens of functions and events, manually maintaining type definitions becomes a nightmare.

## TypeChain: Auto-Generating TypeScript Types from ABI

TypeChain is a code generation tool that automatically produces TypeScript type definitions from ABI JSON. It supports multiple targets (ethers-v5, web3-v1, truffle, etc.), and the generated code is used directly in the project.

### Installation and Configuration

```bash
npm install --save-dev typechain @typechain/ethers-v5 ethers
```

```typescript
// typechain.config.ts
import { TypeChainConfig } from 'typechain'

const config: TypeChainConfig = {
  files: ['./abis/**/*.json'],  // ABI file paths
  outDir: './types/contracts',   // Output directory
  target: 'ethers-v5',           // Target library
}

export default config
```

### Generating Types

```bash
# Generate via CLI
npx typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'

# Or configure script in package.json
{
  "scripts": {
    "typechain": "typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'",
    "prebuild": "npm run typechain"
  }
}
```

### Generated Types

Assuming an ABI file `ERC20.json`:

```typescript
// types/contracts/ERC20.ts (auto-generated)
import { ethers } from 'ethers'
import { Provider, TransactionReceipt, Signer, BigNumber, BigNumberish } from 'ethers'

export interface ERC20 extends ethers.Contract {
  // Function calls — type-safe
  transfer(to: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>
  balanceOf(address: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  allowance(owner: string, spender: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  approve(spender: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>

  // Static calls
  'transfer(address,uint256)': (to: string, amount: BigNumberish) => Promise<boolean>
  'balanceOf(address)': (address: string) => Promise<BigNumber>

  // Event filters
  filters: {
    Transfer(from?: string | null, to?: string | null, value?: null): ethers.EventFilter
    Approval(owner?: string | null, spender?: string | null, value?: null): ethers.EventFilter
  }

  // Event listeners
  on(event: 'Transfer', listener: (from: string, to: string, value: BigNumber, event: ethers.Event) => void): this
  on(event: 'Approval', listener: (owner: string, spender: string, value: BigNumber, event: ethers.Event) => void): this
}

// Factory function
export class ERC20__factory {
  static connect(address: string, signerOrProvider: Signer | Provider): ERC20
  static abi: string[]
}
```

### Type-Safe Contract Calls

```typescript
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, provider)

// Create a type-safe contract instance
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// ✅ Compile-time checking of function names and parameters
const balance = await token.balanceOf(userAddress) // Returns BigNumber
const tx = await token.transfer(recipient, 1000)   // Correct parameter types

// ❌ Compile-time errors
// token.transer(recipient, 1000)                  // Function doesn't exist
// token.transfer(recipient, '1000')                // Type mismatch (needs BigNumberish)
// token.balanceOf()                                // Missing parameters

// Event listeners are also type-safe
token.on('Transfer', (from, to, value, event) => {
  console.log(`${from} -> ${to}: ${value.toString()}`)
  // from: string, to: string, value: BigNumber — correct types
})

// ❌ Event name typo
// token.on('Transer', ...) // Compile-time error
```

### Handling Structs (Tuples)

Solidity structs are represented as tuples in the ABI:

```solidity
// Solidity
struct UserInfo {
  uint256 amount;
  uint256 rewardDebt;
}

function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
```

```json
[
  {
    "type": "function",
    "name": "userInfo",
    "inputs": [
      { "name": "pid", "type": "uint256" },
      { "name": "user", "type": "address" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "amount", "type": "uint256" },
          { "name": "rewardDebt", "type": "uint256" }
        ]
      }
    ]
  }
]
```

TypeChain generates the corresponding TypeScript interface:

```typescript
// Auto-generated struct types
export interface UserInfoStruct {
  amount: BigNumber
  rewardDebt: BigNumber
}

export interface UserInfoStructOutput {
  amount: BigNumber
  rewardDebt: BigNumber
}

// Usage
const info = await contract.userInfo(0, userAddress)
// info: UserInfoStructOutput
console.log(info.amount.toString())
```

## Event Type Generation and Type-Safe Listening

TypeChain generates complete type definitions for events, including event parameters and filter types:

```typescript
// Auto-generated event types
export interface TransferEvent extends ethers.Event {
  args: {
    from: string
    to: string
    value: BigNumber
  }
}

// Type-safe event filtering
const filter = token.filters.Transfer(fromAddress, null, null)
// filter only accepts (string | null, string | null, string | null)
// null means wildcard

// Query historical events
const events = await token.queryFilter(filter, fromBlock, toBlock)
// events: TransferEvent[]
events.forEach((event) => {
  console.log(event.args.from)  // string
  console.log(event.args.value) // BigNumber
})
```

## viem's Built-in Type Inference

viem is an Ethereum TypeScript library developed by the wagmi team. Its standout feature is built-in ABI type inference—no code generation step needed, types are inferred directly from ABI literals.

### viem's Type Inference

```typescript
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// Use ABI literals directly — no code generation needed
const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// viem infers complete types from ABI literals
const balance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf',
  args: ['0x1234...'], // ✅ Type checking: address
})

// ❌ Compile-time errors
// functionName: 'balanecOf'  // Typo, compiler error
// args: [123]                 // Type mismatch, needs address
```

### Using JSON ABI

```typescript
import { createPublicClient, http, getContract } from 'viem'
import { mainnet } from 'viem/chains'

// JSON ABI also supports type inference
const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const  // Key: as const lets TypeScript infer literal types

// Create a type-safe contract instance using getContract
const contract = getContract({
  address: '0x...',
  abi: erc20Abi,
  client,
})

// ✅ Type-safe
const { result } = await contract.simulate.transfer({
  args: [recipient, parseEther('100')],
})

// Event types are also safe
const unwatch = contract.watchEvent.Transfer({
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.from)  // string
      console.log(log.args.value) // bigint
    })
  },
})
```

### viem's Advantages

```typescript
// 1. No code generation step needed
// No typechain.config.ts, no prebuild script
// When ABI changes, types update immediately

// 2. More precise type inference
// TypeChain generates loose string/BigNumber types
// viem infers more precise literal types

// 3. Function names are literal union types
type FunctionNames = 'balanceOf' | 'transfer' | 'approve'
// Typos are caught immediately at compile time

// 4. Parameter and return value types are inferred from ABI
// uint256 -> bigint
// address -> \`0x${string}\`
// bool -> boolean
// string -> string
```

## Comparison of Two Implementations with the Same ABI

### TypeChain + ethers-v5 Implementation

```typescript
// 1. First run code generation: npx typechain
// 2. Import generated types
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

// 3. Create contract instance
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = provider.getSigner()
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// 4. Call
const balance: BigNumber = await token.balanceOf(userAddress)

// 5. Transfer
const tx = await token.transfer(recipient, ethers.utils.parseUnits('100', 18))
await tx.wait()

// 6. Event listening
token.on('Transfer', (from, to, value: BigNumber, event) => {
  console.log(value.toString())
})
```

### viem Implementation

```typescript
// 1. No code generation needed
import { createWalletClient, http, parseAbi, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

// 2. Define ABI (inline)
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

// 3. Create client
const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

// 4. Call
const balance: bigint = await client.readContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'balanceOf',
  args: [userAddress],
})

// 5. Transfer
const txHash = await client.writeContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'transfer',
  args: [recipient, parseEther('100')],
})

// 6. Event listening
const unwatch = client.watchContractEvent({
  address: TOKEN_ADDRESS,
  abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.value) // bigint
    })
  },
})
```

Key differences:

| Dimension | TypeChain + ethers | viem |
|------|-------------------|------|
| Code generation | Required (pre-build step) | Not needed |
| Type updates | Regenerate after ABI changes | Instant |
| Big number type | BigNumber (object) | bigint (native) |
| Bundle size | Larger (ethers + typechain) | Smaller (tree-shakeable) |
| Event types | Strong | Strong |
| Learning curve | Low (ethers ecosystem) | Medium (new API) |

## Frontend Engineering: Integrating ABI Type Generation into the Build Pipeline

### Auto-Generation with Hardhat

```typescript
// hardhat.config.ts
import '@typechain/hardhat'
import 'hardhat-deploy'

export default {
  solidity: '0.8.17',
  typechain: {
    outDir: 'types/contracts',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
  },
  paths: {
    sources: './contracts',
    artifacts: './artifacts',
  },
}
```

Hardhat automatically runs TypeChain after compiling contracts, with generated type files in the `types/contracts/` directory.

### Using Foundry + Scripts

```bash
# Foundry generates ABI after compilation
forge build

# ABI is in the out/ directory
# Use a script to extract ABI and run TypeChain
npx typechain --target ethers-v5 --out-dir types/contracts 'out/**/*.json'
```

### Vite Project Integration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { typechainPlugin } from 'vite-plugin-typechain'

export default defineConfig({
  plugins: [
    typechainPlugin({
      outDir: 'src/types/contracts',
      target: 'ethers-v5',
      files: 'src/abis/**/*.json',
    }),
  ],
})
```

### ABI Sharing in Monorepos

```typescript
// packages/contracts/package.json
{
  "name": "@myapp/contracts",
  "scripts": {
    "build": "forge build && npm run typechain",
    "typechain": "typechain --target ethers-v5 --out-dir types 'out/**/*.json'"
  },
  "exports": {
    "./types": "./types/index.ts",
    "./abis": "./abis/index.ts"
  }
}

// packages/frontend/src/hooks/useToken.ts
import { ERC20__factory } from '@myapp/contracts/types'
// Types shared from contracts package to frontend
```

## Limitations of Type Safety

### Runtime Validation Still Needed

TypeScript types are only checked at compile time; at runtime, the ABI may not match the actual contract:

```typescript
// Type check passes, but may fail at runtime
const balance = await token.balanceOf(userAddress)
// If the contract doesn't actually have a balanceOf function, runtime error
```

### ABI Version Management

After contract upgrades, the ABI may change. You need to ensure the frontend's ABI matches the on-chain contract:

```typescript
// Recommended to validate ABI completeness at runtime
import tokenAbi from './abis/ERC20.json'

function validateContract(abi: any, requiredFunctions: string[]) {
  const abiFunctions = abi
    .filter((item: any) => item.type === 'function')
    .map((item: any) => item.name)

  const missing = requiredFunctions.filter(
    (fn) => !abiFunctions.includes(fn)
  )

  if (missing.length > 0) {
    throw new Error(`ABI missing required functions: ${missing.join(', ')}`)
  }
}

validateContract(tokenAbi, ['transfer', 'balanceOf', 'approve'])
```

### Types for Overloaded Functions

Solidity supports function overloading, but TypeScript type generation may not be precise enough:

```solidity
// Solidity overloads
function transfer(address to, uint256 amount) returns (bool)
function transfer(address to, uint256 amount, bytes data) returns (bool)
```

TypeChain uses string forms of function signatures to distinguish overloads, which is less intuitive than viem:

```typescript
// TypeChain
token['transfer(address,uint256)'](to, amount)
token['transfer(address,uint256,bytes)'](to, amount, data)

// viem handles overloads automatically
client.writeContract({
  functionName: 'transfer',
  args: [to, amount],          // Auto-matches first overload
  // or
  args: [to, amount, data],    // Auto-matches second overload
})
```

## Summary

From TypeChain to viem, Ethereum frontend type safety has evolved from "code generation" to "built-in inference." TypeChain's core contribution was making ABI type generation a standard part of the build pipeline, greatly improving the development experience within the ethers.js ecosystem. viem took type inference to new heights—no code generation, no build steps, ABI literals are directly inferred into precise types by the TypeScript compiler.

For existing ethers.js projects, TypeChain is recommended due to low migration cost and mature ecosystem. New projects can consider viem to enjoy zero-configuration type safety and a lighter bundle size. Regardless of the choice, pay attention to ABI version management—compile-time type safety cannot replace runtime validation, and the frontend ABI must be synchronized after contract upgrades.

Type safety brings not only fewer bugs but, more importantly, an improved development experience. IDE auto-completion, compile-time error checking, and type tracking during refactoring bring Web3 frontend development closer to the experience standards of traditional web development.
