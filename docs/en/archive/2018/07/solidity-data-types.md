---
title: "Solidity Data Types and Storage Models In Depth"
date: 2018-07-15 10:43:47
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 7
wordCount: 1039
description: "Solidity's data type system may superficially resemble a hybrid of JavaScript and C++, but its storage model is fundamentally different from both. Every state w"
---

Solidity's data type system may superficially resemble a hybrid of JavaScript and C++, but its storage model is fundamentally different from both. Every state write in a smart contract consumes gas, and gas consumption directly depends on how data is laid out in storage. Understanding Solidity's data types and storage model is not only a prerequisite for writing correct contracts, but also the key to writing economical ones.

## Value Types

Value types create copies when assigned or passed as parameters—modifying the copy does not affect the original value:

### bool

```solidity
bool public flag = true;
```

`bool` occupies only 1 byte (and is packed in storage). Note that Solidity does not have implicit type conversion—`bool` cannot be mixed with `uint`:

```solidity
// 错误
if (1) { ... }

// 正确
if (true) { ... }
```

### uint / int

```solidity
uint256 public bigNumber = 1 ether;     // uint256 是 uint 的别名
uint8 public smallNumber = 255;         // 最大 255
int256 public signedNumber = -100;
```

Solidity provides unsigned integer types ranging from `uint8` to `uint256` (in steps of 8). Choosing a narrower type can save storage space—but only when several small integer types can be packed into the same slot.

### address

```solidity
address public owner = msg.sender;
// address payable（Solidity 0.5+）允许调用 .transfer() 和 .send()
address payable public treasury = msg.sender;
```

`address` occupies 20 bytes and stores an Ethereum address. `address payable` is a distinction introduced in 0.5.0—only `payable` addresses can receive Ether and call transfer methods.

### bytes

Solidity has fixed-size byte arrays `bytes1` through `bytes32` and dynamic byte arrays `bytes`:

```solidity
bytes32 public hash = keccak256(abi.encodePacked("hello"));
bytes1 public firstByte = 0x41;
bytes public dynamicBytes = "hello";
```

### enum

```solidity
enum State { Created, Active, Inactive, Closed }
State public currentState = State.Created;
```

`enum` is essentially syntactic sugar for `uint8`, incrementing from 0.

## Reference Types

Reference types pass references rather than copies when assigned or passed as parameters. Solidity's reference types include: string, array, struct, and mapping.

### string

```solidity
string public name = "Hello";
// string 是动态字节数组，不能直接访问 length 或索引
// 需要转换为 bytes
function getNameLength() public view returns (uint) {
    return bytes(name).length;
}
```

### array

```solidity
// 定长数组
uint[5] public fixedArray = [1, 2, 3, 4, 5];

// 动态数组
uint[] public dynamicArray;

function pushItem(uint item) public {
    dynamicArray.push(item);
}

function getItem(uint index) public view returns (uint) {
    return dynamicArray[index];
}
```

### struct

```solidity
struct User {
    address addr;
    uint balance;
    bool isActive;
    string name;
}

mapping(address => User) public users;

function createUser(string memory _name) public {
    users[msg.sender] = User({
        addr: msg.sender,
        balance: 0,
        isActive: true,
        name: _name
    });
}
```

### mapping

```solidity
mapping(address => uint) public balances;
mapping(address => mapping(address => uint)) public allowances;

function deposit() public payable {
    balances[msg.sender] += msg.value;
}

function getBalance(address account) public view returns (uint) {
    return balances[account];
}
```

`mapping` is the most commonly used data structure in Solidity, similar to a hash table but does not support iteration.

## Data Locations: storage, memory, calldata

Data location is a concept unique to Solidity and one of its most error-prone features:

### storage

`storage` refers to permanent on-chain storage. State variables are stored in `storage` by default:

```solidity
contract StorageExample {
    uint[] public data; // 状态变量，storage

    function addToStorage(uint item) public {
        data.push(item); // 直接修改 storage
    }
}
```

### memory

`memory` is temporary memory space that is destroyed after the function call ends. Reference type parameters in functions default to `memory`:

```solidity
function processArray(uint[] memory arr) public pure returns (uint) {
    uint sum = 0;
    for (uint i = 0; i < arr.length; i++) {
        sum += arr[i];
    }
    return sum;
}
```

### calldata

`calldata` is a read-only region for function arguments, similar to `memory` but more gas-efficient:

```solidity
function externalFunc(uint[] calldata arr) external pure returns (uint) {
    return arr[0]; // 只能读取，不能修改
}
```

### Comparison of the Three

| Feature | storage | memory | calldata |
|---------|---------|--------|----------|
| Persistence | Permanent | During function call | During function call |
| Modifiable | Yes | Yes | No |
| Gas cost | Highest | Medium | Lowest |
| Use case | State variables | Internal computation | External function parameters |

