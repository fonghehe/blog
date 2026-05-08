---
title: "Solidity 数据类型与存储模型详解"
date: 2018-07-15 10:43:47
tags:
  - Web3
  - Solidity
  - Smart Contract
---

Solidity 的数据类型系统表面上看起来像 JavaScript 和 C++ 的混合体，但其存储模型却与两者截然不同。智能合约的每次状态写入都需要消耗 Gas，而 Gas 消耗直接取决于数据在 storage 中的布局方式。理解 Solidity 的数据类型与存储模型，不仅是写出正确合约的前提，更是写出经济合约的关键。

## 值类型

值类型在赋值或传参时会创建副本，修改副本不影响原值：

### bool

```solidity
bool public flag = true;
```

`bool` 只占 1 字节（在 storage 中会被打包）。注意 Solidity 中没有隐式类型转换，`bool` 不能与 `uint` 混用：

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

Solidity 提供从 `uint8` 到 `uint256`（步长 8）的无符号整数类型。选择合适的大小可以节省 storage 空间——但仅在多个小类型变量可以打包到同一槽位时才有意义。

### address

```solidity
address public owner = msg.sender;
// address payable（Solidity 0.5+）允许调用 .transfer() 和 .send()
address payable public treasury = msg.sender;
```

`address` 占 20 字节，存储以太坊地址。`address payable` 是 0.5.0 引入的区分，只有 `payable` 地址才能接收 Ether 和调用转账方法。

### bytes

Solidity 有定长字节数组 `bytes1` 到 `bytes32` 和动态字节数组 `bytes`：

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

`enum` 本质上是 `uint8` 的语法糖，从 0 开始递增。

## 引用类型

引用类型在赋值或传参时传递的是引用而非副本。Solidity 中的引用类型包括：string、array、struct、mapping。

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

`mapping` 是 Solidity 中最常用的数据结构，类似哈希表但不支持遍历。

## 数据位置：storage, memory, calldata

数据位置是 Solidity 独有的概念，也是最容易出错的特性之一：

### storage

`storage` 指区块链上的永久存储。状态变量默认存储在 `storage` 中：

```solidity
contract StorageExample {
    uint[] public data; // 状态变量，storage

    function addToStorage(uint item) public {
        data.push(item); // 直接修改 storage
    }
}
```

### memory

`memory` 是临时的内存空间，函数调用结束后销毁。函数参数中的引用类型默认为 `memory`：

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

`calldata` 是只读的、不可修改的函数输入数据区域，类似于 `memory` 但更省 Gas：

```solidity
function externalFunc(uint[] calldata arr) external pure returns (uint) {
    return arr[0]; // 只能读取，不能修改
}
```

### 三者对比

| 特性 | storage | memory | calldata |
|------|---------|--------|----------|
| 持久性 | 永久 | 函数调用期间 | 函数调用期间 |
| 可修改 | 是 | 是 | 否 |
| Gas 消耗 | 最高 | 中 | 最低 |
| 适用场景 | 状态变量 | 内部计算 | external 函数参数 |

### 引用陷阱

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

## 状态变量在 storage 中的布局规则

EVM 的 storage 由 2^256 个 32 字节的槽位组成，初始全为零。Solidity 编译器按以下规则布局状态变量：

1. **顺序排列**：状态变量按声明顺序从槽位 0 开始排列
2. **打包优化**：如果多个变量的大小之和 ≤ 32 字节，它们会被打包到同一个槽位
3. **动态类型占独立槽位**：动态数组、mapping、string 等动态类型单独占用一个槽位，该槽位存储的不是数据本身，而是数据的引用位置

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

理解布局规则后，可以通过优化声明顺序来节省 Gas：

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

## mapping 的存储原理

mapping 不像传统哈希表那样存储键值对数组。它的存储位置通过 keccak256 哈希计算：

```
value_slot = keccak256(key . mapping_slot)
```

```solidity
contract MappingStorage {
    mapping(address => uint) public balances; // slot 0
    mapping(uint => address) public users;    // slot 1
}
```

对于 `balances[0xAlice]`，其存储位置为：

```
keccak256(bytes32(0xAlice) . bytes32(0))
```

对于嵌套 mapping `mapping(address => mapping(address => uint))`：

```
inner_slot = keccak256(key1 . outer_mapping_slot)
value_slot = keccak256(key2 . inner_slot)
```

这意味着：

1. **mapping 无法遍历**：没有直接的方式获取所有 key
2. **mapping 无法清空**：只能逐个 key 删除
3. **key 不存在时返回零值**：`balances[address(0)]` 返回 0

