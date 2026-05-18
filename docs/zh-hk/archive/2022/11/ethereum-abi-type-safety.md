---
title: "以太坊 ABI 類型安全：從 TypeChain 到 viem"
date: 2022-11-05 18:56:55
tags:
  - Web3
  - TypeScript
  - Ethereum
readingTime: 11
description: "手動維護合約調用的類型定義是 Web3 前端開發中的常見痛點。本文梳理從 TypeChain 到 viem 的類型安全演進路徑，展示如何實現編譯時 ABI 類型檢查。"
wordCount: 3000
---

在以太坊 DApp 開發中，前端與智能合約的交互通過 ABI（Application Binary Interface）完成。ABI 定義了合約的函數簽名、事件結構和參數類型。然而，直接使用 ABI JSON 與 ethers.js 或 web3.js 交互時，類型安全幾乎為零——函數名拼寫錯誤、參數類型不匹配、參數順序錯誤等問題只能在運行時暴露。本文梳理從手動類型定義到 TypeChain 再到 viem 內置類型推導的完整演進。

## ABI 的 JSON 結構

ABI 是一個 JSON 數組，每個元素描述合約的一個接口（函數、事件、錯誤等）：

```json
[
  {
    "type": "function",
    "name": "transfer",
    "inputs": [
      { "name": "to", "type": "address", "internalType": "address" },
      { "name": "amount", "type": "uint256", "internalType": "uint256" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "Transfer",
    "inputs": [
      { "name": "from", "type": "address", "indexed": true },
      { "name": "to", "type": "address", "indexed": true },
      { "name": "value", "type": "uint256", "indexed": false }
    ],
    "anonymous": false
  }
]
```

ABI 中的 `type` 字段使用 Solidity 的類型系統：`uint256`、`address`、`bytes32`、`string`、`bool`，以及複合類型 `tuple`（對應 struct）和數組 `uint256[]`。

## 手動類型定義的痛點

不使用代碼生成時，開發者需要手動編寫類型：

```typescript
// 手動定義類型 —— 繁瑣且容易出錯
interface ERC20Contract {
  transfer(to: string, amount: BigNumber): Promise<BigNumber>
  balanceOf(address: string): Promise<BigNumber>
  allowance(owner: string, spender: string): Promise<BigNumber>
  // ... 每個函數都要手動寫
}

// 問題 1：函數名拼寫錯誤不會被編譯器捕獲
contract.transer(to, amount) // 拼寫錯誤，運行時才報錯

// 問題 2：參數類型不匹配
contract.transfer(to, '100') // 應該傳 BigNumber，傳了 string

// 問題 3：參數順序錯誤
contract.transfer(amount, to) // 順序反了，編譯器不報錯

// 問題 4：事件監聽沒有類型
contract.on('Transfer', (from, to, value) => {
  // from, to, value 的類型是 any
})
```

這些問題在小型項目中尚可容忍，但當合約有幾十個函數和事件時，手動維護類型定義變成了一場噩夢。

## TypeChain：從 ABI 自動生成 TypeScript 類型

TypeChain 是一個代碼生成工具，從 ABI JSON 自動生成 TypeScript 類型定義。它支持多個 target（ethers-v5、web3-v1、truffle 等），生成的代碼直接用於項目。

### 安裝與配置

```bash
npm install --save-dev typechain @typechain/ethers-v5 ethers
```

```typescript
// typechain.config.ts
import { TypeChainConfig } from 'typechain'

const config: TypeChainConfig = {
  files: ['./abis/**/*.json'],  // ABI 文件路徑
  outDir: './types/contracts',   // 輸出目錄
  target: 'ethers-v5',           // 目標庫
}

export default config
```

### 生成類型

```bash
# 通過 CLI 生成
npx typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'

# 或在 package.json 中配置 script
{
  "scripts": {
    "typechain": "typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'",
    "prebuild": "npm run typechain"
  }
}
```

### 生成的類型

假設 ABI 文件 `ERC20.json`：

