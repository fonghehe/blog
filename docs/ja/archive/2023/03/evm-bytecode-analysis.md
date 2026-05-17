---
title: "EVM バイトコード分析：スマートコントラクト実行モデルの理解"
date: 2023-03-29 20:04:02
tags:
  - Web3
  - Ethereum
  - Smart Contract
readingTime: 13
description: "スマートコントラクトは最終的に EVM バイトコードとして実行されます。バイトコードとオペコードの理解は Gas 最適化、セキュリティ監査、デバッグにおいて極めて重要です。本記事では EVM アーキテクチャからバイトコード逆コンパイルまで、コントラクト実行モデルを体系的に分解します。"
wordCount: 3300
---

Solidity コードは Ethereum にデプロイされる前に EVM バイトコードにコンパイルされます。オンチェーンで実行されるのは Solidity ソースコードではなく、これらのバイトコードです。バイトコードと EVM 実行モデルの理解は、Gas 最適化、セキュリティ監査、コントラクトデバッグ、フロントエンドインタラクションのすべてにおいて極めて重要です。本記事では EVM アーキテクチャから着手し、Solidity からバイトコード、オペコードまでの完全なフローを段階的に分解します。

## EVM アーキテクチャの概要

Ethereum 仮想マシン（EVM）はスタックベースの仮想マシンで、以下の核心的な特徴を持ちます：

- **スタック深度**：1024 スロット、各 256-bit（32 バイト）
- **ワード長**：256-bit（32 バイト）、すべての計算は 256-bit 整数上で実行
- **ストレージ**：各コントラクトが独立した永続化ストレージ領域を持つ、256-bit key → 256-bit value
- **メモリ**：一時メモリ、トランザクション実行後に破棄、32 バイト word でアドレス指定
- **Gas**：各オペコードに固定の Gas 消費があり、無限ループを防止

### EVM の計算モデル

```
        ┌──────────────────────────────┐
        │           Calldata           │ ← 入力データ（読み取り専用）
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Stack              │ ← 1024 × 256-bit
        │     (LIFO, max depth 16)     │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Memory             │ ← 一時的な読み書き可能
        │     (byte-addressable)       │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │         Storage              │ ← 永続化
        │  (256-bit key → 256-bit val) │
        └──────────────────────────────┘
```

EVM はチューリング完全ではありません——その「チューリング完全性」はジャンプ命令による有限ループで実現されます。Gas メカニズムが計算の必ず終了することを保証します。

## オペコードの分類と機能

EVM には約 140 のオペコードがあり、以下のカテゴリに分類されます：

### 算術演算

```
ADD     0x01  // スタックトップの2要素の加算
SUB     0x03  // 減算
MUL     0x02  // 乗算
DIV     0x04  // 除算
MOD     0x06  // 剰余
ADDMOD  0x08  // モジュロ加算
MULMOD  0x09  // モジュロ乗算
EXP     0x0A  // 指数演算
SIGNEXTEND 0x0B // 符号拡張
```

### 比較とビット演算

```
LT      0x10  // 小なり
GT      0x11  // 大なり
EQ      0x14  // 等価
ISZERO  0x15  // ゼロかどうか
AND     0x16  // ビット論理積
OR      0x17  // ビット論理和
XOR     0x18  // ビット排他的論理和
NOT     0x19  // ビット反転
SHL     0x1B  // 左シフト
SHR     0x1C  // 右シフト
```

### スタック操作

```
POP         0x50  // スタックトップをポップ
PUSH0       0x5F  // 0 をプッシュ（EIP-3855、Shanghai アップグレード）
PUSH1-PUSH32 0x60-0x7F // 1-32 バイトをプッシュ
DUP1-DUP16  0x80-0x8F // スタック要素の複製
SWAP1-SWAP16 0x90-0x9F // スタック要素の交換
```

### メモリとストレージ

```
MLOAD   0x51  // メモリから 32 バイト読み取り
MSTORE  0x52  // メモリに 32 バイト書き込み
MSTORE8 0x53  // メモリに 1 バイト書き込み
SLOAD   0x54  // ストレージから読み取り
SSTORE  0x55  // ストレージに書き込み
```

