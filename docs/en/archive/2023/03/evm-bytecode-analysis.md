---
title: "EVM Bytecode Analysis: Understanding the Smart Contract Execution Model"
date: 2023-03-29 20:04:02
tags:
  - Web3
  - Ethereum
  - Smart Contract
readingTime: 9
description: "Smart contracts ultimately run as EVM bytecode. Understanding bytecode and opcodes is essential for gas optimization, security auditing, and debugging. This article systematically breaks down the contract execution model from EVM architecture to bytecode decompilation."
wordCount: 705
---

Before Solidity code is deployed to Ethereum, it is compiled into EVM bytecode. What runs on-chain is not Solidity source code, but this bytecode. Understanding bytecode and the EVM execution model is crucial for gas optimization, security auditing, contract debugging, and frontend interactions. This article starts from EVM architecture and progressively breaks down the complete pipeline from Solidity to bytecode to opcodes.

## EVM Architecture Overview

The Ethereum Virtual Machine (EVM) is a stack-based virtual machine with the following core characteristics:

- **Stack depth**: 1024 slots, each 256-bit (32 bytes)
- **Word size**: 256-bit (32 bytes), all computations operate on 256-bit integers
- **Storage**: Each contract has independent persistent storage, 256-bit key → 256-bit value
- **Memory**: Temporary memory, destroyed after transaction execution, byte-addressable
- **Gas**: Each opcode has a fixed gas cost, preventing infinite loops

### EVM's Computation Model

```
        ┌──────────────────────────────┐
        │           Calldata           │ ← Input data (read-only)
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Stack              │ ← 1024 × 256-bit
        │     (LIFO, max depth 16)     │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │           Memory             │ ← Temporary read-write
        │     (byte-addressable)       │
        └──────────────┬───────────────┘
                       │
        ┌──────────────▼───────────────┐
        │         Storage              │ ← Persistent
        │  (256-bit key → 256-bit val) │
        └──────────────────────────────┘
```

The EVM is not Turing-complete—its "Turing completeness" is achieved through jump instructions for finite looping. The gas mechanism guarantees that computation will eventually terminate.

## Opcode Categories and Functions

The EVM has approximately 140 opcodes, divided into the following categories:

### Arithmetic Operations

```
ADD     0x01  // Add top two stack elements
SUB     0x03  // Subtraction
MUL     0x02  // Multiplication
DIV     0x04  // Division
MOD     0x06  // Modulo
ADDMOD  0x08  // Modular addition
MULMOD  0x09  // Modular multiplication
EXP     0x0A  // Exponentiation
SIGNEXTEND 0x0B // Sign extension
```

### Comparison and Bitwise Operations

```
LT      0x10  // Less than
GT      0x11  // Greater than
EQ      0x14  // Equal
ISZERO  0x15  // Is zero
AND     0x16  // Bitwise AND
OR      0x17  // Bitwise OR
XOR     0x18  // Bitwise XOR
NOT     0x19  // Bitwise NOT
SHL     0x1B  // Shift left
SHR     0x1C  // Shift right
```

### Stack Operations

```
POP         0x50  // Pop top of stack
PUSH0       0x5F  // Push 0 (EIP-3855, Shanghai upgrade)
PUSH1-PUSH32 0x60-0x7F // Push 1-32 bytes
DUP1-DUP16  0x80-0x8F // Duplicate stack element
SWAP1-SWAP16 0x90-0x9F // Swap stack elements
```

### Memory and Storage

```
MLOAD   0x51  // Read 32 bytes from memory
MSTORE  0x52  // Write 32 bytes to memory
MSTORE8 0x53  // Write 1 byte to memory
SLOAD   0x54  // Read from storage
SSTORE  0x55  // Write to storage
```

### Control Flow

```
JUMP    0x56  // Unconditional jump
JUMPI   0x57  // Conditional jump
PC      0x58  // Get current program counter
MSIZE   0x59  // Get memory size
GAS     0x5A  // Get remaining gas
JUMPDEST 0x5B // Jump destination marker
```

### Environment Information

