---
title: "zkSync Frontend Integration: Zero-Knowledge Proof Layer2 Interactions"
date: 2022-09-19 13:53:40
tags:
  - Web3
  - Blockchain
readingTime: 8
description: "zkSync 2.0 (era) natively supports account abstraction and Paymaster, making its frontend integration approach significantly different from EVM Layer1. This article covers the complete zkSync frontend development pipeline, from SDK usage to Paymaster integration."
wordCount: 761
---

zkSync 2.0 (later renamed zkSync Era) is a zkRollup solution developed by Matter Labs that launched on mainnet. Unlike Optimistic Rollup, zkSync uses zero-knowledge proofs (specifically the PLONK proof system) to guarantee the validity of L2 state, and withdrawals do not require a 7-day challenge period. More importantly, zkSync natively supports Account Abstraction and Paymaster (gas sponsorship) from the ground up, making its frontend interaction model significantly different from traditional EVM.

## zkSync Era Overview and zkRollup Principles

### How Zero-Knowledge Proofs Ensure Security

The core idea of zkRollup is: after L2 executes all transactions, it generates a proof that verifies these transactions were executed correctly. L1 only needs to verify this proof, rather than re-executing all transactions.

```
L2 batch executes transactions → generate ZK Proof → submit to L1 → L1 verifies Proof → state confirmed
```

Key difference from Optimistic Rollup:

- **OR**: Assumes all transactions are valid unless someone submits a fraud proof (7-day challenge period)
- **ZKR**: Guarantees transaction validity through mathematical proofs, no challenge period needed

This means zkSync's L2 → L1 withdrawals only need to wait for the proof to be verified by L1 (usually a few hours), rather than 7 days.

### zkSync Era's EVM Compatibility

zkSync Era is not EVM-equivalent, but rather EVM-compatible. The distinction is:

- **EVM equivalent** (e.g., Optimism Bedrock): Bytecode is identical, existing contracts can be deployed directly
- **EVM compatible** (e.g., zkSync): Supports Solidity syntax, but compiles to a different virtual machine (zkEVM)

Therefore, some opcodes are unavailable or behave differently on zkSync (e.g., `SELFDESTRUCT`, `CALLCODE`), requiring special attention.

## Native Account Abstraction Support on zkSync

zkSync Era natively supports EIP-4337-style account abstraction without requiring an additional EntryPoint contract. Every account can be a smart contract wallet, supporting custom signature verification and transaction execution logic.

```typescript
// Accounts on zkSync can be:
// 1. EOAs (Externally Owned Accounts) — same as Ethereum
// 2. Smart Contract Accounts — natively supported, no EntryPoint needed

// This means the frontend can support:
// - Social login wallets (no mnemonic needed)
// - Multi-sig wallets (native support, not plugin-based)
// - Session Keys (temporary authorization keys)
// - Gas sponsorship (via Paymaster)
```

## Paymaster: Gas Fee Sponsorship Mechanism

Paymaster is one of zkSync's most distinctive features. It allows third parties to pay gas fees for users, and users can pay gas with ERC-20 tokens (instead of ETH) or even completely free.

### How Paymaster Works

```
User initiates transaction → zkSync protocol checks for Paymaster → Paymaster pays gas
                                                      ↓
                                              User compensates as agreed (optional)
```

### Frontend Paymaster Integration

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

