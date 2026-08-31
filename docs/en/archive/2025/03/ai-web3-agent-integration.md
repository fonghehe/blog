---
title: "AI Agent and Web3 Interaction: Automated Transaction Pipelines"
date: 2025-03-15 19:04:38
tags:
  - Web3
  - AI
readingTime: 9
description: "Exploring the complete architecture of LLM Agents calling smart contracts, covering intent recognition, secure signing, automated transaction pipelines, and multi-step transaction orchestration"
wordCount: 492
---

## Architecture of LLM Agents Calling Smart Contracts

The convergence of AI Agents and Web3 is one of the most promising technology directions. The core idea is to let LLMs (Large Language Models) serve as the decision layer, transforming natural language instructions into on-chain transactions.

The overall architecture is divided into three layers:

```
┌──────────────────────────────────────────────────┐
│                  User Layer                        │
│    "Swap 100 USDC for ETH if Gas < 20 gwei"       │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              AI Agent Layer (Decision Layer)        │
│  ┌─────────┐  ┌──────────┐  ┌─────────────────┐  │
│  │ Intent   │─▶│ Strategy  │─▶│ Transaction      │  │
│  │ Recognition│ │ Decision  │  │ Construction &   │  │
│  └─────────┘  └──────────┘  │ Signing          │  │
│                              └─────────────────┘  │
└──────────────────────┬───────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────┐
│              Execution Layer                       │
│    Wallet Client → RPC → Blockchain               │
└──────────────────────────────────────────────────┘
```

The Agent doesn't directly call the LLM's API to sign transactions — that would be too dangerous. The correct architecture is for the Agent to treat the LLM's output as a "transaction intent," which goes through security validation before constructing the actual transaction.

## Intent Recognition: From Natural Language to Contract Calls

Intent recognition converts the user's natural language instructions into structured transaction parameters:

```typescript
// Transaction intent data structure
interface TransactionIntent {
  action: 'swap' | 'stake' | 'transfer' | 'approve' | 'claim' | 'bridge' | 'custom'
  protocol: string       // Target protocol, e.g., 'uniswap-v3'
  params: Record<string, any>
  conditions?: {
    maxGasPrice?: bigint       // Gas price condition
    minSlippage?: number       // Maximum slippage
    deadline?: number          // Expiration time
    priceCondition?: {         // Price trigger condition
      token: string
      operator: '>' | '<' | '>=' | '<='
      value: number
    }
  }
  constraints: {
    maxAmount: bigint          // Maximum transaction amount
    allowedContracts: string[] // Whitelist of allowed contracts
  }
}

// LLM system prompt
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

// Intent recognition pipeline
class IntentParser {
  private llm: LLMClient
  private tokenRegistry: TokenRegistry

  constructor(llm: LLMClient, tokenRegistry: TokenRegistry) {
    this.llm = llm
    this.tokenRegistry = tokenRegistry
  }

  async parse(userInput: string): Promise<TransactionIntent> {
    // 1. Call LLM to parse intent
    const rawIntent = await this.llm.complete({
      system: SYSTEM_PROMPT,
      user: userInput,
      temperature: 0, // Deterministic output
    })

    const parsed = JSON.parse(rawIntent)

    // 2. Validate and normalize intent
    const intent = await this.validateIntent(parsed)

    return intent
  }

  private async validateIntent(raw: any): Promise<TransactionIntent> {
    // Validate that action is legal
    const validActions = ['swap', 'stake', 'transfer', 'approve', 'claim', 'bridge', 'custom']
    if (!validActions.includes(raw.action)) {
      throw new Error(`Invalid action: ${raw.action}`)
    }

    // Resolve token symbols to contract addresses
    const params = { ...raw.params }
    for (const key of ['tokenIn', 'tokenOut', 'token', 'rewardToken']) {
      if (params[key] && typeof params[key] === 'string') {
        const tokenInfo = await this.tokenRegistry.getByName(params[key])
        if (tokenInfo) {
          params[key] = tokenInfo.address
        }
      }
    }

    // Set security constraints
    const intent: TransactionIntent = {
      ...raw,
      params,
      constraints: {
        maxAmount: raw.constraints?.maxAmount
          ? BigInt(raw.constraints.maxAmount)
          : parseEther('1000'), // Default max 1000 ETH equivalent
        allowedContracts: raw.constraints?.allowedContracts || [],
      },
    }

    return intent
  }
}
```

## Agent Transaction Signing: Security Boundaries and Permission Control

Agent signing is the most sensitive part of the entire architecture. LLM output cannot be directly used for signing — it must go through multiple security checks:

