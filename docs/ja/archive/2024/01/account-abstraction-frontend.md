---
title: "アカウント抽象化 (ERC-4337) フロントエンド実践"
date: 2024-01-14 15:17:29
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 13
description: "ERC-4337 アカウント抽象化のフロントエンド実践を深く解説。UserOperation ライフサイクル、Bundler インタラクション、Paymaster Gas スポンサーシップ、ソーシャルリカバリーソリューションをカバー"
wordCount: 2296
---

## ERC-4337 アカウント抽象化の概要

アカウント抽象化（Account Abstraction, ERC-4337）は、Ethereum において最も革新的な提案の一つです。その中核的な目標は、アカウントの検証ロジックをプロトコル層からコントラクト層に移行し、スマートアカウントがカスタムの署名検証、Gas 支払い、実行ロジックを持てるようにすることです。

従来の Ethereum モデルでは、二種類のアカウントが存在します：外部所有アカウント（EOA）とコントラクトアカウント（CA）です。EOA は秘密鍵によって制御され、取引の発起のみが可能で、署名アルゴリズムは secp256k1 ECDSA に固定されています。コントラクトアカウントは自ら取引を発起できません——EOA によって呼び出されることしかできません。この制限は劣悪なユーザー体験をもたらしました：ユーザーは秘密鍵を管理し、Gas 支払いのために ETH を保有しなければならず、バッチ操作やソーシャルリカバリーも実現できません。

ERC-4337 はコンセンサス層を変更しないアプローチを選択しました。独立した mempool システム——UserOperation mempool と、Bundler と呼ばれる役割を導入しています。Bundler は通常の EOA であり、UserOp mempool から UserOperations を収集し、`EntryPoint` と呼ばれるシングルトンコントラクトを通じてオンチェーンにパッケージ化して提出します。この設計は L1 コンセンサスを変更することなくアカウント抽象化を実現します。

## Smart Account vs EOA：アーキテクチャの違い

Smart Account と EOA のアーキテクチャの違いを理解することが、適切なフロントエンド対応の前提条件です。

```
EOA モデル：
┌──────────┐     ┌──────────────┐
│  ユーザー秘密鍵  │────▶│  EOA Account  │────▶│  コントラクト呼び出し  │
└──────────┘     └──────────────┘

Smart Account モデル：
┌──────────┐     ┌──────────────────┐     ┌─────────────┐
│  署名方式  │────▶│  Smart Account    │◀────│  Paymaster   │
│  (任意)   │     │  (コントラクトウォレット)│     │  (Gas スポンサー)   │
└──────────┘     └──────────────────┘     └─────────────┘
                        ▲
                        │
                 ┌─────────────┐
                 │   Bundler    │
                 │  (パッケージ化提出)   │
                 └─────────────┘
```

Smart Account の検証ロジックは完全にコントラクトコードによって定義されます。Passkey、Session Key、マルチシグ、ソーシャルリカバリーなど、任意の検証方式を使用できます。フロントエンドはもはや `personal_sign` のような固定された署名パターンを処理する必要はなく、アカウントコントラクトの `validateUserOp` 関数に従って署名データを構築します。

## UserOperation データ構造とライフサイクル

UserOperation（略称 UserOp）は ERC-4337 の中核的なデータ構造です。通常の取引に似ていますが、フィールドが異なります：

```typescript
interface UserOperation {
  sender: string;              // スマートアカウントアドレス
  nonce: bigint;               // リプレイ防止 nonce
  initCode: string;            // アカウントデプロイ時の初期化コード
  callData: string;            // 実行する呼び出しデータ
  callGasLimit: bigint;        // callData 実行の Gas 制限
  verificationGasLimit: bigint;// 検証段階の Gas 制限
  preVerificationGas: bigint;  // 事前検証 Gas
  maxFeePerGas: bigint;        // 最大 Gas 価格
  maxPriorityFeePerGas: bigint;// 優先手数料
  paymasterAndData: string;    // Paymaster アドレスと追加データ
  signature: string;           // 署名
}
```

UserOp のライフサイクルはフロントエンドでの構築から始まり、以下の段階を経ます：

1. **構築**：フロントエンドが UserOp フィールドを組み立て（一部のフィールドは Bundler から推定が必要）
2. **署名**：ユーザーが自身の検証方式で UserOp ハッシュに署名
3. **提出**：`eth_sendUserOperation` を通じて Bundler に送信
4. **パッケージ化**：Bundler が複数の UserOp を一つの取引にパッケージ化
5. **実行**：`EntryPoint` が各 UserOp を一つずつ検証・実行
6. **確認**：フロントエンドが `eth_getUserOperationReceipt` でポーリングして結果を確認