### 制御フロー

```
JUMP    0x56  // 無条件ジャンプ
JUMPI   0x57  // 条件ジャンプ
PC      0x58  // 現在のプログラムカウンタを取得
MSIZE   0x59  // メモリサイズを取得
GAS     0x5A  // 残り Gas を取得
JUMPDEST 0x5B // ジャンプ先マーカー
```

### 環境情報

```
ADDRESS      0x30  // 現在のコントラクトアドレス
BALANCE      0x31  // アドレス残高
CALLER       0x33  // 呼び出し元アドレス（msg.sender）
CALLVALUE    0x34  // 送信された ETH（msg.value）
CALLDATALOAD 0x35  // calldata から読み取り
CALLDATASIZE 0x36  // calldata 長
CALLDATACOPY 0x37  // calldata をメモリにコピー
CODESIZE     0x38  // コードサイズ
CODECOPY     0x39  // コードをメモリにコピー
SELFBALANCE  0x47  // コントラクト自身の残高
CHAINID      0x46  // チェーン ID
```

### 呼び出しと作成

```
CALL        0xF1  // 別のコントラクトを呼び出し
CALLCODE    0xF2  // コード呼び出し（非推奨）
DELEGATECALL 0xF4 // 委譲呼び出し
STATICCALL  0xFA  // 静的呼び出し（状態を変更しない）
CREATE      0xF0  // コントラクト作成
CREATE2     0xF5  // CREATE2 でコントラクト作成
```

## Gas 計算モデル

各オペコードには Gas 消費があり、2 種類に分類されます：

- **静的 Gas**：オペコード自体の固定費用
- **動的 Gas**：操作パラメータに依存する追加費用

### 一般的なオペコードの Gas 消費

```
ADD/SUB/MUL/DIV    3 Gas    (算術演算)
LT/GT/EQ/ISZERO    3 Gas    (比較演算)
AND/OR/XOR/NOT     3 Gas    (ビット演算)
PUSH1-PUSH32       3 Gas    (プッシュ)
DUP1-DUP16         3 Gas    (複製)
SWAP1-SWAP16       3 Gas    (交換)
MLOAD/MSTORE       3 Gas    (メモリ読み書き)
SLOAD          2100 Gas    (ストレージ読み取り、コールド)
SLOAD (warm)    100 Gas    (ストレージ読み取り、ホット)
SSTORE (cold, from zero to non-zero)  22100 Gas
SSTORE (warm)    100 Gas    (ストレージ書き込み、ホット)
BALANCE         700 Gas    (コールド) / 100 Gas (ホット)
CALL          2600 Gas    (コールド) / 100 Gas (ホット)
CREATE/CREATE2 32000 Gas   (コントラクト作成)
```

### ストレージスロットのコールド/ホットモデル

EIP-2929 はアクセスリスト（Access List）メカニズムを導入し、ストレージスロットとアドレスを「コールド」と「ホット」に分類しました：

- **コールドアクセス**：トランザクション中の初回アクセス、Gas が高い
- **ホットアクセス**：同一トランザクション内で既にアクセス済み、Gas が低い

```
// 初回 SLOAD：2100 Gas（コールド）
// 後続 SLOAD：100 Gas（ホット）
// 初回 SSTORE（0→非0）：22100 Gas
// 後続 SSTORE：100 Gas（ホット）
```

これがコントラクト内でストレージ変数をメモリにキャッシュすることで Gas を節約できる理由です：

```solidity
// Gas が高い：ストレージを複数回読み取り
function bad() public view returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < array.length; i++) { // 毎回 array.length がストレージを読み取り
        sum += array[i];                          // 毎回ストレージを読み取り
    }
    return sum;
}

// Gas が低い：メモリにキャッシュ
function good() public view returns (uint256) {
    uint256[] memory arr = array; // 一度に読み取り
    uint256 sum = 0;
    for (uint256 i = 0; i < arr.length; i++) {
        sum += arr[i]; // メモリ読み取り、3 Gas
    }
    return sum;
}
```

## コントラクトデプロイ：constructor bytecode と runtime bytecode