如果需要遍历 mapping，需要额外维护一个 key 列表：

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

## 动态数组与定长数组的存储差异

### 定长数组

定长数组在 storage 中按声明顺序占用连续槽位：

```solidity
contract FixedArray {
    uint[3] public arr; // 占用 slot 0, 1, 2 三个槽位
    // 即使每个元素只需要 1 字节，也各占 32 字节（定长数组不打包）
}
```

注意：定长数组在 storage 中**不会**打包存储，每个元素独占一个槽位（除非元素类型本身小于 32 字节且有其他变量可以共享槽位——但数组元素之间不共享）。

### 动态数组

动态数组在槽位中存储长度，实际数据存储在 `keccak256(slot)` 开始的连续位置：

```solidity
contract DynamicArray {
    uint[] public arr; // slot 0 存储长度
    // arr[0] 存储在 keccak256(0) 处
    // arr[1] 存储在 keccak256(0) + 1 处
    // arr[i] 存储在 keccak256(0) + i 处
}
```

计算 `arr[i]` 的存储位置：

```javascript
// 用 JavaScript 模拟
const ethUtil = require('ethereumjs-util');

function arraySlot(slot, index) {
    const slotHash = ethUtil.keccak256(ethUtil.setLengthLeft(slot, 32));
    return ethUtil.bufferToHex(BigNumber.from(slotHash).add(index).toHexString());
}
```

这也是为什么动态数组的随机访问 Gas 消耗较高——需要先计算 keccak256 哈希来确定存储位置。

## bytes32 vs string 的选择

`bytes32` 和 `string` 在某些场景下可以互换，但存储模型完全不同：

```solidity
contract BytesVsString {
    bytes32 public fixedData = "hello"; // 占用 1 个槽位（32 字节）
    string public dynamicData = "hello"; // 占用 1 个槽位存储长度+指针，数据在别处
}
```

| 特性 | bytes32 | string |
|------|---------|--------|
| 最大长度 | 32 字节 | 无限制 |
| 存储 | 1 个槽位 | 长度槽位 + 数据槽位 |
| Gas（写入） | 20,000 | 20,000 + 数据槽位 |
| 访问 | 直接读取 | 需要解码 |
| 适用场景 | 固定长度哈希、短标识符 | 变长文本 |

经验法则：如果数据长度 ≤ 32 字节且固定，使用 `bytes32`；如果需要变长文本，使用 `string`。

## Gas 消耗对比

以下是一个展示不同类型 Gas 消耗的合约：

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

## 最佳实践与常见陷阱

### 1. 合理排列状态变量

将小类型变量放在一起声明，利用打包机制减少槽位使用：

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

### 2. 避免在 memory 中打包

memory 中的变量不会打包，每个元素占独立槽位：

```solidity
// memory 中 struct 不会打包
function test() public pure {
    MyStruct memory s;
    // s.a 和 s.b 各占 32 字节，即使它们是 uint8
}
```

### 3. mapping 遍历

如果需要遍历，使用 key 数组 + mapping 的组合模式，但要注意删除操作的复杂度。

### 4. delete 操作

`delete` 将变量重置为默认值（零值），对于 storage 变量会退还部分 Gas：

```solidity
function clearData(uint index) public {
    delete arr[index]; // 退还 15000 gas（SSTORE 零值）
}
```

### 5. storage 引用的隐式行为

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

## 小结

Solidity 的数据类型和存储模型设计有两个核心驱动因素：EVM 的 32 字节槽位架构和 Gas 经济学。理解 storage 布局规则不仅是优化 Gas 的手段，更是排查合约 bug 的基础——许多合约漏洞（如 storage 碰撞、初始化覆盖）都与存储布局有关。

从语言设计角度，Solidity 的数据位置（storage/memory/calldata）概念是独特的。它要求开发者在每次变量声明时都考虑数据生命周期，这增加了认知负担但也提供了对 Gas 消耗的精细控制。

Solidity（0.4.x 版本）在类型系统上还存在诸多不足：`address` 与 `address payable` 未区分、`memory`/`calldata` 的默认规则不清晰、数组操作缺少边界检查。这些问题在后续版本中逐步得到修复，而底层存储模型的核心设计保持稳定——因为它是 EVM 规范的一部分。

对于从传统前端转入智能合约开发的工程师，最大的思维转变在于：数据存储不再是"免费的"，每一次状态写入都有实际的经济成本。这种约束迫使开发者重新思考数据结构设计——在 Solidity 中，好的数据布局本身就是最好的优化。
