---
title: "Aptos Chain Frontend Integration: Move Contracts and TypeScript SDK"
date: 2023-07-22 13:05:54
tags:
  - Web3
  - Blockchain
readingTime: 9
description: "Aptos inherits Diem's Move lineage, with unique designs in resource models and parallel execution. This article covers the complete solution for @aptos-labs/ts-sdk, Petra Wallet integration, and Move contract frontend interactions."
wordCount: 781
---

Aptos is a Layer 1 blockchain founded by core members of Meta's (Facebook) former Diem project, which launched on mainnet. Like Sui, Aptos uses the Move language, but the two have significant differences in their Move implementations. Aptos retains Diem's standard Move implementation, adopting a Resource model rather than Sui's Object model. For frontend developers, Aptos's SDK design and wallet integration approach form a system of their own.

## Aptos Network Overview and Diem Lineage

### From Diem to Aptos

The Diem (formerly Libra) project was sold by Meta and disbanded. Its core technical team founded Aptos Labs. Aptos inherited Diem's core technology stack:

- **Move language**: A resource-oriented language designed by the Diem team for blockchain scenarios
- **Move Virtual Machine**: The virtual machine that executes Move bytecode
- **DiemBFT consensus**: An improved BFT consensus protocol, now called AptosBFT

### Aptos's Core Features

- **Parallel execution**: Block-STM (Block Software Transactional Memory) parallel execution engine
- **Move language**: Resource-oriented, strongly typed
- **Account model**: Similar to EVM's account model, but resources are stored under accounts
- **Gas token**: APT
- **High TPS**: Theoretically capable of 100,000+ TPS (in parallel execution scenarios)

### Network Information

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

## Move Language Implementation on Aptos

### Aptos Move vs Sui Move

Although both use the Move language, their implementations and semantics differ significantly:

| Dimension | Aptos Move | Sui Move |
|------|-----------|----------|
| Resource storage | Account's resource space | Independent Objects |
| Data model | Account-based | Object-based |
| Ownership | Resources stored under account addresses | Objects have independent owners |
| Transfer | move_to / move_from | transfer Object |
| Global storage | Globally accessible | Isolated per Object |

### Aptos Move Module Example

```move
// Move contract on Aptos
module my_app::token {
    use std::signer;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;

    // Define resource type
    struct Vault has key {
        balance: Coin<AptosCoin>,
    }

    // Initialize Vault (stored under the caller's account)
    public entry fun initialize(account: &signer, amount: Coin<AptosCoin>) {
        let vault = Vault { balance: amount };
        move_to(account, vault);
    }

    // Withdraw from Vault
    public entry fun withdraw(account: &signer, amount: u64): Coin<AptosCoin> acquires Vault {
        let vault = borrow_global_mut<Vault>(signer::address_of(account));
        coin::extract(&mut vault.balance, amount)
    }

    // Query balance
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

Key difference: Aptos uses `move_to` to store resources under account addresses, and `borrow_global` to read resources from any address. This is a global storage model, while Sui's Objects are independently addressed.

## Using the @aptos-labs/ts-sdk

Aptos released the `@aptos-labs/ts-sdk` (replacing the older `aptos` SDK), with a more modern API design.

### Installation and Initialization

```bash
npm install @aptos-labs/ts-sdk
```

```typescript
import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk'

// Initialize client
const aptosConfig = new AptosConfig({
  network: Network.TESTNET,
})
const aptos = new Aptos(aptosConfig)

// Or use a custom RPC
const customConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: 'https://my-aptos-node.com',
})
const customAptos = new Aptos(customConfig)
```

### Querying On-Chain Data

```typescript
// Get account information
const accountInfo = await aptos.getAccountInfo({
  accountAddress: '0xUserAddress...',
})
// {
//   sequence_number: '5',
//   authentication_key: '0x...',
// }

// Get account resources
const resources = await aptos.getAccountResources({
  accountAddress: '0xUserAddress...',
})
// Returns all resources under the account
// [
//   { type: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>', data: { coin: { value: '100000000' } } },
//   { type: '0x1::account::Account', data: { ... } },
//   ...
// ]

// Get a specific resource
const coinStore = await aptos.getAccountResource({
  accountAddress: '0xUserAddress...',
  resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
})
// { coin: { value: '100000000' } }

// Get APT balance
async function getAptBalance(address: string): Promise<number> {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>',
    })
    return parseInt(resource.coin.value) / 1e8 // APT has 8 decimals
  } catch {
    return 0 // Account may not have a CoinStore resource
  }
}

