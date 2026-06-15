---
title: "智能合約前端測試策略：從 Mock 到 Fork"
date: 2026-06-15 20:15:10
tags:
  - Web3
  - 测试
  - Smart Contract
readingTime: 7
description: "系統性講解 Web3 前端測試的分層策略，涵蓋合約 Mock、主網 Fork、測試網、事件斷言及 CI 整合"
wordCount: 3200
---

## Web3 前端測試的獨特挑戰

Web3 前端測試與傳統前端測試有本質區別。傳統前端的測試邊界是 API 請求，而 Web3 前端需要與區塊鏈網絡、智能合約、錢包交互。這些依賴既不可控也不穩定，直接調用真實 RPC 會導致測試緩慢且不可重複。

核心挑戰包括：

- **鏈上狀態依賴**：合約狀態隨時變化，測試無法依賴固定狀態
- **交易確認延遲**：每筆交易需要等待區塊確認，測試速度極慢
- **Gas 費用**：測試網和主網上的交易消耗真實 Gas
- **錢包交互**：簽名彈窗無法在自動化測試中處理
- **多鏈環境**：不同鏈的行為差異需要覆蓋

合理的測試分層策略是解決這些挑戰的關鍵。

## 合約 Mock：在單元測試中模擬合約調用

單元測試應該完全隔離，不依賴任何外部網絡。通過 Mock 合約調用，可以快速驗證組件邏輯：

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

// Mock 合約讀取結果
function mockReadContract(result: unknown, loading = false) {
  const { useReadContract } = vi.mocked(await import('wagmi'))
  useReadContract.mockReturnValue({
    data: result,
    isLoading: loading,
    error: null,
    refetch: vi.fn(),
  })
}

describe('TokenBalance 組件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('應正確顯示代幣餘額', async () => {
    // 模擬返回 1.5 ETH
    mockReadContract(1500000000000000000n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('1.5 ETH')).toBeInTheDocument()
  })

  it('應顯示加載狀態', () => {
    mockReadContract(undefined, true)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('應處理零餘額', () => {
    mockReadContract(0n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('0 ETH')).toBeInTheDocument()
  })
})
```

對於更複雜的場景，可以 Mock 整個 viem PublicClient：

```typescript
import { createMockClient } from './test-utils'

