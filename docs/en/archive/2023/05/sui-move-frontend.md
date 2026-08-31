---
title: "Sui Move Ecosystem Frontend Development: From Move to Web"
date: 2023-05-11 19:14:49
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "Sui adopts an Object model rather than EVM's Account model, resulting in a fundamentally different frontend interaction approach. This article covers the complete pipeline of the @mysten/sui.js SDK, wallet connection, Object reading, and transaction building."
wordCount: 636
---

Sui is a Layer 1 blockchain developed by Mysten Labs, using the Move language and an Object-based data model. Unlike EVM chains' Account model, every asset on Sui is an independent Object with its own ID and ownership. This architectural difference directly impacts frontend development—from data reading to transaction building, everything needs to be rethought.

## Sui Network Overview and Move Language Characteristics

### Sui's Core Features

- **Object model**: All assets and data are Objects, not account balances
- **Move language**: Resource-oriented programming, resources cannot be copied or dropped
- **Parallel execution**: Transactions are processed in parallel based on Object dependencies; non-conflicting transactions execute simultaneously
- **Gas token**: SUI
- **Consensus**: Narwhal & Bullshark (DAG-based BFT consensus)

### Move Language's Uniqueness

```move
// Move module example
module my_package::coin {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;

    // Define a resource type
    struct Treasury has key {
        id: UID,
        balance: Coin<SUI>,
    }

    public fun create treasury(balance: Coin<SUI>, ctx: &mut TxContext) {
        let treasury = Treasury {
            id: object::new(ctx),
            balance,
        };
        transfer::share_object(treasury);
    }

    public fun withdraw(treasury: &mut Treasury, amount: u64, ctx: &mut TxContext) {
        let coin = coin::take(&mut treasury.balance, amount, ctx);
        transfer::transfer(coin, tx_context::sender(ctx));
    }
}
```

Move's core characteristic is resource-oriented programming: resources are first-class citizens that cannot be copied or dropped, and must be explicitly transferred or destroyed. This is fundamentally different from Solidity's storage variable model.

## Sui's Object Model vs EVM's Account Model

### EVM Account Model

```
Account address → balance mapping
mapping(address => uint256) balances

// Transfer: modify two accounts' balances
balances[sender] -= amount;
balances[recipient] += amount;
```

### Sui Object Model

```
Each Coin is an independent Object
Object {
  id: 0x...
  owner: 0x...
  value: 100
  type: 0x2::sui::SUI
}

// Transfer: transfer Object ownership
transfer_object(coin_object, new_owner)
```

The impact of this difference on the frontend is fundamental:

| Dimension | EVM Account Model | Sui Object Model |
|------|-----------------|-----------------|
| Asset representation | Balance (a number) | Object (independent entity) |
| Transfer | Modify balance mapping | Transfer Object ownership |
| Data query | Read storage slots | Query Objects |
| History tracking | Requires event logs | Objects have complete history |
| Parallel processing | Global state lock | Parallel by Object dependencies |

## Using the @mysten/sui.js SDK

`@mysten/sui.js` is Sui's official JavaScript SDK, providing a complete API for interacting with the Sui network.

### Installation and Initialization

```bash
npm install @mysten/sui.js
```

```typescript
import {
  JsonRpcProvider,
  localnetConnection,
  testnetConnection,
  mainnetConnection,
} from '@mysten/sui.js'

// Connect to Sui network
const provider = new JsonRpcProvider(testnetConnection)

// Or use a custom RPC
const customProvider = new JsonRpcProvider({
  url: 'https://sui-testnet.nodeprovider.com/rpc',
})
```

### Querying Basic Information

```typescript
// Get on-chain information
const chainId = await provider.getChainIdentifier()
const latestCheckpoint = await provider.getLatestCheckpointSequenceNumber()
const rpcApiVersion = await provider.getRpcApiVersion()

// Get all Objects owned by an address
const objects = await provider.getObjectsOwnedByAddress(
  '0xUserAddress...'
)

console.log(objects.data)
// [
//   {
//     objectId: '0x...',
//     version: 1,
//     digest: '...',
//     type: '0x2::coin::Coin<0x2::sui::SUI>',
//     owner: { AddressOwner: '0x...' }
//   },
//   ...
// ]
```

## Frontend Sui Wallet Connection

Sui Wallet is Sui's official browser extension wallet, similar to MetaMask.

### Detecting and Connecting Wallet