### Reference Pitfalls

```solidity
function dangerousLoop() public {
    uint[] storage s = data; // s 是 data 的引用
    s.push(999); // 这会修改状态变量 data！
}

function safeCopy() public {
    uint[] memory m = new uint[](0);
    m.push(1); // 仅修改 memory 副本，不影响 storage
}
```

## Storage Layout Rules for State Variables

EVM storage consists of 2^256 32-byte slots, all initially zero. The Solidity compiler lays out state variables according to the following rules:

1. **Sequential arrangement**: State variables are arranged starting from slot 0 in declaration order
2. **Packing optimization**: If the combined size of multiple variables is ≤ 32 bytes, they are packed into the same slot
3. **Dynamic types occupy independent slots**: Dynamic arrays, mappings, strings, and other dynamic types each occupy a single slot—this slot stores not the data itself, but a reference to where the data is located

```solidity
contract LayoutExample {
    uint8 public a;        // slot 0, offset 0 (1 byte)
    uint8 public b;        // slot 0, offset 1 (1 byte)
    uint16 public c;       // slot 0, offset 2 (2 bytes)
    address public d;      // slot 0, offset 4 (20 bytes)
                           // slot 0 总计 24 字节，还有 8 字节剩余

    uint256 public e;      // slot 1 (32 bytes，无法打包进 slot 0)

    uint8 public f;        // slot 2, offset 0 (1 byte，新槽位因为 slot 0 空间不足)

    uint[] public arr;     // slot 3，存储数组长度，数据在 keccak256(3) 处
    mapping(address => uint) public map; // slot 4，数据在 keccak256(key . 4) 处
}
```

Once you understand the layout rules, you can save gas by optimizing declaration order:

```solidity
// 不优化的布局 —— 占用 3 个槽位
contract Unoptimized {
    uint64 public a;    // slot 0 (8 bytes)
    uint256 public b;   // slot 1 (32 bytes，无法打包)
    uint64 public c;    // slot 2 (8 bytes)
}
// 总共 3 个槽位，3 * 20000 = 60000 Gas（SSTORE）

// 优化的布局 —— 占用 2 个槽位
contract Optimized {
    uint64 public a;    // slot 0, offset 0
    uint64 public c;    // slot 0, offset 8
    uint256 public b;   // slot 1
}
// 总共 2 个槽位，2 * 20000 = 40000 Gas
```

## How Mappings Are Stored

A mapping does not store an array of key-value pairs like a traditional hash table. Its storage location is computed via a keccak256 hash:

```
value_slot = keccak256(key . mapping_slot)
```

```solidity
contract MappingStorage {
    mapping(address => uint) public balances; // slot 0
    mapping(uint => address) public users;    // slot 1
}
```

For `balances[0xAlice]`, the storage location is:

```
keccak256(bytes32(0xAlice) . bytes32(0))
```

For nested mappings `mapping(address => mapping(address => uint))`:

```
inner_slot = keccak256(key1 . outer_mapping_slot)
value_slot = keccak256(key2 . inner_slot)
```

This means:

1. **Mappings cannot be iterated**: There is no direct way to retrieve all keys
2. **Mappings cannot be cleared**: You can only delete keys one by one
3. **Non-existent keys return zero values**: `balances[address(0)]` returns 0

If you need to iterate over a mapping, you must maintain a separate key list:

```solidity
contract IterableMapping {
    mapping(address => uint) public values;
    address[] public keys;
    mapping(address => bool) public inserted;

    function set(address key, uint value) public {
        values[key] = value;
        if (!inserted[key]) {
            keys.push(key);
            inserted[key] = true;
        }
    }

    function remove(address key) public {
        delete values[key];
        delete inserted[key];
        // 注意：从数组中删除需要额外逻辑
    }

    function size() public view returns (uint) {
        return keys.length;
    }
}
```

## Storage Differences Between Dynamic and Fixed-Size Arrays

### Fixed-Size Arrays

Fixed-size arrays occupy consecutive slots in storage in declaration order:

```solidity
contract FixedArray {
    uint[3] public arr; // 占用 slot 0, 1, 2 三个槽位
    // 即使每个元素只需要 1 字节，也各占 32 字节（定长数组不打包）
}
```

Note: fixed-size arrays in storage are **not** packed—each element occupies its own slot. (An element under 32 bytes may still be packed with *other* adjacent variables, but array elements are never packed with one another.)

### Dynamic Arrays

Dynamic arrays store their length in the slot, with actual data stored at consecutive locations starting from `keccak256(slot)`:

```solidity
contract DynamicArray {
    uint[] public arr; // slot 0 存储长度
    // arr[0] 存储在 keccak256(0) 处
    // arr[1] 存储在 keccak256(0) + 1 处
    // arr[i] 存储在 keccak256(0) + i 处
}
```