describe('合約交互模塊', () => {
  let mockClient: MockPublicClient

  beforeEach(() => {
    mockClient = createMockClient({
      chain: mainnet,
      blockNumber: 19000000n,
      gasPrice: 20000000000n,
    })
  })

  it('應正確讀取多簽合約的 owners', async () => {
    // 設置 Mock 返回值
    mockClient.setContractReadResult(
      '0x1234...', // 合約地址
      'getOwners', // 函數名稱
      ['0xaaa...', '0xbbb...', '0xccc...'], // 返回值
    )

    const owners = await getMultisigOwners(mockClient, '0x1234...')

    expect(owners).toHaveLength(3)
    expect(owners[0]).toBe('0xaaa...')
  })

  it('應模擬交易回滾', async () => {
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

## 本地 Fork：用 Anvil/Hardhat 分叉主網

Mock 適合單元測試，但無法驗證真實的合約行為。主網 Fork 是中間層——它複製主網狀態到本地，允許與真實合約交互但不需要真實 Gas：

```typescript
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { spawn } from 'child_process'
import { expect, beforeAll, afterAll, describe, it } from 'vitest'

// 啟動 Anvil 分叉主網
let anvilProcess: ChildProcess
let forkClient: PublicClient
let forkWallet: WalletClient

beforeAll(async () => {
  // 啟動 Anvil，分叉主網區塊 19000000
  anvilProcess = spawn('anvil', [
    '--fork-url', process.env.MAINNET_RPC_URL!,
    '--fork-block-number', '19000000',
    '--port', '8545',
    '--block-time', '1', // 1 秒出塊
  ])

  // 等待 Anvil 啟動
  await waitForAnvilReady('http://localhost:8545')

  forkClient = createPublicClient({
    chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
    transport: http('http://localhost:8545'),
  })

  // 使用 Anvil 提供的測試賬戶
  const testAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil 默認賬戶 0
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

describe('USDC 轉賬（主網 Fork）', () => {
  it('應成功轉移 USDC', async () => {
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    // 使用 Anvil 的 impersonateAccount 功能操作真實持有者
    await forkClient.request({
      method: 'anvil_impersonateAccount',
      params: ['0xF977814e90dA44bFA03b6295A0616a897441aceC'], // Binance 熱錢包，持有大量 USDC
    })

    const whaleWallet = createWalletClient({
      chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
      transport: http('http://localhost:8545'),
      account: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    })

    // 執行 USDC 轉賬
    const hash = await whaleWallet.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [forkWallet.account.address, 1000000n], // 1 USDC
    })

    const receipt = await forkClient.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')

    // 驗證餘額
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

## 測試網策略：Sepolia, Polygon Amoy

測試網用於集成測試和手動驗證。選擇測試網時需考慮：

| 測試網 | 對應主網 | Faucet | 出塊時間 | 推薦用途 |
|--------|---------|--------|---------|---------|
| Sepolia | Ethereum | 充足 | ~12s | 以太坊 L1 測試 |
| Polygon Amoy | Polygon | 充足 | ~2s | Polygon 測試 |
| Base Sepolia | Base | 充足 | ~2s | Base L2 測試 |

```typescript
// 測試網配置
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

// 測試網集成測試
describe('測試網集成測試', () => {
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

  it('應在 Sepolia 上成功部署合約', async () => {
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

## 事件斷言：驗證合約事件是否正確觸發

事件是合約與前端通信的主要方式。測試中需要驗證事件是否被正確觸發和解析：

```typescript
import { parseEventLogs, decodeEventLog, type Abi } from 'viem'

// 事件斷言工具
class EventAssertions {
  constructor(private abi: Abi) {}

  // 從交易回執中提取事件
  extractEvents(receipt: TransactionReceipt, eventName: string) {
    const parsed = parseEventLogs({ logs: receipt.logs, abi: this.abi })
    return parsed.filter((log) => log.eventName === eventName)
  }

  // 斷言事件被觸發
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

  // 斷言事件未被觸發
  expectNoEvent(receipt: TransactionReceipt, eventName: string) {
    const events = this.extractEvents(receipt, eventName)
    expect(events.length).toBe(0)
  }

  // 斷言事件順序
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
describe('事件斷言', () => {
  const assertions = new EventAssertions(routerAbi)

  it('應觸發 Swap 事件', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEvent(receipt, 'Swap', {
      sender: forkWallet.account.address,
      amountIn: parseEther('1'),
      amountOut: expect.any(BigInt),
    })
  })

  it('應按正確順序觸發事件', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEventOrder(receipt, ['Approval', 'Transfer', 'Swap'])
  })
})
```

## 前端集成測試：組件 + 合約交互

集成測試驗證前端組件與合約交互的正確性。使用 Anvil Fork 作為後端，配合 wagmi 的測試配置：

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
    // 使用測試賬戶
    accounts: {
      [mainnet.id]: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
  })
}

describe('SwapComponent 集成測試', () => {
  beforeAll(async () => {
    await waitForAnvilReady(FORK_URL)
  })

  it('應顯示正確的代幣餘額並完成 swap', async () => {
    const config = createTestConfig()

    render(
      <WagmiProvider config={config}>
        <SwapComponent />
      </WagmiProvider>,
    )

    // 等待餘額加載
    await waitFor(() => {
      expect(screen.getByText(/ETH Balance:/)).toBeInTheDocument()
    })

    // 輸入交換數量
    const input = screen.getByLabelText('Swap Amount')
    fireEvent.change(input, { target: { value: '0.1' } })

    // 點擊 Swap 按鈕
    const swapButton = screen.getByText('Swap')
    fireEvent.click(swapButton)

    // 等待交易確認
    await waitFor(() => {
      expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument()
    }, { timeout: 15000 })
  })
})
```

## E2E 測試：Playwright + 本地鏈

端到端測試模擬真實用戶操作，包括錢包交互。通過 Playwright 控制 Anvil 和注入 Mock 錢包：

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
            // 轉發到本地 Anvil
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

  // 連接錢包
  await page.click('text=Connect Wallet')
  await expect(page.locator('text=0xf39F...2266')).toBeVisible()

  // 執行 swap
  await page.fill('input[placeholder="Amount"]', '0.1')
  await page.click('text=Swap')
  await page.click('text=Confirm')

  // 等待確認
  await expect(page.locator('text=Transaction confirmed')).toBeVisible({
    timeout: 30000,
  })
})
```

## CI 整合：GitHub Actions 中運行 Web3 測試

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

## 測試覆蓋率與質量度量

Web3 前端的測試覆蓋率不應只看行覆蓋率，更應關注以下維度：

```typescript
// vitest.config.ts 中的覆蓋率配置
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

// Web3 特有的覆蓋率指標
interface Web3CoverageMetrics {
  contractReadCoverage: number    // readContract 調用的覆蓋率
  contractWriteCoverage: number   // writeContract 調用的覆蓋率
  eventHandlingCoverage: number   // 事件處理函數的覆蓋率
  errorPathCoverage: number       // 錯誤路徑的覆蓋率
  multiChainCoverage: number      // 多鏈場景的覆蓋
}
```

## 小結

Web3 前端測試需要分層策略：Mock 用於快速單元測試，Anvil Fork 用於真實的合約交互驗證，測試網用於端到端驗證。每層解決不同的問題，組合使用才能達到全面覆蓋。事件斷言工具確保合約事件被正確處理。Playwright E2E 測試通過注入 Mock provider 繞過錢包彈窗，實現自動化端到端驗證。CI 整合應按測試層分組執行——先運行快速的 Mock 測試，再運行 Fork 測試，最後運行 E2E 測試。覆蓋率度量除了行覆蓋，還應關注合約交互和錯誤路徑的覆蓋。投資測試基礎設施是 Web3 項目的必要支出——合約的不可逆性使得前端的正確性驗證比傳統 Web 應用更加重要。
