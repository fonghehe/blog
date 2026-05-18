---
title: "EVM 字節碼分析：理解智能合約執行模型"
date: 2023-03-29 20:04:02
tags:
  - Web3
  - Ethereum
  - Smart Contract
readingTime: 13
description: "智能合約最終以 EVM 字節碼運行，理解字節碼和操作碼對於 gas 優化、安全審計和調試至關重要。本文從 EVM 架構到字節碼反編譯，系統拆解合約執行模型。"
wordCount: 3300
---

Solidity 代碼在部署到以太坊之前，會編譯為 EVM 字節碼。鏈上運行的不是 Solidity 源碼，而是這些字節碼。理解字節碼和 EVM 執行模型，對於 gas 優化、安全審計、合約調試和前端交互都至關重要。本文從 EVM 架構入手，逐步拆解從 Solidity 到字節碼到操作碼的完整鏈路。

## EVM 架構概述

以太坊虛擬機（EVM）是一個基於棧的虛擬機，具有以下核心特徵：

- **棧深度**：1024 個槽位，每個 256-bit（32 字節）
- **字長**：256-bit（32 字節），所有計算都在 256-bit 整數上進行
- **存儲**：每個合約有獨立的持久化存儲空間，256-bit key → 256-bit value
- **內存**：臨時內存，交易執行後銷燬，按 32 字節 word 尋址
- **Gas**：每條操作碼有固定的 Gas 消耗，防止無限循環

### EVM 的計算模型

```
        ┌──────────────────────────────┐
        │           Calldata           │ ← 輸入數據（只讀）
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Stack              │ ← 1024 × 256-bit
        │     (LIFO, max depth 16)     │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Memory             │ ← 臨時可讀寫
        │     (byte-addressable)       │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │         Storage              │ ← 持久化
        │  (256-bit key → 256-bit val) │
        └──────────────────────────────┘
```

EVM 不是圖靈完備的——它的"圖靈完備"是通過跳轉指令實現的有限循環。Gas 機制保證了計算必然終止。

## 操作碼分類與功能

EVM 共有約 140 個操作碼，分為以下幾類：

### 算術運算

```
ADD     0x01  // 棧頂兩元素相加
SUB     0x03  // 減法
MUL     0x02  // 乘法
DIV     0x04  // 除法
MOD     0x06  // 取模
ADDMOD  0x08  // 模加法
MULMOD  0x09  // 模乘法
EXP     0x0A  // 指數運算
SIGNEXTEND 0x0B // 符號擴展
```

### 比較與位運算

```
LT      0x10  // 小於
GT      0x11  // 大於
EQ      0x14  // 等於
ISZERO  0x15  // 是否為零
AND     0x16  // 按位與
OR      0x17  // 按位或
XOR     0x18  // 按位異或
NOT     0x19  // 按位取反
SHL     0x1B  // 左移
SHR     0x1C  // 右移
```

### 棧操作

```
POP         0x50  // 彈出棧頂
PUSH0       0x5F  // 壓入 0（EIP-3855，上海升級）
PUSH1-PUSH32 0x60-0x7F // 壓入 1-32 字節
DUP1-DUP16  0x80-0x8F // 複製棧中元素
SWAP1-SWAP16 0x90-0x9F // 交換棧中元素
```

### 內存與存儲

```
MLOAD   0x51  // 從內存讀取 32 字節
MSTORE  0x52  // 向內存寫入 32 字節
MSTORE8 0x53  // 向內存寫入 1 字節
SLOAD   0x54  // 從存儲讀取
SSTORE  0x55  // 向存儲寫入
```

### 控制流

```
JUMP    0x56  // 無條件跳轉
JUMPI   0x57  // 條件跳轉
PC      0x58  // 獲取當前程序計數器
MSIZE   0x59  // 獲取內存大小
GAS     0x5A  // 獲取剩餘 Gas
JUMPDEST 0x5B // 跳轉目標標記
```

### 環境信息

