---
title: "AI Agent 与 Web3 交互：自动化交易管道"
date: 2025-03-15 19:04:38
tags:
  - Web3
  - AI
readingTime: 12
description: "探索 LLM Agent 调用智能合约的完整架构，涵盖意图识别、安全签名、自动化交易管道及多步交易编排"
wordCount: 3700
---

## LLM Agent 调用智能合约的架构

AI Agent 与 Web3 的结合是 2025 年最具前景的技术方向之一。核心思路是让 LLM（大语言模型）作为决策层，将自然语言指令转化为链上交易。

整体架构分为三层：

```
┌──────────────────────────────────────────────────┐
│                  用户层 (User Layer)               │
│    "帮我用 100 USDC 换 ETH，如果 Gas < 20 gwei"    │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              AI Agent 层 (Decision Layer)          │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ 意图识别 │─▶│ 策略决策  │─▶│ 交易构造 & 签名  │  │
│  └─────────┘  └──────────┘  └─────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              执行层 (Execution Layer)              │
│    Wallet Client → RPC → Blockchain               │
└──────────────────────────────────────────────────┘
```

Agent 不是直接调用 LLM 的 API 来签发交易——那样太危险了。正确的架构是 Agent 将 LLM 的输出作为"交易意图"，经过安全校验后再构造实际交易。

## 意图识别：从自然语言到合约调用

意图识别是将用户的自然语言指令转换为结构化的交易参数：

```typescript
// 交易意图数据结构
interface TransactionIntent {
  action: 'swap' | 'stake' | 'transfer' | 'approve' | 'claim' | 'bridge' | 'custom'
  protocol: string       // 目标协议，如 'uniswap-v3'
  params: Record<string, any>
  conditions?: {
    maxGasPrice?: bigint       // Gas 价格条件
    minSlippage?: number       // 最大滑点
    deadline?: number          // 过期时间
    priceCondition?: {         // 价格触发条件
      token: string
      operator: '>' | '<' | '>=' | '<='
      value: number
    }
  }
  constraints: {
    maxAmount: bigint          // 最大交易金额
    allowedContracts: string[] // 允许调用的合约白名单
  }
}

// LLM 系统提示词
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

// 意图识别管道
class IntentParser {
  private llm: LLMClient
  private tokenRegistry: TokenRegistry

  constructor(llm: LLMClient, tokenRegistry: TokenRegistry) {
    this.llm = llm
    this.tokenRegistry = tokenRegistry
  }

  async parse(userInput: string): Promise<TransactionIntent> {
    // 1. 调用 LLM 解析意图
    const rawIntent = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: userInput,
      temperature: 0, // 确定性输出
    })

    const parsed = JSON.parse(rawIntent)

    // 2. 验证和规范化意图
    const intent = await this.validateIntent(parsed)

    return intent
  }

  private async validateIntent(raw: any): Promise<TransactionIntent> {
    // 验证 action 是否合法
    const validActions = ['swap', 'stake', 'transfer', 'approve', 'claim', 'bridge', 'custom']
    if (!validActions.includes(raw.action)) {
      throw new Error(`Invalid action: ${raw.action}`)
    }

    // 将 token 符号解析为合约地址
    const params = { ...raw.params }
    for (const key of ['tokenIn', 'tokenOut', 'token', 'rewardToken']) {
      if (params[key] && typeof params[key] === 'string') {
        const tokenInfo = await this.tokenRegistry.getByName(params[key])
        if (tokenInfo) {
          params[key] = tokenInfo.address
        }
      }
    }

    // 设置安全约束
    const intent: TransactionIntent = {
      ...raw,
      params,
      constraints: {
        maxAmount: raw.constraints?.maxAmount
          ? BigInt(raw.constraints.maxAmount)
          : parseEther('1000'), // 默认最大 1000 ETH 等价物
        allowedContracts: raw.constraints?.allowedContracts || [],
      },
    }

    return intent
  }
}
```

## Agent 交易签名：安全边界与权限控制

Agent 签名是整个架构中最敏感的部分。LLM 输出不能直接用于签名——必须经过多重安全检查：

