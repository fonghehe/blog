---
title: "Ethereum ABI 型安全性：TypeChain から viem まで"
date: 2022-11-05 18:56:55
tags:
  - Web3
  - TypeScript
  - Ethereum
readingTime: 10
description: "コントラクト呼び出しの型定義を手動で保守するのは Web3 フロントエンド開発における一般的な課題です。本記事では TypeChain から viem までの型安全性の進化の道のりを整理し、コンパイル時の ABI 型チェックの実現方法を示します。"
wordCount: 1693
---

Ethereum DApp 開発において、フロントエンドとスマートコントラクトのインタラクションは ABI（Application Binary Interface）を通じて行われます。ABI はコントラクトの関数シグネチャ、イベント構造、パラメータ型を定義します。しかし、ABI JSON を直接 ethers.js や web3.js で使用する場合、型安全性はほぼゼロです——関数名のスペルミス、パラメータ型の不一致、パラメータ順序のエラーなどは実行時にしか発見できません。本記事では手動型定義から TypeChain、さらに viem の組み込み型推導まで、完全な進化の道のりを整理します。

## ABI の JSON 構造

ABI は JSON 配列で、各要素がコントラクトの一つのインターフェース（関数、イベント、エラーなど）を記述します：

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

ABI の `type` フィールドは Solidity の型システムを使用します：`uint256`、`address`、`bytes32`、`string`、`bool`、および複合型の `tuple`（struct に対応）と配列 `uint256[]`。

## 手動型定義の課題

コード生成を使用しない場合、開発者は手動で型を記述する必要があります：

```typescript
// 手動型定義 —— 煩雑でエラーが起きやすい
interface ERC20Contract {
  transfer(to: string, amount: BigNumber): Promise<BigNumber>
  balanceOf(address: string): Promise<BigNumber>
  allowance(owner: string, spender: string): Promise<BigNumber>
  // ... 各関数を手動で記述する必要がある
}

// 問題 1：関数名のスペルミスがコンパイラに捕捉されない
contract.transer(to, amount) // スペルミス、実行時にエラー

// 問題 2：パラメータ型の不一致
contract.transfer(to, '100') // BigNumber を渡すべきだが string を渡している

// 問題 3：パラメータ順序のエラー
contract.transfer(amount, to) // 順序が逆、コンパイラはエラーを出さない

// 問題 4：イベントリスナーに型がない
contract.on('Transfer', (from, to, value) => {
  // from, to, value の型は any
})
```

これらの問題は小規模プロジェクトでは許容できますが、コントラクトに数十の関数とイベントがある場合、手動での型定義の保守は悪夢になります。

## TypeChain：ABI から TypeScript 型を自動生成

TypeChain はコード生成ツールで、ABI JSON から TypeScript 型定義を自動生成します。複数の target（ethers-v5、web3-v1、truffle など）をサポートし、生成されたコードはプロジェクトで直接使用できます。

### インストールと設定

```bash
npm install --save-dev typechain @typechain/ethers-v5 ethers
```

```typescript
// typechain.config.ts
import { TypeChainConfig } from 'typechain'

const config: TypeChainConfig = {
  files: ['./abis/**/*.json'],  // ABI ファイルパス
  outDir: './types/contracts',   // 出力ディレクトリ
  target: 'ethers-v5',           // ターゲットライブラリ
}

export default config
```

### 型の生成

```bash
# CLI で生成
npx typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'

# または package.json で script を設定
{
  "scripts": {
    "typechain": "typechain --target ethers-v5 --out-dir types/contracts 'abis/**/*.json'",
    "prebuild": "npm run typechain"
  }
}
```

### 生成された型

ABI ファイル `ERC20.json` を想定：

```typescript
// types/contracts/ERC20.ts（自動生成）
import { ethers } from 'ethers'
import { Provider, TransactionReceipt, Signer, BigNumber, BigNumberish } from 'ethers'

export interface ERC20 extends ethers.Contract {
  // 関数呼び出し —— 型安全
  transfer(to: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>
  balanceOf(address: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  allowance(owner: string, spender: string, overrides?: ethers.CallOverrides): Promise<BigNumber>
  approve(spender: string, amount: BigNumberish, overrides?: ethers.Overrides): Promise<ethers.ContractTransaction>

  // スタティックコール
  'transfer(address,uint256)': (to: string, amount: BigNumberish) => Promise<boolean>
  'balanceOf(address)': (address: string) => Promise<BigNumber>

  // イベントフィルター
  filters: {
    Transfer(from?: string | null, to?: string | null, value?: null): ethers.EventFilter
    Approval(owner?: string | null, spender?: string | null, value?: null): ethers.EventFilter
  }

  // イベントリスナー
  on(event: 'Transfer', listener: (from: string, to: string, value: BigNumber, event: ethers.Event) => void): this
  on(event: 'Approval', listener: (owner: string, spender: string, value: BigNumber, event: ethers.Event) => void): this
}

// ファクトリー関数
export class ERC20__factory {
  static connect(address: string, signerOrProvider: Signer | Provider): ERC20
  static abi: string[]
}
```