```
ADDRESS      0x30  // Current contract address
BALANCE      0x31  // Address balance
CALLER       0x33  // Caller address (msg.sender)
CALLVALUE    0x34  // Sent ETH (msg.value)
CALLDATALOAD 0x35  // Read from calldata
CALLDATASIZE 0x36  // Calldata length
CALLDATACOPY 0x37  // Copy calldata to memory
CODESIZE     0x38  // Code size
CODECOPY     0x39  // Copy code to memory
SELFBALANCE  0x47  // Contract's own balance
CHAINID      0x46  // Chain ID
```

### Call and Create

```
CALL        0xF1  // Call another contract
CALLCODE    0xF2  // Call code (deprecated)
DELEGATECALL 0xF4 // Delegate call
STATICCALL  0xFA  // Static call (no state modification)
CREATE      0xF0  // Create contract
CREATE2     0xF5  // CREATE2 contract creation
```

## Gas Calculation Model

Each opcode has a gas cost, divided into two categories:

- **Static gas**: The fixed cost of the opcode itself
- **Dynamic gas**: Additional costs depending on operation parameters

### Gas Costs of Common Opcodes

```
ADD/SUB/MUL/DIV    3 Gas    (arithmetic operations)
LT/GT/EQ/ISZERO    3 Gas    (comparison operations)
AND/OR/XOR/NOT     3 Gas    (bitwise operations)
PUSH1-PUSH32       3 Gas    (push to stack)
DUP1-DUP16         3 Gas    (duplicate)
SWAP1-SWAP16       3 Gas    (swap)
MLOAD/MSTORE       3 Gas    (memory read/write)
SLOAD          2100 Gas    (storage read, cold)
SLOAD (warm)    100 Gas    (storage read, warm)
SSTORE (cold, from zero to non-zero)  22100 Gas
SSTORE (warm)    100 Gas    (storage write, warm)
BALANCE         700 Gas    (cold) / 100 Gas (warm)
CALL          2600 Gas    (cold) / 100 Gas (warm)
CREATE/CREATE2 32000 Gas   (contract creation)
```

### Storage Slot Cold/Warm Model

EIP-2929 introduced the Access List mechanism, classifying storage slots and addresses as "cold" and "warm":

- **Cold access**: First access in a transaction, higher gas
- **Warm access**: Already accessed in the same transaction, lower gas

```
// First SLOAD: 2100 Gas (cold)
// Subsequent SLOAD: 100 Gas (warm)
// First SSTORE (0→non-0): 22100 Gas
// Subsequent SSTORE: 100 Gas (warm)
```

This is why caching storage variables to memory in contracts can save gas:

```solidity
// High gas: multiple storage reads
function bad() public view returns (uint256) {
    uint256 sum = 0;
    for (uint256 i = 0; i < array.length; i++) { // array.length reads storage each time
        sum += array[i];                          // reads storage each time
    }
    return sum;
}

// Low gas: cache to memory
function good() public view returns (uint256) {
    uint256[] memory arr = array; // read once
    uint256 sum = 0;
    for (uint256 i = 0; i < arr.length; i++) {
        sum += arr[i]; // memory read, 3 Gas
    }
    return sum;
}
```

## Contract Deployment: Creation Bytecode vs Runtime Bytecode

Contract deployment involves two types of bytecode:

### Creation Bytecode

Contains constructor code + runtime bytecode. During deployment, the constructor executes, then the runtime bytecode is stored on-chain.

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

Compiled bytecode structure:

```
Creation Bytecode:
┌─────────────────────────────────┐
│  Constructor code              │
│  (executes initialization logic)│
├─────────────────────────────────┤
│  Runtime Bytecode               │
│  (code returned to EVM for storage)│
└─────────────────────────────────┘

Deployment process:
1. EVM executes Creation Bytecode
2. Constructor sets initial state
3. Constructor returns Runtime Bytecode
4. Runtime Bytecode is stored at the contract address
```

### Runtime Bytecode