// Read Table
// Aptos's Table is similar to EVM's mapping
const tableItem = await aptos.getTableItem({
  tableHandle: '0xTableHandle...',
  data: {
    key_type: 'address',
    value_type: 'u64',
    key: '0xUserAddress...',
  },
})
```

### Using View Functions

Aptos supports functions annotated with `#[view]`, which can be called directly via RPC (without a transaction):

```typescript
// Call a view function
const viewResult = await aptos.view({
  payload: {
    function: '0xMyPackage::token::balance',
    functionArguments: ['0xUserAddress...'],
  },
})
// Returns an array of values
// ['100000000']
const balance = parseInt(viewResult[0])
```

## Petra Wallet Frontend Integration

Petra Wallet is the browser extension wallet officially developed by Aptos Labs.

### Detection and Connection

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

    // Detect Petra Wallet
    if (window.aptos) {
      // Check if already connected
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

      // Get network
      window.aptos.network().then((net: string) => {
        setNetwork(net)
      })
    }

    // Listen for account changes
    window.aptos?.onAccountChange((account: any) => {
      setAccount(account?.address || null)
    })

    // Listen for network changes
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

## Resource Model and Frontend Reading

Aptos's resources are stored under account addresses, and the frontend's reading approach is fundamentally different from EVM.

### Reading Account Resources

```typescript
// Read a user's resource under a specific module
async function getUserVault(address: string) {
  try {
    const resource = await aptos.getAccountResource({
      accountAddress: address,
      resourceType: '0xMyPackage::token::Vault',
    })

    // Resource data structure depends on the struct defined in Move
    return {
      balance: resource.balance, // Coin object's value
    }
  } catch (error: any) {
    // 404 means the account doesn't have this resource
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

// Read CoinStore balance
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

### Reading Table Data

Aptos's Table is a persistent key-value structure, similar to EVM's mapping:

```typescript
// Read data from a Table
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

// Example: Read a user's credit score
// Move: struct CreditScore has key { scores: Table<address, u64> }
async function getCreditScore(
  contractAddress: string,
  userAddress: string
) {
  // First get the table handle from the contract resource
  const resource = await aptos.getAccountResource({
    accountAddress: contractAddress,
    resourceType: '0xMyApp::credit::CreditScore',
  })

  const tableHandle = resource.scores.handle

  // Then query the value in the table
  const score = await getTableValue(
    tableHandle,
    userAddress,
    'address',
    'u64'
  )

  return score
}
```

## Transaction Building: Payload Types and Signing

### Building Transaction Payload

```typescript
import {
  Aptos,
  AptosConfig,
  Network,
  AccountAddress,
} from '@aptos-labs/ts-sdk'

// Build entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0x1::coin::transfer',
  type_arguments: ['0x1::aptos_coin::AptosCoin'],
  arguments: [
    '0xRecipientAddress...', // Recipient address
    '100000000',              // Amount (octas, 1 APT = 10^8 octas)
  ],
}
```

### Signing and Submitting Transactions

```typescript
// Sign and submit using Petra Wallet
async function submitTransaction(
  payload: any
): Promise<string> {
  // Petra Wallet's signAndSubmitTransaction both signs and submits
  const transaction = await window.aptos.signAndSubmitTransaction(
    payload
  )

  // Wait for transaction confirmation
  await aptos.waitForTransaction({
    transactionHash: transaction.hash,
  })

  return transaction.hash
}

