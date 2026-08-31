---
title: "AI Agent 與 Web3 交互：自動化交易管道"
date: 2025-03-15 19:04:38
tags:
  - Web3
  - AI
readingTime: 8
description: "探索 LLM Agent 調用智能合約的完整架構，涵蓋意圖識別、安全簽名、自動化交易管道及多步交易編排"
wordCount: 772
---

## LLM Agent 調用智能合約的架構

AI Agent 與 Web3 的結合是一個具前景的技術方向。核心思路是讓 LLM（大語言模型）作為決策層，將自然語言指令轉化為鏈上交易。

整體架構分為三層：

```
┌──────────────────────────────────────────────────┐
│                  用戶層 (User Layer)               │
│    "幫我用 100 USDC 換 ETH，如果 Gas < 20 gwei"    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              AI Agent 層 (Decision Layer)          │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ 意圖識別 │─▶│ 策略決策  │─▶│ 交易構造 & 簽名  │  │
│  └─────────┘  └──────────┘  └─────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              執行層 (Execution Layer)              │
│    Wallet Client → RPC → Blockchain               │
└──────────────────────────────────────────────────┘
```

Agent 不是直接調用 LLM 的 API 來簽發交易——那樣太危險了。正確的架構是 Agent 將 LLM 的輸出作為"交易意圖"，經過安全校驗後再構造實際交易。

## 意圖識別：從自然語言到合約調用

意圖識別是將用戶的自然語言指令轉換為結構化的交易參數：

```typescript
// 交易意圖數據結構
interface TransactionIntent {
  action: 'swap' | 'stake' | 'transfer' | 'approve' | 'claim' | 'bridge' | 'custom'
  protocol: string       // 目標協議，如 'uniswap-v3'
  params: Record<string, any>
  conditions?: {
    maxGasPrice?: bigint       // Gas 價格條件
    minSlippage?: number       // 最大滑點
    deadline?: number          // 過期時間
    priceCondition?: {         // 價格觸發條件
      token: string
      operator: '>' | '<' | '>=' | '<='
      value: number
    }
  }
  constraints: {
    maxAmount: bigint          // 最大交易金額
    allowedContracts: string[] // 允許調用的合約白名單
  }
}

// LLM 系統提示詞
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

// 意圖識別管道
class IntentParser {
  private llm: LLMClient
  private tokenRegistry: TokenRegistry

  constructor(llm: LLMClient, tokenRegistry: TokenRegistry) {
    this.llm = llm
    this.tokenRegistry = tokenRegistry
  }

  async parse(userInput: string): Promise<TransactionIntent> {
    // 1. 調用 LLM 解析意圖
    const rawIntent = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: userInput,
      temperature: 0, // 確定性輸出
    })

    const parsed = JSON.parse(rawIntent)

    // 2. 驗證和規範化意圖
    const intent = await this.validateIntent(parsed)

    return intent
  }

  private async validateIntent(raw: any): Promise<TransactionIntent> {
    // 驗證 action 是否合法
    const validActions = ['swap', 'stake', 'transfer', 'approve', 'claim', 'bridge', 'custom']
    if (!validActions.includes(raw.action)) {
      throw new Error(`Invalid action: ${raw.action}`)
    }

    // 將 token 符號解析為合約地址
    const params = { ...raw.params }
    for (const key of ['tokenIn', 'tokenOut', 'token', 'rewardToken']) {
      if (params[key] && typeof params[key] === 'string') {
        const tokenInfo = await this.tokenRegistry.getByName(params[key])
        if (tokenInfo) {
          params[key] = tokenInfo.address
        }
      }
    }

    // 設置安全約束
    const intent: TransactionIntent = {
      ...raw,
      params,
      constraints: {
        maxAmount: raw.constraints?.maxAmount
          ? BigInt(raw.constraints.maxAmount)
          : parseEther('1000'), // 默認最大 1000 ETH 等價物
        allowedContracts: raw.constraints?.allowedContracts || [],
      },
    }

    return intent
  }
}
```

## Agent 交易簽名：安全邊界與權限控制

Agent 簽名是整個架構中最敏感的部分。LLM 輸出不能直接用於簽名——必須經過多重安全檢查：