コントラクトのデプロイには2種類のバイトコードが関わります：

### Creation Bytecode（デプロイバイトコード）

constructor コード + runtime bytecode を含みます。デプロイ時に constructor を実行し、その後 runtime bytecode をオンチェーンに保存します。

```solidity
// SimpleStorage.sol
pragma solidity 0.8.17;

contract SimpleStorage {
    uint256 public value;

    constructor(uint256 _value) {
        value = _value;
    }

    function setValue(uint256 _value) external {
        value = _value;
    }

    function getValue() external view returns (uint256) {
        return value;
    }
}
```

コンパイル後のバイトコード構造：

```
Creation Bytecode:
┌─────────────────────────────────┐
│  Constructor コード               │
│  (初期化ロジックを実行)             │
├─────────────────────────────────┤
│  Runtime Bytecode               │
│  (EVM に保存されるコードを返す)      │
└─────────────────────────────────┘

デプロイプロセス：
1. EVM が Creation Bytecode を実行
2. Constructor が初期状態を設定
3. Constructor が Runtime Bytecode を返す
4. Runtime Bytecode がコントラクトアドレスに保存
```

### Runtime Bytecode（ランタイムバイトコード）

これがオンチェーンに保存され、実際にトランザクションに応答するコードです。`eth_getCode` で取得できます：

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// オンチェーンの runtime bytecode を取得
const bytecode = await provider.getCode(contractAddress)
// "0x608060405234801561001057600080fd5b5060..."
```

## バイトコード逆コンパイルツール

### オンライン逆コンパイルツール

- **ethervm.io**：オペコードを視覚的に表示、メインネットとテストネットをサポート
- **dedaub.com**：Decompiler、バイトコードを読みやすい疑似コードに逆コンパイル
- **etherscan.io**：コントラクトページの "Disassemble" 機能

### ethers によるバイトコード解析

```typescript
import { ethers } from 'ethers'

// バイトコードをオペコードに解析
function disassemble(bytecode: string): { opcode: string; pc: number }[] {
    // 0x プレフィックスを削除
    const code = bytecode.startsWith('0x')
        ? bytecode.slice(2)
        : bytecode

    const opcodes: { opcode: string; pc: number }[] = []
    let pc = 0

    while (pc < code.length) {
        const byte = parseInt(code.slice(pc, pc + 2), 16)

        const opcode = OPCODE_MAP[byte] || `UNKNOWN(0x${byte.toString(16)})`
        opcodes.push({ opcode, pc })

        // PUSH1-PUSH32 はデータをスキップする必要がある
        if (byte >= 0x60 && byte <= 0x7f) {
            const pushSize = byte - 0x5f
            pc += 2 + pushSize * 2
        } else {
            pc += 2
        }
    }

    return opcodes
}

// 一般的なオペコードマッピングテーブル
const OPCODE_MAP: Record<number, string> = {
    0x00: 'STOP',
    0x01: 'ADD',
    0x02: 'MUL',
    0x03: 'SUB',
    0x04: 'DIV',
    0x10: 'LT',
    0x11: 'GT',
    0x14: 'EQ',
    0x15: 'ISZERO',
    0x16: 'AND',
    0x17: 'OR',
    0x34: 'CALLVALUE',
    0x35: 'CALLDATALOAD',
    0x36: 'CALLDATASIZE',
    0x50: 'POP',
    0x51: 'MLOAD',
    0x52: 'MSTORE',
    0x54: 'SLOAD',
    0x55: 'SSTORE',
    0x56: 'JUMP',
    0x57: 'JUMPI',
    0x5b: 'JUMPDEST',
    0x80: 'DUP1',
    0x90: 'SWAP1',
    0xf3: 'RETURN',
    0xfd: 'REVERT',
}

// 使用
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const bytecode = await provider.getCode('0x...')
const opcodes = disassemble(bytecode)
opcodes.forEach((op) => console.log(`${op.pc}: ${op.opcode}`))
```

## 実行トレース

`debug_traceTransaction` は Geth のデバッグ RPC メソッドで、トランザクションの完全な実行トレースを取得できます：

```typescript
import { ethers } from 'ethers'