This is the code stored on-chain that actually responds to transactions. It can be retrieved via `eth_getCode`:

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// Get on-chain runtime bytecode
const bytecode = await provider.getCode(contractAddress)
// "0x608060405234801561001057600080fd5b5060..."
```

## Bytecode Decompilation Tools

### Online Decompilation Tools

- **ethervm.io**: Visualizes opcodes, supports mainnet and testnet
- **dedaub.com**: Decompiler, converts bytecode into readable pseudocode
- **etherscan.io**: "Disassemble" feature on contract pages

### Parsing Bytecode with ethers

```typescript
import { ethers } from 'ethers'

// Parse bytecode into opcodes
function disassemble(bytecode: string): { opcode: string; pc: number }[] {
    // Remove 0x prefix
    const code = bytecode.startsWith('0x')
        ? bytecode.slice(2)
        : bytecode

    const opcodes: { opcode: string; pc: number }[] = []
    let pc = 0

    while (pc < code.length) {
        const byte = parseInt(code.slice(pc, pc + 2), 16)

        const opcode = OPCODE_MAP[byte] || `UNKNOWN(0x${byte.toString(16)})`
        opcodes.push({ opcode, pc })

        // PUSH1-PUSH32 need to skip data
        if (byte >= 0x60 && byte <= 0x7f) {
            const pushSize = byte - 0x5f
            pc += 2 + pushSize * 2
        } else {
            pc += 2
        }
    }

    return opcodes
}

// Common opcode mapping table
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

// Usage
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const bytecode = await provider.getCode('0x...')
const opcodes = disassemble(bytecode)
opcodes.forEach((op) => console.log(`${op.pc}: ${op.opcode}`))
```

## Execution Tracing

`debug_traceTransaction` is Geth's debugging RPC method that can retrieve the complete execution trace of a transaction:

```typescript
import { ethers } from 'ethers'

// Requires a node that supports debug_traceTransaction
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

    // trace.structLogs is the opcode execution sequence
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

### Using Trace for Gas Analysis

```typescript
function analyzeGasUsage(trace: any) {
    const gasPerOpcode: Record<string, { count: number; gas: number }> = {}

    trace.structLogs.forEach((log: any) => {
        const op = log.op
        if (!gasPerOpcode[op]) {
            gasPerOpcode[op] = { count: 0, gas: 0 }
        }
        gasPerOpcode[op].count++
        // Estimate gas per step (actual calculation is more complex)
    })

    // Sort by gas consumption
    const sorted = Object.entries(gasPerOpcode).sort(
        (a, b) => b[1].count - a[1].count
    )

    console.log('Opcode usage statistics:')
    sorted.forEach(([op, data]) => {
        console.log(`  ${op}: ${data.count} times`)
    })
}
```

## Storage Layout

A Solidity contract's storage is a 256-bit key → 256-bit value mapping with 2^256 slots. The compiler allocates storage slots in declaration order.

### Storage Slot Allocation Rules

```solidity
contract StorageLayout {
    // Slot 0: state variables packed in declaration order
    uint256 public a;           // slot 0 (occupies entire slot)
    uint128 public b;           // slot 1 (packed with c)
    uint128 public c;           // slot 1 (packed with b)

    // Slot 2: array length stored here
    uint256[] public array;     // slot 2 stores length, data at keccak256(2) + i

    // Slot 3: mapping doesn't store values, key computed via keccak256(key . slot)
    mapping(address => uint256) public balances; // slot 3

    // Slot 4: nested mapping
    mapping(address => mapping(uint256 => uint256)) public nested; // slot 4
}
```

### Reading Storage Slots from the Frontend

```typescript
import { ethers } from 'ethers'

const provider = new ethers.providers.JsonRpcProvider(RPC_URL)

// Read slot 0
const slot0 = await provider.getStorageAt(contractAddress, 0)
console.log('Slot 0:', ethers.BigNumber.from(slot0).toString())

// Read mapping value
// balances[user] is stored at keccak256(userAddress . slotNumber)
async function getMappingValue(
    contractAddress: string,
    slot: number,
    key: string
) {
    // Compute the key's storage position
    const paddedKey = ethers.utils.hexZeroPad(key, 32)
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const concatenated = paddedKey + paddedSlot.slice(2)
    const hash = ethers.utils.keccak256(concatenated)

    const value = await provider.getStorageAt(contractAddress, hash)
    return ethers.BigNumber.from(value)
}

// Read balances[0xUser...]
const balance = await getMappingValue(
    contractAddress,
    3, // mapping's slot
    '0xUserAddress...'
)
```