```typescript
// types/contracts/ERC20.ts（自動生成）
import { ethers } from 'ethers'
import { Provider, TransactionReceipt, Signer, BigNumber, BigNumberish } from 'ethers'

export interface ERC20 extends ethers.Contract {
  // 函數調用 —— 類型安全
  transfer(to: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>
  balanceOf(address: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  allowance(owner: string, spender: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  approve(spender: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>

  // 靜態調用
  'transfer(address,uint256)': (to: string, amount: BigNumberish) => Promise<boolean>
  'balanceOf(address)': (address: string) => Promise<BigNumber>

  // 事件過濾器
  filters: {
    Transfer(from?: string | null, to?: string | null, value?: null): ethers.EventFilter
    Approval(owner?: string | null, spender?: string | null, value?: null): ethers.EventFilter
  }

  // 事件監聽
  on(event: 'Transfer', listener: (from: string, to: string, value: BigNumber, event: ethers.Event) => void): this
  on(event: 'Approval', listener: (owner: string, spender: string, value: BigNumber, event: ethers.Event) => void): this
}

// 工廠函數
export class ERC20__factory {
  static connect(address: string, signerOrProvider: Signer | Provider): ERC20
  static abi: string[]
}
```

### 類型安全的合約調用

```typescript
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, provider)

// 創建類型安全的合約實例
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// ✅ 編譯時檢查函數名和參數
const balance = await token.balanceOf(userAddress) // 返回 BigNumber
const tx = await token.transfer(recipient, 1000)   // 參數類型正確

// ❌ 編譯時錯誤
// token.transer(recipient, 1000)                  // 函數不存在
// token.transfer(recipient, '1000')                // 類型不匹配（需要 BigNumberish）
// token.balanceOf()                                // 缺少參數

// 事件監聽也是類型安全的
token.on('Transfer', (from, to, value, event) => {
  console.log(`${from} -> ${to}: ${value.toString()}`)
  // from: string, to: string, value: BigNumber —— 類型正確
})

// ❌ 事件名拼寫錯誤
// token.on('Transer', ...) // 編譯時錯誤
```

### 處理 Struct（Tuple）

Solidity 的 struct 在 ABI 中表示為 tuple：

```solidity
// Solidity
struct UserInfo {
  uint256 amount;
  uint256 rewardDebt;
}

function userInfo(uint256 pid, address user) external view returns (UserInfo memory);
```

```json
[
  {
    "type": "function",
    "name": "userInfo",
    "inputs": [
      { "name": "pid", "type": "uint256" },
      { "name": "user", "type": "address" }
    ],
    "outputs": [
      {
        "name": "",
        "type": "tuple",
        "components": [
          { "name": "amount", "type": "uint256" },
          { "name": "rewardDebt", "type": "uint256" }
        ]
      }
    ]
  }
]
```

TypeChain 會生成對應的 TypeScript 接口：

```typescript
// 自動生成的 struct 類型
export interface UserInfoStruct {
  amount: BigNumber
  rewardDebt: BigNumber
}

export interface UserInfoStructOutput {
  amount: BigNumber
  rewardDebt: BigNumber
}

// 使用
const info = await contract.userInfo(0, userAddress)
// info: UserInfoStructOutput
console.log(info.amount.toString())
```

## 事件類型生成與類型安全監聽

TypeChain 為事件生成完整的類型定義，包括事件參數和過濾器的類型：

```typescript
// 自動生成的事件類型
export interface TransferEvent extends ethers.Event {
  args: {
    from: string
    to: string
    value: BigNumber
  }
}

// 類型安全的事件過濾
const filter = token.filters.Transfer(fromAddress, null, null)
// filter 只接受 (string | null, string | null, string | null)
// null 表示通配符

// 查詢歷史事件
const events = await token.queryFilter(filter, fromBlock, toBlock)
// events: TransferEvent[]
events.forEach((event) => {
  console.log(event.args.from)  // string
  console.log(event.args.value) // BigNumber
})
```

## viem 的內置類型推導

viem 是一個 2023 年初發布的以太坊 TypeScript 庫，由 wagmi 團隊開發。它的最大特色是內置 ABI 類型推導——不需要代碼生成步驟，直接從 ABI 字面量推導類型。

