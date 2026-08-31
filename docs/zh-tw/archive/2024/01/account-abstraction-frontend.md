---
title: "賬戶抽象 (ERC-4337) 前端實踐"
date: 2024-01-14 15:17:29
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 10
description: "深入解析 ERC-4337 賬戶抽象的前端實踐，涵蓋 UserOperation 生命週期、Bundler 交互、Paymaster Gas 贊助及社交恢復方案"
wordCount: 1294
---

## ERC-4337 賬戶抽象概述

賬戶抽象（Account Abstraction, ERC-4337）是以太坊上最具變革性的提案之一。其核心目標是將賬戶的驗證邏輯從協議層移至合約層，使得智能賬戶可以擁有自定義的簽名驗證、Gas 支付和執行邏輯。

在傳統以太坊模型中，存在兩種賬戶：外部擁有賬戶（EOA）和合約賬戶（CA）。EOA 由私鑰控制，只能發起交易且簽名算法固定為 secp256k1 ECDSA。合約賬戶無法主動發起交易——它們只能被 EOA 調用。這種限制導致了糟糕的用戶體驗：用戶必須管理私鑰、持有 ETH 支付 Gas、且無法實現批量操作或社交恢復。

ERC-4337 選擇了不修改共識層的路線。它引入了一個獨立的 mempool 系統——UserOperation mempool，以及一個名為 Bundler 的角色。Bundler 是一個常規的 EOA，它從 UserOp mempool 中收集 UserOperations，打包後通過一個名為 `EntryPoint` 的單例合約提交到鏈上。這種設計在不改變 L1 共識的前提下實現了賬戶抽象。

## Smart Account vs EOA：架構差異

理解 Smart Account 與 EOA 的架構差異，是做好前端適配的前提。

```
EOA 模型：
┌──────────┐     ┌──────────────┐
│  用戶私鑰  │────▶│  EOA Account  │────▶│  合約調用  │
└──────────┘     └──────────────┘

Smart Account 模型：
┌──────────┐     ┌──────────────────┐     ┌─────────────┐
│  簽名方案  │────▶│  Smart Account    │◀────│  Paymaster   │
│  (任意)   │     │  (合約錢包)       │     │  (Gas 贊助)   │
└──────────┘     └──────────────────┘     └─────────────┘
                        ▲
                        │
                 ┌─────────────┐
                 │   Bundler    │
                 │  (打包提交)   │
                 └─────────────┘
```

Smart Account 的驗證邏輯完全由合約代碼定義。它可以使用 Passkey、Session Key、多籤、社交恢復等任意驗證方案。前端不再需要處理 `personal_sign` 這種固定的簽名模式，而是根據賬戶合約的 `validateUserOp` 函數來構造簽名數據。

## UserOperation 數據結構與生命週期

UserOperation（簡稱 UserOp）是 ERC-4337 的核心數據結構。它類似於常規交易但字段不同：

```typescript
interface UserOperation {
  sender: string;              // 智能賬戶地址
  nonce: bigint;               // 防重放 nonce
  initCode: string;            // 部署賬戶時的初始化代碼
  callData: string;            // 要執行的調用數據
  callGasLimit: bigint;        // 執行 callData 的 Gas 限制
  verificationGasLimit: bigint;// 驗證階段的 Gas 限制
  preVerificationGas: bigint;  // 預驗證 Gas
  maxFeePerGas: bigint;        // 最大 Gas 價格
  maxPriorityFeePerGas: bigint;// 優先費
  paymasterAndData: string;    // Paymaster 地址及附加數據
  signature: string;           // 簽名
}
```

UserOp 的生命週期從前端構造開始，經歷以下階段：

1. **構造**：前端組裝 UserOp 字段，部分字段需要從 Bundler 估算
2. **簽名**：用戶用其驗證方案對 UserOp 哈希簽名
3. **提交**：通過 `eth_sendUserOperation` 發送到 Bundler
4. **打包**：Bundler 將多個 UserOp 打包成一筆交易
5. **執行**：`EntryPoint` 逐一驗證並執行每個 UserOp
6. **確認**：前端通過 `eth_getUserOperationReceipt` 輪詢結果

