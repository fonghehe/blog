---
title: "智能合约前端测试策略：从 Mock 到 Fork"
date: 2026-06-15 20:15:10
tags:
  - Web3
  - 测试
  - Smart Contract
readingTime: 7
description: "系统性讲解 Web3 前端测试的分层策略，涵盖合约 Mock、主网 Fork、测试网、事件断言及 CI 集成"
wordCount: 3200
---

## Web3 前端测试的独特挑战

Web3 前端测试与传统前端测试有本质区别。传统前端的测试边界是 API 请求，而 Web3 前端需要与区块链网络、智能合约、钱包交互。这些依赖既不可控也不稳定，直接调用真实 RPC 会导致测试缓慢且不可重复。

核心挑战包括：

- **链上状态依赖**：合约状态随时变化，测试无法依赖固定状态
- **交易确认延迟**：每笔交易需要等待区块确认，测试速度极慢
- **Gas 费用**：测试网和主网上的交易消耗真实 Gas
- **钱包交互**：签名弹窗无法在自动化测试中处理
- **多链环境**：不同链的行为差异需要覆盖

合理的测试分层策略是解决这些挑战的关键。

## 合约 Mock：在单元测试中模拟合约调用

单元测试应该完全隔离，不依赖任何外部网络。通过 Mock 合约调用，可以快速验证组件逻辑：

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'viem/chains'
import { http } from 'viem'
import { TokenBalance } from './TokenBalance'

// Mock wagmi 的 useReadContract
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useReadContract: vi.fn(),
  }
})

// Mock 合约读取结果
function mockReadContract(result: unknown, loading = false) {
  const { useReadContract } = vi.mocked(await import('wagmi'))
  useReadContract.mockReturnValue({
    data: result,
    isLoading: loading,
    error: null,
    refetch: vi.fn(),
  })
}

describe('TokenBalance 组件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应正确显示代币余额', async () => {
    // 模拟返回 1.5 ETH
    mockReadContract(1500000000000000000n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('1.5 ETH')).toBeInTheDocument()
  })

  it('应显示加载状态', () => {
    mockReadContract(undefined, true)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('应处理零余额', () => {
    mockReadContract(0n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('0 ETH')).toBeInTheDocument()
  })
})
```

对于更复杂的场景，可以 Mock 整个 viem PublicClient：

```typescript
import { createMockClient } from './test-utils'

describe('合约交互模块', () => {
  let mockClient: MockPublicClient

  beforeEach(() => {
    mockClient = createMockClient({
      chain: mainnet,
      blockNumber: 19000000n,
      gasPrice: 20000000000n,
    })
  })

  it('应正确读取多签合约的 owners', async () => {
    // 设置 Mock 返回值
    mockClient.setContractReadResult(
      '0x1234...', // 合约地址
      'getOwners', // 函数名
      ['0xaaa...', '0xbbb...', '0xccc...'], // 返回值
    )

    const owners = await getMultisigOwners(mockClient, '0x1234...')

    expect(owners).toHaveLength(3)
    expect(owners[0]).toBe('0xaaa...')
  })

  it('应模拟交易回滚', async () => {
    mockClient.setContractSimulationError(
      '0x1234...',
      'transfer',
      new Error('Insufficient balance'),
    )

    await expect(
      transferTokens(mockClient, '0x1234...', recipient, amount),
    ).rejects.toThrow('Insufficient balance')
  })
})
```

## 本地 Fork：用 Anvil/Hardhat 分叉主网

Mock 适合单元测试，但无法验证真实的合约行为。主网 Fork 是中间层——它复制主网状态到本地，允许与真实合约交互但不需要真实 Gas：

```typescript
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { spawn } from 'child_process'
import { expect, beforeAll, afterAll, describe, it } from 'vitest'

// 启动 Anvil 分叉主网
let anvilProcess: ChildProcess
let forkClient: PublicClient
let forkWallet: WalletClient

beforeAll(async () => {
  // 启动 Anvil，分叉主网区块 19000000
  anvilProcess = spawn('anvil', [
    '--fork-url', process.env.MAINNET_RPC_URL!,
    '--fork-block-number', '19000000',
    '--port', '8545',
    '--block-time', '1', // 1 秒出块
  ])

  // 等待 Anvil 启动
  await waitForAnvilReady('http://localhost:8545')

  forkClient = createPublicClient({
    chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
    transport: http('http://localhost:8545'),
  })

  // 使用 Anvil 提供的测试账户
  const testAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil 默认账户 0
  )

  forkWallet = createWalletClient({
    chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
    transport: http('http://localhost:8545'),
    account: testAccount,
  })
})

afterAll(() => {
  anvilProcess?.kill()
})

