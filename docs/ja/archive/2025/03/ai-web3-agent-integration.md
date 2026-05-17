---
title: "AI Agent と Web3 インタラクション：自動化取引パイプライン"
date: 2025-03-15 19:04:38
tags:
  - Web3
  - AI
readingTime: 12
description: "LLM Agent がスマートコントラクトを呼び出す完全なアーキテクチャを探求し、意図認識、安全署名、自動化取引パイプライン、マルチステップ取引オーケストレーションをカバー"
wordCount: 3700
---

## LLM Agent によるスマートコントラクト呼び出しのアーキテクチャ

AI Agent と Web3 の組み合わせは、2025 年において最も将来性のある技術方向の一つです。中核的な考え方は、LLM（大規模言語モデル）を意思決定層として、自然言語の指示をオンチェーン取引に変換することです。

全体アーキテクチャは三層に分かれています：

```
┌──────────────────────────────────────────────────┐
│                  ユーザー層 (User Layer)               │
│    "100 USDC で ETH に交換して、Gas < 20 gwei なら"    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              AI Agent 層 (Decision Layer)          │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ 意図認識 │─▶│ 戦略決定  │─▶│ 取引構築 & 署名  │  │
│  └─────────┘  └──────────┘  └─────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              実行層 (Execution Layer)              │
│    Wallet Client → RPC → Blockchain               │
└──────────────────────────────────────────────────┘
```

Agent は LLM の API を直接呼び出して取引に署名するわけではありません——それは危険すぎます。正しいアーキテクチャは、Agent が LLM の出力を「取引意図」として扱い、安全検証を経てから実際の取引を構築することです。

## 意図認識：自然言語からコントラクト呼び出しへ

意図認識は、ユーザーの自然言語指示を構造化された取引パラメータに変換することです：

```typescript
// 取引意図データ構造
interface TransactionIntent {
  action: 'swap' | 'stake' | 'transfer' | 'approve' | 'claim' | 'bridge' | 'custom'
  protocol: string       // ターゲットプロトコル、例: 'uniswap-v3'
  params: Record<string, any>
  conditions?: {
    maxGasPrice?: bigint       // Gas 価格条件
    minSlippage?: number       // 最大スリッページ
    deadline?: number          // 有効期限
    priceCondition?: {         // 価格トリガー条件
      token: string
      operator: '>' | '<' | '>=' | '<='
      value: number
    }
  }
  constraints: {
    maxAmount: bigint          // 最大取引金額
    allowedContracts: string[] // 呼び出し許可コントラクトのホワイトリスト
  }
}

// LLM システムプロンプト
const SYSTEM_PROMPT = `
You are a Web3 transaction intent parser. Convert user's natural language
instruction into a structured JSON transaction intent.

Available actions:
- swap: Token swap (params: tokenIn, tokenOut, amountIn, minAmountOut)
- stake: Stake tokens (params: token, amount, validator)
- transfer: Transfer tokens (params: token, to, amount)
- approve: Approve token spending (params: token, spender, amount)
- claim: Claim rewards (params: protocol, rewardToken)
- bridge: Cross-chain transfer (params: fromChain, toChain, token, amount)

Output format: JSON only, no explanation.

Example:
User: "Swap 100 USDC for ETH on Uniswap, slippage 1%"
Output: {
  "action": "swap",
  "protocol": "uniswap-v3",
  "params": { "tokenIn": "USDC", "tokenOut": "ETH", "amountIn": 100, "minAmountOut": 0 },
  "conditions": { "minSlippage": 0.01 }
}
`

// 意図認識パイプライン
class IntentParser {
  private llm: LLMClient
  private tokenRegistry: TokenRegistry

  constructor(llm: LLMClient, tokenRegistry: TokenRegistry) {
    this.llm = llm
    this.tokenRegistry = tokenRegistry
  }

  async parse(userInput: string): Promise<TransactionIntent> {
    // 1. LLM を呼び出して意図を解析
    const rawIntent = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: userInput,
      temperature: 0, // 決定的出力
    })

    const parsed = JSON.parse(rawIntent)

    // 2. 意図を検証・正規化
    const intent = await this.validateIntent(parsed)

    return intent
  }

  private async validateIntent(raw: any): Promise<TransactionIntent> {
    // action が正当か検証
    const validActions = ['swap', 'stake', 'transfer', 'approve', 'claim', 'bridge', 'custom']
    if (!validActions.includes(raw.action)) {
      throw new Error(`Invalid action: ${raw.action}`)
    }

    // トークンシンボルをコントラクトアドレスに解決
    const params = { ...raw.params }
    for (const key of ['tokenIn', 'tokenOut', 'token', 'rewardToken']) {
      if (params[key] && typeof params[key] === 'string') {
        const tokenInfo = await this.tokenRegistry.getByName(params[key])
        if (tokenInfo) {
          params[key] = tokenInfo.address
        }
      }
    }

    // 安全制約を設定
    const intent: TransactionIntent = {
      ...raw,
      params,
      constraints: {
        maxAmount: raw.constraints?.maxAmount
          ? BigInt(raw.constraints.maxAmount)
          : parseEther('1000'), // デフォルト最大 1000 ETH 相当
        allowedContracts: raw.constraints?.allowedContracts || [],
      },
    }

    return intent
  }
}
```