// debug_traceTransaction をサポートするノードが必要
const provider = new ethers.providers.JsonRpcProvider(
    'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY'
)

async function traceTransaction(txHash: string) {
    const trace = await provider.send('debug_traceTransaction', [
        txHash,
        {
            disableStorage: false,
            disableMemory: false,
            disableStack: false,
        },
    ])

    // trace.structLogs はオペコード実行シーケンス
    trace.structLogs.forEach((log: any, index: number) => {
        console.log(`[${index}] PC: ${log.pc}, OP: ${log.op}`)
        console.log(`  Stack: ${log.stack}`)
        if (log.storage) {
            console.log(`  Storage: ${JSON.stringify(log.storage)}`)
        }
    })

    return trace
}
```

### Trace を使用した Gas 分析

```typescript
function analyzeGasUsage(trace: any) {
    const gasPerOpcode: Record<string, { count: number; gas: number }> = {}

    trace.structLogs.forEach((log: any) => {
        const op = log.op
        if (!gasPerOpcode[op]) {
            gasPerOpcode[op] = { count: 0, gas: 0 }
        }
        gasPerOpcode[op].count++
        // 各ステップの Gas を見積もり（実際にはより複雑な計算が必要）
    })

    // Gas 消費でソート
    const sorted = Object.entries(gasPerOpcode).sort(
        (a, b) => b[1].count - a[1].count
    )

    console.log('オペコード使用統計:')
    sorted.forEach(([op, data]) => {
        console.log(`  ${op}: ${data.count} 回`)
    })
}
```

## ストレージレイアウト

Solidity コントラクトのストレージは 256-bit key → 256-bit value のマッピングで、合計 2^256 スロットがあります。コンパイラは宣言順にストレージスロットを割り当てます。

### ストレージスロット割り当てルール

```solidity
contract StorageLayout {
    // Slot 0: 状態変数は宣言順にパッキング
    uint256 public a;           // slot 0（スロット全体を占有）
    uint128 public b;           // slot 1（c とパッキング）
    uint128 public c;           // slot 1（b とパッキング）

    // Slot 2: 配列の長さはここに保存
    uint256[] public array;     // slot 2 に長さ、データは keccak256(2) + i

    // Slot 3: mapping は値を保存せず、key は keccak256(key . slot) で計算
    mapping(address => uint256) public balances; // slot 3

    // Slot 4: ネストされた mapping
    mapping(address => mapping(uint256 => uint256)) public nested; // slot 4
}
```

### フロントエンドからのストレージスロット読み取り

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// slot 0 の読み取り
const slot0 = await provider.getStorageAt(contractAddress, 0)
console.log('Slot 0:', ethers.BigNumber.from(slot0).toString())

// mapping 内の値の読み取り
// balances[user] は keccak256(userAddress . slotNumber) に保存
async function getMappingValue(
    contractAddress: string,
    slot: number,
    key: string
) {
    // key のストレージ位置を計算
    const paddedKey = ethers.utils.hexZeroPad(key, 32)
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const concatenated = paddedKey + paddedSlot.slice(2)
    const hash = ethers.utils.keccak256(concatenated)

    const value = await provider.getStorageAt(contractAddress, hash)
    return ethers.BigNumber.from(value)
}

// balances[0xUser...] の読み取り
const balance = await getMappingValue(
    contractAddress,
    3, // mapping の slot
    '0xUserAddress...'
)
```

### 動的配列要素の読み取り

```typescript
// array[i] は keccak256(slot) + i に保存
async function getArrayElement(
    contractAddress: string,
    slot: number,
    index: number
) {
    // 配列データの開始位置を計算
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const arrayStart = ethers.utils.keccak256(paddedSlot)

    // 要素位置 = arrayStart + index
    const elementSlot = ethers.BigNumber.from(arrayStart).add(index)
    const value = await provider.getStorageAt(
        contractAddress,
        elementSlot.toHexString()
    )

    return ethers.BigNumber.from(value)
}
```

## 完全な Solidity → Bytecode → Opcode 分析