```typescript
// hooks/useSuiWallet.ts
import { useState, useEffect } from 'react'

declare global {
  interface Window {
    suiWallet?: any
  }
}

export function useSuiWallet() {
  const [connected, setConnected] = useState(false)
  const [account, setAccount] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if wallet is installed
    if (window.suiWallet) {
      // Check if already connected
      window.suiWallet
        .hasPermissions()
        .then(() => {
          setConnected(true)
          return window.suiWallet.getAccounts()
        })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0])
          }
        })
        .catch(() => {
          // Not connected
        })
    }

    // Listen for account changes
    window.suiWallet?.on('accountChanged', (account: string) => {
      setAccount(account)
    })

    // Listen for disconnection
    window.suiWallet?.on('disconnect', () => {
      setConnected(false)
      setAccount(null)
    })
  }, [])

  const connect = async () => {
    if (!window.suiWallet) {
      window.open('https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmaojdnfgeibjlmn')
      return
    }

    try {
      await window.suiWallet.requestPermissions()
      const accounts = await window.suiWallet.getAccounts()
      setAccount(accounts[0])
      setConnected(true)
    } catch (error) {
      console.error('Failed to connect wallet:', error)
    }
  }

  const disconnect = async () => {
    await window.suiWallet.disconnect()
    setConnected(false)
    setAccount(null)
  }

  return { connected, account, connect, disconnect }
}
```

## Reading Objects

### getObject: Get a Single Object

```typescript
import { JsonRpcProvider, testnetConnection } from '@mysten/sui.js'

const provider = new JsonRpcProvider(testnetConnection)

// Get a single Object
const objectResponse = await provider.getObject(
  '0xObjectId...'
)

const object = objectResponse.details
console.log(object)
// {
//   data: {
//     objectId: '0x...',
//     version: 1,
//     type: '0x2::coin::Coin<0x2::sui::SUI>',
//     content: { fields: { balance: '1000000000', id: {...} } }
//   }
// }

// Get Object with specified return options
const objectWithOptions = await provider.getObject(
  '0xObjectId...',
  { showContent: true, showOwner: true, showType: true }
)

// Batch get multiple Objects
const multiObjectResponse = await provider.multiGetObjects([
  '0xObjectId1...',
  '0xObjectId2...',
  '0xObjectId3...',
], { showContent: true })
```

### getObjectsOwnedByAddress: Get All Objects Owned by an Address

```typescript
// Get all Objects owned by an address (paginated)
async function getAllObjects(address: string) {
  const allObjects: any[] = []
  let cursor: string | null = null

  do {
    const response = await provider.getObjectsOwnedByAddress(
      address,
      { cursor, limit: 50 }
    )

    allObjects.push(...response.data)
    cursor = response.nextCursor

  } while (cursor)

  return allObjects
}

// Filter Objects by type
async function getCoinsByType(address: string, coinType: string) {
  const objects = await getAllObjects(address)

  return objects.filter(
    (obj) => obj.type === `0x2::coin::Coin<${coinType}>`
  )
}

// Get all SUI tokens
const suiCoins = await getCoinsByType(
  account,
  '0x2::sui::SUI'
)

// Aggregate total SUI balance
const totalSui = suiCoins.reduce((sum, coin) => {
  // Need to get each Object's detailed content
  return sum
}, BigInt(0))

// Batch get Coin details
const coinDetails = await provider.multiGetObjects(
  suiCoins.map((c) => c.objectId),
  { showContent: true }
)

const totalBalance = coinDetails.reduce((sum, resp) => {
  const balance = resp.details?.data?.content?.fields?.balance
  return sum + BigInt(balance || 0)
}, BigInt(0))

console.log('Total SUI:', totalBalance.toString())
```

## Transaction Building and Signing

### paySui: Transfer SUI Tokens

```typescript
// Send SUI tokens
async function sendSui(
  recipient: string,
  amount: bigint,
  sender: string
) {
  // Get sender's SUI Coins
  const coins = await provider.getObjectsOwnedByAddress(sender)
  const suiCoins = coins.data.filter(
    (c) => c.type === '0x2::coin::Coin<0x2::sui::SUI>'
  )

  // Get enough Coins to pay
  const coinObjects = await provider.multiGetObjects(
    suiCoins.map((c) => c.objectId),
    { showContent: true }
  )

  // Filter Coins with sufficient balance
  const sufficientCoins = coinObjects.filter((resp) => {
    const balance = resp.details?.data?.content?.fields?.balance
    return BigInt(balance || 0) >= amount
  })

  if (sufficientCoins.length === 0) {
    throw new Error('Insufficient SUI balance')
  }

  // Build paySui transaction
  const tx = new TransactionBlock()
  const coin = tx.object(sufficientCoins[0].details.reference.objectId)
  const splitCoin = tx.splitCoins(coin, [tx.pure(amount)])

  // Transfer to recipient
  tx.transferObjects([splitCoin], tx.pure(recipient))

  // Sign with wallet and send
  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  const result = await provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
  })

  return result
}
```

### moveCall: Call a Move Contract

