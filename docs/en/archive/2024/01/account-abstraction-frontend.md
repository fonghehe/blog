---
title: "Account Abstraction (ERC-4337) Frontend Practices"
date: 2024-01-14 15:17:29
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 12
description: "An in-depth analysis of ERC-4337 account abstraction frontend practices, covering UserOperation lifecycle, Bundler interaction, Paymaster gas sponsorship, and social recovery solutions"
wordCount: 3800
---

## ERC-4337 Account Abstraction Overview

Account Abstraction (ERC-4337) is one of the most transformative proposals on Ethereum. Its core goal is to move account verification logic from the protocol layer to the contract layer, enabling smart accounts to have custom signature verification, gas payment, and execution logic.

In the traditional Ethereum model, there are two types of accounts: Externally Owned Accounts (EOA) and Contract Accounts (CA). EOAs are controlled by private keys, can only initiate transactions, and have a fixed signature algorithm of secp256k1 ECDSA. Contract accounts cannot proactively initiate transactions — they can only be called by EOAs. This limitation leads to poor user experience: users must manage private keys, hold ETH for gas payments, and cannot perform batch operations or social recovery.

ERC-4337 chose a path that does not modify the consensus layer. It introduces a separate mempool system — the UserOperation mempool — and a role called the Bundler. A Bundler is a regular EOA that collects UserOperations from the UserOp mempool, packages them, and submits them on-chain through a singleton contract called `EntryPoint`. This design achieves account abstraction without changing L1 consensus.

## Smart Account vs EOA: Architecture Differences

Understanding the architectural differences between Smart Accounts and EOAs is a prerequisite for proper frontend adaptation.

```
EOA Model:
┌──────────┐     ┌──────────────┐
│  User Private Key  │────▶│  EOA Account  │────▶│  Contract Call  │
└──────────┘     └──────────────┘

Smart Account Model:
┌──────────┐     ┌──────────────────┐     ┌─────────────┐
│  Signature Scheme  │────▶│  Smart Account    │◀────│  Paymaster   │
│  (Arbitrary)   │     │  (Contract Wallet)       │     │  (Gas Sponsorship)   │
└──────────┘     └──────────────────┘     └─────────────┘
                        ▲
                        │
                 ┌─────────────┐
                 │   Bundler    │
                 │  (Package & Submit)   │
                 └─────────────┘
```

The verification logic of a Smart Account is entirely defined by contract code. It can use any verification scheme such as Passkey, Session Key, multi-sig, or social recovery. The frontend no longer needs to handle fixed signature patterns like `personal_sign`; instead, it constructs signature data based on the account contract's `validateUserOp` function.

## UserOperation Data Structure and Lifecycle

UserOperation (UserOp for short) is the core data structure of ERC-4337. It is similar to a regular transaction but with different fields:

```typescript
interface UserOperation {
  sender: string;              // Smart account address
  nonce: bigint;               // Anti-replay nonce
  initCode: string;            // Initialization code for account deployment
  callData: string;            // Call data to execute
  callGasLimit: bigint;        // Gas limit for executing callData
  verificationGasLimit: bigint;// Gas limit for the verification phase
  preVerificationGas: bigint;  // Pre-verification gas
  maxFeePerGas: bigint;        // Maximum gas price
  maxPriorityFeePerGas: bigint;// Priority fee
  paymasterAndData: string;    // Paymaster address and additional data
  signature: string;           // Signature
}
```

The UserOp lifecycle starts from frontend construction and goes through the following stages:

1. **Construction**: The frontend assembles UserOp fields, some of which require estimation from the Bundler
2. **Signing**: The user signs the UserOp hash using their verification scheme
3. **Submission**: Sent to the Bundler via `eth_sendUserOperation`
4. **Packaging**: The Bundler packages multiple UserOps into a single transaction
5. **Execution**: `EntryPoint` verifies and executes each UserOp one by one
6. **Confirmation**: The frontend polls for the result via `eth_getUserOperationReceipt`

## Bundler: Frontend Interaction for Packaging UserOps

The Bundler exposes a set of JSON-RPC methods that the frontend uses to interact with it. Below is a complete Bundler interaction module:

```typescript
import { createClient, http, type Address, type Hash } from 'viem'
import { mainnet } from 'viem/chains'

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0F08D8E4965195975AD86BD9d027E73' as Address

interface BundlerClient {
  sendUserOperation: (userOp: UserOperation, entryPoint: Address) => Promise<Hash>
  estimateUserOperationGas: (userOp: UserOperation, entryPoint: Address) => Promise<{
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
  }>
  getUserOperationReceipt: (userOpHash: Hash) => Promise<UserOperationReceipt | null>
  getUserOperationByHash: (userOpHash: Hash) => Promise<UserOperationFull | null>
}

interface UserOperation {
  sender: Address
  nonce: bigint
  initCode: `0x${string}`
  callData: `0x${string}`
  callGasLimit: bigint
  verificationGasLimit: bigint
  preVerificationGas: bigint
  maxFeePerGas: bigint
  maxPriorityFeePerGas: bigint
  paymasterAndData: `0x${string}`
  signature: `0x${string}`
}

interface UserOperationReceipt {
  userOpHash: Hash
  sender: Address
  nonce: bigint
  success: boolean
  actualGasCost: bigint
  actualGasUsed: bigint
  logs: any[]
  receipt: {
    transactionHash: Hash
    blockNumber: bigint
    blockHash: Hash
    status: '0x1' | '0x0'
  }
}

// Create Bundler client
function createBundlerClient(bundlerUrl: string): BundlerClient {
  const transport = http(bundlerUrl)

  return {
    async sendUserOperation(userOp: UserOperation, entryPoint: Address): Promise<Hash> {
      const response = await transport({}).request({
        method: 'eth_sendUserOperation',
        params: [
          {
            sender: userOp.sender,
            nonce: toHex(userOp.nonce),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: toHex(userOp.callGasLimit),
            verificationGasLimit: toHex(userOp.verificationGasLimit),
            preVerificationGas: toHex(userOp.preVerificationGas),
            maxFeePerGas: toHex(userOp.maxFeePerGas),
            maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature,
          },
          entryPoint,
        ],
      })
      return response as Hash
    },

    async estimateUserOperationGas(userOp: UserOperation, entryPoint: Address) {
      const response = await transport({}).request({
        method: 'eth_estimateUserOperationGas',
        params: [serializeUserOp(userOp), entryPoint],
      })
      return {
        callGasLimit: BigInt(response.callGasLimit),
        verificationGasLimit: BigInt(response.verificationGasLimit),
        preVerificationGas: BigInt(response.preVerificationGas),
      }
    },

    async getUserOperationReceipt(userOpHash: Hash) {
      try {
        const response = await transport({}).request({
          method: 'eth_getUserOperationReceipt',
          params: [userOpHash],
        })
        return response ? parseUserOpReceipt(response) : null
      } catch {
        return null
      }
    },

    async getUserOperationByHash(userOpHash: Hash) {
      const response = await transport({}).request({
        method: 'eth_getUserOperationByHash',
        params: [userOpHash],
      })
      return response || null
    },
  }
}

function toHex(value: bigint): `0x${string}` {
  return `0x${value.toString(16)}`
}

function serializeUserOp(userOp: UserOperation) {
  return {
    sender: userOp.sender,
    nonce: toHex(userOp.nonce),
    initCode: userOp.initCode,
    callData: userOp.callData,
    callGasLimit: toHex(userOp.callGasLimit),
    verificationGasLimit: toHex(userOp.verificationGasLimit),
    preVerificationGas: toHex(userOp.preVerificationGas),
    maxFeePerGas: toHex(userOp.maxFeePerGas),
    maxPriorityFeePerGas: toHex(userOp.maxPriorityFeePerGas),
    paymasterAndData: userOp.paymasterAndData,
    signature: userOp.signature,
  }
}

function parseUserOpReceipt(raw: any): UserOperationReceipt {
  return {
    userOpHash: raw.userOpHash,
    sender: raw.sender,
    nonce: BigInt(raw.nonce),
    success: raw.success,
    actualGasCost: BigInt(raw.actualGasCost),
    actualGasUsed: BigInt(raw.actualGasUsed),
    logs: raw.logs,
    receipt: {
      transactionHash: raw.receipt.transactionHash,
      blockNumber: BigInt(raw.receipt.blockNumber),
      blockHash: raw.receipt.blockHash,
      status: raw.receipt.status,
    },
  }
}

export { createBundlerClient, ENTRY_POINT_ADDRESS }
export type { BundlerClient, UserOperation, UserOperationReceipt }
```

## Paymaster: Frontend Integration of Gas Sponsorship Mechanism