```
ADDRESS      0x30  // 當前合約地址
BALANCE      0x31  // 地址餘額
CALLER       0x33  // 調用者地址（msg.sender）
CALLVALUE    0x34  // 發送的 ETH（msg.value）
CALLDATALOAD 0x35  // 從 calldata 讀取
CALLDATASIZE 0x36  // calldata 長度
CALLDATACOPY 0x37  // 複製 calldata 到內存
CODESIZE     0x38  // 代碼大小
CODECOPY     0x39  // 複製代碼到內存
SELFBALANCE  0x47  // 合約自身餘額
CHAINID      0x46  // 鏈 ID
```

### 調用與創建

```
CALL        0xF1  // 調用另一個合約
CALLCODE    0xF2  // 調用代碼（已不推薦）
DELEGATECALL 0xF4 // 委託調用
STATICCALL  0xFA  // 靜態調用（不修改狀態）
CREATE      0xF0  // 創建合約
CREATE2     0xF5  // CREATE2 創建合約
```

## Gas 計算模型

每個操作碼都有 Gas 消耗，分為兩類：

- **靜態 Gas**：操作碼本身的固定費用
- **動態 Gas**：取決於操作參數的額外費用

### 常見操作碼的 Gas 消耗

```
ADD/SUB/MUL/DIV    3 Gas    (算術運算)
LT/GT/EQ/ISZERO    3 Gas    (比較運算)
AND/OR/XOR/NOT     3 Gas    (位運算)
PUSH1-PUSH32       3 Gas    (壓棧)
DUP1-DUP16         3 Gas    (複製)
SWAP1-SWAP16       3 Gas    (交換)
MLOAD/MSTORE       3 Gas    (內存讀寫)
SLOAD          2100 Gas    (存儲讀取，冷)
SLOAD (warm)    100 Gas    (存儲讀取，熱)
SSTORE (cold, from zero to non-zero)  22100 Gas
SSTORE (warm)    100 Gas    (存儲寫入，熱)
BALANCE         700 Gas    (冷) / 100 Gas (熱)
CALL          2600 Gas    (冷) / 100 Gas (熱)
CREATE/CREATE2 32000 Gas   (合約創建)
```

### 存儲槽的冷熱模型

EIP-2929 引入了訪問列表（Access List）機制，將存儲槽和地址分為"冷"和"熱"：

- **冷訪問**：交易中首次訪問，Gas 較高
- **熱訪問**：同一交易中已訪問過，Gas 較低

```
// 首次 SLOAD：2100 Gas（冷）
// 後續 SLOAD：100 Gas（熱）
// 首次 SSTORE（0→非0）：22100 Gas
// 後續 SSTORE：100 Gas（熱）
```

這就是為什麼在合約中緩存存儲變量到內存中可以節省 Gas：

```solidity
// Gas 高：多次讀取存儲
function bad() public view returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < array.length; i++) { // 每次 array.length 讀存儲
        sum += array[i];                          // 每次讀存儲
    }
    return sum;
}

// Gas 低：緩存到內存
function good() public view returns (uint256) {
    uint256[] memory arr = array; // 一次性讀取
    uint256 sum = 0;
    for (uint256 i = 0; i < arr.length; i++) {
        sum += arr[i]; // 內存讀取，3 Gas
    }
    return sum;
}
```

## 合約部署：constructor bytecode 與 runtime bytecode

合約部署涉及兩種字節碼：

### Creation Bytecode（部署字節碼）

包含 constructor 代碼 + runtime bytecode。部署時執行 constructor，然後將 runtime bytecode 存儲到鏈上。

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

編譯後的字節碼結構：

```
Creation Bytecode:
┌─────────────────────────────────┐
│  Constructor 代碼               │
│  (執行初始化邏輯)               │
├─────────────────────────────────┤
│  Runtime Bytecode               │
│  (返回給 EVM 存儲的代碼)         │
└─────────────────────────────────┘

部署過程：
1. EVM 執行 Creation Bytecode
2. Constructor 設置初始狀態
3. Constructor 返回 Runtime Bytecode
4. Runtime Bytecode 被存儲到合約地址
```