## Bundler：UserOp パッケージ化のフロントエンドインタラクション

Bundler は一連の JSON-RPC メソッドを公開しており、フロントエンドはこれらのメソッドを通じてやり取りします。以下は完全な Bundler インタラクションモジュールです：

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

// Bundler クライアントを作成
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

## Paymaster：Gas スポンサーシップ機構のフロントエンド統合

Paymaster は ERC-4337 において Gas 抽象化を実現する重要な役割です。UserOp の Gas 費用を支払うことができるコントラクトです。フロントエンド統合の中核は、`paymasterAndData` フィールドを正しく構築することにあります。

```typescript
// Paymaster インタラクションモジュール
import type { Address, UserOperation } from './bundler-client'

interface PaymasterConfig {
  paymasterAddress: Address
  paymasterUrl: string // Paymaster の RPC エンドポイント
}

// Paymaster に署名をリクエストし、paymasterAndData を取得
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
          // トークン支払いの場合、トークンアドレスを指定
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

## ソーシャルリカバリーとマルチシグのフロントエンドインタラクション

Smart Account の最大の利点の一つはソーシャルリカバリーをサポートすることです。ユーザーは一連の「ガーディアン」アドレスを指定し、秘密鍵を紛失した際にガーディアンの投票を通じてアカウントアクセスを回復できます。

```typescript
// ソーシャルリカバリー フロントエンドインタラクション
import { encodeFunctionData, type Address } from 'viem'