```typescript
import { TransactionBlock } from '@mysten/sui.js'

// Call a Move module function
async function callMoveFunction(
  packageId: string,
  moduleName: string,
  functionName: string,
  typeArgs: string[],
  args: any[],
  gasBudget: number
) {
  const tx = new TransactionBlock()

  // Build moveCall
  tx.moveCall({
    target: `${packageId}::${moduleName}::${functionName}`,
    typeArguments: typeArgs,
    arguments: args.map((arg) => {
      if (typeof arg === 'string' && arg.startsWith('0x')) {
        return tx.object(arg) // Object ID
      }
      return tx.pure(arg)    // Pure argument
    }),
  })

  tx.setGasBudget(gasBudget)

  // Sign and send
  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  const result = await provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
    options: {
      showEffects: true,
      showEvents: true,
    },
  })

  return result
}

// Example: Call a custom Move contract
const result = await callMoveFunction(
  '0xPackageId...',
  'marketplace',
  'list_item',
  [], // No generic parameters
  [
    '0xNftObjectId...',  // NFT Object ID
    1000000000,          // Price (MIST)
  ],
  100000000 // Gas budget
)
```

### Merging Coins

```typescript
// Merge multiple SUI Coins into one
async function mergeCoins(coinIds: string[]) {
  const tx = new TransactionBlock()

  // First Coin as the primary Coin
  const primaryCoin = tx.object(coinIds[0])

  // Merge remaining Coins into the primary Coin
  const coinsToMerge = coinIds.slice(1).map((id) => tx.object(id))
  tx.mergeCoins(primaryCoin, coinsToMerge)

  tx.setGasBudget(50000000)

  const signedTx = await window.suiWallet.signTransactionBlock({
    transactionBlock: tx,
  })

  return provider.executeTransactionBlock({
    transactionBlock: signedTx.transactionBlockBytes,
    signature: signedTx.signature,
  })
}
```

## Complete Sui DApp Frontend Module

```typescript
// lib/suiDApp.ts
import {
  JsonRpcProvider,
  TransactionBlock,
  testnetConnection,
} from '@mysten/sui.js'

export class SuiDApp {
  private provider: JsonRpcProvider
  private account: string | null = null

  constructor() {
    this.provider = new JsonRpcProvider(testnetConnection)
  }

  setAccount(account: string | null) {
    this.account = account
  }

  // Get SUI balance
  async getSuiBalance(address: string): Promise<bigint> {
    const coins = await this.provider.getCoins(address, {
      coinType: '0x2::sui::SUI',
    })

    return coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    )
  }

  // Get all NFTs
  async getNFTs(address: string) {
    const objects = await this.provider.getOwnedObjects({
      owner: address,
      filter: { StructType: '0x2::devnet_nft::DevNetNFT' },
      options: { showContent: true, showType: true },
    })

    return objects.data.map((obj) => ({
      id: obj.data?.objectId,
      name: obj.data?.content?.fields?.name,
      url: obj.data?.content?.fields?.url,
      description: obj.data?.content?.fields?.description,
    }))
  }

  // Mint NFT
  async mintNFT(
    name: string,
    description: string,
    url: string
  ) {
    const tx = new TransactionBlock()

    tx.moveCall({
      target: '0x2::devnet_nft::mint',
      arguments: [tx.pure(name), tx.pure(description), tx.pure(url)],
    })

    tx.setGasBudget(100000000)

    const signedTx = await window.suiWallet.signTransactionBlock({
      transactionBlock: tx,
    })

    const result = await this.provider.executeTransactionBlock({
      transactionBlock: signedTx.transactionBlockBytes,
      signature: signedTx.signature,
      options: { showEffects: true, showEvents: true },
    })

    return result
  }

  // Transfer SUI
  async transferSui(recipient: string, amount: bigint) {
    const tx = new TransactionBlock()

    // Split the specified amount from the gas coin
    const [coin] = tx.splitCoins(tx.gas, [tx.pure(amount)])
    tx.transferObjects([coin], tx.pure(recipient))

    tx.setGasBudget(50000000)

    const signedTx = await window.suiWallet.signTransactionBlock({
      transactionBlock: tx,
    })

    return this.provider.executeTransactionBlock({
      transactionBlock: signedTx.transactionBlockBytes,
      signature: signedTx.signature,
    })
  }

  // Wait for transaction confirmation
  async waitForTransaction(digest: string) {
    return this.provider.waitForTransaction({
      digest,
      options: { showEffects: true, showEvents: true },
    })
  }

  // Read Move contract events
  async queryEvents(packageId: string, limit: number = 50) {
    const events = await this.provider.queryEvents({
      query: { MoveModule: { package: packageId, module: 'marketplace' } },
      limit,
    })

    return events.data
  }
}
```

## TypeScript Type Mapping for Move Contract Modules

Move's type system differs significantly from TypeScript, requiring manual mapping.