### Runtime Bytecode（運行時字節碼）

這是鏈上存儲的、實際響應交易的代碼。可以通過 `eth_getCode` 獲取：

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// 獲取鏈上 runtime bytecode
const bytecode = await provider.getCode(contractAddress)
// "0x608060405234801561001057600080fd5b5060..."
```

## 字節碼反編譯工具

### 在線反編譯工具

- **ethervm.io**：可視化展示操作碼，支持主網和測試網
- **dedaub.com**：Decompiler，將字節碼反編譯為可讀的偽代碼
- **etherscan.io**：合約頁面的 "Disassemble" 功能

### 使用 ethers 解析字節碼

```typescript
import { ethers } from 'ethers'

// 解析字節碼為操作碼
function disassemble(bytecode: string): { opcode: string; pc: number }[] {
    // 去除 0x 前綴
    const code = bytecode.startsWith('0x')
        ? bytecode.slice(2)
        : bytecode

    const opcodes: { opcode: string; pc: number }[] = []
    let pc = 0

    while (pc < code.length) {
        const byte = parseInt(code.slice(pc, pc + 2), 16)

        const opcode = OPCODE_MAP[byte] || `UNKNOWN(0x${byte.toString(16)})`
        opcodes.push({ opcode, pc })

        // PUSH1-PUSH32 需要跳過數據
        if (byte >= 0x60 && byte <= 0x7f) {
            const pushSize = byte - 0x5f
            pc += 2 + pushSize * 2
        } else {
            pc += 2
        }
    }

    return opcodes
}

// 常見操作碼映射表
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

## 執行追蹤

`debug_traceTransaction` 是 Geth 的調試 RPC 方法，可以獲取交易的完整執行追蹤：

```typescript
import { ethers } from 'ethers'

// 需要支持 debug_traceTransaction 的節點
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

    // trace.structLogs 是操作碼執行序列
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

### 使用 Trace 進行 Gas 分析

```typescript
function analyzeGasUsage(trace: any) {
    const gasPerOpcode: Record<string, { count: number; gas: number }> = {}

    trace.structLogs.forEach((log: any) => {
        const op = log.op
        if (!gasPerOpcode[op]) {
            gasPerOpcode[op] = { count: 0, gas: 0 }
        }
        gasPerOpcode[op].count++
        // 估算每步 Gas（實際需要更復雜的計算）
    })

    // 按 Gas 消耗排序
    const sorted = Object.entries(gasPerOpcode).sort(
        (a, b) => b[1].count - a[1].count
    )

    console.log('操作碼使用統計:')
    sorted.forEach(([op, data]) => {
        console.log(`  ${op}: ${data.count} 次`)
    })
}
```

## 存儲佈局

Solidity 合約的存儲是 256-bit key → 256-bit value 的映射，共 2^256 個槽位。編譯器按照聲明順序分配存儲槽。

### 存儲槽分配規則

```solidity
contract StorageLayout {
    // Slot 0: state variables 按聲明順序打包
    uint256 public a;           // slot 0（佔用整個槽）
    uint128 public b;           // slot 1（與 c 打包）
    uint128 public c;           // slot 1（與 b 打包）

    // Slot 2: 數組長度存儲在此
    uint256[] public array;     // slot 2 存長度，數據在 keccak256(2) + i

    // Slot 3: mapping 不存儲值，key 通過 keccak256(key . slot) 計算
    mapping(address => uint256) public balances; // slot 3

    // Slot 4: 嵌套 mapping
    mapping(address => mapping(uint256 => uint256)) public nested; // slot 4
}
```

### 前端讀取存儲槽

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// 讀取 slot 0
const slot0 = await provider.getStorageAt(contractAddress, 0)
console.log('Slot 0:', ethers.BigNumber.from(slot0).toString())

// 讀取 mapping 中的值
// balances[user] 存儲在 keccak256(userAddress . slotNumber)
async function getMappingValue(
    contractAddress: string,
    slot: number,
    key: string
) {
    // 計算 key 的存儲位置
    const paddedKey = ethers.utils.hexZeroPad(key, 32)
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const concatenated = paddedKey + paddedSlot.slice(2)
    const hash = ethers.utils.keccak256(concatenated)

    const value = await provider.getStorageAt(contractAddress, hash)
    return ethers.BigNumber.from(value)
}

// 讀取 balances[0xUser...]
const balance = await getMappingValue(
    contractAddress,
    3, // mapping 的 slot
    '0xUserAddress...'
)
```

