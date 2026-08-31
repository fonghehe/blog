---
title: "Smart Contract Frontend Testing Strategy: From Mock to Fork"
date: 2026-06-15 20:15:10
tags:
  - Web3
  - Testing
  - Smart Contract
readingTime: 7
description: "A systematic guide to Web3 frontend testing layers, covering contract mocking, mainnet forking, testnets, event assertions, and CI integration"
wordCount: 466
---

## Unique Challenges of Web3 Frontend Testing

Web3 frontend testing differs fundamentally from traditional frontend testing. Traditional frontends test against API boundaries, while Web3 frontends must interact with blockchain networks, smart contracts, and wallets. These dependencies are neither controllable nor stable—calling real RPC endpoints makes tests slow and non-deterministic.

Core challenges include:

- **On-chain state dependencies**: Contract states change constantly; tests cannot rely on fixed state
- **Transaction confirmation latency**: Each transaction waits for block confirmation, making tests extremely slow
- **Gas costs**: Transactions on testnets and mainnet consume real gas
- **Wallet interactions**: Signature popups cannot be handled in automated tests
- **Multi-chain environments**: Behavioral differences across chains need coverage

A well-structured testing layering strategy is key to solving these challenges.

## Contract Mocking: Simulating Contract Calls in Unit Tests

Unit tests should be fully isolated with no external network dependencies. By mocking contract calls, component logic can be verified quickly:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WagmiProvider, createConfig } from 'wagmi'
import { mainnet } from 'viem/chains'
import { http } from 'viem'
import { TokenBalance } from './TokenBalance'

// Mock wagmi's useReadContract
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useReadContract: vi.fn(),
  }
})

// Mock contract read results
function mockReadContract(result: unknown, loading = false) {
  const { useReadContract } = vi.mocked(await import('wagmi'))
  useReadContract.mockReturnValue({
    data: result,
    isLoading: loading,
    error: null,
    refetch: vi.fn(),
  })
}

describe('TokenBalance Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display token balance correctly', async () => {
    // Mock return value of 1.5 ETH
    mockReadContract(1500000000000000000n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('1.5 ETH')).toBeInTheDocument()
  })

  it('should display loading state', () => {
    mockReadContract(undefined, true)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should handle zero balance', () => {
    mockReadContract(0n)

    render(<TokenBalance address="0x..." tokenAddress="0x..." />)

    expect(screen.getByText('0 ETH')).toBeInTheDocument()
  })
})
```

For more complex scenarios, the entire viem PublicClient can be mocked:

```typescript
import { createMockClient } from './test-utils'

