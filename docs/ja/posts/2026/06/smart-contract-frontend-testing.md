---
title: "スマートコントラクトのフロントエンドテスト戦略：MockからForkまで"
date: 2026-06-15 20:15:10
tags:
  - Web3
  - 测试
  - Smart Contract
readingTime: 9
description: "Web3フロントエンドテストの階層化戦略を体系的に解説。コントラクトMock、メインネットFork、テストネット、イベントアサーション、CI統合をカバー"
wordCount: 1484
---

## Web3フロントエンドテストの特有な課題

Web3フロントエンドテストは従来のフロントエンドテストとは本質的に異なる。従来のフロントエンドはAPIリクエストをテスト境界とするが、Web3フロントエンドはブロックチェーンネットワーク、スマートコントラクト、ウォレットと相互作用する必要がある。これらの依存関係は制御不可能であり、不安定である。実際のRPCエンドポイントを直接呼び出すと、テストが遅くなり、再現性が失われる。

主な課題は以下の通りである：

- **オンチェーン状態への依存**：コントラクト状態は常に変化し、テストは固定状態に依存できない
- **トランザクション確認の遅延**：各トランザクションはブロック確認を待つ必要があり、テスト速度が極めて遅い
- **ガスコスト**：テストネットとメインネット上のトランザクションは実際のガスを消費する
- **ウォレット相互作用**：署名ポップアップは自動テストで処理できない
- **マルチチェーン環境**：異なるチェーン間の動作差異をカバーする必要がある

適切なテスト階層化戦略がこれらの課題を解決する鍵である。

## コントラクトMock：ユニットテストでのコントラクト呼び出しのシミュレーション

ユニットテストは完全に隔離され、外部ネットワークに依存すべきではない。コントラクト呼び出しをMock化することで、コンポーネントロジックを高速に検証できる：

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'viem/chains'
import { http } from 'viem'
import { TokenBalance } from './TokenBalance'

// wagmiのuseReadContractをMock化
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useReadContract: vi.fn(),
  }
})

// コントラクト読み取り結果のMock
function mockReadContract(result: unknown, loading = false) {
  const { useReadContract } = vi.mocked(await import('wagmi'))
  useReadContract.mockReturnValue({
    data: result,
    isLoading: loading,
    error: null,
    refetch: vi.fn(),
  })
}