Paymaster is the key role in ERC-4337 for achieving gas abstraction. It is a contract that can pay gas fees for UserOps. The core of frontend integration lies in correctly constructing the `paymasterAndData` field.

```typescript
// Paymaster interaction module
import type { Address, UserOperation } from './bundler-client'

interface PaymasterConfig {
  paymasterAddress: Address
  paymasterUrl: string // Paymaster's RPC endpoint
}

// Request signature from Paymaster and obtain paymasterAndData
async function sponsorUserOp(
  userOp: UserOperation,
  config: PaymasterConfig,
  sponsorshipType: 'free' | 'token' = 'free',
): Promise<UserOperation> {
  const response = await fetch(config.paymasterUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      method: 'pm_sponsorUserOperation',
      params: [
        {
          sender: userOp.sender,
          nonce: `0x${userOp.nonce.toString(16)}`,
          initCode: userOp.initCode,
          callData: userOp.callData,
          callGasLimit: `0x${userOp.callGasLimit.toString(16)}`,
          verificationGasLimit: `0x${userOp.verificationGasLimit.toString(16)}`,
          preVerificationGas: `0x${userOp.preVerificationGas.toString(16)}`,
          maxFeePerGas: `0x${userOp.maxFeePerGas.toString(16)}`,
          maxPriorityFeePerGas: `0x${userOp.maxPriorityFeePerGas.toString(16)}`,
          signature: '0x',
        },
        {
          type: sponsorshipType,
          // If paying with tokens, specify the token address
          token: sponsorshipType === 'token' ? '0x...' : undefined,
        },
      ],
    }),
  })

  const result = await response.json()

  if (!result.ok) {
    throw new Error(`Paymaster sponsorship failed: ${result.reason}`)
  }

  return {
    ...userOp,
    paymasterAndData: result.paymasterAndData,
  }
}
```

## Social Recovery and Multi-Sig Frontend Interaction

One of the biggest advantages of Smart Accounts is support for social recovery. Users can designate a set of "guardian" addresses that can recover account access through guardian voting when a private key is lost.

```typescript
// Social recovery frontend interaction
import { encodeFunctionData, type Address } from 'viem'

// Initiate social recovery request
async function initiateSocialRecovery(
  smartAccount: Address,
  newOwner: Address,
  guardians: Address[],
  bundlerClient: BundlerClient,
): Promise<Hash> {
  // Construct recovery call's callData
  const callData = encodeFunctionData({
    abi: recoveryAbi,
    functionName: 'startRecovery',
    args: [newOwner],
  })

  // Guardians sign approval one by one
  const guardianSignatures = await Promise.all(
    guardians.map(async (guardian) => {
      const message = encodeRecoveryMessage(smartAccount, newOwner)
      return await signWithGuardian(guardian, message)
    }),
  )

  // Construct UserOp
  const userOp: Partial<UserOperation> = {
    sender: smartAccount,
    callData,
    // Guardian signatures as additional verification data
    signature: encodeGuardianSignatures(guardianSignatures),
  }

  // Fill in gas estimation and other fields
  const fullUserOp = await fillUserOp(userOp, bundlerClient)

  // Send to Bundler
  return await bundlerClient.sendUserOperation(fullUserOp, ENTRY_POINT_ADDRESS)
}
```

The multi-sig scenario is similar — the frontend needs to coordinate multiple signers, collect sufficient signatures, and then construct the complete UserOp. This interaction pattern is similar to Gnosis Safe, but the underlying submission method is different.

## Complete AA Frontend Interaction Module

Below is an end-to-end AA frontend interaction module covering account deployment, gas-sponsored transactions, and status tracking:

```typescript
import { createPublicClient, http, encodeFunctionData, type Address, type Hash } from 'viem'
import { mainnet } from 'viem/chains'
import {
  createBundlerClient,
  ENTRY_POINT_ADDRESS,
  type UserOperation,
  type BundlerClient,
} from './bundler-client'
import { sponsorUserOp } from './paymaster'

class SmartAccountClient {
  private bundler: BundlerClient
  private publicClient: ReturnType<typeof createPublicClient>
  private accountAddress: Address | null = null
  private signer: Signer

  constructor(
    private config: {
      bundlerUrl: string
      rpcUrl: string
      accountFactoryAddress: Address
      paymasterConfig?: PaymasterConfig
    },
    signer: Signer,
  ) {
    this.bundler = createBundlerClient(config.bundlerUrl)
    this.publicClient = createPublicClient({
      chain: mainnet,
      transport: http(config.rpcUrl),
    })
    this.signer = signer
  }

  // Compute counterfactual address (account address before deployment)
  async getCounterfactualAddress(salt: bigint = 0n): Promise<Address> {
    const initCode = this.buildInitCode(salt)
    // Call the factory's getAddress function
    const address = await this.publicClient.readContract({
      address: this.config.accountFactoryAddress,
      abi: accountFactoryAbi,
      functionName: 'getAddress',
      args: [this.signer.getAddress(), salt],
    })
    this.accountAddress = address as Address
    return address
  }

  // Send transaction (automatically handles account deployment)
  async sendTransaction(
    target: Address,
    value: bigint,
    data: `0x${string}` = '0x',
  ): Promise<Hash> {
    const sender = this.accountAddress!
    const isDeployed = await this.isAccountDeployed(sender)

    // Construct callData
    const callData = encodeFunctionData({
      abi: smartAccountAbi,
      functionName: 'execute',
      args: [target, value, data],
    })

    // Get nonce
    const nonce = await this.getAccountNonce(sender)

    // Construct base UserOp
    let userOp: UserOperation = {
      sender,
      nonce,
      initCode: isDeployed ? '0x' : this.buildInitCode(0n),
      callData,
      callGasLimit: 0n,
      verificationGasLimit: 0n,
      preVerificationGas: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      paymasterAndData: '0x',
      signature: '0x',
    }

    // Gas estimation
    const gasEstimate = await this.bundler.estimateUserOperationGas(
      userOp,
      ENTRY_POINT_ADDRESS,
    )
    userOp = { ...userOp, ...gasEstimate }

    // Get gas price
    const feeData = await this.publicClient.getGasPrice()
    userOp.maxFeePerGas = feeData * 12n / 10n
    userOp.maxPriorityFeePerGas = feeData / 5n

    // Paymaster sponsorship
    if (this.config.paymasterConfig) {
      userOp = await sponsorUserOp(userOp, this.config.paymasterConfig)
    }

    // User signature
    const userOpHash = this.getUserOpHash(userOp)
    userOp.signature = await this.signer.signMessage(userOpHash)

    // Send to Bundler
    const hash = await this.bundler.sendUserOperation(userOp, ENTRY_POINT_ADDRESS)

    // Wait for confirmation
    await this.waitForUserOp(hash)

    return hash
  }

  // Wait for UserOp confirmation
  private async waitForUserOp(userOpHash: Hash, timeout = 120000): Promise<void> {
    const start = Date.now()
    while (Date.now() - start < timeout) {
      const receipt = await this.bundler.getUserOperationReceipt(userOpHash)
      if (receipt) {
        if (!receipt.success) {
          throw new Error(`UserOp failed: ${receipt.receipt.transactionHash}`)
        }
        return
      }
      await new Promise((r) => setTimeout(r, 3000))
    }
    throw new Error('UserOp timeout')
  }

  private async isAccountDeployed(address: Address): Promise<boolean> {
    const code = await this.publicClient.getCode({ address })
    return code !== '0x'
  }

  private async getAccountNonce(address: Address): Promise<bigint> {
    return await this.publicClient.readContract({
      address: ENTRY_POINT_ADDRESS,
      abi: entryPointAbi,
      functionName: 'getNonce',
      args: [address, 0n],
    })
  }

  private buildInitCode(salt: bigint): `0x${string}` {
    const initCode = encodeFunctionData({
      abi: accountFactoryAbi,
      functionName: 'createAccount',
      args: [this.signer.getAddress(), salt],
    })
    return `${this.config.accountFactoryAddress}${initCode.slice(2)}` as `0x${string}`
  }

  private getUserOpHash(userOp: UserOperation): `0x${string}` {
    // Compute UserOp hash according to ERC-4337 spec
    const packed = encodePacked(
      ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
      [
        userOp.sender,
        userOp.nonce,
        keccak256(userOp.initCode),
        keccak256(userOp.callData),
        userOp.callGasLimit,
        userOp.verificationGasLimit,
        userOp.preVerificationGas,
        userOp.maxFeePerGas,
        userOp.maxPriorityFeePerGas,
        keccak256(userOp.paymasterAndData),
      ],
    )
    return keccak256(encodePacked(
      ['bytes32', 'address', 'uint256'],
      [keccak256(packed), ENTRY_POINT_ADDRESS, BigInt(mainnet.id)],
    ))
  }
}

export { SmartAccountClient }
```

