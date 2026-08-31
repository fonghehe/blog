---
title: "以太坊 ABI 类型安全：从 TypeChain 到 viem"
date: 2022-11-05 18:56:55
tags:
  - Web3
  - TypeScript
  - Ethereum
readingTime: 8
description: "手动维护合约调用的类型定义是 Web3 前端开发中的常见痛点。本文梳理从 TypeChain 到 viem 的类型安全演进路径，展示如何实现编译时 ABI 类型检查。"
wordCount: 1068
---

在以太坊 DApp 开发中，前端与智能合约的交互通过 ABI（Application Binary Interface）完成。ABI 定义了合约的函数签名、事件结构和参数类型。然而，直接使用 ABI JSON 与 ethers.js 或 web3.js 交互时，类型安全几乎为零——函数名拼写错误、参数类型不匹配、参数顺序错误等问题只能在运行时暴露。本文梳理从手动类型定义到 TypeChain 再到 viem 内置类型推导的完整演进。

## ABI 的 JSON 结构

ABI 是一个 JSON 数组，每个元素描述合约的一个接口（函数、事件、错误等）：

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

ABI 中的 `type` 字段使用 Solidity 的类型系统：`uint256`、`address`、`bytes32`、`string`、`bool`，以及复合类型 `tuple`（对应 struct）和数组 `uint256[]`。

## 手动类型定义的痛点

不使用代码生成时，开发者需要手动编写类型：

```typescript
// 手动定义类型 —— 繁琐且容易出错
interface ERC20Contract {
  transfer(to: string, amount: BigNumber): Promise<BigNumber>
  balanceOf(address: string): Promise<BigNumber>
  allowance(owner: string, spender: string): Promise<BigNumber>
  // ... 每个函数都要手动写
}

// 问题 1：函数名拼写错误不会被编译器捕获
contract.transer(to, amount) // 拼写错误，运行时才报错

// 问题 2：参数类型不匹配
contract.transfer(to, '100') // 应该传 BigNumber，传了 string

// 问题 3：参数顺序错误
contract.transfer(amount, to) // 顺序反了，编译器不报错

// 问题 4：事件监听没有类型
contract.on('Transfer', (from, to, value) => {
  // from, to, value 的类型是 any
})
```

这些问题在小型项目中尚可容忍，但当合约有几十个函数和事件时，手动维护类型定义变成了一场噩梦。

## TypeChain：从 ABI 自动生成 TypeScript 类型

TypeChain 是一个代码生成工具，从 ABI JSON 自动生成 TypeScript 类型定义。它支持多个 target（ethers-v5、web3-v1、truffle 等），生成的代码直接用于项目。

### 安装与配置

```bash
npm install --save-dev typechain @typechain/ethers-v5 ethers
```

```typescript
// typechain.config.ts
import { TypeChainConfig } from 'typechain'

const config: TypeChainConfig = {
  files: ['./abis/**/*.json'],  // ABI 文件路径
  outDir: './types/contracts',   // 输出目录
  target: 'ethers-v5',           // 目标库
}

export default config
```

### 生成类型

```bash
# 通过 CLI 生成
npx typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'

# 或在 package.json 中配置 script
{
  "scripts": {
    "typechain": "typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'",
    "prebuild": "npm run typechain"
  }
}
```

### 生成的类型

假设 ABI 文件 `ERC20.json`：

```typescript
// types/contracts/ERC20.ts（自动生成）
import { ethers } from 'ethers'
import { Provider, TransactionReceipt, Signer, BigNumber, BigNumberish } from 'ethers'

export interface ERC20 extends ethers.Contract {
  // 函数调用 —— 类型安全
  transfer(to: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>
  balanceOf(address: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  allowance(owner: string, spender: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  approve(spender: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>

  // 静态调用
  'transfer(address,uint256)': (to: string, amount: BigNumberish) => Promise<boolean>
  'balanceOf(address)': (address: string) => Promise<BigNumber>

  // 事件过滤器
  filters: {
    Transfer(from?: string | null, to?: string | null, value?: null): ethers.EventFilter
    Approval(owner?: string | null, spender?: string | null, value?: null): ethers.EventFilter
  }

  // 事件监听
  on(event: 'Transfer', listener: (from: string, to: string, value: BigNumber, event: ethers.Event) => void): this
  on(event: 'Approval', listener: (owner: string, spender: string, value: BigNumber, event: ethers.Event) => void): this
}

// 工厂函数
export class ERC20__factory {
  static connect(address: string, signerOrProvider: Signer | Provider): ERC20
  static abi: string[]
}
```