// ソーシャルリカバリーリクエストを開始
async function initiateSocialRecovery(
  smartAccount: Address,
  newOwner: Address,
  guardians: Address[],
  bundlerClient: BundlerClient,
): Promise<Hash> {
  // リカバリー呼び出しの callData を構築
  const callData = encodeFunctionData({
    abi: recoveryAbi,
    functionName: 'startRecovery',
    args: [newOwner],
  })

  // ガーディアンが順次署名して承認
  const guardianSignatures = await Promise.all(
    guardians.map(async (guardian) => {
      const message = encodeRecoveryMessage(smartAccount, newOwner)
      return await signWithGuardian(guardian, message)
    }),
  )

  // UserOp を構築
  const userOp: Partial<UserOperation> = {
    sender: smartAccount,
    callData,
    // ガーディアン署名を追加検証データとして
    signature: encodeGuardianSignatures(guardianSignatures),
  }

  // Gas 推定などのフィールドを埋める
  const fullUserOp = await fillUserOp(userOp, bundlerClient)

  // Bundler に送信
  return await bundlerClient.sendUserOperation(fullUserOp, ENTRY_POINT_ADDRESS)
}
```

マルチシグのシナリオも同様で、フロントエンドは複数の署名者を調整し、十分な署名を収集した後に完全な UserOp を構築する必要があります。これは Gnosis Safe のインタラクションパターンに似ていますが、基盤となる提出方法が異なります。

## 完全な AA フロントエンドインタラクションモジュール

以下はエンドツーエンドの AA フロントエンドインタラクションモジュールで、アカウントデプロイ、Gas スポンサー取引、状態追跡をカバーしています：

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

  // 反事実アドレスを計算（デプロイ前のアカウントアドレス）
  async getCounterfactualAddress(salt: bigint = 0n): Promise<Address> {
    const initCode = this.buildInitCode(salt)
    // ファクトリーの getAddress 関数を呼び出す
    const address = await this.publicClient.readContract({
      address: this.config.accountFactoryAddress,
      abi: accountFactoryAbi,
      functionName: 'getAddress',
      args: [this.signer.getAddress(), salt],
    })
    this.accountAddress = address as Address
    return address
  }

  // 取引を送信（アカウントデプロイを自動処理）
  async sendTransaction(
    target: Address,
    value: bigint,
    data: `0x${string}` = '0x',
  ): Promise<Hash> {
    const sender = this.accountAddress!
    const isDeployed = await this.isAccountDeployed(sender)

    // callData を構築
    const callData = encodeFunctionData({
      abi: smartAccountAbi,
      functionName: 'execute',
      args: [target, value, data],
    })

    // nonce を取得
    const nonce = await this.getAccountNonce(sender)

    // 基本 UserOp を構築
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

    // Gas 推定
    const gasEstimate = await this.bundler.estimateUserOperationGas(
      userOp,
      ENTRY_POINT_ADDRESS,
    )
    userOp = { ...userOp, ...gasEstimate }

    // Gas 価格を取得
    const feeData = await this.publicClient.getGasPrice()
    userOp.maxFeePerGas = feeData * 12n / 10n
    userOp.maxPriorityFeePerGas = feeData / 5n

    // Paymaster スポンサー
    if (this.config.paymasterConfig) {
      userOp = await sponsorUserOp(userOp, this.config.paymasterConfig)
    }

    // ユーザー署名
    const userOpHash = this.getUserOpHash(userOp)
    userOp.signature = await this.signer.signMessage(userOpHash)

    // Bundler に送信
    const hash = await this.bundler.sendUserOperation(userOp, ENTRY_POINT_ADDRESS)

    // 確認待ち
    await this.waitForUserOp(hash)

    return hash
  }

  // UserOp 確認待ち
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
    // ERC-4337 仕様に従って UserOp ハッシュを計算
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

## ユーザー体験：Gas レス取引とバッチ操作

アカウント抽象化がもたらす最大の UX 向上は **Gas レス取引** と **バッチ操作** です。

Gas レス取引は Paymaster を通じて実現されます。フロントエンドは UserOp を送信する前に Paymaster にスポンサーをリクエストし、ユーザーは ETH を保有する必要がありません。Paymaster は無料スポンサー（獲得コストとして）または ERC-20 トークンによる Gas 支払いを受け入れることを選択できます。

バッチ操作は Smart Account の `executeBatch` 関数を通じて実現されます。ユーザーは複数の操作——例えば approve + swap + stake——を一つの UserOp にパッケージ化して提出し、一度の署名と一度の Gas で済みます。

```typescript
// バッチ操作例
async function batchOperations(account: SmartAccountClient) {
  // 一回で完了：approve USDC -> swap to ETH -> stake ETH
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

## セキュリティ境界：署名検証とセッションキー

Session Key は AA シナリオにおける重要なセキュリティプリミティブです。特定のコントラクトに対して特定の操作のみを実行できる制限付きキーであり、時間枠と金額制限があります。

```typescript
interface SessionKeyConfig {
  key: Address           // Session Key アドレス
  approvedContracts: Address[] // 呼び出し許可コントラクトのホワイトリスト
  maxAmountPerTx: bigint      // 取引あたりの最大金額
  validUntil: number          // 有効期限タイムスタンプ
  validAfter: number          // 有効開始タイムスタンプ
}

// フロントエンドで Session Key を登録
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

セッションキーのリスクはキー自体の漏洩にあります。フロントエンドは Session Key を localStorage ではなく sessionStorage に保存し、ページを閉じた際に消去するべきです。

## 従来の EOA ウォレットとのフロントエンド共存対応

移行期間中、DApp は EOA ウォレット（MetaMask など）と Smart Account の両方をサポートする必要があります。推奨されるアーキテクチャは統一された Wallet Interface を抽象化することです：

```typescript
interface UnifiedWallet {
  address: Address
  sendTransaction: (tx: TransactionRequest) => Promise<Hash>
  signMessage: (msg: string) Promise<string>
  isSmartAccount: boolean
}

// EOA アダプター
class EOAWalletAdapter implements UnifiedWallet {
  isSmartAccount = false
  // window.ethereum に委任
}

// Smart Account アダプター
class SmartAccountAdapter implements UnifiedWallet {
  isSmartAccount = true
  // SmartAccountClient に委任
}

// 統一接続エントリポイント
async function connectWallet(): Promise<UnifiedWallet> {
  // Smart Account を優先的に試行（ユーザーが設定済みの場合）
  // EOA にフォールバック
}
```

このアダプターパターンにより、上位層のコンポーネントは基盤となるアカウントタイプを意識する必要がなく、ビジネスコードは一貫性を保ちます。

## まとめ

ERC-4337 アカウント抽象化は Ethereum のインタラクションモデルを根本的に変えます。フロントエンドにとって、中核的な変化は：取引構築が `eth_sendTransaction` から UserOp フローに変わり、Gas 支払いがユーザー負担からオプションのスポンサーに変わり、署名方式が固定 ECDSA からコントラクトカスタムに変わります。これらの変化はより良いユーザー体験をもたらしますが、フロントエンドの複雑さも増加させます——Bundler インタラクション、Paymaster 統合、Gas 推定方法はいずれも従来のモデルとは異なります。移行期間中、DApp は EOA と Smart Account の両方に対応する必要があり、統一抽象化レイヤーが現実的な選択肢です。長期的には、Smart Account がデフォルトのアカウントモデルとなり、フロントエンドアーキテクチャはこれに備えるべきです。