```typescript
// 安全签名管道
class SecureSigningPipeline {
  private whitelist: ContractWhitelist
  private limits: TransactionLimits
  private approver: HumanApprover | null // 可选的人工审批

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
    // 1. 合约白名单检查
    const targetContract = this.resolveTargetContract(intent)
    if (!this.whitelist.isAllowed(targetContract, intent.action)) {
      throw new SecurityError(
        `Contract ${targetContract} is not in whitelist for action ${intent.action}`
      )
    }

    // 2. 金额限制检查
    const txAmount = this.extractAmount(intent)
    if (txAmount > this.limits.maxAmount) {
      throw new SecurityError(
        `Amount ${txAmount} exceeds limit ${this.limits.maxAmount}`
      )
    }

    // 3. 条件检查（Gas 价格、价格触发等）
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

    // 4. 构造交易数据
    const txData = await this.buildTransactionData(intent)

    // 5. 模拟执行
    const simulation = await publicClient.simulateContract({
      address: targetContract,
      abi: await this.getContractAbi(targetContract),
      functionName: txData.functionName,
      args: txData.args,
      account: walletClient.account!,
      value: txData.value,
    })

    // 6. 可选：人工审批
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

    // 7. 签名并发送
    return walletClient.writeContract(simulation.request)
  }

  private requiresApproval(intent: TransactionIntent, amount: bigint): boolean {
    // 大额交易需要人工审批
    return amount > this.limits.autoApproveThreshold
  }
}
```

## 自动化交易管道：监控 -> 决策 -> 执行

完整的自动化管道需要持续监控链上状态，在条件满足时自动触发交易：

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

  // 注册条件触发器
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
      // 无条件，立即执行
      await this.executeIntent(intent)
    }
  }

  // 执行意图
  private async executeIntent(intent: TransactionIntent) {
    try {
      const hash = await this.signer.sign(
        intent,
        this.walletClient,
        this.publicClient,
      )

      // 追踪交易状态
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log(`Intent executed: ${intent.action}, tx: ${hash}`)
        // 可选：通过通知系统告知用户
      } else {
        console.error(`Intent failed: ${hash}`)
        // 重试或通知用户
      }
    } catch (error) {
      console.error(`Intent execution error: ${error}`)
    }
  }

  // 停止所有监控
  stopAll() {
    for (const monitor of this.monitors.values()) {
      monitor.stop()
    }
    this.monitors.clear()
  }
}