async function sendTransactionWithPaymaster(
  wallet: Wallet,
  to: string,
  data: string,
  paymasterAddress: string
) {
  // Build transaction
  const tx = {
    to,
    data,
    from: wallet.address,
    // Specify Paymaster
    customData: {
      paymasterParams: {
        paymaster: paymasterAddress,
        paymasterInput: '0x', // Paymaster-specific input
      },
      // If paying gas with ERC-20, also need to specify gasPerPubdata
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  // Estimate gas (including Paymaster logic)
  const gasEstimate = await wallet.estimateGas(tx)

  // Send transaction
  const txHash = await wallet.sendTransaction({
    ...tx,
    gasLimit: gasEstimate,
  })

  return txHash
}

// Paymaster for paying gas with ERC-20 tokens
async function payGasWithToken(
  wallet: Wallet,
  tokenAddress: string,
  paymasterAddress: string
) {
  const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
    type: 'ERC20',
    token: tokenAddress,
    // Minimum exchange rate allowed by Paymaster
    minAllowance: ethers.BigNumber.from('100'),
  })

  const tx = {
    to: wallet.address,
    value: 0,
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  const gasEstimate = await wallet.estimateGas(tx)
  return wallet.sendTransaction({ ...tx, gasLimit: gasEstimate })
}
```

## Using the zksync-web3 SDK

`zksync-web3` is zkSync's official JavaScript SDK. Its API design is highly compatible with ethers.js, but adds zkSync-specific features.

### Basic Usage

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

// Initialize Provider
const zkSyncProvider = new Provider('https://zksync-era-mainnet.chainstacklabs.com')
const ethereumProvider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY'
)

// Create zkSync wallet from Ethereum wallet
const ethWallet = new ethers.Wallet(PRIVATE_KEY, ethereumProvider)
const zkSyncWallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethWallet)

// Query balances
const ethBalance = await zkSyncWallet.getBalance()
const tokenBalances = await zkSyncWallet.getBalances()

// L1 -> L2 deposit
async function depositETH(amount: string) {
  const tx = await zkSyncWallet.deposit({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
    // optional: refundRecipient
  })

  // Wait for L1 transaction confirmation
  await tx.wait()

  // Wait for L2 to reflect (usually takes a few minutes)
  await tx.waitFinalize()

  return tx
}

// L2 transfer
async function transfer(token: string, to: string, amount: string) {
  const tx = await zkSyncWallet.transfer({
    to,
    token,
    amount: ethers.utils.parseEther(amount),
  })

  await tx.wait()
  return tx
}

// L2 -> L1 withdrawal
async function withdrawETH(amount: string) {
  const tx = await zkSyncWallet.withdraw({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
  })

  // L2 transaction confirmation (usually a few seconds)
  await tx.wait()

  // Note: Although no 7-day challenge period is needed,
  // you still need to wait for ZK Proof to be verified (a few hours)
  // Users do not need to manually finalize!
  return tx
}
```

### ethers v6 Adapter

For projects that need to use ethers v6, zkSync provides an adapter:

```typescript
import { ethers } from 'ethers'
import { ZkSyncEthersAdapter } from 'zksync-web3'

const adapter = new ZkSyncEthersAdapter({
  zkSyncProvider,
  ethProvider,
})

// Use ethers v6's Contract through the adapter
const contract = adapter.getContract(
  contractAddress,
  abi,
  zkSyncWallet
)

// Calling contract methods is consistent with ethers v6
const tx = await contract.transfer(recipient, amount)
await tx.wait()
```

## Deploying Contracts to zkSync

### Compiler Differences

zkSync uses its own compiler `zksolc`, rather than the standard `solc`. `zksolc` takes `solc`'s output as input, then compiles to zkEVM bytecode.

```bash
# Install zksolc
npm install -g @matterlabs/zksolc-bin

# Compile contracts
zksolc --combined-json bin,abi contracts/MyContract.sol
```

### Deploying with Hardhat Plugin

```typescript
// hardhat.config.ts
import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'

export default {
  solidity: {
    version: '0.8.17',
  },
  zksolc: {
    version: '1.3.1',
    compilerSource: 'binary',
    settings: {
      optimizer: {
        enabled: true,
        mode: 'z',
      },
    },
  },
  networks: {
    zkSyncTestnet: {
      url: 'https://zksync2-testnet.zksync.dev',
      ethNetwork: 'goerli',
      zksync: true,
    },
    zkSyncMainnet: {
      url: 'https://zksync2-mainnet.zksync.io',
      ethNetwork: 'mainnet',
      zksync: true,
    },
  },
}
```

```typescript
// deploy/deploy.ts
import { Wallet, utils, ContractFactory } from 'zksync-web3'
import * as ethers from 'ethers'
import { readFileSync } from 'fs'

async function deploy() {
  const wallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethProvider)

  // Read compiled ABI and bytecode
  const artifact = JSON.parse(
    readFileSync('./artifacts/MyContract.json', 'utf8')
  )

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  )

  // Deploy contract
  const contract = await factory.deploy(
    constructorArg1,
    constructorArg2
  )

  await contract.deployed()
  console.log('Contract deployed to:', contract.address)
}

deploy()
```

## Frontend Network Configuration and MetaMask Integration

### Adding zkSync Network to MetaMask

```typescript
// lib/network.ts
export const ZK_SYNC_MAINNET = {
  chainId: '0x144', // 324
  chainName: 'zkSync Era Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-mainnet.zksync.io'],
  blockExplorerUrls: ['https://explorer.zksync.io'],
}

export const ZK_SYNC_TESTNET = {
  chainId: '0x118', // 280
  chainName: 'zkSync Era Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-testnet.zksync.dev'],
  blockExplorerUrls: ['https://goerli.explorer.zksync.io'],
}

export async function switchToZkSync(
  provider: ethers.providers.Web3Provider
) {
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: ZK_SYNC_MAINNET.chainId },
    ])
  } catch (switchError: any) {
    // Chain not yet added to MetaMask
    if (switchError.code === 4902) {
      await provider.send('wallet_addEthereumChain', [ZK_SYNC_MAINNET])
    } else {
      throw switchError
    }
  }
}
```

### Frontend zkSync Wallet Connection

```typescript
// hooks/useZkSyncWallet.ts
import { useState, useEffect } from 'react'
import { Provider, Wallet } from 'zksync-web3'
import { ethers } from 'ethers'

export function useZkSyncWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [l1Provider, setL1Provider] =
    useState<ethers.providers.Web3Provider | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    const ethProvider = new ethers.providers.Web3Provider(
      window.ethereum
    )
    const zkProvider = new Provider(
      'https://zksync2-mainnet.zksync.io'
    )

    setL1Provider(ethProvider)
    setProvider(zkProvider)

    // Check connected accounts
    ethProvider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0])
      }
    })

    // Listen for account changes
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // Listen for chain changes
    window.ethereum.on('chainChanged', () => {
      window.location.reload()
    })
  }, [])

  const connect = async () => {
    if (!l1Provider) return
    const accounts = await l1Provider.send('eth_requestAccounts', [])
    setAccount(accounts[0])
  }

  return { account, provider, l1Provider, connect }
}
```

## L1 <-> L2 Message Passing

zkSync supports bidirectional message passing between L1 and L2. Unlike Optimistic Rollup, L2 → L1 messages do not require a 7-day challenge period, but do need to wait for ZK Proof verification.

### L1 → L2 Messages

```typescript
// Send a message from L1 to L2 (not just a deposit)
async function sendL1ToL2Message(
  l1Wallet: ethers.Wallet,
  zkSyncProvider: Provider,
  l2ContractAddress: string,
  calldata: string
) {
  // Use zkSync's Mailbox contract
  const mailboxAddress = '0x...'
  const mailbox = new ethers.Contract(
    mailboxAddress,
    [
      'function requestL2Transaction(address _contract, uint256 _l2Value, bytes _calldata, uint256 _l2GasLimit, uint256 _l2GasPerPubdataByteLimit, bytes[] _factoryDeps, address _refundRecipient) external payable',
    ],
    l1Wallet
  )

  const tx = await mailbox.requestL2Transaction(
    l2ContractAddress,
    0, // L2 value
    calldata,
    1_000_000, // L2 gas limit
    800, // gas per pubdata byte
    [], // factory deps
    l1Wallet.address // refund recipient
  )

  await tx.wait()

  // Wait for execution on L2
  const l2TxHash = await zkSyncProvider.getL2TxHashFromPriorityOp(tx)
  await zkSyncProvider.wait(l2TxHash)

  return { l1TxHash: tx.hash, l2TxHash }
}
```

### L2 → L1 Messages

```typescript
// Send a message from L2 to L1
async function sendL2ToL1Message(
  zkSyncWallet: Wallet,
  l1ContractAddress: string,
  calldata: string
) {
  const tx = await zkSyncWallet.sendTransaction({
    to: l1ContractAddress,
    data: calldata,
    // L1 gas limit
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  })

  await tx.wait()
  return tx.hash
}
```

## Complete zkSync DApp Frontend Module

```typescript
// lib/zkSyncDApp.ts
import { Provider, Wallet, utils, types } from 'zksync-web3'
import { ethers, BigNumber } from 'ethers'

export class ZkSyncDApp {
  private provider: Provider
  private l1Provider: ethers.providers.JsonRpcProvider
  private wallet: Wallet | null = null

  constructor(
    zkSyncRpcUrl: string,
    l1RpcUrl: string
  ) {
    this.provider = new Provider(zkSyncRpcUrl)
    this.l1Provider = new ethers.providers.JsonRpcProvider(l1RpcUrl)
  }

  // Connect wallet
  connect(privateKey: string) {
    this.wallet = new Wallet(
      privateKey,
      this.provider,
      new ethers.Wallet(privateKey, this.l1Provider)
    )
  }

  // Get balances (ETH + ERC-20)
  async getAllBalances(address: string) {
    const balances = await this.provider.getAllBalances(address)
    return balances
  }

  // Deposit (L1 -> L2)
  async deposit(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.deposit({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L1 confirmation
    await tx.waitFinalize() // L2 confirmation

    return tx
  }

  // L2 transfer
  async transfer(token: string, to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.transfer({
      to,
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    return tx.wait()
  }

  // Withdraw (L2 -> L1)
  async withdraw(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.withdraw({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L2 confirmation
    // No manual finalize needed! Automatically credited after ZK Proof verification

    return tx
  }

  // Send transaction with Paymaster (ERC-20 gas payment)
  async sendWithPaymaster(
    to: string,
    data: string,
    paymasterAddress: string,
    gasToken: string
  ) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
      type: 'ERC20',
      token: gasToken,
      minAllowance: BigNumber.from('0'),
    })

    const gasEstimate = await this.wallet.estimateGas({
      to,
      data,
      from: this.wallet.address,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    const tx = await this.wallet.sendTransaction({
      to,
      data,
      gasLimit: gasEstimate,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    return tx.wait()
  }

  // Get transaction status
  async getTransactionStatus(txHash: string) {
    const receipt = await this.provider.getTransactionReceipt(txHash)
    if (!receipt) return null

    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.transactionIndex,
      gasUsed: receipt.gasUsed.toString(),
      // zkSync-specific: pubdata byte gas
      gasPerPubdataUsed: receipt.gasPerPubdataUsed?.toString(),
    }
  }
}
```

## Gas Estimation and Transaction Confirmation Characteristics

zkSync's gas model differs significantly from L1, introducing the concept of "pubdata":

```typescript
// zkSync Gas model
// Total Gas = L2 Gas + L1 Gas (for publishing pubdata)

// pubdata is the data published to L1, which determines cost
// Each transaction has a gasPerPubdata parameter

async function estimateGas(
  wallet: Wallet,
  tx: types.TransactionRequest
) {
  // zkSync-specific gas estimation
  const gasEstimate = await wallet.estimateGas(tx)

  // Also need to estimate pubdata gas
  const pubdataGas = await wallet.estimateGasL1ToL2(tx)

  return {
    l2Gas: gasEstimate,
    pubdataGas,
    total: gasEstimate.add(pubdataGas),
  }
}
```

Transaction confirmation characteristics:

- **L2 transactions**: Usually confirmed in 1-2 seconds (instant)
- **L1 → L2 deposits**: Require L1 confirmation + L2 final confirmation (a few minutes)
- **L2 → L1 withdrawals**: Require ZK Proof verification (a few hours), but no manual finalize needed

## Frontend Adaptation Differences from Optimistic Rollup

| Dimension | Optimistic Rollup | zkSync Era |
|------|------------------|------------|
| Withdrawal time | ~7 days | A few hours |
| Withdrawal operation | Requires manual finalize | Automatic |
| Gas payment | ETH only | ETH + ERC-20 (Paymaster) |
| Account model | EOA + smart contract | Native account abstraction |
| SDK | ethers.js compatible | zksync-web3 (ethers-derived) |
| Contract deployment | Direct deployment | Requires zksolc compilation |
| State polling | Complex (cross-chain) | Simple (auto-confirmation) |

## Summary

zkSync Era's frontend development is simpler than Optimistic Rollup in many ways—withdrawals don't require manual finalize, and there's no need to manage a 7-day waiting period state machine. However, zkSync introduces new concepts: Paymaster, account abstraction, and the pubdata gas model, all of which require frontend developers to learn new interaction patterns.

Paymaster is zkSync's most innovative feature. It allows DApps to subsidize users' gas fees or lets users pay gas with stablecoins, which has tremendous value for lowering user barriers. Implementing gas sponsorship on traditional EVM requires complex relayer infrastructure, while on zkSync it's a natively supported capability.

For SDK selection, `zksync-web3` is highly compatible with ethers v5, resulting in low migration cost. However, attention is needed for zkSync-specific `customData` fields and gas estimation methods. For existing EVM DApps, the main work in migrating to zkSync involves: adjusting the contract compilation pipeline (using zksolc), adapting Paymaster, and testing zkEVM compatibility (certain opcodes are unavailable).

With the rapid development of the zkRollup ecosystem and the maturation of zero-knowledge proof technology, zkSync represents an important direction for Layer 2 scaling. Frontend developers should familiarize themselves with this new interaction model as early as possible.