```typescript
// 安全簽名管道
class SecureSigningPipeline {
  private whitelist: ContractWhitelist
  private limits: TransactionLimits
  private approver: HumanApprover | null // 可選的人工審批

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
    // 1. 合約白名單檢查
    const targetContract = this.resolveTargetContract(intent)
    if (!this.whitelist.isAllowed(targetContract, intent.action)) {
      throw new SecurityError(
        `Contract ${targetContract} is not in whitelist for action ${intent.action}`
      )
    }

    // 2. 金額限制檢查
    const txAmount = this.extractAmount(intent)
    if (txAmount > this.limits.maxAmount) {
      throw new SecurityError(
        `Amount ${txAmount} exceeds limit ${this.limits.maxAmount}`
      )
    }

    // 3. 條件檢查（Gas 價格、價格觸發等）
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

    // 4. 構造交易數據
    const txData = await this.buildTransactionData(intent)

    // 5. 模擬執行
    const simulation = await publicClient.simulateContract({
      address: targetContract,
      abi: await this.getContractAbi(targetContract),
      functionName: txData.functionName,
      args: txData.args,
      account: walletClient.account!,
      value: txData.value,
    })

    // 6. 可選：人工審批
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

    // 7. 簽名併發送
    return walletClient.writeContract(simulation.request)
  }

  private requiresApproval(intent: TransactionIntent, amount: bigint): boolean {
    // 大額交易需要人工審批
    return amount > this.limits.autoApproveThreshold
  }
}
```

## 自動化交易管道：監控 -> 決策 -> 執行

完整的自動化管道需要持續監控鏈上狀態，在條件滿足時自動觸發交易：

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

  // 註冊條件觸發器
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
      // 無條件，立即執行
      await this.executeIntent(intent)
    }
  }

  // 執行意圖
  private async executeIntent(intent: TransactionIntent) {
    try {
      const hash = await this.signer.sign(
        intent,
        this.walletClient,
        this.publicClient,
      )

      // 追蹤交易狀態
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log(`Intent executed: ${intent.action}, tx: ${hash}`)
        // 可選：通過通知系統告知用戶
      } else {
        console.error(`Intent failed: ${hash}`)
        // 重試或通知用戶
      }
    } catch (error) {
      console.error(`Intent execution error: ${error}`)
    }
  }

  // 停止所有監控
  stopAll() {
    for (const monitor of this.monitors.values()) {
      monitor.stop()
    }
    this.monitors.clear()
  }
}