```solidity
// 最もシンプルなコントラクト
pragma solidity 0.8.17;

contract Adder {
    function add(uint256 a, uint256 b) external pure returns (uint256) {
        return a + b;
    }
}
```

コンパイル後の runtime bytecode（簡略版）：

```
0x6080604052
  // 関数セレクタのチェック
  34156100...  // CALLVALUE, ISZERO, ...
  6004351460... // CALLDATALOAD 4バイト, EQ, JUMPI

  // add(uint256,uint256) の関数セレクタ: 0x771602f7
  // calldata レイアウト: [4バイトselector][32バイト a][32バイト b]

  // パラメータ a と b の読み取り
  35            // CALLDATALOAD
  6004602410... // offset 4、パラメータ a をロード
  35            // CALLDATALOAD
  6024602410... // offset 36、パラメータ b をロード

  // 加算の実行
  01            // ADD

  // 結果の返却
  602052...    // MSTORE でメモリに保存
  f3            // RETURN
```

対応するオペコードシーケンス：

```
PC    OP             説明
0     PUSH1 0x80     0x80 をプッシュ
2     PUSH1 0x40     0x40 をプッシュ
4     MSTORE         メモリ 0x40 に 0x80 を保存（空きメモリポインタ）
5     CALLVALUE      msg.value を取得
6     DUP1           複製
7     ISZERO         ゼロかどうかチェック
8     PUSH1 0x0f     ジャンプ先をプッシュ
10    JUMPI          msg.value == 0 ならジャンプ
...
```

### 関数セレクタ

Solidity は関数セレクタを使用して呼び出しをルーティングします。セレクタは関数シグネチャの keccak256 ハッシュの先頭 4 バイトです：

```typescript
import { ethers } from 'ethers'

// 関数セレクタの計算
const selector = ethers.utils
    .id('add(uint256,uint256)')
    .slice(0, 10) // 0x + 4バイト

console.log(selector) // 0x771602f7

// calldata からセレクタを抽出
function parseCalldata(calldata: string) {
    const selector = calldata.slice(0, 10) // 0x + 4バイト
    const params = '0x' + calldata.slice(10)

    return {
        selector,
        params,
    }
}
```

## フロントエンドツール：ethers で bytecode を解析

```typescript
import { ethers } from 'ethers'

class BytecodeAnalyzer {
    constructor(private bytecode: string) {}

    // コントラクトかどうかをチェック（EOA ではなく）
    isContract(): boolean {
        return this.bytecode !== '0x' && this.bytecode.length > 2
    }

    // immutable 変数の抽出
    // immutable 変数はバイトコード内に PUSH32 で保存される
    extractImmutableValues(): string[] {
        const values: string[] = []
        const code = this.bytecode.slice(2)

        for (let i = 0; i < code.length; i += 2) {
            const byte = parseInt(code.slice(i, i + 2), 16)

            // PUSH32 (0x7f)
            if (byte === 0x7f) {
                const value = '0x' + code.slice(i + 2, i + 66)
                if (value !== '0x' + '0'.repeat(64)) {
                    values.push(value)
                }
                i += 64 // 32 バイトのデータをスキップ
            }
        }

        return values
    }

    // プロキシコントラクトパターンの検出
    isProxyContract(): boolean {
        // プロキシコントラクトは通常先頭に DELEGATECALL (0xf4) を持つ
        // EIP-1167 最小プロキシパターン
        const minimalProxyPattern =
            '0x3d602d80600a3d3981f3363d3d373d3d3d363d73'
        return this.bytecode.startsWith(minimalProxyPattern)
    }

    // コントラクトインターフェースの抽出（calldata ルーティングの分析による）
    extractFunctionSelectors(): string[] {
        const selectors: string[] = []
        // PUSH4 の後に EQ が続くパターンを検索
        const code = this.bytecode.slice(2)

        for (let i = 0; i < code.length - 10; i += 2) {
            const byte = parseInt(code.slice(i, i + 2), 16)

            // PUSH4 (0x63)
            if (byte === 0x63) {
                const selector = '0x' + code.slice(i + 2, i + 10)
                // 後ろに EQ (0x14) があるかチェック
                const nextByte = parseInt(code.slice(i + 10, i + 12), 16)
                if (nextByte === 0x14) {
                    selectors.push(selector)
                }
            }
        }

        return [...new Set(selectors)]
    }
}

// 使用
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const bytecode = await provider.getCode(contractAddress)
const analyzer = new BytecodeAnalyzer(bytecode)

console.log('Is contract:', analyzer.isContract())
console.log('Is proxy:', analyzer.isProxyContract())
console.log('Function selectors:', analyzer.extractFunctionSelectors())
```