### 型安全なコントラクト呼び出し

```typescript
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = new ethers.Wallet(PRIVATE_KEY, provider)

// 型安全なコントラクトインスタンスを作成
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// ✅ コンパイル時の関数名とパラメータのチェック
const balance = await token.balanceOf(userAddress) // BigNumber を返す
const tx = await token.transfer(recipient, 1000)   // パラメータ型が正しい

// ❌ コンパイル時エラー
// token.transer(recipient, 1000)                  // 関数が存在しない
// token.transfer(recipient, '1000')                // 型不一致（BigNumberish が必要）
// token.balanceOf()                                // パラメータ不足

// イベントリスナーも型安全
token.on('Transfer', (from, to, value, event) => {
  console.log(`${from} -> ${to}: ${value.toString()}`)
  // from: string, to: string, value: BigNumber —— 型が正しい
})

// ❌ イベント名のスペルミス
// token.on('Transer', ...) // コンパイル時エラー
```

### Struct（Tuple）の処理

Solidity の struct は ABI では tuple として表現されます：

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

TypeChain は対応する TypeScript インターフェースを生成します：

```typescript
// 自動生成された struct 型
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

## イベント型生成と型安全なリスナー

TypeChain はイベントに対して完全な型定義を生成し、イベントパラメータとフィルターの型を含みます：

```typescript
// 自動生成されたイベント型
export interface TransferEvent extends ethers.Event {
  args: {
    from: string
    to: string
    value: BigNumber
  }
}

// 型安全なイベントフィルタリング
const filter = token.filters.Transfer(fromAddress, null, null)
// filter は (string | null, string | null, string | null) のみ受け付ける
// null はワイルドカードを意味する

// 履歴イベントの照会
const events = await token.queryFilter(filter, fromBlock, toBlock)
// events: TransferEvent[]
events.forEach((event) => {
  console.log(event.args.from)  // string
  console.log(event.args.value) // BigNumber
})
```

## viem の組み込み型推導

viem は 2023 年初頭にリリースされた Ethereum TypeScript ライブラリで、wagmi チームが開発しました。最大の特徴は組み込みの ABI 型推導です——コード生成ステップが不要で、ABI リテラルから直接型を推導します。

### viem の型推導

```typescript
import { createPublicClient, http, parseAbi } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(),
})

// ABI リテラルを直接使用 —— コード生成不要
const abi = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
])

// viem が ABI リテラルから完全な型を推導
const balance = await client.readContract({
  address: '0x...',
  abi,
  functionName: 'balanceOf',
  args: ['0x1234...'], // ✅ 型チェック：address
})

// ❌ コンパイル時エラー
// functionName: 'balanecOf'  // スペルミス、コンパイラがエラー
// args: [123]                 // 型不一致、address が必要
```

### JSON ABI の使用

```typescript
import { createPublicClient, http, getContract } from 'viem'
import { mainnet } from 'viem/chains'

// JSON ABI も型推導をサポート
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
] as const  // 重要：as const で TypeScript がリテラル型を推導

// getContract で型安全なコントラクトインスタンスを作成
const contract = getContract({
  address: '0x...',
  abi: erc20Abi,
  client,
})

// ✅ 型安全
const { result } = await contract.simulate.transfer({
  args: [recipient, parseEther('100')],
})

// イベント型も安全
const unwatch = contract.watchEvent.Transfer({
  onLogs: (logs) => {
    logs.forEach((log) => {
      console.log(log.args.from)  // string
      console.log(log.args.value) // bigint
    })
  },
})
```

### viem の優位性

```typescript
// 1. コード生成ステップが不要
// typechain.config.ts、prebuild script が不要
// ABI が変われば型が即座に更新

// 2. より精密な型推導
// TypeChain が生成するのは緩い string/BigNumber
// viem はより精密なリテラル型を推導

// 3. 関数名はリテラルユニオン型
type FunctionNames = 'balanceOf' | 'transfer' | 'approve'
// スペルミスがコンパイル時に即座に発覚

// 4. パラメータと戻り値の型が ABI から自動推導
// uint256 -> bigint
// address -> \`0x${string}\`
// bool -> boolean
// string -> string
```

## 同一 ABI の2つの実装の比較

### TypeChain + ethers-v5 実装

```typescript
// 1. まずコード生成を実行：npx typechain
// 2. 生成された型をインポート
import { ERC20__factory } from './types/contracts'
import { ethers } from 'ethers'

// 3. コントラクトインスタンスを作成
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const signer = provider.getSigner()
const token = ERC20__factory.connect(TOKEN_ADDRESS, signer)

// 4. 呼び出し
const balance: BigNumber = await token.balanceOf(userAddress)

