---
title: "账户抽象 (ERC-4337) 前端实践"
date: 2024-01-14 15:17:29
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 10
description: "深入解析 ERC-4337 账户抽象的前端实践，涵盖 UserOperation 生命周期、Bundler 交互、Paymaster Gas 赞助及社交恢复方案"
wordCount: 1294
---

## ERC-4337 账户抽象概述

账户抽象（Account Abstraction, ERC-4337）是以太坊上最具变革性的提案之一。其核心目标是将账户的验证逻辑从协议层移至合约层，使得智能账户可以拥有自定义的签名验证、Gas 支付和执行逻辑。

在传统以太坊模型中，存在两种账户：外部拥有账户（EOA）和合约账户（CA）。EOA 由私钥控制，只能发起交易且签名算法固定为 secp256k1 ECDSA。合约账户无法主动发起交易——它们只能被 EOA 调用。这种限制导致了糟糕的用户体验：用户必须管理私钥、持有 ETH 支付 Gas、且无法实现批量操作或社交恢复。

ERC-4337 选择了不修改共识层的路线。它引入了一个独立的 mempool 系统——UserOperation mempool，以及一个名为 Bundler 的角色。Bundler 是一个常规的 EOA，它从 UserOp mempool 中收集 UserOperations，打包后通过一个名为 `EntryPoint` 的单例合约提交到链上。这种设计在不改变 L1 共识的前提下实现了账户抽象。

## Smart Account vs EOA：架构差异

理解 Smart Account 与 EOA 的架构差异，是做好前端适配的前提。

```
EOA 模型：
┌──────────┐     ┌──────────────┐
│  用户私钥  │────▶│  EOA Account  │────▶│  合约调用  │
└──────────┘     └──────────────┘

Smart Account 模型：
┌──────────┐     ┌──────────────────┐     ┌─────────────┐
│  签名方案  │────▶│  Smart Account    │◀────│  Paymaster   │
│  (任意)   │     │  (合约钱包)       │     │  (Gas 赞助)   │
└──────────┘     └──────────────────┘     └─────────────┘
                        ▲
                        │
                 ┌─────────────┐
                 │   Bundler    │
                 │  (打包提交)   │
                 └─────────────┘
```

Smart Account 的验证逻辑完全由合约代码定义。它可以使用 Passkey、Session Key、多签、社交恢复等任意验证方案。前端不再需要处理 `personal_sign` 这种固定的签名模式，而是根据账户合约的 `validateUserOp` 函数来构造签名数据。

## UserOperation 数据结构与生命周期

UserOperation（简称 UserOp）是 ERC-4337 的核心数据结构。它类似于常规交易但字段不同：

```typescript
interface UserOperation {
  sender: string;              // 智能账户地址
  nonce: bigint;               // 防重放 nonce
  initCode: string;            // 部署账户时的初始化代码
  callData: string;            // 要执行的调用数据
  callGasLimit: bigint;        // 执行 callData 的 Gas 限制
  verificationGasLimit: bigint;// 验证阶段的 Gas 限制
  preVerificationGas: bigint;  // 预验证 Gas
  maxFeePerGas: bigint;        // 最大 Gas 价格
  maxPriorityFeePerGas: bigint;// 优先费
  paymasterAndData: string;    // Paymaster 地址及附加数据
  signature: string;           // 签名
}
```

UserOp 的生命周期从前端构造开始，经历以下阶段：

1. **构造**：前端组装 UserOp 字段，部分字段需要从 Bundler 估算
2. **签名**：用户用其验证方案对 UserOp 哈希签名
3. **提交**：通过 `eth_sendUserOperation` 发送到 Bundler
4. **打包**：Bundler 将多个 UserOp 打包成一笔交易
5. **执行**：`EntryPoint` 逐一验证并执行每个 UserOp
6. **确认**：前端通过 `eth_getUserOperationReceipt` 轮询结果

## Bundler：打包 UserOp 的前端交互

Bundler 暴露了一组 JSON-RPC 方法，前端通过这些方法与之交互。以下是完整的 Bundler 交互模块：

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

// 创建 Bundler 客户端
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

## Paymaster：Gas 赞助机制的前端集成

Paymaster 是 ERC-4337 中实现 Gas 抽象的关键角色。它是一个合约，可以为 UserOp 支付 Gas 费用。前端集成的核心在于正确构造 `paymasterAndData` 字段。

```typescript
// Paymaster 交互模块
import type { Address, UserOperation } from './bundler-client'

interface PaymasterConfig {
  paymasterAddress: Address
  paymasterUrl: string // Paymaster 的 RPC 端点
}

// 向 Paymaster 请求签名并获取 paymasterAndData
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
          // 如果是 token 支付，指定代币地址
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

## 社交恢复与多签的前端交互

Smart Account 的最大优势之一是支持社交恢复。用户可以指定一组"守护者"地址，在私钥丢失时通过守护者投票恢复账户访问。

```typescript
// 社交恢复前端交互
import { encodeFunctionData, type Address } from 'viem'