## EVM 理解が DApp 開発に与える実際の価値

### Gas 最適化

EVM オペコードの Gas 消費を理解することで、より効率的なコントラクトを記述できます：

```solidity
// Gas 最適化の例：ストレージ書き込みの削減
contract GasOptimized {
    mapping(address => uint256) public balances;

    // 最適化前：2 回のストレージ書き込み
    function update_bad(address user, uint256 amount) external {
        balances[user] = 0;        // SSTORE (0→0, 100 Gas if warm)
        balances[user] = amount;   // SSTORE (0→nonzero, 22100 Gas)
    }

    // 最適化後：1 回のストレージ書き込み
    function update_good(address user, uint256 amount) external {
        balances[user] = amount;   // SSTORE (1 回の書き込み)
    }
}
```

### セキュリティ監査

ストレージレイアウトの理解はセキュリティ監査において極めて重要です。多くの脆弱性はストレージパッキングの誤解から生じます：

```solidity
// 脆弱性の例：ストレージの衝突
contract Vulnerable {
    address public owner;      // slot 0, 20 バイト
    bool public locked;        // slot 0, owner とパッキング（1 バイト）
    uint256 public funds;      // slot 1

    // 攻撃者は特定の方法で locked を上書きする可能性がある
    // コントラクトが悪意あるコントラクトに delegatecall する場合
}
```

### デバッグ

コントラクトのトランザクションが失敗した際、バイトコードを理解することで問題を特定できます：

```typescript
async function debugFailedTransaction(
    txHash: string,
    provider: ethers.providers.Provider
) {
    const tx = await provider.getTransaction(txHash)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (receipt.status === 0) {
        // トランザクション失敗、リプレイを試みる
        try {
            await provider.call({
                to: tx.to,
                data: tx.data,
                from: tx.from,
                value: tx.value,
            }, tx.blockNumber)
        } catch (error) {
            // revert 原因の解析
            const revertReason = ethers.utils.toUtf8String(
                '0x' + error.data.slice(138)
            )
            console.log('Revert reason:', revertReason)
        }
    }
}
```

## まとめ

EVM バイトコード分析は Web3 開発における高度なスキルです。日常の開発でバイトコードを手書きする必要はありませんが、オペコード、Gas モデル、ストレージレイアウトの理解は3つの側面に直接的な価値をもたらします：

**Gas 最適化**は即効性のあるメリットです。SLOAD が 2100 Gas で MLOAD が 3 Gas と知れば、ループ内のストレージ読み取りをメモリにキャッシュすることが本能になります。ストレージパッキングルールを知れば、スロット使用量を減らすために変数宣言順序を適切に配置します。

**セキュリティ監査**にはストレージレイアウトの理解が必要です。プロキシコントラクトの delegatecall は呼び出し元のストレージを再利用し、レイアウトが不一致の場合はストレージの衝突が発生します。スロット割り当てルールを理解してこそ安全なプロキシパターンを設計できます。

**デバッグ能力**は最後の砦です。トランザクションが失敗し revert 原因もない場合、debug_traceTransaction でオペコード実行をトレースするのが問題特定の最後の手段です。フロントエンド開発者はバイトコードレベルのデバッグを頻繁に行うわけではありませんが、このツールの存在と基本用法を知っておけば、決定的な瞬間に大量のトラブルシューティング時間を節約できます。

EVM の継続的な進化（EIP-3540 EOF、EIP-3074 などの提案）に伴い、バイトコード構造自体も変化しています。EVM 仕様への関心を持ち続けることは、Web3 開発者の長期的な必修科目です。