### viem 的類型推導

```typescript
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// 直接使用 ABI 字面量 —— 無需代碼生成
const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// viem 從 ABI 字面量推導出完整類型
const balance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf',
  args: ['0x1234...'], // ✅ 類型檢查：address
})

// ❌ 編譯時錯誤
// functionName: 'balanecOf'  // 拼寫錯誤，編譯器報錯
// args: [123]                 // 類型不匹配，需要 address
```

### 使用 JSON ABI

```typescript
import { createPublicClient, http, getContract } from 'viem'
import { mainnet } from 'viem/chains'

// JSON ABI 也支持類型推導
const erc20Abi = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const  // 關鍵：as const 讓 TypeScript 推導字面量類型

// 使用 getContract 創建類型安全的合約實例
const contract = getContract({
  address: '0x...',
  abi: erc20Abi,
  client,
})

// ✅ 類型安全
const { result } = await contract.simulate.transfer({
  args: [recipient, parseEther('100')],
})

// 事件類型也是安全的
const unwatch = contract.watchEvent.Transfer({
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.from)  // string
      console.log(log.args.value) // bigint
    })
  },
})
```

### viem 的優勢

```typescript
// 1. 無需代碼生成步驟
// 不需要 typechain.config.ts、不需要 prebuild script
// ABI 變了，類型立即更新

// 2. 更精確的類型推導
// TypeChain 生成的是鬆散的 string/BigNumber
// viem 推導出更精確的字面量類型

// 3. 函數名是字面量聯合類型
type FunctionNames = 'balanceOf' | 'transfer' | 'approve'
// 拼寫錯誤在編譯時立即暴露

// 4. 參數和返回值的類型從 ABI 自動推導
// uint256 -> bigint
// address -> \`0x${string}\`
// bool -> boolean
// string -> string
```

## 同一 ABI 的兩種實現對比

### TypeChain + ethers-v5 實現

```typescript
// 1. 先運行代碼生成：npx typechain
// 2. 導入生成的類型
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

// 3. 創建合約實例
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = provider.getSigner()
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// 4. 調用
const balance: BigNumber = await token.balanceOf(userAddress)

// 5. 轉賬
const tx = await token.transfer(recipient, ethers.utils.parseUnits('100', 18))
await tx.wait()

// 6. 事件監聽
token.on('Transfer', (from, to, value: BigNumber, event) => {
  console.log(value.toString())
})
```

### viem 實現

```typescript
// 1. 無需代碼生成
import { createWalletClient, http, parseAbi, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

// 2. 定義 ABI（內聯）
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

// 3. 創建 client
const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

// 4. 調用
const balance: bigint = await client.readContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'balanceOf',
  args: [userAddress],
})

// 5. 轉賬
const txHash = await client.writeContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'transfer',
  args: [recipient, parseEther('100')],
})

// 6. 事件監聽
const unwatch = client.watchContractEvent({
  address: TOKEN_ADDRESS,
  abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.value) // bigint
    })
  },
})
```

關鍵區別：

| 維度 | TypeChain + ethers | viem |
|------|-------------------|------|
| 代碼生成 | 需要（構建前步驟） | 不需要 |
| 類型更新 | ABI 變化後重新生成 | 即時更新 |
| 大數類型 | BigNumber（對象） | bigint（原生） |
| 包體積 | 較大（ethers + typechain） | 較小（tree-shakeable） |
| 事件類型 | 強 | 強 |
| 學習成本 | 低（ethers 生態） | 中（新 API） |

## 前端工程化：ABI 類型生成集成到構建流程

### 使用 Hardhat 自動生成

```typescript
// hardhat.config.ts
import '@typechain/hardhat'
import 'hardhat-deploy'

export default {
  solidity: '0.8.17',
  typechain: {
    outDir: 'types/contracts',
    target: 'ethers-v5',
    alwaysGenerateOverloads: true,
  },
  paths: {
    sources: './contracts',
    artifacts: './artifacts',
  },
}
```

Hardhat 編譯合約後會自動運行 TypeChain，生成的類型文件在 `types/contracts/` 目錄下。