// 價格監控器
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
        this.stop() // 觸發一次後停止
      }
    }, 10000) // 每 10 秒檢查一次
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async fetchPrice(token: string): Promise<number> {
    // 從 Chainlink 或 DEX 獲取價格
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

## Agent 與錢包的交互模式

Agent 與錢包的交互有兩種模式：

**模式一：Agent 持有簽名密鑰（全自動）**

Agent 持有一個受限的 Session Key，可以自主簽名交易。安全性依賴 Session Key 的權限控制——限制可調用的合約、金額上限和有效期。

**模式二：Agent 構造交易，用戶審批簽名（半自動）**

Agent 負責構造交易數據和模擬執行，但最終簽名由用戶完成。適用於高價值交易或敏感操作。

```typescript
// 模式二：半自動模式
async function semiAutoExecute(
  intent: TransactionIntent,
  agent: AIAgent,
  userWallet: WalletClient,
  publicClient: PublicClient,
) {
  // Agent 構造交易
  const txPlan = await agent.planTransaction(intent, publicClient)

  // 向用戶展示交易計劃
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

  // 用戶簽名
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

## 多步交易的 Agent 編排

複雜操作需要多步交易。Agent 負責編排執行順序，處理中間狀態和錯誤恢復：

```typescript
// 多步交易編排器
class TransactionOrchestrator {
  private agent: AIAgent
  private signer: SecureSigningPipeline
  private walletClient: WalletClient
  private publicClient: PublicClient

  // 執行多步交易計劃
  async executePlan(steps: TransactionStep[]): Promise<ExecutionResult> {
    const results: StepResult[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      try {
        // 檢查前置條件
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

        // 執行當前步驟
        const hash = await this.signer.sign(
          step.intent,
          this.walletClient,
          this.publicClient,
        )

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          // 嘗試回退
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

        // 檢查後置條件
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

  // 回退已執行的步驟
  private async executeRollback(
    rollbackSteps: RollbackStep[],
    completedResults: StepResult[],
  ) {
    // 反向執行回滾
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try {
        await this.signer.sign(
          rollbackSteps[i].intent,
          this.walletClient,
          this.publicClient,
        )
      } catch {
        // 回滾失敗也需要記錄
        console.error('Rollback failed')
      }
    }
  }
}

// 示例：Agent 編排一個複雜的 DeFi 操作
async function orchestrateDefiStrategy(
  orchestrator: TransactionOrchestrator,
  agent: AIAgent,
) {
  // 用戶説："把我的 ETH 存入 Lido，然後用 stETH 在 Aave 借 USDC"
  const plan = await agent.planMultiStep({
    instruction: 'Deposit ETH to Lido, then use stETH as collateral to borrow USDC on Aave',
  })

  // plan 包含：
  // Step 1: approve Lido stETH
  // Step 2: stake ETH to Lido
  // Step 3: approve Aave stETH
  // Step 4: supply stETH to Aave
  // Step 5: borrow USDC from Aave

  const result = await orchestrator.executePlan(plan)
  return result
}
```

## 錯誤處理：Agent 決策失敗時的回退

Agent 可能做出錯誤決策——可能是 LLM 幻覺導致調用了不存在的合約，或是對市場條件判斷失誤。健壯的錯誤處理是必須的：

```typescript
class AgentErrorHandler {
  // 錯誤分類
  classifyError(error: unknown): ErrorType {
    if (error instanceof SecurityError) return 'security'
    if (error instanceof ConditionError) return 'condition'
    if (error instanceof ContractError) return 'contract'
    if (error instanceof NetworkError) return 'network'
    return 'unknown'
  }

  // 根據錯誤類型決定回退策略
  getFallbackStrategy(errorType: ErrorType): FallbackStrategy {
    switch (errorType) {
      case 'security':
        // 安全錯誤：立即停止，通知用戶
        return { action: 'stop', notify: true, autoRetry: false }

      case 'condition':
        // 條件未滿足：等待重試
        return { action: 'wait', waitTime: 60000, maxRetries: 3, autoRetry: true }

      case 'contract':
        // 合約錯誤：檢查是否是 ABI 不匹配，嘗試修正
        return { action: 'replan', maxReplans: 2 }

      case 'network':
        // 網絡錯誤：切換 RPC 端點重試
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
        // 讓 Agent 重新規劃
        break

      case 'stop':
        // 停止管道並通知
        pipeline.stopAll()
        break
    }
  }
}
```

## 安全設計：白名單合約、金額限制、審批流程

安全是 AI + Web3 的生命線。以下是推薦的安全架構：

```typescript
// 合約白名單
class ContractWhitelist {
  private whitelist: Map<string, Set<string>> = new Map()

  // 格式: contractAddress -> Set<allowedActions>
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

// 交易限制
interface TransactionLimits {
  maxAmount: bigint           // 單筆最大金額
  maxDailyVolume: bigint      // 日最大交易量
  autoApproveThreshold: bigint // 自動審批閾值
  cooldownPeriod: number       // 冷卻期（毫秒）
}

// 頻率限制器
class RateLimiter {
  private lastTransaction: Map<string, number> = new Map()
  private dailyVolume: bigint = 0n
  private dailyResetTime: number = Date.now()

  constructor(private limits: TransactionLimits) {}

  async check(intent: TransactionIntent): Promise<void> {
    // 檢查冷卻期
    const key = `${intent.action}-${intent.protocol}`
    const lastTime = this.lastTransaction.get(key) || 0
    if (Date.now() - lastTime < this.limits.cooldownPeriod) {
      throw new SecurityError('Cooldown period not elapsed')
    }

    // 檢查日交易量
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

## 小結

AI Agent 與 Web3 的結合正在創造全新的交互範式。用戶不再需要理解 ABI、Gas、Nonce 等概念——他們只需要用自然語言描述意圖，Agent 負責將其轉化為鏈上交易。這種便利性的代價是更高的安全風險。LLM 的不可預測性意味着 Agent 可能做出錯誤決策，而 Web3 的不可逆性使得錯誤的後果是永久的。安全邊界設計是整個架構的核心——合約白名單、金額限制、人工審批和頻率控制構成了多層防禦。從長期來看，AI + Web3 的最大機遇是降低用戶門檻：讓數十億不懂得 Gas 和私鑰的用戶也能使用鏈上服務。但這個願景的前提是安全架構足夠成熟，能將 Agent 的風險限制在可控範圍內。