## Agent 取引署名：安全境界と権限制御

Agent 署名はアーキテクチャ全体で最もセンシティブな部分です。LLM 出力をそのまま署名に使用してはいけません——多重の安全チェックを経る必要があります：

```typescript
// 安全署名パイプライン
class SecureSigningPipeline {
  private whitelist: ContractWhitelist
  private limits: TransactionLimits
  private approver: HumanApprover | null // オプションの人間による承認

  constructor(config: {
    whitelist: ContractWhitelist
    limits: TransactionLimits
    approver?: HumanApprover
  }) {
    this.whitelist = config.whitelist
    this.limits = config.limits
    this.approver = config.approver || null
  }

  async sign(
    intent: TransactionIntent,
    walletClient: WalletClient,
    publicClient: PublicClient,
  ): Promise<Hash> {
    // 1. コントラクトホワイトリストチェック
    const targetContract = this.resolveTargetContract(intent)
    if (!this.whitelist.isAllowed(targetContract, intent.action)) {
      throw new SecurityError(
        `Contract ${targetContract} is not in whitelist for action ${intent.action}`
      )
    }

    // 2. 金額制限チェック
    const txAmount = this.extractAmount(intent)
    if (txAmount > this.limits.maxAmount) {
      throw new SecurityError(
        `Amount ${txAmount} exceeds limit ${this.limits.maxAmount}`
      )
    }

    // 3. 条件チェック（Gas 価格、価格トリガーなど）
    if (intent.conditions?.maxGasPrice) {
      const currentGasPrice = await publicClient.getGasPrice()
      if (currentGasPrice > intent.conditions.maxGasPrice) {
        throw new ConditionError(
          `Gas price ${currentGasPrice} exceeds limit ${intent.conditions.maxGasPrice}`
        )
      }
    }

    if (intent.conditions?.priceCondition) {
      const currentPrice = await this.getTokenPrice(intent.conditions.priceCondition.token)
      const { operator, value } = intent.conditions.priceCondition
      const meets = this.evaluateCondition(currentPrice, operator, value)
      if (!meets) {
        throw new ConditionError(
          `Price condition not met: ${currentPrice} ${operator} ${value}`
        )
      }
    }

    // 4. 取引データを構築
    const txData = await this.buildTransactionData(intent)

    // 5. シミュレーション実行
    const simulation = await publicClient.simulateContract({
      address: targetContract,
      abi: await this.getContractAbi(targetContract),
      functionName: txData.functionName,
      args: txData.args,
      account: walletClient.account!,
      value: txData.value,
    })

    // 6. オプション：人間による承認
    if (this.approver && this.requiresApproval(intent, txAmount)) {
      const approved = await this.approver.requestApproval({
        intent,
        txData,
        simulation,
      })
      if (!approved) {
        throw new SecurityError('Human approval denied')
      }
    }

    // 7. 署名して送信
    return walletClient.writeContract(simulation.request)
  }

  private requiresApproval(intent: TransactionIntent, amount: bigint): boolean {
    // 大口取引は人間の承認が必要
    return amount > this.limits.autoApproveThreshold
  }
}
```

## 自動化取引パイプライン：監視 -> 意思決定 -> 実行

完全な自動化パイプラインは、オンチェーン状態を継続的に監視し、条件が満たされたときに自動的に取引をトリガーする必要があります：