// 5. 送金
const tx = await token.transfer(recipient, ethers.utils.parseUnits('100', 18))
await tx.wait()

// 6. イベントリスナー
token.on('Transfer', (from, to, value: BigNumber, event) => {
  console.log(value.toString())
})
```

### viem 実装

```typescript
// 1. コード生成不要
import { createWalletClient, http, parseAbi, parseEther } from 'viem'
import { mainnet } from 'viem/chains'

// 2. ABI を定義（インライン）
const abi = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
])

// 3. client を作成
const client = createWalletClient({
  chain: mainnet,
  transport: http(),
})

// 4. 呼び出し
const balance: bigint = await client.readContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'balanceOf',
  args: [userAddress],
})

// 5. 送金
const txHash = await client.writeContract({
  address: TOKEN_ADDRESS,
  abi,
  functionName: 'transfer',
  args: [recipient, parseEther('100')],
})

// 6. イベントリスナー
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

主な違い：

| 次元 | TypeChain + ethers | viem |
|------|-------------------|------|
| コード生成 | 必要（ビルド前ステップ） | 不要 |
| 型更新 | ABI 変更後に再生成 | 即時更新 |
| 多倍長整数型 | BigNumber（オブジェクト） | bigint（ネイティブ） |
| パッケージサイズ | 大きい（ethers + typechain） | 小さい（tree-shakeable） |
| イベント型 | 強力 | 強力 |
| 学習コスト | 低い（ethers エコシステム） | 中（新しい API） |

## フロントエンドエンジニアリング：ABI 型生成のビルドフローへの統合

### Hardhat による自動生成

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

Hardhat はコントラクトのコンパイル後に自動的に TypeChain を実行し、生成された型ファイルは `types/contracts/` ディレクトリに配置されます。

### Foundry + スクリプトの使用

```bash
# Foundry コンパイル後に ABI を生成
forge build

# ABI は out/ ディレクトリに配置
# スクリプトで ABI を抽出して TypeChain を実行
npx typechain --target ethers-v5 --out-dir types/contracts 'out/**/*.json'
```

### Vite プロジェクトへの統合

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

### Monorepo での ABI 共有

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
// 型が contracts パッケージからフロントエンドへ共有
```

## 型安全性の限界

### 実行時の検証は依然必要

TypeScript の型はコンパイル時にのみチェックされ、実行時の ABI は実際のコントラクトと一致しない可能性があります：

```typescript
// 型チェックは通るが、実行時に失敗する可能性がある
const balance = await token.balanceOf(userAddress)
// コントラクトに実際に balanceOf 関数がない場合、実行時エラー
```

### ABI バージョン管理

コントラクトのアップグレード後に ABI が変化する可能性があり、フロントエンドが使用する ABI がオンチェーンのコントラクトと一致することを保証する必要があります：

```typescript
// 実行時に ABI の完全性を検証することを推奨
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

### オーバーロード関数の型

Solidity は関数のオーバーロードをサポートしますが、TypeScript の型生成は十分に精密でない場合があります：

```solidity
// Solidity オーバーロード
function transfer(address to, uint256 amount) returns (bool)
function transfer(address to, uint256 amount, bytes data) returns (bool)
```

TypeChain は関数シグネチャの文字列表現でオーバーロードを区別し、viem ほど直感的ではありません：

```typescript
// TypeChain
token['transfer(address,uint256)'](to, amount)
token['transfer(address,uint256,bytes)'](to, amount, data)

// viem はオーバーロードを自動処理
client.writeContract({
  functionName: 'transfer',
  args: [to, amount],          // 最初のオーバーロードに自動マッチ
  // または
  args: [to, amount, data],    // 2番目のオーバーロードに自動マッチ
})
```

## まとめ

TypeChain から viem まで、Ethereum フロントエンド開発の型安全性は「コード生成」から「組み込み推導」への進化を経ました。TypeChain の核心的な貢献は ABI 型生成をビルドフローの標準的なステップにしたことで、ethers.js 時代の開発体験を大幅に向上させました。viem は型推導を新たな高みへ押し上げました——コード生成不要、ビルドステップ不要、ABI リテラルが直接 TypeScript コンパイラによって精密な型として推導されます。

選択について、既存の ethers.js プロジェクトには TypeChain を推奨します。移行コストが低く、エコシステムが成熟しています。新規プロジェクトは viem を検討でき、ゼロ設定の型安全性とより軽量なパッケージサイズを享受できます。ただしどの方案を選択しても、ABI バージョン管理に注意が必要です——コンパイル時の型安全性は実行時の検証を代替できず、コントラクトのアップグレード後はフロントエンドの ABI を同期的に更新する必要があります。

型安全性がもたらすのはバグの削減だけでなく、さらに重要なのは開発体験の向上です。IDE の自動補完、コンパイル時のエラーチェック、リファクタリング時の型追跡、これらの機能により Web3 フロントエンド開発は徐々に従来の Web 開発の体験水準に近づいています。