// 价格监控器
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
        this.stop() // 触发一次后停止
      }
    }, 10000) // 每 10 秒检查一次
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async fetchPrice(token: string): Promise<number> {
    // 从 Chainlink 或 DEX 获取价格
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

## Agent 与钱包的交互模式

Agent 与钱包的交互有两种模式：

**模式一：Agent 持有签名密钥（全自动）**

Agent 持有一个受限的 Session Key，可以自主签名交易。安全性依赖 Session Key 的权限控制——限制可调用的合约、金额上限和有效期。

**模式二：Agent 构造交易，用户审批签名（半自动）**

Agent 负责构造交易数据和模拟执行，但最终签名由用户完成。适用于高价值交易或敏感操作。

```typescript
// 模式二：半自动模式
async function semiAutoExecute(
  intent: TransactionIntent,
  agent: AIAgent,
  userWallet: WalletClient,
  publicClient: PublicClient,
) {
  // Agent 构造交易
  const txPlan = await agent.planTransaction(intent, publicClient)

  // 向用户展示交易计划
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

  // 用户签名
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

## 多步交易的 Agent 编排

复杂操作需要多步交易。Agent 负责编排执行顺序，处理中间状态和错误恢复：

```typescript
// 多步交易编排器
class TransactionOrchestrator {
  private agent: AIAgent
  private signer: SecureSigningPipeline
  private walletClient: WalletClient
  private publicClient: PublicClient

  // 执行多步交易计划
  async executePlan(steps: TransactionStep[]): Promise<ExecutionResult> {
    const results: StepResult[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      try {
        // 检查前置条件
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

        // 执行当前步骤
        const hash = await this.signer.sign(
          step.intent,
          this.walletClient,
          this.publicClient,
        )

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          // 尝试回退
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

        // 检查后置条件
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

  // 回退已执行的步骤
  private async executeRollback(
    rollbackSteps: RollbackStep[],
    completedResults: StepResult[],
  ) {
    // 反向执行回滚
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try {
        await this.signer.sign(
          rollbackSteps[i].intent,
          this.walletClient,
          this.publicClient,
        )
      } catch {
        // 回滚失败也需要记录
        console.error('Rollback failed')
      }
    }
  }
}

// 示例：Agent 编排一个复杂的 DeFi 操作
async function orchestrateDefiStrategy(
  orchestrator: TransactionOrchestrator,
  agent: AIAgent,
) {
  // 用户说："把我的 ETH 存入 Lido，然后用 stETH 在 Aave 借 USDC"
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

## 错误处理：Agent 决策失败时的回退

Agent 可能做出错误决策——可能是 LLM 幻觉导致调用了不存在的合约，或是对市场条件判断失误。健壮的错误处理是必须的：

```typescript
class AgentErrorHandler {
  // 错误分类
  classifyError(error: unknown): ErrorType {
    if (error instanceof SecurityError) return 'security'
    if (error instanceof ConditionError) return 'condition'
    if (error instanceof ContractError) return 'contract'
    if (error instanceof NetworkError) return 'network'
    return 'unknown'
  }

  // 根据错误类型决定回退策略
  getFallbackStrategy(errorType: ErrorType): FallbackStrategy {
    switch (errorType) {
      case 'security':
        // 安全错误：立即停止，通知用户
        return { action: 'stop', notify: true, autoRetry: false }

      case 'condition':
        // 条件未满足：等待重试
        return { action: 'wait', waitTime: 60000, maxRetries: 3, autoRetry: true }

      case 'contract':
        // 合约错误：检查是否是 ABI 不匹配，尝试修正
        return { action: 'replan', maxReplans: 2 }

      case 'network':
        // 网络错误：切换 RPC 端点重试
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
        // 让 Agent 重新规划
        break

      case 'stop':
        // 停止管道并通知
        pipeline.stopAll()
        break
    }
  }
}
```

## 安全设计：白名单合约、金额限制、审批流程

安全是 AI + Web3 的生命线。以下是推荐的安全架构：

```typescript
// 合约白名单
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
  maxAmount: bigint           // 单笔最大金额
  maxDailyVolume: bigint      // 日最大交易量
  autoApproveThreshold: bigint // 自动审批阈值
  cooldownPeriod: number       // 冷却期（毫秒）
}

// 频率限制器
class RateLimiter {
  private lastTransaction: Map<string, number> = new Map()
  private dailyVolume: bigint = 0n
  private dailyResetTime: number = Date.now()

  constructor(private limits: TransactionLimits) {}

  async check(intent: TransactionIntent): Promise<void> {
    // 检查冷却期
    const key = `${intent.action}-${intent.protocol}`
    const lastTime = this.lastTransaction.get(key) || 0
    if (Date.now() - lastTime < this.limits.cooldownPeriod) {
      throw new SecurityError('Cooldown period not elapsed')
    }

    // 检查日交易量
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

## 小结

AI Agent 与 Web3 的结合正在创造全新的交互范式。用户不再需要理解 ABI、Gas、Nonce 等概念——他们只需要用自然语言描述意图，Agent 负责将其转化为链上交易。这种便利性的代价是更高的安全风险。LLM 的不可预测性意味着 Agent 可能做出错误决策，而 Web3 的不可逆性使得错误的后果是永久的。安全边界设计是整个架构的核心——合约白名单、金额限制、人工审批和频率控制构成了多层防御。从长期来看，AI + Web3 的最大机遇是降低用户门槛：让数十亿不懂得 Gas 和私钥的用户也能使用链上服务。但这个愿景的前提是安全架构足够成熟，能将 Agent 的风险限制在可控范围内。