### 类型安全的合约调用

```typescript
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, provider)

// 创建类型安全的合约实例
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// ✅ 编译时检查函数名和参数
const balance = await token.balanceOf(userAddress) // 返回 BigNumber
const tx = await token.transfer(recipient, 1000)   // 参数类型正确

// ❌ 编译时错误
// token.transer(recipient, 1000)                  // 函数不存在
// token.transfer(recipient, '1000')                // 类型不匹配（需要 BigNumberish）
// token.balanceOf()                                // 缺少参数

// 事件监听也是类型安全的
token.on('Transfer', (from, to, value, event) => {
  console.log(`${from} -> ${to}: ${value.toString()}`)
  // from: string, to: string, value: BigNumber —— 类型正确
})

// ❌ 事件名拼写错误
// token.on('Transer', ...) // 编译时错误
```

### 处理 Struct（Tuple）

Solidity 的 struct 在 ABI 中表示为 tuple：

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

TypeChain 会生成对应的 TypeScript 接口：

```typescript
// 自动生成的 struct 类型
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

## 事件类型生成与类型安全监听

TypeChain 为事件生成完整的类型定义，包括事件参数和过滤器的类型：

```typescript
// 自动生成的事件类型
export interface TransferEvent extends ethers.Event {
  args: {
    from: string
    to: string
    value: BigNumber
  }
}

// 类型安全的事件过滤
const filter = token.filters.Transfer(fromAddress, null, null)
// filter 只接受 (string | null, string | null, string | null)
// null 表示通配符

// 查询历史事件
const events = await token.queryFilter(filter, fromBlock, toBlock)
// events: TransferEvent[]
events.forEach((event) => {
  console.log(event.args.from)  // string
  console.log(event.args.value) // BigNumber
})
```

## viem 的内置类型推导

viem 是一个以太坊 TypeScript 库，由 wagmi 团队开发。它的最大特色是内置 ABI 类型推导——不需要代码生成步骤，直接从 ABI 字面量推导类型。

### viem 的类型推导

```typescript
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// 直接使用 ABI 字面量 —— 无需代码生成
const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// viem 从 ABI 字面量推导出完整类型
const balance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf',
  args: ['0x1234...'], // ✅ 类型检查：address
})

// ❌ 编译时错误
// functionName: 'balanecOf'  // 拼写错误，编译器报错
// args: [123]                 // 类型不匹配，需要 address
```

### 使用 JSON ABI

```typescript
import { createPublicClient, http, getContract } from 'viem'
import { mainnet } from 'viem/chains'

// JSON ABI 也支持类型推导
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
] as const  // 关键：as const 让 TypeScript 推导字面量类型

// 使用 getContract 创建类型安全的合约实例
const contract = getContract({
  address: '0x...',
  abi: erc20Abi,
  client,
})

// ✅ 类型安全
const { result } = await contract.simulate.transfer({
  args: [recipient, parseEther('100')],
})

// 事件类型也是安全的
const unwatch = contract.watchEvent.Transfer({
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.from)  // string
      console.log(log.args.value) // bigint
    })
  },
})
```

### viem 的优势

```typescript
// 1. 无需代码生成步骤
// 不需要 typechain.config.ts、不需要 prebuild script
// ABI 变了，类型立即更新

// 2. 更精确的类型推导
// TypeChain 生成的是松散的 string/BigNumber
// viem 推导出更精确的字面量类型

// 3. 函数名是字面量联合类型
type FunctionNames = 'balanceOf' | 'transfer' | 'approve'
// 拼写错误在编译时立即暴露

// 4. 参数和返回值的类型从 ABI 自动推导
// uint256 -> bigint
// address -> \`0x${string}\`
// bool -> boolean
// string -> string
```

## 同一 ABI 的两种实现对比

### TypeChain + ethers-v5 实现

```typescript
// 1. 先运行代码生成：npx typechain
// 2. 导入生成的类型
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