### 讀取動態數組元素

```typescript
// array[i] 存儲在 keccak256(slot) + i
async function getArrayElement(
    contractAddress: string,
    slot: number,
    index: number
) {
    // 計算數組數據起始位置
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const arrayStart = ethers.utils.keccak256(paddedSlot)

    // 元素位置 = arrayStart + index
    const elementSlot = ethers.BigNumber.from(arrayStart).add(index)
    const value = await provider.getStorageAt(
        contractAddress,
        elementSlot.toHexString()
    )

    return ethers.BigNumber.from(value)
}
```

## 完整的 Solidity → Bytecode → Opcode 分析

```solidity
// 一個最簡單的合約
pragma solidity 0.8.17;

contract Adder {
    function add(uint256 a, uint256 b) external pure returns (uint256) {
        return a + b;
    }
}
```

編譯後的 runtime bytecode（簡化版）：

```
0x6080604052
  // 函數選擇器檢查
  34156100...  // CALLVALUE, ISZERO, ...
  6004351460... // CALLDATALOAD 4字節, EQ, JUMPI

  // add(uint256,uint256) 的函數選擇器: 0x771602f7
  // calldata 佈局: [4字節selector][32字節 a][32字節 b]

  // 讀取參數 a 和 b
  35            // CALLDATALOAD
  6004602410... // offset 4, 加載參數 a
  35            // CALLDATALOAD
  6024602410... // offset 36, 加載參數 b

  // 執行加法
  01            // ADD

  // 返回結果
  602052...    // MSTORE 到內存
  f3            // RETURN
```

對應的操作碼序列：

```
PC    OP             説明
0     PUSH1 0x80     壓入 0x80
2     PUSH1 0x40     壓入 0x40
4     MSTORE         在內存 0x40 處存儲 0x80（空閒內存指針）
5     CALLVALUE      獲取 msg.value
6     DUP1           複製
7     ISZERO         檢查是否為 0
8     PUSH1 0x0f     壓入跳轉目標
10    JUMPI          如果 msg.value == 0，跳轉
...
```

### 函數選擇器

Solidity 使用函數選擇器來路由調用。選擇器是函數簽名的 keccak256 哈希的前 4 字節：

```typescript
import { ethers } from 'ethers'

// 計算函數選擇器
const selector = ethers.utils
    .id('add(uint256,uint256)')
    .slice(0, 10) // 0x + 4字節

console.log(selector) // 0x771602f7

// 從 calldata 中提取選擇器
function parseCalldata(calldata: string) {
    const selector = calldata.slice(0, 10) // 0x + 4字節
    const params = '0x' + calldata.slice(10)

    return {
        selector,
        params,
    }
}
```

## 前端工具：用 ethers 解析 bytecode