describe('USDC 转账（主网 Fork）', () => {
  it('应成功转移 USDC', async () => {
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    // 使用 Anvil 的 impersonateAccount 功能操作真实持有者
    await forkClient.request({
      method: 'anvil_impersonateAccount',
      params: ['0xF977814e90dA44bFA03b6295A0616a897441aceC'], // Binance 热钱包，持有大量 USDC
    })

    const whaleWallet = createWalletClient({
      chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
      transport: http('http://localhost:8545'),
      account: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    })

    // 执行 USDC 转账
    const hash = await whaleWallet.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [forkWallet.account.address, 1000000n], // 1 USDC
    })

    const receipt = await forkClient.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')

    // 验证余额
    const balance = await forkClient.readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [forkWallet.account.address],
    })
    expect(balance).toBe(1000000n)
  })
})
```

## 测试网策略：Sepolia, Polygon Amoy

测试网用于集成测试和手动验证。选择测试网时需考虑：

| 测试网 | 对应主网 | Faucet | 出块时间 | 推荐用途 |
|--------|---------|--------|---------|---------|
| Sepolia | Ethereum | 充足 | ~12s | 以太坊 L1 测试 |
| Polygon Amoy | Polygon | 充足 | ~2s | Polygon 测试 |
| Base Sepolia | Base | 充足 | ~2s | Base L2 测试 |

```typescript
// 测试网配置
const TESTNET_CONFIGS = {
  sepolia: {
    chainId: 11155111,
    rpcUrl: 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    faucets: ['https://sepoliafaucet.com'],
    deployedContracts: {
      testToken: '0x...',
      testRouter: '0x...',
    },
  },
  'polygon-amoy': {
    chainId: 80002,
    rpcUrl: 'https://rpc-amoy.polygon.technology',
    explorerUrl: 'https://amoy.polygonscan.com',
    faucets: ['https://faucet.polygon.technology'],
    deployedContracts: {
      testToken: '0x...',
      testRouter: '0x...',
    },
  },
}

// 测试网集成测试
describe('测试网集成测试', () => {
  const config = TESTNET_CONFIGS.sepolia
  let testClient: WalletClient

  beforeAll(() => {
    const account = privateKeyToAccount(process.env.TEST_PRIVATE_KEY!)
    testClient = createWalletClient({
      chain: sepolia,
      transport: http(config.rpcUrl),
      account,
    })
  })

  it('应在 Sepolia 上成功部署合约', async () => {
    const hash = await testClient.deployContract({
      abi: testTokenAbi,
      bytecode: testTokenBytecode,
      args: ['Test Token', 'TST', 18],
    })

    const receipt = await waitForReceipt(testClient, hash)
    expect(receipt.status).toBe('success')
    expect(receipt.contractAddress).toBeTruthy()
  })
})
```

## 事件断言：验证合约事件是否正确触发

事件是合约与前端通信的主要方式。测试中需要验证事件是否被正确触发和解析：

```typescript
import { parseEventLogs, decodeEventLog, type Abi } from 'viem'

// 事件断言工具
class EventAssertions {
  constructor(private abi: Abi) {}

  // 从交易回执中提取事件
  extractEvents(receipt: TransactionReceipt, eventName: string) {
    const parsed = parseEventLogs({ logs: receipt.logs, abi: this.abi })
    return parsed.filter((log) => log.eventName === eventName)
  }

  // 断言事件被触发
  expectEvent(receipt: TransactionReceipt, eventName: string, expectedArgs?: Record<string, any>) {
    const events = this.extractEvents(receipt, eventName)
    expect(events.length).toBeGreaterThan(0)

    if (expectedArgs) {
      const lastEvent = events[events.length - 1]
      for (const [key, value] of Object.entries(expectedArgs)) {
        expect(lastEvent.args[key]).toEqual(value)
      }
    }
  }

  // 断言事件未被触发
  expectNoEvent(receipt: TransactionReceipt, eventName: string) {
    const events = this.extractEvents(receipt, eventName)
    expect(events.length).toBe(0)
  }

  // 断言事件顺序
  expectEventOrder(receipt: TransactionReceipt, eventNames: string[]) {
    const parsed = parseEventLogs({ logs: receipt.logs, abi: this.abi })
    const actualOrder = parsed.map((log) => log.eventName)

    let lastIndex = -1
    for (const name of eventNames) {
      const index = actualOrder.indexOf(name, lastIndex + 1)
      expect(index).toBeGreaterThan(lastIndex)
      lastIndex = index
    }
  }
}