// 3. 创建合约实例
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = provider.getSigner()
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// 4. 调用
const balance: BigNumber = await token.balanceOf(userAddress)

// 5. 转账
const tx = await token.transfer(recipient, ethers.utils.parseUnits('100', 18))
await tx.wait()

// 6. 事件监听
token.on('Transfer', (from, to, value: BigNumber, event) => {
  console.log(value.toString())
})
```

### viem 实现

```typescript
// 1. 无需代码生成
import { createWalletClient, http, parseAbi, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

// 2. 定义 ABI（内联）
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

// 3. 创建 client
const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

// 4. 调用
const balance: bigint = await client.readContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'balanceOf',
  args: [userAddress],
})

// 5. 转账
const txHash = await client.writeContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'transfer',
  args: [recipient, parseEther('100')],
})

// 6. 事件监听
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

关键区别：

| 维度 | TypeChain + ethers | viem |
|------|-------------------|------|
| 代码生成 | 需要（构建前步骤） | 不需要 |
| 类型更新 | ABI 变化后重新生成 | 即时更新 |
| 大数类型 | BigNumber（对象） | bigint（原生） |
| 包体积 | 较大（ethers + typechain） | 较小（tree-shakeable） |
| 事件类型 | 强 | 强 |
| 学习成本 | 低（ethers 生态） | 中（新 API） |

## 前端工程化：ABI 类型生成集成到构建流程

### 使用 Hardhat 自动生成

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

Hardhat 编译合约后会自动运行 TypeChain，生成的类型文件在 `types/contracts/` 目录下。

### 使用 Foundry + 脚本

```bash
# Foundry 编译后生成 ABI
forge build

# ABI 在 out/ 目录下
# 用脚本提取 ABI 并运行 TypeChain
npx typechain --target ethers-v5 --out-dir types/contracts 'out/**/*.json'
```

### Vite 项目集成

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
// 类型从 contracts 包共享到前端
```

## 类型安全的局限

### 运行时仍需验证

TypeScript 类型只在编译时检查，运行时 ABI 可能与实际合约不匹配：

```typescript
// 类型检查通过，但运行时可能失败
const balance = await token.balanceOf(userAddress)
// 如果合约实际没有 balanceOf 函数，运行时报错
```

### ABI 版本管理

合约升级后 ABI 可能变化，需要确保前端使用的 ABI 与链上合约一致：

```typescript
// 建议在运行时验证 ABI 完整性
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

### 重载函数的类型

Solidity 支持函数重载，但 TypeScript 类型生成可能不够精确：

```solidity
// Solidity 重载
function transfer(address to, uint256 amount) returns (bool)
function transfer(address to, uint256 amount, bytes data) returns (bool)
```

TypeChain 使用函数签名的字符串形式来区分重载，使用起来不如 viem 直观：

```typescript
// TypeChain
token['transfer(address,uint256)'](to, amount)
token['transfer(address,uint256,bytes)'](to, amount, data)

// viem 自动处理重载
client.writeContract({
  functionName: 'transfer',
  args: [to, amount],          // 自动匹配第一个重载
  // 或
  args: [to, amount, data],    // 自动匹配第二个重载
})
```

## 小结

从 TypeChain 到 viem，以太坊前端开发的类型安全经历了从"代码生成"到"内置推导"的演进。TypeChain 的核心贡献是让 ABI 类型生成成为构建流程的标准环节，极大提升了 ethers.js 时代的开发体验。viem 则把类型推导推向了新高度——不需要代码生成、不需要构建步骤，ABI 字面量直接被 TypeScript 编译器推导为精确的类型。

选择上，已有 ethers.js 项目推荐使用 TypeChain，迁移成本低、生态成熟。新项目可以考虑 viem，享受零配置类型安全和更轻量的包体积。但无论选择哪种方案，都要注意 ABI 版本管理——编译时类型安全无法替代运行时验证，合约升级后必须同步更新前端 ABI。

类型安全带来的不仅仅是减少 bug，更重要的是开发体验的提升。IDE 自动补全、编译时错误检查、重构时的类型追踪，这些能力让 Web3 前端开发逐渐接近传统 Web 开发的体验标准。