```typescript
class AutomatedTradingPipeline {
  private parser: IntentParser
  private signer: SecureSigningPipeline
  private walletClient: WalletClient
  private publicClient: PublicClient
  private monitors: Map<string, PriceMonitor> = new Map()
  private queue: TransactionQueue

  constructor(config: PipelineConfig) {
    this.parser = new IntentParser(config.llm, config.tokenRegistry)
    this.signer = new SecureSigningPipeline({
      whitelist: config.whitelist,
      limits: config.limits,
    })
    this.walletClient = config.walletClient
    this.publicClient = config.publicClient
    this.queue = new TransactionQueue()
  }

  // 条件トリガーを登録
  async registerTrigger(userInstruction: string) {
    const intent = await this.parser.parse(userInstruction)

    if (intent.conditions?.priceCondition) {
      const monitor = new PriceMonitor(
        intent.conditions.priceCondition.token,
        intent.conditions.priceCondition.operator,
        intent.conditions.priceCondition.value,
      )
      this.monitors.set(userInstruction, monitor)

      monitor.onTrigger(async () => {
        await this.executeIntent(intent)
      })

      monitor.start()
    } else {
      // 条件なし、即時実行
      await this.executeIntent(intent)
    }
  }

  // 意図を実行
  private async executeIntent(intent: TransactionIntent) {
    try {
      const hash = await this.signer.sign(
        intent,
        this.walletClient,
        this.publicClient,
      )

      // 取引状態を追跡
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log(`Intent executed: ${intent.action}, tx: ${hash}`)
        // オプション：通知システムでユーザーに通知
      } else {
        console.error(`Intent failed: ${hash}`)
        // リトライまたはユーザー通知
      }
    } catch (error) {
      console.error(`Intent execution error: ${error}`)
    }
  }

  // すべての監視を停止
  stopAll() {
    for (const monitor of this.monitors.values()) {
      monitor.stop()
    }
    this.monitors.clear()
  }
}

// 価格モニター
class PriceMonitor {
  private interval: NodeJS.Timeout | null = null
  private callbacks: (() => void)[] = []

  constructor(
    private token: string,
    private operator: '>' | '<' | '>=' | '<=',
    private targetValue: number,
  ) {}

  onTrigger(cb: () => void) {
    this.callbacks.push(cb)
  }

  start() {
    this.interval = setInterval(async () => {
      const currentPrice = await this.fetchPrice(this.token)
      if (this.evaluate(currentPrice)) {
        this.callbacks.forEach((cb) => cb())
        this.stop() // 一度トリガーされたら停止
      }
    }, 10000) // 10 秒ごとにチェック
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async fetchPrice(token: string): Promise<number> {
    // Chainlink または DEX から価格を取得
    const response = await fetch(`https://api.example.com/price/${token}`)
    const data = await response.json()
    return data.price
  }

  private evaluate(current: number): boolean {
    switch (this.operator) {
      case '>': return current > this.targetValue
      case '<': return current < this.targetValue
      case '>=': return current >= this.targetValue
      case '<=': return current <= this.targetValue
    }
  }
}
```

## Agent とウォレットのインタラクションモード

Agent とウォレットのインタラクションには二つのモードがあります：

**モード一：Agent が署名キーを保持（全自動）**

Agent は制限付きの Session Key を保持し、自律的に取引に署名できます。セキュリティは Session Key の権限制御に依存します——呼び出し可能なコントラクト、金額上限、有効期限を制限します。

**モード二：Agent が取引を構築し、ユーザーが署名を承認（半自動）**

Agent が取引データの構築とシミュレーション実行を担当し、最終的な署名はユーザーが行います。高額取引やセンシティブな操作に適しています。

```typescript
// モード二：半自動モード
async function semiAutoExecute(
  intent: TransactionIntent,
  agent: AIAgent,
  userWallet: WalletClient,
  publicClient: PublicClient,
) {
  // Agent が取引を構築
  const txPlan = await agent.planTransaction(intent, publicClient)

  // ユーザーに取引計画を提示
  const userApproved = await presentToUser({
    action: intent.action,
    contract: txPlan.contractName,
    functionName: txPlan.functionName,
    args: txPlan.args,
    estimatedGas: txPlan.estimatedGas,
    estimatedCost: txPlan.estimatedGasCost,
    simulationResult: txPlan.simulation,
    value: txPlan.value,
  })

  if (!userApproved) {
    throw new Error('User rejected the transaction plan')
  }

  // ユーザーが署名
  const hash = await userWallet.writeContract({
    address: txPlan.contractAddress,
    abi: txPlan.abi,
    functionName: txPlan.functionName,
    args: txPlan.args,
    value: txPlan.value,
  })

  return hash
}
```

## マルチステップ取引の Agent オーケストレーション

複雑な操作にはマルチステップ取引が必要です。Agent は実行順序の調整、中間状態の処理、エラーリカバリーを担当します：

```typescript
// マルチステップ取引オーケストレーター
class TransactionOrchestrator {
  private agent: AIAgent
  private signer: SecureSigningPipeline
  private walletClient: WalletClient
  private publicClient: PublicClient