```typescript
import { ethers } from 'ethers'

class BytecodeAnalyzer {
    constructor(private bytecode: string) {}

    // 檢查是否是合約（而非 EOA）
    isContract(): boolean {
        return this.bytecode !== '0x' && this.bytecode.length > 2
    }

    // 提取 immutable 變量
    // immutable 變量在字節碼中以 PUSH32 存儲
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
                i += 64 // 跳過 32 字節數據
            }
        }

        return values
    }

    // 檢測代理合約模式
    isProxyContract(): boolean {
        // 代理合約通常在開頭有 DELEGATECALL (0xf4)
        // EIP-1167 最小代理模式
        const minimalProxyPattern =
            '0x3d602d80600a3d3981f3363d3d373d3d3d363d73'
        return this.bytecode.startsWith(minimalProxyPattern)
    }

    // 提取合約接口（通過分析 calldata 路由）
    extractFunctionSelectors(): string[] {
        const selectors: string[] = []
        // 查找 PUSH4 後跟 EQ 的模式
        const code = this.bytecode.slice(2)

        for (let i = 0; i < code.length - 10; i += 2) {
            const byte = parseInt(code.slice(i, i + 2), 16)

            // PUSH4 (0x63)
            if (byte === 0x63) {
                const selector = '0x' + code.slice(i + 2, i + 10)
                // 檢查後面是否有 EQ (0x14)
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

## 理解 EVM 對 DApp 開發的實際價值

### Gas 優化

理解 EVM 操作碼的 Gas 消耗可以幫助編寫更高效的合約：

```solidity
// Gas 優化示例：減少存儲寫入
contract GasOptimized {
    mapping(address => uint256) public balances;

    // 優化前：2 次存儲寫入
    function update_bad(address user, uint256 amount) external {
        balances[user] = 0;        // SSTORE (0→0, 100 Gas if warm)
        balances[user] = amount;   // SSTORE (0→nonzero, 22100 Gas)
    }

    // 優化後：1 次存儲寫入
    function update_good(address user, uint256 amount) external {
        balances[user] = amount;   // SSTORE (一次寫入)
    }
}
```

### 安全審計

理解存儲佈局對於安全審計至關重要。許多漏洞源於對存儲打包的誤解：

```solidity
// 漏洞示例：存儲碰撞
contract Vulnerable {
    address public owner;      // slot 0, 20 字節
    bool public locked;        // slot 0, 與 owner 打包（1 字節）
    uint256 public funds;      // slot 1

    // 攻擊者可能通過特定方式覆蓋 locked
    // 如果合約有 delegatecall 到惡意合約
}
```

### 調試

當合約交易失敗時，理解字節碼可以幫助定位問題：

```typescript
async function debugFailedTransaction(
    txHash: string,
    provider: ethers.providers.Provider
) {
    const tx = await provider.getTransaction(txHash)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (receipt.status === 0) {
        // 交易失敗，嘗試 replay
        try {
            await provider.call({
                to: tx.to,
                data: tx.data,
                from: tx.from,
                value: tx.value,
            }, tx.blockNumber)
        } catch (error) {
            // 解析 revert 原因
            const revertReason = ethers.utils.toUtf8String(
                '0x' + error.data.slice(138)
            )
            console.log('Revert reason:', revertReason)
        }
    }
}
```

## 小結

EVM 字節碼分析是 Web3 開發中的深度技能。雖然日常開發中不需要手寫字節碼，但理解操作碼、Gas 模型和存儲佈局對三個方面有直接價值：

**Gas 優化**是立竿見影的收益。知道 SLOAD 是 2100 Gas 而 MLOAD 是 3 Gas，就會本能地把循環中的存儲讀取緩存到內存。知道存儲打包規則，就會合理安排變量聲明順序以減少槽位使用。

**安全審計**需要理解存儲佈局。代理合約的 delegatecall 會複用調用者的存儲，如果佈局不一致就會導致存儲碰撞。理解 slot 分配規則才能設計安全的代理模式。

**調試能力**是最後的保障。當交易失敗且沒有 revert 原因時，通過 debug_traceTransaction 追蹤操作碼執行是定位問題的最後一招。前端開發者雖然不常做字節碼級調試，但知道這個工具的存在和基本用法，在關鍵時刻能節省大量排查時間。

隨着 EVM 的持續演進（EIP-3540 EOF、EIP-3074 等提案），字節碼結構本身也在變化。保持對 EVM 規範的關注，是 Web3 開發者的長期必修課。