## User Experience: Gasless Transactions and Batch Operations

The biggest UX improvements brought by account abstraction are **gasless transactions** and **batch operations**.

Gasless transactions are implemented through Paymaster. The frontend requests Paymaster sponsorship before sending a UserOp, so the user doesn't need to hold ETH. The Paymaster can choose to sponsor for free (as a customer acquisition cost) or accept ERC-20 token payments for gas.

Batch operations are implemented through the Smart Account's `executeBatch` function. Users can package multiple operations — such as approve + swap + stake — into a single UserOp, requiring only one signature and one gas payment.

```typescript
// Batch operation example
async function batchOperations(account: SmartAccountClient) {
  // Complete in one go: approve USDC -> swap to ETH -> stake ETH
  const batchCallData = encodeFunctionData({
    abi: smartAccountAbi,
    functionName: 'executeBatch',
    args: [
      [USDC_ADDRESS, ROUTER_ADDRESS, STAKING_ADDRESS],
      [0n, 0n, parseEther('10')],
      [
        encodeFunctionData({ abi: erc20Abi, functionName: 'approve', args: [ROUTER_ADDRESS, parseUnits('1000', 6)] }),
        encodeFunctionData({ abi: routerAbi, functionName: 'swap', args: [...] }),
        encodeFunctionData({ abi: stakingAbi, functionName: 'stake', args: [] }),
      ],
    ],
  })

  await account.sendTransaction(account.getAddress()!, 0n, batchCallData)
}
```

## Security Boundaries: Signature Verification and Session Keys

Session Key is an important security primitive in the AA context. It is a restricted key that can only perform specific operations on specific contracts, with time windows and amount limits.

```typescript
interface SessionKeyConfig {
  key: Address           // Session Key address
  approvedContracts: Address[] // Whitelist of allowed contracts
  maxAmountPerTx: bigint      // Maximum amount per transaction
  validUntil: number          // Expiration timestamp
  validAfter: number          // Effective timestamp
}

// Register Session Key on frontend
async function registerSessionKey(
  account: SmartAccountClient,
  config: SessionKeyConfig,
): Promise<Hash> {
  const data = encodeFunctionData({
    abi: smartAccountAbi,
    functionName: 'addSessionKey',
    args: [
      config.key,
      config.approvedContracts,
      config.maxAmountPerTx,
      BigInt(config.validUntil),
      BigInt(config.validAfter),
    ],
  })
  return account.sendTransaction(account.getAddress()!, 0n, data)
}
```

The risk of session keys lies in the key itself being compromised. The frontend should store Session Keys in sessionStorage rather than localStorage, and clear them when the page is closed.

## Coexistence with Traditional EOA Wallet Frontend Adaptation

During the transition period, DApps need to support both EOA wallets (MetaMask, etc.) and Smart Accounts simultaneously. The recommended architecture is to abstract a unified Wallet Interface:

```typescript
interface UnifiedWallet {
  address: Address
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>
  signMessage: (msg: string) Promise<string>
  isSmartAccount: boolean
}

// EOA adapter
class EOAWalletAdapter implements UnifiedWallet {
  isSmartAccount = false
  // Delegates to window.ethereum
}

// Smart Account adapter
class SmartAccountAdapter implements UnifiedWallet {
  isSmartAccount = true
  // Delegates to SmartAccountClient
}

// Unified connection entry point
async function connectWallet(): Promise<UnifiedWallet> {
  // Try Smart Account first (if user has configured it)
  // Fall back to EOA
}
```

This adapter pattern allows upper-layer components to be agnostic to the underlying account type, keeping business code consistent.

## Summary

ERC-4337 account abstraction fundamentally changes Ethereum's interaction model. For the frontend, the core changes are: transaction construction shifts from `eth_sendTransaction` to the UserOp flow, gas payment shifts from user-paid to optional sponsorship, and signature schemes shift from fixed ECDSA to contract-defined custom schemes. These changes bring better user experience but also increase frontend complexity — Bundler interaction, Paymaster integration, and gas estimation methods are all different from the traditional model. During the transition period, DApps need to adapt to both EOA and Smart Account simultaneously, and a unified abstraction layer is the pragmatic choice. In the long run, Smart Accounts will become the default account model, and frontend architectures should prepare for this.