```typescript
// types/sui.ts

// Move's Coin<SUI> corresponding TypeScript type
interface SuiCoinObject {
  objectId: string
  version: number
  digest: string
  type: '0x2::coin::Coin<0x2::sui::SUI>'
  content: {
    dataType: 'moveObject'
    type: '0x2::coin::Coin<0x2::sui::SUI>'
    fields: {
      balance: string
      id: { id: string }
    }
  }
}

// Move's struct corresponding TypeScript type
// move:
// struct Listing has key {
//   id: UID,
//   item: ID,
//   price: u64,
//   seller: address,
// }
interface ListingObject {
  objectId: string
  type: '0xPackage::marketplace::Listing'
  content: {
    fields: {
      item: { id: string }
      price: string
      seller: string
    }
  }
}

// Type guards
function isSuiCoin(obj: any): obj is SuiCoinObject {
  return obj?.type === '0x2::coin::Coin<0x2::sui::SUI>'
}

function isListing(obj: any): obj is ListingObject {
  return obj?.type?.includes('::marketplace::Listing')
}

// Generic Object parser
function parseObject<T>(raw: any): T | null {
  if (!raw?.details?.data?.content) return null

  const fields = raw.details.data.content.fields
  // Move's struct fields are in content.fields
  // Nested structs also have their own fields
  return fields as T
}

// Usage
const listing = parseObject<ListingFields>(rawListing)
if (listing) {
  console.log('Price:', listing.price)
  console.log('Seller:', listing.seller)
}
```

## Comparison with EVM DApp Development

### Data Query Approach

```typescript
// EVM: read contract storage
const balance = await tokenContract.balanceOf(userAddress)
// Returns a number

// Sui: query Object list
const coins = await provider.getCoins(userAddress, { coinType: '0x2::sui::SUI' })
// Returns a set of Objects, each with an independent ID
const totalBalance = coins.data.reduce(
  (sum, c) => sum + BigInt(c.balance),
  BigInt(0)
)
```

### Transaction Building Approach

```typescript
// EVM: send calldata
const tx = await contract.transfer(recipient, amount)
// ABI encodes function selector + parameters

// Sui: build TransactionBlock
const tx = new TransactionBlock()
tx.moveCall({
  target: `${packageId}::coin::transfer`,
  arguments: [tx.object(coinId), tx.pure(recipient)],
})
// Transaction is a sequence of Move calls
```

### Gas Mechanism

```typescript
// EVM: Gas Price * Gas Used
// Gas Price determined by EIP-1559's base fee + priority fee

// Sui: Gas Budget (budget-based)
// Transaction specifies a Gas Budget, actual consumption deducted from Budget
tx.setGasBudget(50000000) // 0.05 SUI
// Unused gas is refunded
```

### Transaction Confirmation

```typescript
// EVM: wait for block confirmation
const receipt = await tx.wait(1) // 1 block

// Sui: parallel confirmation by Object dependencies
// Non-conflicting transactions confirm almost instantly
const result = await provider.waitForTransaction({ digest })
// Conflicting transactions need to go through consensus, slightly slower
```

## Sui Ecosystem Maturity Assessment

The Sui ecosystem is still in its early stages:

**SDK maturity**: `@mysten/sui.js` API changes frequently, with breaking changes between versions. Documentation covers a wide range but lacks in-depth examples.

**Wallet ecosystem**: Sui Wallet is the primary browser extension wallet, but its user experience and features are not as mature as MetaMask. Third-party wallets like Ethos Wallet and Martian Wallet are also in development.

**Developer tools**: Sui CLI is used for contract development and deployment, with basically complete functionality but a steep learning curve. The Move language itself is relatively friendly for developers with Rust experience.

**DApp ecosystem**: Projects are being built in DeFi, NFT, and GameFi domains, but user numbers and TVL lag significantly behind the EVM ecosystem.

## Summary

Sui's Object model brings an entirely new paradigm to frontend development. The simple concept of "balance" no longer exists; instead, there are groups of independent Objects, each with its own ID, version, and ownership. This model is more intuitive in some scenarios—NFT transfers are simply Object ownership changes, without needing ERC-721's complex interface; but more complex in others—getting a user's total balance requires traversing all Coin Objects and aggregating them.

Move's resource-oriented programming guarantees asset safety at the type system level—resources cannot be copied or dropped. This is a stronger safety guarantee than Solidity, but also increases the complexity of frontend type mapping.

Frontend developers migrating from EVM to Sui need to adapt to three core changes: from querying contract storage to querying Objects, from ABI calls to TransactionBlock building, and from Gas Price to Gas Budget. These changes are not incremental improvements, but a shift in mindset.

Sui's ecosystem maturity is still early, and the stability of the SDK and toolchain needs improvement. However, the technical advantages of the Object model and parallel execution are clear, making it worth frontend developers' attention and learning.