## Bundler：打包 UserOp 的前端交互

Bundler 暴露了一組 JSON-RPC 方法，前端通過這些方法與之交互。以下是完整的 Bundler 交互模塊：

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

// 創建 Bundler 客戶端
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

## Paymaster：Gas 贊助機制的前端集成

Paymaster 是 ERC-4337 中實現 Gas 抽象的關鍵角色。它是一個合約，可以為 UserOp 支付 Gas 費用。前端集成的核心在於正確構造 `paymasterAndData` 字段。

```typescript
// Paymaster 交互模塊
import type { Address, UserOperation } from './bundler-client'

interface PaymasterConfig {
  paymasterAddress: Address
  paymasterUrl: string // Paymaster 的 RPC 端點
}

// 向 Paymaster 請求籤名並獲取 paymasterAndData
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
          // 如果是 token 支付，指定代幣地址
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

## 社交恢復與多籤的前端交互

Smart Account 的最大優勢之一是支持社交恢復。用戶可以指定一組"守護者"地址，在私鑰丟失時通過守護者投票恢復賬戶訪問。

```typescript
// 社交恢復前端交互
import { encodeFunctionData, type Address } from 'viem'

// 發起社交恢復請求
async function initiateSocialRecovery(
  smartAccount: Address,
  newOwner: Address,
  guardians: Address[],
  bundlerClient: BundlerClient,
): Promise<Hash> {
  // 構造恢復調用的 callData
  const callData = encodeFunctionData({
    abi: recoveryAbi,
    functionName: 'startRecovery',
    args: [newOwner],
  })

  // 守護者逐一簽名批准
  const guardianSignatures = await Promise.all(
    guardians.map(async (guardian) => {
      const message = encodeRecoveryMessage(smartAccount, newOwner)
      return await signWithGuardian(guardian, message)
    }),
  )

  // 構造 UserOp
  const userOp: Partial<UserOperation> = {
    sender: smartAccount,
    callData,
    // 守護者簽名作為附加驗證數據
    signature: encodeGuardianSignatures(guardianSignatures),
  }

  // 填充 Gas 估算等字段
  const fullUserOp = await fillUserOp(userOp, bundlerClient)

  // 發送到 Bundler
  return await bundlerClient.sendUserOperation(fullUserOp, ENTRY_POINT_ADDRESS)
}
```

多籤場景類似，前端需要協調多個簽名者，收集足夠的簽名後構造完整的 UserOp。這與 Gnosis Safe 的交互模式相似，但底層提交方式不同。

## 完整的 AA 前端交互模塊

以下是一個端到端的 AA 前端交互模塊，涵蓋賬戶部署、Gas 贊助交易和狀態追蹤：

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

  // 計算反事實地址（部署前的賬戶地址）
  async getCounterfactualAddress(salt: bigint = 0n): Promise<Address> {
    const initCode = this.buildInitCode(salt)
    // 調用工廠的 getAddress 函數
    const address = await this.publicClient.readContract({
      address: this.config.accountFactoryAddress,
      abi: accountFactoryAbi,
      functionName: 'getAddress',
      args: [this.signer.getAddress(), salt],
    })
    this.accountAddress = address as Address
    return address
  }

  // 發送交易（自動處理賬戶部署）
  async sendTransaction(
    target: Address,
    value: bigint,
    data: `0x${string}` = '0x',
  ): Promise<Hash> {
    const sender = this.accountAddress!
    const isDeployed = await this.isAccountDeployed(sender)

    // 構造 callData
    const callData = encodeFunctionData({
      abi: smartAccountAbi,
      functionName: 'execute',
      args: [target, value, data],
    })

    // 獲取 nonce
    const nonce = await this.getAccountNonce(sender)

    // 構造基礎 UserOp
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

    // Gas 估算
    const gasEstimate = await this.bundler.estimateUserOperationGas(
      userOp,
      ENTRY_POINT_ADDRESS,
    )
    userOp = { ...userOp, ...gasEstimate }

    // 獲取 Gas 價格
    const feeData = await this.publicClient.getGasPrice()
    userOp.maxFeePerGas = feeData * 12n / 10n
    userOp.maxPriorityFeePerGas = feeData / 5n

    // Paymaster 贊助
    if (this.config.paymasterConfig) {
      userOp = await sponsorUserOp(userOp, this.config.paymasterConfig)
    }

    // 用戶簽名
    const userOpHash = this.getUserOpHash(userOp)
    userOp.signature = await this.signer.signMessage(userOpHash)

    // 發送到 Bundler
    const hash = await this.bundler.sendUserOperation(userOp, ENTRY_POINT_ADDRESS)

    // 等待確認
    await this.waitForUserOp(hash)

    return hash
  }

  // 等待 UserOp 確認
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
    // 按照 ERC-4337 規範計算 UserOp 哈希
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

## 用戶體驗：無 Gas 交易與批量操作

賬戶抽象帶來的最大 UX 提升是 **無 Gas 交易** 和 **批量操作**。

無 Gas 交易通過 Paymaster 實現。前端在發送 UserOp 前請求 Paymaster 贊助，用戶無需持有 ETH。Paymaster 可以選擇免費贊助（作為獲客成本）或接受 ERC-20 代幣支付 Gas。

批量操作通過 Smart Account 的 `executeBatch` 函數實現。用戶可以將多個操作——如 approve + swap + stake——打包成一個 UserOp 提交，只需一次簽名和一筆 Gas。

```typescript
// 批量操作示例
async function batchOperations(account: SmartAccountClient) {
  // 一次性完成：approve USDC -> swap to ETH -> stake ETH
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

## 安全邊界：簽名驗證與會話密鑰

Session Key 是 AA 場景下的重要安全原語。它是一種受限的密鑰，只能對特定合約執行特定操作，且有時間窗口和金額限制。

```typescript
interface SessionKeyConfig {
  key: Address           // Session Key 地址
  approvedContracts: Address[] // 允許調用的合約白名單
  maxAmountPerTx: bigint      // 單筆最大金額
  validUntil: number          // 過期時間戳
  validAfter: number          // 生效時間戳
}

// 前端註冊 Session Key
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

會話密鑰的風險在於密鑰本身的洩露。前端應將 Session Key 存儲在 sessionStorage 而非 localStorage，並在頁面關閉時清除。

## 與傳統 EOA 錢包的前端適配共存

在過渡期，DApp 需要同時支持 EOA 錢包（MetaMask 等）和 Smart Account。推薦的架構是抽象出一個統一的 Wallet Interface：

```typescript
interface UnifiedWallet {
  address: Address
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>
  signMessage: (msg: string) Promise<string>
  isSmartAccount: boolean
}

// EOA 適配器
class EOAWalletAdapter implements UnifiedWallet {
  isSmartAccount = false
  // 委託給 window.ethereum
}

// Smart Account 適配器
class SmartAccountAdapter implements UnifiedWallet {
  isSmartAccount = true
  // 委託給 SmartAccountClient
}

// 統一連接入口
async function connectWallet(): Promise<UnifiedWallet> {
  // 優先嚐試 Smart Account（如用戶已配置）
  // 回退到 EOA
}
```

這種適配器模式讓上層組件無需感知底層賬戶類型，業務代碼保持一致。

## 小結

ERC-4337 賬戶抽象從根本上改變了以太坊的交互模型。對前端而言，核心變化在於：交易構造從 `eth_sendTransaction` 變為 UserOp 流程，Gas 支付從用戶自付變為可選贊助，簽名方案從固定 ECDSA 變為合約自定義。這些變化帶來更好的用戶體驗，但也增加了前端的複雜度——Bundler 交互、Paymaster 集成、Gas 估算方式都與傳統模式不同。過渡期內，DApp 需要同時適配 EOA 和 Smart Account，統一抽象層是務實的選擇。從長期看，Smart Account 將成為默認的賬戶模型，前端架構應為此做好準備。