```typescript
// Secure signing pipeline
class SecureSigningPipeline {
  private whitelist: ContractWhitelist
  private limits: TransactionLimits
  private approver: HumanApprover | null // Optional human approval

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
    // 1. Contract whitelist check
    const targetContract = this.resolveTargetContract(intent)
    if (!this.whitelist.isAllowed(targetContract, intent.action)) {
      throw new SecurityError(
        `Contract ${targetContract} is not in whitelist for action ${intent.action}`
      )
    }

    // 2. Amount limit check
    const txAmount = this.extractAmount(intent)
    if (txAmount > this.limits.maxAmount) {
      throw new SecurityError(
        `Amount ${txAmount} exceeds limit ${this.limits.maxAmount}`
      )
    }

    // 3. Condition checks (gas price, price triggers, etc.)
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

    // 4. Construct transaction data
    const txData = await this.buildTransactionData(intent)

    // 5. Simulate execution
    const simulation = await publicClient.simulateContract({
      address: targetContract,
      abi: await this.getContractAbi(targetContract),
      functionName: txData.functionName,
      args: txData.args,
      account: walletClient.account!,
      value: txData.value,
    })

    // 6. Optional: human approval
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

    // 7. Sign and send
    return walletClient.writeContract(simulation.request)
  }

  private requiresApproval(intent: TransactionIntent, amount: bigint): boolean {
    // Large transactions require human approval
    return amount > this.limits.autoApproveThreshold
  }
}
```

## Automated Transaction Pipeline: Monitor -> Decide -> Execute

A complete automated pipeline requires continuous monitoring of on-chain state and automatically triggering transactions when conditions are met:

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

  // Register condition trigger
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
      // No conditions, execute immediately
      await this.executeIntent(intent)
    }
  }

  // Execute intent
  private async executeIntent(intent: TransactionIntent) {
    try {
      const hash = await this.signer.sign(
        intent,
        this.walletClient,
        this.publicClient,
      )

      // Track transaction status
      const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        console.log(`Intent executed: ${intent.action}, tx: ${hash}`)
        // Optional: notify user via notification system
      } else {
        console.error(`Intent failed: ${hash}`)
        // Retry or notify user
      }
    } catch (error) {
      console.error(`Intent execution error: ${error}`)
    }
  }

  // Stop all monitors
  stopAll() {
    for (const monitor of this.monitors.values()) {
      monitor.stop()
    }
    this.monitors.clear()
  }
}