// 使用示例
describe('事件断言', () => {
  const assertions = new EventAssertions(routerAbi)

  it('应触发 Swap 事件', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEvent(receipt, 'Swap', {
      sender: forkWallet.account.address,
      amountIn: parseEther('1'),
      amountOut: expect.any(BigInt),
    })
  })

  it('应按正确顺序触发事件', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEventOrder(receipt, ['Approval', 'Transfer', 'Swap'])
  })
})
```

## 前端集成测试：组件 + 合约交互

集成测试验证前端组件与合约交互的正确性。使用 Anvil Fork 作为后端，配合 wagmi 的测试配置：

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'viem/chains'
import { http } from 'viem'
import { describe, it, expect, beforeAll } from 'vitest'
import { SwapComponent } from './SwapComponent'

const FORK_URL = 'http://localhost:8545'

function createTestConfig() {
  return createConfig({
    chains: [mainnet],
    transports: {
      [mainnet.id]: http(FORK_URL),
    },
    // 使用测试账户
    accounts: {
      [mainnet.id]: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
  })
}

describe('SwapComponent 集成测试', () => {
  beforeAll(async () => {
    await waitForAnvilReady(FORK_URL)
  })

  it('应显示正确的代币余额并完成 swap', async () => {
    const config = createTestConfig()

    render(
      <WagmiProvider config={config}>
        <SwapComponent />
      </WagmiProvider>,
    )

    // 等待余额加载
    await waitFor(() => {
      expect(screen.getByText(/ETH Balance:/)).toBeInTheDocument()
    })

    // 输入交换数量
    const input = screen.getByLabelText('Swap Amount')
    fireEvent.change(input, { target: { value: '0.1' } })

    // 点击 Swap 按钮
    const swapButton = screen.getByText('Swap')
    fireEvent.click(swapButton)

    // 等待交易确认
    await waitFor(() => {
      expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument()
    }, { timeout: 15000 })
  })
})
```

## E2E 测试：Playwright + 本地链

端到端测试模拟真实用户操作，包括钱包交互。通过 Playwright 控制 Anvil 和注入 Mock 钱包：

```typescript
import { test, expect, chromium } from '@playwright/test'
import { spawn } from 'child_process'

let anvil: ChildProcess

test.beforeAll(async () => {
  anvil = spawn('anvil', [
    '--fork-url', process.env.MAINNET_RPC_URL!,
    '--port', '8545',
    '--block-time', '1',
  ])
  await waitForAnvilReady('http://localhost:8545')
})

test.afterAll(() => {
  anvil?.kill()
})

test('完整的 swap 流程', async ({ page }) => {
  // 注入 Mock provider
  await page.addInitScript(() => {
    window.ethereum = {
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
          case 'eth_chainId':
            return '0x1'
          case 'eth_sendTransaction':
            // 转发到本地 Anvil
            const response = await fetch('http://localhost:8545', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            })
            const result = await response.json()
            return result.result
          default:
            const response = await fetch('http://localhost:8545', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
            })
            const result = await response.json()
            return result.result
        }
      },
      on: () => {},
      removeListener: () => {},
    }
  })

  await page.goto('http://localhost:3000')

  // 连接钱包
  await page.click('text=Connect Wallet')
  await expect(page.locator('text=0xf39F...2266')).toBeVisible()

  // 执行 swap
  await page.fill('input[placeholder="Amount"]', '0.1')
  await page.click('text=Swap')
  await page.click('text=Confirm')

  // 等待确认
  await expect(page.locator('text=Transaction confirmed')).toBeVisible({
    timeout: 30000,
  })
})
```

## CI 集成：GitHub Actions 中运行 Web3 测试

```yaml
# .github/workflows/web3-test.yml
name: Web3 Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: foundry-toolchain/foundry-toolchain@v2
        with:
          version: nightly

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests (with mocks)
        run: npx vitest run --coverage

      - name: Run fork tests
        env:
          MAINNET_RPC_URL: ${{ secrets.MAINNET_RPC_URL }}
        run: npx vitest run --testNamePattern="Fork"

      - name: Run integration tests
        env:
          TEST_PRIVATE_KEY: ${{ secrets.TEST_PRIVATE_KEY }}
        run: npx vitest run --testNamePattern="Integration"

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/lcov.info
```

## 测试覆盖率与质量度量

Web3 前端的测试覆盖率不应只看行覆盖率，更应关注以下维度：

```typescript
// vitest.config.ts 中的覆盖率配置
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
})

// Web3 特有的覆盖率指标
interface Web3CoverageMetrics {
  contractReadCoverage: number    // readContract 调用的覆盖率
  contractWriteCoverage: number   // writeContract 调用的覆盖率
  eventHandlingCoverage: number   // 事件处理函数的覆盖率
  errorPathCoverage: number       // 错误路径的覆盖率
  multiChainCoverage: number      // 多链场景的覆盖
}
```

## 小结

Web3 前端测试需要分层策略：Mock 用于快速单元测试，Anvil Fork 用于真实的合约交互验证，测试网用于端到端验证。每层解决不同的问题，组合使用才能达到全面覆盖。事件断言工具确保合约事件被正确处理。Playwright E2E 测试通过注入 Mock provider 绕过钱包弹窗，实现自动化端到端验证。CI 集成应按测试层分组执行——先运行快速的 Mock 测试，再运行 Fork 测试，最后运行 E2E。覆盖率度量除了行覆盖，还应关注合约交互和错误路径的覆盖。投资测试基础设施是 Web3 项目的必要支出——合约的不可逆性使得前端的正确性验证比传统 Web 应用更加重要。