### Reading Dynamic Array Elements

```typescript
// array[i] is stored at keccak256(slot) + i
async function getArrayElement(
    contractAddress: string,
    slot: number,
    index: number
) {
    // Compute array data start position
    const paddedSlot = ethers.utils.hexZeroPad(slot, 32)
    const arrayStart = ethers.utils.keccak256(paddedSlot)

    // Element position = arrayStart + index
    const elementSlot = ethers.BigNumber.from(arrayStart).add(index)
    const value = await provider.getStorageAt(
        contractAddress,
        elementSlot.toHexString()
    )

    return ethers.BigNumber.from(value)
}
```

## Complete Solidity → Bytecode → Opcode Analysis

```solidity
// A minimal contract
pragma solidity 0.8.17;

contract Adder {
    function add(uint256 a, uint256 b) external pure returns (uint256) {
        return a + b;
    }
}
```

Compiled runtime bytecode (simplified):

```
0x6080604052
  // Function selector check
  34156100...  // CALLVALUE, ISZERO, ...
  6004351460... // CALLDATALOAD 4 bytes, EQ, JUMPI

  // add(uint256,uint256) function selector: 0x771602f7
  // calldata layout: [4 bytes selector][32 bytes a][32 bytes b]

  // Read parameters a and b
  35            // CALLDATALOAD
  6004602410... // offset 4, load parameter a
  35            // CALLDATALOAD
  6024602410... // offset 36, load parameter b

  // Execute addition
  01            // ADD

  // Return result
  602052...    // MSTORE to memory
  f3            // RETURN
```

Corresponding opcode sequence:

```
PC    OP             Description
0     PUSH1 0x80     Push 0x80
2     PUSH1 0x40     Push 0x40
4     MSTORE         Store 0x80 at memory 0x40 (free memory pointer)
5     CALLVALUE      Get msg.value
6     DUP1           Duplicate
7     ISZERO         Check if zero
8     PUSH1 0x0f     Push jump target
10    JUMPI          Jump if msg.value == 0
...
```

### Function Selectors

Solidity uses function selectors to route calls. The selector is the first 4 bytes of the keccak256 hash of the function signature:

```typescript
import { ethers } from 'ethers'

// Compute function selector
const selector = ethers.utils
    .id('add(uint256,uint256)')
    .slice(0, 10) // 0x + 4 bytes

console.log(selector) // 0x771602f7

// Extract selector from calldata
function parseCalldata(calldata: string) {
    const selector = calldata.slice(0, 10) // 0x + 4 bytes
    const params = '0x' + calldata.slice(10)

    return {
        selector,
        params,
    }
}
```

## Frontend Tool: Parsing Bytecode with ethers