  // マルチステップ取引計画を実行
  async executePlan(steps: TransactionStep[]): Promise<ExecutionResult> {
    const results: StepResult[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      try {
        // 事前条件をチェック
        if (step.precondition) {
          const met = await step.precondition(this.publicClient, results)
          if (!met) {
            return {
              success: false,
              completedSteps: results,
              failedAtStep: i,
              reason: 'Precondition not met',
            }
          }
        }

        // 現在のステップを実行
        const hash = await this.signer.sign(
          step.intent,
          this.walletClient,
          this.publicClient,
        )

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          // ロールバックを試行
          if (step.rollback) {
            await this.executeRollback(step.rollback, results)
          }
          return {
            success: false,
            completedSteps: results,
            failedAtStep: i,
            reason: 'Transaction reverted',
            receipt,
          }
        }

        results.push({ step: i, hash, receipt, success: true })

        // 事後条件をチェック
        if (step.postcondition) {
          const met = await step.postcondition(this.publicClient, receipt)
          if (!met) {
            return {
              success: false,
              completedSteps: results,
              failedAtStep: i,
              reason: 'Postcondition not met',
            }
          }
        }
      } catch (error) {
        return {
          success: false,
          completedSteps: results,
          failedAtStep: i,
          reason: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    return { success: true, completedSteps: results }
  }

  // 実行済みのステップをロールバック
  private async executeRollback(
    rollbackSteps: RollbackStep[],
    completedResults: StepResult[],
  ) {
    // 逆順でロールバックを実行
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try {
        await this.signer.sign(
          rollbackSteps[i].intent,
          this.walletClient,
          this.publicClient,
        )
      } catch {
        // ロールバック失敗も記録する必要がある
        console.error('Rollback failed')
      }
    }
  }
}

// 例：Agent が複雑な DeFi 操作をオーケストレーション
async function orchestrateDefiStrategy(
  orchestrator: TransactionOrchestrator,
  agent: AIAgent,
) {
  // ユーザーが言う：「ETH を Lido に預けて、stETH を Aave で担保に USDC を借りて」
  const plan = await agent.planMultiStep({
    instruction: 'Deposit ETH to Lido, then use stETH as collateral to borrow USDC on Aave',
  })

  // plan には以下が含まれる：
  // Step 1: approve Lido stETH
  // Step 2: stake ETH to Lido
  // Step 3: approve Aave stETH
  // Step 4: supply stETH to Aave
  // Step 5: borrow USDC from Aave

  const result = await orchestrator.executePlan(plan)
  return result
}
```

## エラーハンドリング：Agent 意思決定失敗時のロールバック

Agent は誤った意思決定をする可能性があります——LLM の幻覚によって存在しないコントラクトを呼び出したり、市場状況の判断を誤ったりするかもしれません。堅牢なエラーハンドリングは必須です：

```typescript
class AgentErrorHandler {
  // エラー分類
  classifyError(error: unknown): ErrorType {
    if (error instanceof SecurityError) return 'security'
    if (error instanceof ConditionError) return 'condition'
    if (error instanceof ContractError) return 'contract'
    if (error instanceof NetworkError) return 'network'
    return 'unknown'
  }