### 使用 Foundry + 腳本

```bash
# Foundry 編譯後生成 ABI
forge build

# ABI 在 out/ 目錄下
# 用腳本提取 ABI 並運行 TypeChain
npx typechain --target ethers-v5 --out-dir types/contracts 'out/**/*.json'
```

### Vite 項目集成

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { typechainPlugin } from 'vite-plugin-typechain'

export default defineConfig({
  plugins: [
    typechainPlugin({
      outDir: 'src/types/contracts',
      target: 'ethers-v5',
      files: 'src/abis/**/*.json',
    }),
  ],
})
```

### Monorepo 中的 ABI 共享

```typescript
// packages/contracts/package.json
{
  "name": "@myapp/contracts",
  "scripts": {
    "build": "forge build && npm run typechain",
    "typechain": "typechain --target ethers-v5 --out-dir types 'out/**/*.json'"
  },
  "exports": {
    "./types": "./types/index.ts",
    "./abis": "./abis/index.ts"
  }
}

// packages/frontend/src/hooks/useToken.ts
import { ERC20__factory } from '@myapp/contracts/types'
// 類型從 contracts 包共享到前端
```

## 類型安全的侷限

### 運行時仍需驗證

TypeScript 類型只在編譯時檢查，運行時 ABI 可能與實際合約不匹配：

```typescript
// 類型檢查通過，但運行時可能失敗
const balance = await token.balanceOf(userAddress)
// 如果合約實際沒有 balanceOf 函數，運行時報錯
```

### ABI 版本管理

合約升級後 ABI 可能變化，需要確保前端使用的 ABI 與鏈上合約一致：

```typescript
// 建議在運行時驗證 ABI 完整性
import tokenAbi from './abis/ERC20.json'

function validateContract(abi: any, requiredFunctions: string[]) {
  const abiFunctions = abi
    .filter((item: any) => item.type === 'function')
    .map((item: any) => item.name)

  const missing = requiredFunctions.filter(
    (fn) => !abiFunctions.includes(fn)
  )

  if (missing.length > 0) {
    throw new Error(`ABI missing required functions: ${missing.join(', ')}`)
  }
}

validateContract(tokenAbi, ['transfer', 'balanceOf', 'approve'])
```

### 重載函數的類型

Solidity 支持函數重載，但 TypeScript 類型生成可能不夠精確：

```solidity
// Solidity 重載
function transfer(address to, uint256 amount) returns (bool)
function transfer(address to, uint256 amount, bytes data) returns (bool)
```

TypeChain 使用函數簽名的字符串形式來區分重載，使用起來不如 viem 直觀：

```typescript
// TypeChain
token['transfer(address,uint256)'](to, amount)
token['transfer(address,uint256,bytes)'](to, amount, data)

// viem 自動處理重載
client.writeContract({
  functionName: 'transfer',
  args: [to, amount],          // 自動匹配第一個重載
  // 或
  args: [to, amount, data],    // 自動匹配第二個重載
})
```

## 小結

從 TypeChain 到 viem，以太坊前端開發的類型安全經歷了從"代碼生成"到"內置推導"的演進。TypeChain 的核心貢獻是讓 ABI 類型生成成為構建流程的標準環節，極大提升了 ethers.js 時代的開發體驗。viem 則把類型推導推向了新高度——不需要代碼生成、不需要構建步驟，ABI 字面量直接被 TypeScript 編譯器推導為精確的類型。

選擇上，已有 ethers.js 項目推薦使用 TypeChain，遷移成本低、生態成熟。新項目可以考慮 viem，享受零配置類型安全和更輕量的包體積。但無論選擇哪種方案，都要注意 ABI 版本管理——編譯時類型安全無法替代運行時驗證，合約升級後必須同步更新前端 ABI。

類型安全帶來的不僅僅是減少 bug，更重要的是開發體驗的提升。IDE 自動補全、編譯時錯誤檢查、重構時的類型追蹤，這些能力讓 Web3 前端開發逐漸接近傳統 Web 開發的體驗標準。