```typescript
import { ethers } from 'ethers'

class BytecodeAnalyzer {
    constructor(private bytecode: string) {}

    // Check if it's a contract (not an EOA)
    isContract(): boolean {
        return this.bytecode !== '0x' && this.bytecode.length > 2
    }

    // Extract immutable variables
    // Immutable variables are stored as PUSH32 in bytecode
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
                i += 64 // Skip 32 bytes of data
            }
        }

        return values
    }

    // Detect proxy contract pattern
    isProxyContract(): boolean {
        // Proxy contracts typically have DELEGATECALL (0xf4) at the beginning
        // EIP-1167 minimal proxy pattern
        const minimalProxyPattern =
            '0x3d602d80600a3d3981f3363d3d373d3d3d363d73'
        return this.bytecode.startsWith(minimalProxyPattern)
    }

    // Extract contract interface (by analyzing calldata routing)
    extractFunctionSelectors(): string[] {
        const selectors: string[] = []
        // Look for PUSH4 followed by EQ pattern
        const code = this.bytecode.slice(2)

        for (let i = 0; i < code.length - 10; i += 2) {
            const byte = parseInt(code.slice(i, i + 2), 16)

            // PUSH4 (0x63)
            if (byte === 0x63) {
                const selector = '0x' + code.slice(i + 2, i + 10)
                // Check if followed by EQ (0x14)
                const nextByte = parseInt(code.slice(i + 10, i + 12), 16)
                if (nextByte === 0x14) {
                    selectors.push(selector)
                }
            }
        }

        return [...new Set(selectors)]
    }
}

// Usage
const provider = new ethers.providers.JsonRpcProvider(RPC_URL)
const bytecode = await provider.getCode(contractAddress)
const analyzer = new BytecodeAnalyzer(bytecode)

console.log('Is contract:', analyzer.isContract())
console.log('Is proxy:', analyzer.isProxyContract())
console.log('Function selectors:', analyzer.extractFunctionSelectors())
```

## Practical Value of Understanding EVM for DApp Development

### Gas Optimization

Understanding EVM opcode gas costs helps write more efficient contracts:

```solidity
// Gas optimization example: reducing storage writes
contract GasOptimized {
    mapping(address => uint256) public balances;

    // Before optimization: 2 storage writes
    function update_bad(address user, uint256 amount) external {
        balances[user] = 0;        // SSTORE (0→0, 100 Gas if warm)
        balances[user] = amount;   // SSTORE (0→nonzero, 22100 Gas)
    }

    // After optimization: 1 storage write
    function update_good(address user, uint256 amount) external {
        balances[user] = amount;   // SSTORE (one write)
    }
}
```

### Security Auditing

Understanding storage layout is critical for security auditing. Many vulnerabilities stem from misunderstandings about storage packing:

```solidity
// Vulnerability example: storage collision
contract Vulnerable {
    address public owner;      // slot 0, 20 bytes
    bool public locked;        // slot 0, packed with owner (1 byte)
    uint256 public funds;      // slot 1

    // An attacker might overwrite locked through specific means
    // if the contract has delegatecall to a malicious contract
}
```

### Debugging

When a contract transaction fails, understanding bytecode can help locate the issue:

```typescript
async function debugFailedTransaction(
    txHash: string,
    provider: ethers.providers.Provider
) {
    const tx = await provider.getTransaction(txHash)
    const receipt = await provider.getTransactionReceipt(txHash)

    if (receipt.status === 0) {
        // Transaction failed, try replay
        try {
            await provider.call({
                to: tx.to,
                data: tx.data,
                from: tx.from,
                value: tx.value,
            }, tx.blockNumber)
        } catch (error) {
            // Parse revert reason
            const revertReason = ethers.utils.toUtf8String(
                '0x' + error.data.slice(138)
            )
            console.log('Revert reason:', revertReason)
        }
    }
}
```

## Summary

EVM bytecode analysis is a deep skill in Web3 development. While you don't need to handwrite bytecode in daily development, understanding opcodes, the gas model, and storage layout has direct value in three areas:

**Gas optimization** provides immediate returns. Knowing that SLOAD costs 2100 Gas while MLOAD costs 3 Gas, you'll instinctively cache storage reads in loops to memory. Knowing storage packing rules, you'll arrange variable declaration order to reduce slot usage.

**Security auditing** requires understanding storage layout. Proxy contract delegatecalls reuse the caller's storage—if layouts are inconsistent, storage collision occurs. Understanding slot allocation rules is essential for designing safe proxy patterns.

**Debugging capability** is the last line of defense. When a transaction fails with no revert reason, tracing opcode execution via `debug_traceTransaction` is the ultimate tool for locating the issue. While frontend developers don't often do bytecode-level debugging, knowing this tool exists and its basic usage can save significant troubleshooting time at critical moments.

As the EVM continues to evolve (EIP-3540 EOF, EIP-3074 and other proposals), the bytecode structure itself is changing. Keeping abreast of EVM specifications is a long-termrequired course for Web3 developers.