Computing the storage location of `arr[i]`:

```javascript
// 用 JavaScript 模拟
const ethUtil = require('ethereumjs-util');

function arraySlot(slot, index) {
    const slotHash = ethUtil.keccak256(ethUtil.setLengthLeft(slot, 32));
    return ethUtil.bufferToHex(BigNumber.from(slotHash).add(index).toHexString());
}
```

This is why random access in dynamic arrays has higher gas consumption—a keccak256 hash must be computed to determine the storage location.

## bytes32 vs string: Making the Right Choice

`bytes32` and `string` can be used interchangeably in some scenarios, but their storage models are completely different:

```solidity
contract BytesVsString {
    bytes32 public fixedData = "hello"; // 占用 1 个槽位（32 字节）
    string public dynamicData = "hello"; // 占用 1 个槽位存储长度+指针，数据在别处
}
```

| Feature | bytes32 | string |
|---------|---------|--------|
| Max length | 32 bytes | Unlimited |
| Storage | 1 slot | Length slot + data slot(s) |
| Gas (write) | 20,000 | 20,000 + data slot(s) |
| Access | Direct read | Requires decoding |
| Use case | Fixed-length hashes, short identifiers | Variable-length text |

Rule of thumb: if the data length is ≤ 32 bytes and fixed, use `bytes32`; if variable-length text is needed, use `string`.

## Gas Consumption Comparison

Here is a contract demonstrating gas consumption for different types:

```solidity
pragma solidity ^0.4.24;

contract GasComparison {
    // 方案 A：未优化的变量声明（3 个槽位）
    uint64 public a1;
    uint128 public b1;
    uint64 public c1;
    // 3 * 20000 = 60000 gas（首次写入每个槽位）

    // 方案 B：优化的变量声明（1 个槽位）
    uint64 public a2;
    uint64 public b2;
    uint128 public c2;
    // 1 * 20000 = 20000 gas

    // 方案 C：使用 mapping
    mapping(uint => uint) public map;
    // 每个键值对写入：20000 gas（每个 key 独立槽位）

    // 方案 D：使用动态数组
    uint[] public arr;
    // push 操作：20000 gas（首次写入新槽位）
    // 后续写入已存在的槽位：5000 gas
}
```

## Best Practices and Common Pitfalls

### 1. Arrange State Variables Sensibly

Declare small-type variables together to leverage packing and reduce slot usage:

```solidity
// 推荐
contract Good {
    address public owner;       // 20 bytes
    uint8 public status;        // 1 byte
    uint8 public version;       // 1 byte
    bool public paused;         // 1 byte
    // slot 0: 共 23 字节，打包在一个槽位

    uint256 public totalSupply; // slot 1
}
```

### 2. Avoid Packing in Memory

Variables in memory are not packed—each element occupies its own slot:

```solidity
// memory 中 struct 不会打包
function test() public pure {
    MyStruct memory s;
    // s.a 和 s.b 各占 32 字节，即使它们是 uint8
}
```

### 3. Mapping Iteration

If iteration is needed, use the key array + mapping pattern, but be mindful of the complexity of delete operations.

### 4. The delete Operation

`delete` resets a variable to its default (zero) value. For storage variables, it refunds some gas:

```solidity
function clearData(uint index) public {
    delete arr[index]; // 退还 15000 gas（SSTORE 零值）
}
```

### 5. Implicit Behavior of storage References

```solidity
struct User {
    uint[] scores;
}

mapping(address => User) users;

function addScore(uint score) public {
    // users[msg.sender].scores 是 storage 引用
    users[msg.sender].scores.push(score); // 直接修改 storage
}
```

## Summary

Solidity's data type and storage model design is driven by two core factors: the EVM's 32-byte slot architecture and gas economics. Understanding storage layout rules is not only a means to optimize gas but also the foundation for troubleshooting contract bugs—many contract vulnerabilities (such as storage collisions and initialization overwrites) are related to storage layout.

From a language design perspective, Solidity's data location concept (storage/memory/calldata) is unique. It requires developers to consider data lifecycle with every variable declaration, which increases cognitive load but also provides fine-grained control over gas consumption.

The Solidity 0.4.x type system had several deficiencies: no distinction between `address` and `address payable`, unclear default rules for `memory`/`calldata`, and a lack of bounds checking for array operations. Later versions addressed these gaps, but the core design of the underlying storage model is part of the EVM specification and therefore stable.

For engineers transitioning from traditional frontend development to smart contract development, the biggest mindset shift is this: data storage is no longer "free"—every state write has a real economic cost. This constraint forces developers to rethink data structure design—in Solidity, good data layout is itself the best optimization.