  // エラータイプに応じてロールバック戦略を決定
  getFallbackStrategy(errorType: ErrorType): FallbackStrategy {
    switch (errorType) {
      case 'security':
        // セキュリティエラー：即時停止、ユーザーに通知
        return { action: 'stop', notify: true, autoRetry: false }

      case 'condition':
        // 条件未達成：待機してリトライ
        return { action: 'wait', waitTime: 60000, maxRetries: 3, autoRetry: true }

      case 'contract':
        // コントラクトエラー：ABI 不一致かチェック、修正を試行
        return { action: 'replan', maxReplans: 2 }

      case 'network':
        // ネットワークエラー：RPC エンドポイントを切り替えてリトライ
        return { action: 'retry', maxRetries: 5, retryDelay: 5000 }

      default:
        return { action: 'stop', notify: true, autoRetry: false }
    }
  }

  async handleError(
    error: unknown,
    intent: TransactionIntent,
    pipeline: AutomatedTradingPipeline,
  ): Promise<void> {
    const errorType = this.classifyError(error)
    const strategy = this.getFallbackStrategy(errorType)

    switch (strategy.action) {
      case 'wait':
        if (strategy.autoRetry) {
          await new Promise((r) => setTimeout(r, strategy.waitTime))
          await pipeline.registerTrigger(JSON.stringify(intent))
        }
        break

      case 'replan':
        // Agent に再計画させる
        break

      case 'stop':
        // パイプラインを停止して通知
        pipeline.stopAll()
        break
    }
  }
}
```

## セキュリティ設計：ホワイトリストコントラクト、金額制限、承認フロー

セキュリティは AI + Web3 の生命線です。以下は推奨されるセキュリティアーキテクチャです：

```typescript
// コントラクトホワイトリスト
class ContractWhitelist {
  private whitelist: Map<string, Set<string>> = new Map()

  // 形式: contractAddress -> Set<allowedActions>
  constructor(rules: { contract: string; actions: string[] }[]) {
    for (const rule of rules) {
      this.whitelist.set(
        rule.contract.toLowerCase(),
        new Set(rule.actions),
      )
    }
  }

  isAllowed(contract: string, action: string): boolean {
    const actions = this.whitelist.get(contract.toLowerCase())
    return actions ? actions.has(action) : false
  }
}

// 取引制限
interface TransactionLimits {
  maxAmount: bigint           // 取引あたりの最大金額
  maxDailyVolume: bigint      // 日次最大取引量
  autoApproveThreshold: bigint // 自動承認閾値
  cooldownPeriod: number       // クールダウン期間（ミリ秒）
}

// レート制限器
class RateLimiter {
  private lastTransaction: Map<string, number> = new Map()
  private dailyVolume: bigint = 0n
  private dailyResetTime: number = Date.now()

  constructor(private limits: TransactionLimits) {}

  async check(intent: TransactionIntent): Promise<void> {
    // クールダウン期間をチェック
    const key = `${intent.action}-${intent.protocol}`
    const lastTime = this.lastTransaction.get(key) || 0
    if (Date.now() - lastTime < this.limits.cooldownPeriod) {
      throw new SecurityError('Cooldown period not elapsed')
    }

    // 日次取引量をチェック
    if (Date.now() - this.dailyResetTime > 86400000) {
      this.dailyVolume = 0n
      this.dailyResetTime = Date.now()
    }

    const amount = extractAmount(intent)
    if (this.dailyVolume + amount > this.limits.maxDailyVolume) {
      throw new SecurityError('Daily volume limit exceeded')
    }
  }

  record(intent: TransactionIntent) {
    const key = `${intent.action}-${intent.protocol}`
    this.lastTransaction.set(key, Date.now())
    this.dailyVolume += extractAmount(intent)
  }
}
```

## まとめ

AI Agent と Web3 の組み合わせは、まったく新しいインタラクションパラダイムを創造しています。ユーザーはもはや ABI、Gas、Nonce といった概念を理解する必要はありません——自然言語で意図を記述するだけで、Agent がそれをオンチェーン取引に変換します。この利便性の代償は、より高いセキュリティリスクです。LLM の予測不可能性は、Agent が誤った意思決定をする可能性を意味し、Web3 の不可逆性は誤りの結果が永久的であることを意味します。安全境界設計はアーキテクチャ全体の中核です——コントラクトホワイトリスト、金額制限、人間による承認、レート制限制御が多層防御を構成します。長期的に見て、AI + Web3 の最大の機会はユーザー参入障壁を下げることです：Gas や秘密鍵を知らない数十億の人々もオンチェーンサービスを利用できるようにすることです。しかしこのビジョンの前提は、セキュリティアーキテクチャが十分に成熟し、Agent のリスクを制御可能な範囲に抑えられることです。