// Price monitor
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
        this.stop() // Stop after triggering once
      }
    }, 10000) // Check every 10 seconds
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private async fetchPrice(token: string): Promise<number> {
    // Get price from Chainlink or DEX
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

## Agent and Wallet Interaction Patterns

There are two modes of interaction between Agents and wallets:

**Mode 1: Agent Holds the Signing Key (Fully Automatic)**

The Agent holds a restricted Session Key and can autonomously sign transactions. Security relies on the Session Key's permission controls — limiting callable contracts, amount caps, and validity periods.

**Mode 2: Agent Constructs Transactions, User Approves Signing (Semi-Automatic)**

The Agent is responsible for constructing transaction data and simulating execution, but the final signature is completed by the user. Suitable for high-value transactions or sensitive operations.

```typescript
// Mode 2: Semi-automatic mode
async function semiAutoExecute(
  intent: TransactionIntent,
  agent: AIAgent,
  userWallet: WalletClient,
  publicClient: PublicClient,
) {
  // Agent constructs transaction
  const txPlan = await agent.planTransaction(intent, publicClient)

  // Present transaction plan to user
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

  // User signs
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

## Multi-Step Transaction Agent Orchestration

Complex operations require multiple transactions. The Agent is responsible for orchestrating the execution sequence, handling intermediate states and error recovery:

```typescript
// Multi-step transaction orchestrator
class TransactionOrchestrator {
  private agent: AIAgent
  private signer: SecureSigningPipeline
  private walletClient: WalletClient
  private publicClient: PublicClient

  // Execute multi-step transaction plan
  async executePlan(steps: TransactionStep[]): Promise<ExecutionResult> {
    const results: StepResult[] = []

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]

      try {
        // Check preconditions
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

        // Execute current step
        const hash = await this.signer.sign(
          step.intent,
          this.walletClient,
          this.publicClient,
        )

        const receipt = await this.publicClient.waitForTransactionReceipt({ hash })

        if (receipt.status === 'reverted') {
          // Attempt rollback
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

        // Check postconditions
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

  // Roll back executed steps
  private async executeRollback(
    rollbackSteps: RollbackStep[],
    completedResults: StepResult[],
  ) {
    // Execute rollback in reverse order
    for (let i = rollbackSteps.length - 1; i >= 0; i--) {
      try {
        await this.signer.sign(
          rollbackSteps[i].intent,
          this.walletClient,
          this.publicClient,
        )
      } catch {
        // Rollback failure also needs to be recorded
        console.error('Rollback failed')
      }
    }
  }
}

// Example: Agent orchestrates a complex DeFi operation
async function orchestrateDefiStrategy(
  orchestrator: TransactionOrchestrator,
  agent: AIAgent,
) {
  // User says: "Deposit my ETH to Lido, then use stETH to borrow USDC on Aave"
  const plan = await agent.planMultiStep({
    instruction: 'Deposit ETH to Lido, then use stETH as collateral to borrow USDC on Aave',
  })

  // plan contains:
  // Step 1: approve Lido stETH
  // Step 2: stake ETH to Lido
  // Step 3: approve Aave stETH
  // Step 4: supply stETH to Aave
  // Step 5: borrow USDC from Aave

  const result = await orchestrator.executePlan(plan)
  return result
}
```

## Error Handling: Fallback When Agent Decisions Fail

The Agent may make wrong decisions — perhaps LLM hallucinations cause calls to non-existent contracts, or misjudgments of market conditions. Robust error handling is essential:

```typescript
class AgentErrorHandler {
  // Error classification
  classifyError(error: unknown): ErrorType {
    if (error instanceof SecurityError) return 'security'
    if (error instanceof ConditionError) return 'condition'
    if (error instanceof ContractError) return 'contract'
    if (error instanceof NetworkError) return 'network'
    return 'unknown'
  }

  // Determine fallback strategy based on error type
  getFallbackStrategy(errorType: ErrorType): FallbackStrategy {
    switch (errorType) {
      case 'security':
        // Security error: stop immediately, notify user
        return { action: 'stop', notify: true, autoRetry: false }

      case 'condition':
        // Condition not met: wait and retry
        return { action: 'wait', waitTime: 60000, maxRetries: 3, autoRetry: true }

      case 'contract':
        // Contract error: check if it's an ABI mismatch, attempt to fix
        return { action: 'replan', maxReplans: 2 }

      case 'network':
        // Network error: switch RPC endpoint and retry
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
        // Let the Agent re-plan
        break

      case 'stop':
        // Stop pipeline and notify
        pipeline.stopAll()
        break
    }
  }
}
```

## Security Design: Contract Whitelists, Amount Limits, Approval Processes

Security is the lifeline of AI + Web3. Below is the recommended security architecture:

```typescript
// Contract whitelist
class ContractWhitelist {
  private whitelist: Map<string, Set<string>> = new Map()

  // Format: contractAddress -> Set<allowedActions>
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

// Transaction limits
interface TransactionLimits {
  maxAmount: bigint           // Maximum amount per transaction
  maxDailyVolume: bigint      // Maximum daily transaction volume
  autoApproveThreshold: bigint // Auto-approval threshold
  cooldownPeriod: number       // Cooldown period (milliseconds)
}

// Rate limiter
class RateLimiter {
  private lastTransaction: Map<string, number> = new Map()
  private dailyVolume: bigint = 0n
  private dailyResetTime: number = Date.now()

  constructor(private limits: TransactionLimits) {}

  async check(intent: TransactionIntent): Promise<void> {
    // Check cooldown period
    const key = `${intent.action}-${intent.protocol}`
    const lastTime = this.lastTransaction.get(key) || 0
    if (Date.now() - lastTime < this.limits.cooldownPeriod) {
      throw new SecurityError('Cooldown period not elapsed')
    }

    // Check daily transaction volume
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

## Summary

The convergence of AI Agents and Web3 is creating an entirely new interaction paradigm. Users no longer need to understand concepts like ABI, Gas, and Nonce — they simply describe their intent in natural language, and the Agent handles converting it into on-chain transactions. The price of this convenience is higher security risks. The unpredictability of LLMs means Agents may make wrong decisions, and the irreversibility of Web3 makes the consequences of errors permanent. Security boundary design is the core of the entire architecture — contract whitelists, amount limits, human approval, and rate control form multiple layers of defense. In the long run, the biggest opportunity for AI + Web3 is lowering the barrier to entry: enabling billions of users who don't understand gas and private keys to use on-chain services. But this vision depends on the security architecture being mature enough to keep Agent risks within a controllable range.