describe('TokenBalanceコンポーネント', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('トークン残高を正しく表示すべきである', async () => {
    // 1.5 ETHを返すMock
    mockReadContract(1500000000000000000n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('1.5 ETH')).toBeInTheDocument()
  })

  it('ローディング状態を表示すべきである', () => {
    mockReadContract(undefined, true)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('ゼロ残高を処理すべきである', () => {
    mockReadContract(0n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('0 ETH')).toBeInTheDocument()
  })
})
```

より複雑なシナリオでは、viem PublicClient全体をMock化できる：

```typescript
import { createMockClient } from './test-utils'

describe('コントラクト相互作用モジュール', () => {
  let mockClient: MockPublicClient

  beforeEach(() => {
    mockClient = createMockClient({
      chain: mainnet,
      blockNumber: 19000000n,
      gasPrice: 20000000000n,
    })
  })

  it('マルチシグコントラクトのownersを正しく読み取るべきである', async () => {
    // Mock戻り値を設定
    mockClient.setContractReadResult(
      '0x1234...', // コントラクトアドレス
      'getOwners', // 関数名
      ['0xaaa...', '0xbbb...', '0xccc...'], // 戻り値
    )

    const owners = await getMultisigOwners(mockClient, '0x1234...')

    expect(owners).toHaveLength(3)
    expect(owners[0]).toBe('0xaaa...')
  })

  it('トランザクションのrevertをシミュレートすべきである', async () => {
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

## ローカルFork：Anvil/Hardhatでメインネットをフォーク

Mockはユニットテストに適しているが、実際のコントラクト動作を検証できない。メインネットForkは中間層である——メインネットの状態をローカルに複製し、実際のガスなしでリアルなコントラクトと相互作用できる：

```typescript
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { spawn } from 'child_process'
import { expect, beforeAll, afterAll, describe, it } from 'vitest'

// メインネットをフォークしてAnvilを起動
let anvilProcess: ChildProcess
let forkClient: PublicClient
let forkWallet: WalletClient

beforeAll(async () => {
  // Anvilを起動、ブロック19000000でメインネットをフォーク
  anvilProcess = spawn('anvil', [
    '--fork-url', process.env.MAINNET_RPC_URL!,
    '--fork-block-number', '19000000',
    '--port', '8545',
    '--block-time', '1', // 1秒ブロックタイム
  ])

  // Anvilの起動を待機
  await waitForAnvilReady('http://localhost:8545')

  forkClient = createPublicClient({
    chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
    transport: http('http://localhost:8545'),
  })

  // Anvilのテストアカウントを使用
  const testAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvilデフォルトアカウント0
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

describe('USDC転送（メインネットFork）', () => {
  it('USDCの転送に成功すべきである', async () => {
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    // AnvilのimpersonateAccount機能で実際の保有者を操作
    await forkClient.request({
      method: 'anvil_impersonateAccount',
      params: ['0xF977814e90dA44bFA03b6295A0616a897441aceC'], // Binanceホットウォレット、大量のUSDCを保有
    })

    const whaleWallet = createWalletClient({
      chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
      transport: http('http://localhost:8545'),
      account: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    })

    // USDC転送を実行
    const hash = await whaleWallet.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [forkWallet.account.address, 1000000n], // 1 USDC
    })

    const receipt = await forkClient.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')

    // 残高を検証
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

## テストネット戦略：Sepolia、Polygon Amoy

テストネットは統合テストと手動検証に使用される。テストネット選択時の考慮事項：

| テストネット | 対応メインネット | Faucet | ブロックタイム | 推奨用途 |
|-------------|----------------|--------|-------------|---------|
| Sepolia | Ethereum | 充足 | ~12s | Ethereum L1テスト |
| Polygon Amoy | Polygon | 充足 | ~2s | Polygonテスト |
| Base Sepolia | Base | 充足 | ~2s | Base L2テスト |

```typescript
// テストネット設定
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

// テストネット統合テスト
describe('テストネット統合テスト', () => {
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

  it('Sepolia上でコントラクトをデプロイすべきである', async () => {
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

## イベントアサーション：コントラクトイベントの検証

イベントはコントラクトがフロントエンドと通信する主要な手段である。テストではイベントが正しく発火され、解析されることを検証する必要がある：

```typescript
import { parseEventLogs, decodeEventLog, type Abi } from 'viem'

// イベントアサーションユーティリティ
class EventAssertions {
  constructor(private abi: Abi) {}

  // トランザクションレシートからイベントを抽出
  extractEvents(receipt: TransactionReceipt, eventName: string) {
    const parsed = parseEventLogs({ logs: receipt.logs, abi: this.abi })
    return parsed.filter((log) => log.eventName === eventName)
  }

  // イベントが発火されたことをアサート
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

  // イベントが発火されていないことをアサート
  expectNoEvent(receipt: TransactionReceipt, eventName: string) {
    const events = this.extractEvents(receipt, eventName)
    expect(events.length).toBe(0)
  }

  // イベントの順序をアサート
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

// 使用例
describe('イベントアサーション', () => {
  const assertions = new EventAssertions(routerAbi)

  it('Swapイベントを発火すべきである', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEvent(receipt, 'Swap', {
      sender: forkWallet.account.address,
      amountIn: parseEther('1'),
      amountOut: expect.any(BigInt),
    })
  })

  it('正しい順序でイベントを発火すべきである', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEventOrder(receipt, ['Approval', 'Transfer', 'Swap'])
  })
})
```

## フロントエンド統合テスト：コンポーネント + コントラクト相互作用

統合テストはフロントエンドコンポーネントとコントラクト相互作用の正確性を検証する。Anvil Forkをバックエンドとして使用し、wagmiのテスト設定と組み合わせる：

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
    // テストアカウントを使用
    accounts: {
      [mainnet.id]: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
  })
}

describe('SwapComponent統合テスト', () => {
  beforeAll(async () => {
    await waitForAnvilReady(FORK_URL)
  })

  it('正しいトークン残高を表示しswapを完了すべきである', async () => {
    const config = createTestConfig()

    render(
      <WagmiProvider config={config}>
        <SwapComponent />
      </WagmiProvider>,
    )

    // 残高の読み込みを待機
    await waitFor(() => {
      expect(screen.getByText(/ETH Balance:/)).toBeInTheDocument()
    })

    // スワップ数量を入力
    const input = screen.getByLabelText('Swap Amount')
    fireEvent.change(input, { target: { value: '0.1' } })

    // Swapボタンをクリック
    const swapButton = screen.getByText('Swap')
    fireEvent.click(swapButton)

    // トランザクション確認を待機
    await waitFor(() => {
      expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument()
    }, { timeout: 15000 })
  })
})
```

## E2Eテスト：Playwright + ローカルチェーン

エンドツーエンドテストはウォレット相互作用を含む実際のユーザー操作をシミュレートする。PlaywrightがAnvilを制御し、Mockウォレットを注入する：

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

test('完全なswapフロー', async ({ page }) => {
  // Mock providerを注入
  await page.addInitScript(() => {
    window.ethereum = {
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
          case 'eth_chainId':
            return '0x1'
          case 'eth_sendTransaction':
            // ローカルAnvilに転送
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

  // ウォレット接続
  await page.click('text=Connect Wallet')
  await expect(page.locator('text=0xf39F...2266')).toBeVisible()

  // swapを実行
  await page.fill('input[placeholder="Amount"]', '0.1')
  await page.click('text=Swap')
  await page.click('text=Confirm')

  // 確認を待機
  await expect(page.locator('text=Transaction confirmed')).toBeVisible({
    timeout: 30000,
  })
})
```

## CI統合：GitHub ActionsでWeb3テストを実行

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

## テストカバレッジと品質指標

Web3フロントエンドのテストカバレッジは行カバレッジのみを見るべきではない。以下の次元にも注目すべきである：

```typescript
// vitest.config.tsのカバレッジ設定
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

// Web3固有のカバレッジ指標
interface Web3CoverageMetrics {
  contractReadCoverage: number    // readContract呼び出しのカバレッジ
  contractWriteCoverage: number   // writeContract呼び出しのカバレッジ
  eventHandlingCoverage: number   // イベントハンドラ関数のカバレッジ
  errorPathCoverage: number       // エラーパスのカバレッジ
  multiChainCoverage: number      // マルチチェーンシナリオのカバレッジ
}
```

## まとめ

Web3フロントエンドテストには階層化戦略が必要である。Mockで高速なユニットテストを、Anvil Forkで実際のコントラクト相互作用検証を、テストネットでエンドツーエンド検証を行う。各層は異なる問題を解決し、組み合わせることで包括的なカバレッジを実現する。イベントアサーションユーティリティはコントラクトイベントが正しく処理されることを保証する。Playwright E2EテストはMock providerを注入することでウォレットポップアップをバイパスし、自動化されたエンドツーエンド検証を可能にする。CI統合はテスト層ごとにグループ化して実行すべきである——高速なMockテストを最初に、次にForkテスト、最後にE2Eテストを実行する。カバレッジ指標は行カバレッジを超えて、コントラクト相互作用とエラーパスのカバレッジを含むべきである。テストインフラへの投資はWeb3プロジェクトにとって必要な支出である——スマートコントラクトの不可逆性により、フロントエンドの正確性検証は従来のWebアプリケーションよりも重要になる。