// Transfer APT
async function transferAPT(
  recipient: string,
  amount: number // APT amount
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

### Calling Custom Move Contracts

```typescript
// Call a custom module's function
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

// Example: List an NFT in a marketplace
const txHash = await callMoveFunction(
  '0xMarketplaceAddress...',
  'market',
  'list_item',
  [],
  [
    '0xNftCreatorAddress...',
    'NFTCollectionName',
    '0xNftId...',           // NFT's token name or ID
    '100000000',            // Price (octas)
  ]
)
```

### Multi-Signature Transactions

```typescript
import { MultiAgentTransaction } from '@aptos-labs/ts-sdk'

async function submitMultiAgentTransaction(
  sender: string,
  payload: any,
  secondarySigners: string[]
) {
  // Build multi-agent transaction
  const rawTxn = await aptos.transaction.build.multiAgent({
    sender,
    secondarySigners,
    payload,
  })

  // First signer signs
  const senderSignature = await window.aptos.signTransaction(rawTxn)

  // Second signer signs
  // Usually done on a different device/page
  const secondarySignatures = await Promise.all(
    secondarySigners.map((addr) =>
      getSignatureFromSecondary(addr, rawTxn)
    )
  )

  // Submit multi-agent transaction
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

## Complete Aptos DApp Frontend Module

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

  // Get APT balance
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

  // Get custom token balance
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

  // Transfer APT
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

  // Register CoinStore (required before receiving new tokens)
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

  // Call view function
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

  // Get transaction events
  async getTransactionEvents(txHash: string) {
    const txn = await this.aptos.getTransactionByHash({
      transactionHash: txHash,
    })

    return txn.events || []
  }

  // Parse event data
  parseEvent(event: any, moduleName: string, eventName: string) {
    if (event.type.includes(`::${moduleName}::${eventName}`)) {
      return event.data
    }
    return null
  }
}
```

## Differences Between Aptos and Sui Move Implementations

### Resource Storage Approach

```typescript
// Aptos: resources stored under accounts
// Read approach: getAccountResource(address, resourceType)
const vault = await aptos.getAccountResource({
  accountAddress: userAddress,
  resourceType: '0xPackage::module::Vault',
})
// Vault resource is stored under the userAddress account

// Sui: resources are independent Objects
// Read approach: getObject(objectId)
const object = await provider.getObject(objectId)
// Object has an independent ID, not belonging to any account
```

### Transaction Model

```typescript
// Aptos: entry function payload
const payload = {
  type: 'entry_function_payload',
  function: '0xAddr::module::function',
  type_arguments: [],
  arguments: [arg1, arg2],
}
// One transaction calls one entry function

// Sui: TransactionBlock (can contain multiple Move calls)
const tx = new TransactionBlock()
tx.moveCall({ target: '0xAddr::module::func1', arguments: [...] })
tx.moveCall({ target: '0xAddr::module::func2', arguments: [...] })
// One transaction can execute multiple operations atomically
```

### Gas Mechanism

```typescript
// Aptos: Gas Unit Price * Max Gas Amount
// Similar to EVM's Gas Price * Gas Limit
const txn = {
  ...payload,
  max_gas_amount: '2000',
  gas_unit_price: '100',
}
// Transaction fee = gas_used * gas_unit_price

// Sui: Gas Budget
// Specify total budget, unused portion refunded
tx.setGasBudget(50000000)
```

## Frontend Development Experience Comparison: Aptos vs EVM

| Dimension | Aptos | EVM |
|------|-------|-----|
| Account model | Accounts store resources | Accounts store balances |
| Data query | getAccountResource | eth_call |
| Transaction building | entry function payload | ABI calldata |
| Type system | Move strong typing | ABI + manual types |
| Parallel execution | Block-STM | Serial |
| Transaction confirmation | ~1 second | ~12 seconds (mainnet) |
| Wallet | Petra Wallet | MetaMask |
| SDK | @aptos-labs/ts-sdk | ethers.js / viem |

### Event Listening Comparison

```typescript
// EVM: listen to contract events
contract.on('Transfer', (from, to, value) => {
  console.log(from, to, value)
})

// Aptos: query transaction events (no real-time WebSocket listening)
// Need polling or SDK's event subscription
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

## Ecosystem Toolchain Assessment

The state of the Aptos ecosystem toolchain:

**SDK**: `@aptos-labs/ts-sdk` underwent a major version upgrade. The API is more modern but documentation migration lagged behind. The older `aptos` SDK is still in use, with high migration costs.

**Wallets**: Petra Wallet is the mainstream choice, stable in functionality but limited in extensibility. Third-party wallets like Martian Wallet and Fewcha Wallet also exist, but compatibility varies.

**Development tools**: Aptos CLI is used for contract compilation, testing, and deployment. The Move language's learning curve is friendly for developers with Rust experience, while Solidity developers need to adapt to resource-oriented programming.

**Indexing services**: Aptos's indexing infrastructure is not as mature as The Graph. Self-hosted indexing services or Aptos's official Indexer (PostgreSQL-based) are needed.

## Summary

Aptos inherits Diem's technical accumulation, with a solid foundation in the Move language and parallel execution. Resource-oriented programming provides stronger type safety guarantees than Solidity—resources cannot be copied or dropped, which is particularly important in asset management scenarios.

Compared to Sui, Aptos's account model is closer to EVM's mental model—resources are stored under account addresses rather than as independent Objects. This makes the learning curve from EVM to Aptos gentler than migrating to Sui. However, Aptos's Table queries and event system are less real-time than EVM's WebSocket event listening.

In terms of frontend development experience, `@aptos-labs/ts-sdk`'s API design is clear but still iterating rapidly. Petra Wallet's integration approach is more mature than early Sui Wallet, but still lags behind MetaMask's ecosystem maturity in terms of ecosystem maturity. Fast transaction confirmation (~1 second) is Aptos's significant advantage, making frontend state management simpler than EVM's multi-block waiting.

The Move ecosystem as a whole is still in its early stages, and the toolchain and developer community need time to grow. However, the technical foundation is solid, making it worth frontend developers' investment in learning.