describe('Contract Interaction Module', () => {
  let mockClient: MockPublicClient

  beforeEach(() => {
    mockClient = createMockClient({
      chain: mainnet,
      blockNumber: 19000000n,
      gasPrice: 20000000000n,
    })
  })

  it('should read multisig contract owners correctly', async () => {
    // Set mock return value
    mockClient.setContractReadResult(
      '0x1234...', // contract address
      'getOwners', // function name
      ['0xaaa...', '0xbbb...', '0xccc...'], // return value
    )

    const owners = await getMultisigOwners(mockClient, '0x1234...')

    expect(owners).toHaveLength(3)
    expect(owners[0]).toBe('0xaaa...')
  })

  it('should simulate transaction revert', async () => {
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

## Local Fork: Using Anvil/Hardhat to Fork Mainnet

Mocking is suitable for unit tests but cannot verify real contract behavior. Mainnet forking is the middle layer—it replicates mainnet state locally, allowing interaction with real contracts without real gas:

```typescript
import { createPublicClient, createWalletClient, http, custom } from 'viem'
import { mainnet } from 'viem/chains'
import { spawn } from 'child_process'
import { expect, beforeAll, afterAll, describe, it } from 'vitest'

// Start Anvil forking mainnet
let anvilProcess: ChildProcess
let forkClient: PublicClient
let forkWallet: WalletClient

beforeAll(async () => {
  // Start Anvil, fork mainnet at block 19000000
  anvilProcess = spawn('anvil', [
    '--fork-url', process.env.MAINNET_RPC_URL!,
    '--fork-block-number', '19000000',
    '--port', '8545',
    '--block-time', '1', // 1 second block time
  ])

  // Wait for Anvil to be ready
  await waitForAnvilReady('http://localhost:8545')

  forkClient = createPublicClient({
    chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
    transport: http('http://localhost:8545'),
  })

  // Use Anvil's test accounts
  const testAccount = privateKeyToAccount(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', // Anvil default account 0
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

describe('USDC Transfer (Mainnet Fork)', () => {
  it('should successfully transfer USDC', async () => {
    const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

    // Use Anvil's impersonateAccount to operate as a real holder
    await forkClient.request({
      method: 'anvil_impersonateAccount',
      params: ['0xF977814e90dA44bFA03b6295A0616a897441aceC'], // Binance hot wallet, holds large USDC balance
    })

    const whaleWallet = createWalletClient({
      chain: { ...mainnet, rpcUrls: { default: { http: ['http://localhost:8545'] } } },
      transport: http('http://localhost:8545'),
      account: '0xF977814e90dA44bFA03b6295A0616a897441aceC',
    })

    // Execute USDC transfer
    const hash = await whaleWallet.writeContract({
      address: USDC,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [forkWallet.account.address, 1000000n], // 1 USDC
    })

    const receipt = await forkClient.waitForTransactionReceipt({ hash })
    expect(receipt.status).toBe('success')

    // Verify balance
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

## Testnet Strategy: Sepolia, Polygon Amoy

Testnets are used for integration testing and manual verification. When choosing a testnet, consider:

| Testnet | Mainnet | Faucet | Block Time | Recommended Use |
|---------|---------|--------|------------|-----------------|
| Sepolia | Ethereum | Abundant | ~12s | Ethereum L1 testing |
| Polygon Amoy | Polygon | Abundant | ~2s | Polygon testing |
| Base Sepolia | Base | Abundant | ~2s | Base L2 testing |

```typescript
// Testnet configuration
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

// Testnet integration test
describe('Testnet Integration Tests', () => {
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

  it('should deploy contract on Sepolia successfully', async () => {
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

## Event Assertions: Verifying Contract Events

Events are the primary way contracts communicate with the frontend. Tests need to verify that events are correctly emitted and parsed:

```typescript
import { parseEventLogs, decodeEventLog, type Abi } from 'viem'

// Event assertion utility
class EventAssertions {
  constructor(private abi: Abi) {}

  // Extract events from transaction receipt
  extractEvents(receipt: TransactionReceipt, eventName: string) {
    const parsed = parseEventLogs({ logs: receipt.logs, abi: this.abi })
    return parsed.filter((log) => log.eventName === eventName)
  }

  // Assert event was emitted
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

  // Assert event was not emitted
  expectNoEvent(receipt: TransactionReceipt, eventName: string) {
    const events = this.extractEvents(receipt, eventName)
    expect(events.length).toBe(0)
  }

  // Assert event order
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

// Usage examples
describe('Event Assertions', () => {
  const assertions = new EventAssertions(routerAbi)

  it('should emit Swap event', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEvent(receipt, 'Swap', {
      sender: forkWallet.account.address,
      amountIn: parseEther('1'),
      amountOut: expect.any(BigInt),
    })
  })

  it('should emit events in correct order', async () => {
    const receipt = await executeSwap(forkClient, forkWallet)

    assertions.expectEventOrder(receipt, ['Approval', 'Transfer', 'Swap'])
  })
})
```

## Frontend Integration Tests: Component + Contract Interaction

Integration tests verify the correctness of frontend components interacting with contracts. Using Anvil Fork as the backend with wagmi's test configuration:

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
    // Use test accounts
    accounts: {
      [mainnet.id]: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    },
  })
}

describe('SwapComponent Integration Test', () => {
  beforeAll(async () => {
    await waitForAnvilReady(FORK_URL)
  })

  it('should display correct token balance and complete swap', async () => {
    const config = createTestConfig()

    render(
      <WagmiProvider config={config}>
        <SwapComponent />
      </WagmiProvider>,
    )

    // Wait for balance to load
    await waitFor(() => {
      expect(screen.getByText(/ETH Balance:/)).toBeInTheDocument()
    })

    // Enter swap amount
    const input = screen.getByLabelText('Swap Amount')
    fireEvent.change(input, { target: { value: '0.1' } })

    // Click Swap button
    const swapButton = screen.getByText('Swap')
    fireEvent.click(swapButton)

    // Wait for transaction confirmation
    await waitFor(() => {
      expect(screen.getByText(/Transaction confirmed/)).toBeInTheDocument()
    }, { timeout: 15000 })
  })
})
```

## E2E Tests: Playwright + Local Chain

End-to-end tests simulate real user operations, including wallet interactions. Playwright controls Anvil and injects a mock wallet:

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

test('complete swap flow', async ({ page }) => {
  // Inject mock provider
  await page.addInitScript(() => {
    window.ethereum = {
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        switch (method) {
          case 'eth_requestAccounts':
            return ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
          case 'eth_chainId':
            return '0x1'
          case 'eth_sendTransaction':
            // Forward to local Anvil
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

  // Connect wallet
  await page.click('text=Connect Wallet')
  await expect(page.locator('text=0xf39F...2266')).toBeVisible()

  // Execute swap
  await page.fill('input[placeholder="Amount"]', '0.1')
  await page.click('text=Swap')
  await page.click('text=Confirm')

  // Wait for confirmation
  await expect(page.locator('text=Transaction confirmed')).toBeVisible({
    timeout: 30000,
  })
})
```

## CI Integration: Running Web3 Tests in GitHub Actions

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

## Test Coverage and Quality Metrics

Web3 frontend test coverage should not focus solely on line coverage. The following dimensions deserve attention:

```typescript
// Coverage configuration in vitest.config.ts
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

// Web3-specific coverage metrics
interface Web3CoverageMetrics {
  contractReadCoverage: number    // Coverage of readContract calls
  contractWriteCoverage: number   // Coverage of writeContract calls
  eventHandlingCoverage: number   // Coverage of event handler functions
  errorPathCoverage: number       // Coverage of error paths
  multiChainCoverage: number      // Multi-chain scenario coverage
}
```

## Summary

Web3 frontend testing requires a layered strategy: mocking for fast unit tests, Anvil Fork for real contract interaction verification, and testnets for end-to-end validation. Each layer solves different problems, and combining them achieves comprehensive coverage. Event assertion utilities ensure contract events are handled correctly. Playwright E2E tests bypass wallet popups by injecting mock providers, enabling automated end-to-end verification. CI integration should group test execution by layer—run fast mock tests first, then fork tests, and finally E2E tests. Coverage metrics should go beyond line coverage to include contract interaction and error path coverage. Investing in testing infrastructure is a necessary expenditure for Web3 projects—the irreversibility of smart contracts makes frontend correctness verification more critical than for traditional web applications.