// 发起社交恢复请求
async function initiateSocialRecovery(
  smartAccount: Address,
  newOwner: Address,
  guardians: Address[],
  bundlerClient: BundlerClient,
): Promise<Hash> {
  // 构造恢复调用的 callData
  const callData = encodeFunctionData({
    abi: recoveryAbi,
    functionName: 'startRecovery',
    args: [newOwner],
  })

  // 守护者逐一签名批准
  const guardianSignatures = await Promise.all(
    guardians.map(async (guardian) => {
      const message = encodeRecoveryMessage(smartAccount, newOwner)
      return await signWithGuardian(guardian, message)
    }),
  )

  // 构造 UserOp
  const userOp: Partial<UserOperation> = {
    sender: smartAccount,
    callData,
    // 守护者签名作为附加验证数据
    signature: encodeGuardianSignatures(guardianSignatures),
  }

  // 填充 Gas 估算等字段
  const fullUserOp = await fillUserOp(userOp, bundlerClient)

  // 发送到 Bundler
  return await bundlerClient.sendUserOperation(fullUserOp, ENTRY_POINT_ADDRESS)
}
```

多签场景类似，前端需要协调多个签名者，收集足够的签名后构造完整的 UserOp。这与 Gnosis Safe 的交互模式相似，但底层提交方式不同。

## 完整的 AA 前端交互模块

以下是一个端到端的 AA 前端交互模块，涵盖账户部署、Gas 赞助交易和状态追踪：

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

  // 计算反事实地址（部署前的账户地址）
  async getCounterfactualAddress(salt: bigint = 0n): Promise<Address> {
    const initCode = this.buildInitCode(salt)
    // 调用工厂的 getAddress 函数
    const address = await this.publicClient.readContract({
      address: this.config.accountFactoryAddress,
      abi: accountFactoryAbi,
      functionName: 'getAddress',
      args: [this.signer.getAddress(), salt],
    })
    this.accountAddress = address as Address
    return address
  }

  // 发送交易（自动处理账户部署）
  async sendTransaction(
    target: Address,
    value: bigint,
    data: `0x${string}` = '0x',
  ): Promise<Hash> {
    const sender = this.accountAddress!
    const isDeployed = await this.isAccountDeployed(sender)

    // 构造 callData
    const callData = encodeFunctionData({
      abi: smartAccountAbi,
      functionName: 'execute',
      args: [target, value, data],
    })

    // 获取 nonce
    const nonce = await this.getAccountNonce(sender)

    // 构造基础 UserOp
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

    // 获取 Gas 价格
    const feeData = await this.publicClient.getGasPrice()
    userOp.maxFeePerGas = feeData * 12n / 10n
    userOp.maxPriorityFeePerGas = feeData / 5n

    // Paymaster 赞助
    if (this.config.paymasterConfig) {
      userOp = await sponsorUserOp(userOp, this.config.paymasterConfig)
    }

    // 用户签名
    const userOpHash = this.getUserOpHash(userOp)
    userOp.signature = await this.signer.signMessage(userOpHash)

    // 发送到 Bundler
    const hash = await this.bundler.sendUserOperation(userOp, ENTRY_POINT_ADDRESS)

    // 等待确认
    await this.waitForUserOp(hash)

    return hash
  }

  // 等待 UserOp 确认
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
    // 按照 ERC-4337 规范计算 UserOp 哈希
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

## 用户体验：无 Gas 交易与批量操作

账户抽象带来的最大 UX 提升是 **无 Gas 交易** 和 **批量操作**。

无 Gas 交易通过 Paymaster 实现。前端在发送 UserOp 前请求 Paymaster 赞助，用户无需持有 ETH。Paymaster 可以选择免费赞助（作为获客成本）或接受 ERC-20 代币支付 Gas。

批量操作通过 Smart Account 的 `executeBatch` 函数实现。用户可以将多个操作——如 approve + swap + stake——打包成一个 UserOp 提交，只需一次签名和一笔 Gas。

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

## 安全边界：签名验证与会话密钥

Session Key 是 AA 场景下的重要安全原语。它是一种受限的密钥，只能对特定合约执行特定操作，且有时间窗口和金额限制。

```typescript
interface SessionKeyConfig {
  key: Address           // Session Key 地址
  approvedContracts: Address[] // 允许调用的合约白名单
  maxAmountPerTx: bigint      // 单笔最大金额
  validUntil: number          // 过期时间戳
  validAfter: number          // 生效时间戳
}

// 前端注册 Session Key
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

会话密钥的风险在于密钥本身的泄露。前端应将 Session Key 存储在 sessionStorage 而非 localStorage，并在页面关闭时清除。

## 与传统 EOA 钱包的前端适配共存

在过渡期，DApp 需要同时支持 EOA 钱包（MetaMask 等）和 Smart Account。推荐的架构是抽象出一个统一的 Wallet Interface：

```typescript
interface UnifiedWallet {
  address: Address
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>
  signMessage: (msg: string) Promise<string>
  isSmartAccount: boolean
}

// EOA 适配器
class EOAWalletAdapter implements UnifiedWallet {
  isSmartAccount = false
  // 委托给 window.ethereum
}

// Smart Account 适配器
class SmartAccountAdapter implements UnifiedWallet {
  isSmartAccount = true
  // 委托给 SmartAccountClient
}

// 统一连接入口
async function connectWallet(): Promise<UnifiedWallet> {
  // 优先尝试 Smart Account（如用户已配置）
  // 回退到 EOA
}
```

这种适配器模式让上层组件无需感知底层账户类型，业务代码保持一致。

## 小结

ERC-4337 账户抽象从根本上改变了以太坊的交互模型。对前端而言，核心变化在于：交易构造从 `eth_sendTransaction` 变为 UserOp 流程，Gas 支付从用户自付变为可选赞助，签名方案从固定 ECDSA 变为合约自定义。这些变化带来更好的用户体验，但也增加了前端的复杂度——Bundler 交互、Paymaster 集成、Gas 估算方式都与传统模式不同。过渡期内，DApp 需要同时适配 EOA 和 Smart Account，统一抽象层是务实的选择。从长期看，Smart Account 将成为默认的账户模型，前端架构应为此做好准备。
