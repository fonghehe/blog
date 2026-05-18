---
readingTime: 7
wordCount: 1593
title: "Solidity 數據類型與存儲模型詳解"
date: 2018-07-15 10:43:47
tags:
  - Web3
  - Solidity
  - Smart Contract
---

Solidity 的數據類型系統表面上看起來像 JavaScript 和 C++ 的混合體，但其存儲模型卻與兩者截然不同。智能合約的每次狀態寫入都需要消耗 Gas，而 Gas 消耗直接取決於數據在 storage 中的佈局方式。理解 Solidity 的數據類型與存儲模型，不僅是寫出正確合約的前提，更是寫出經濟合約的關鍵。

## 值類型

值類型在賦值或傳參時會創建副本，修改副本不影響原值：

### bool

```solidity
bool public flag = true;
```

`bool` 只佔 1 字節（在 storage 中會被打包）。注意 Solidity 中沒有隱式類型轉換，`bool` 不能與 `uint` 混用：

```solidity
// 錯誤
if (1) { ... }

// 正確
if (true) { ... }
```

### uint / int

```solidity
uint256 public bigNumber = 1 ether;     // uint256 是 uint 的別名
uint8 public smallNumber = 255;         // 最大 255
int256 public signedNumber = -100;
```

Solidity 提供從 `uint8` 到 `uint256`（步長 8）的無符號整數類型。選擇合適的大小可以節省 storage 空間——但僅在多個小類型變量可以打包到同一槽位時才有意義。

### address

```solidity
address public owner = msg.sender;
// address payable（Solidity 0.5+）允許調用 .transfer() 和 .send()
address payable public treasury = msg.sender;
```

`address` 佔 20 字節，存儲以太坊地址。`address payable` 是 0.5.0 引入的區分，只有 `payable` 地址才能接收 Ether 和調用轉賬方法。

### bytes

Solidity 有定長字節數組 `bytes1` 到 `bytes32` 和動態字節數組 `bytes`：

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

`enum` 本質上是 `uint8` 的語法糖，從 0 開始遞增。

## 引用類型

引用類型在賦值或傳參時傳遞的是引用而非副本。Solidity 中的引用類型包括：string、array、struct、mapping。

### string

```solidity
string public name = "Hello";
// string 是動態字節數組，不能直接訪問 length 或索引
// 需要轉換為 bytes
function getNameLength() public view returns (uint) {
    return bytes(name).length;
}
```

### array

```solidity
// 定長數組
uint[5] public fixedArray = [1, 2, 3, 4, 5];

// 動態數組
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

`mapping` 是 Solidity 中最常用的數據結構，類似哈希表但不支持遍歷。

## 數據位置：storage, memory, calldata

數據位置是 Solidity 獨有的概念，也是最容易出錯的特性之一：

### storage

`storage` 指區塊鏈上的永久存儲。狀態變量默認存儲在 `storage` 中：

```solidity
contract StorageExample {
    uint[] public data; // 狀態變量，storage

    function addToStorage(uint item) public {
        data.push(item); // 直接修改 storage
    }
}
```

### memory

`memory` 是臨時的內存空間，函數調用結束後銷燬。函數參數中的引用類型默認為 `memory`：

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

`calldata` 是隻讀的、不可修改的函數輸入數據區域，類似於 `memory` 但更省 Gas：

```solidity
function externalFunc(uint[] calldata arr) external pure returns (uint) {
    return arr[0]; // 只能讀取，不能修改
}
```

### 三者對比

| 特性 | storage | memory | calldata |
|------|---------|--------|----------|
| 持久性 | 永久 | 函數調用期間 | 函數調用期間 |
| 可修改 | 是 | 是 | 否 |
| Gas 消耗 | 最高 | 中 | 最低 |
| 適用場景 | 狀態變量 | 內部計算 | external 函數參數 |

### 引用陷阱

```solidity
function dangerousLoop() public {
    uint[] storage s = data; // s 是 data 的引用
    s.push(999); // 這會修改狀態變量 data！
}

function safeCopy() public {
    uint[] memory m = new uint[](0);
    m.push(1); // 僅修改 memory 副本，不影響 storage
}
```

## 狀態變量在 storage 中的佈局規則

EVM 的 storage 由 2^256 個 32 字節的槽位組成，初始全為零。Solidity 編譯器按以下規則佈局狀態變量：

1. **順序排列**：狀態變量按聲明順序從槽位 0 開始排列
2. **打包優化**：如果多個變量的大小之和 ≤ 32 字節，它們會被打包到同一個槽位
3. **動態類型佔獨立槽位**：動態數組、mapping、string 等動態類型單獨佔用一個槽位，該槽位存儲的不是數據本身，而是數據的引用位置

```solidity
contract LayoutExample {
    uint8 public a;        // slot 0, offset 0 (1 byte)
    uint8 public b;        // slot 0, offset 1 (1 byte)
    uint16 public c;       // slot 0, offset 2 (2 bytes)
    address public d;      // slot 0, offset 4 (20 bytes)
                           // slot 0 總計 24 字節，還有 8 字節剩餘

    uint256 public e;      // slot 1 (32 bytes，無法打包進 slot 0)

    uint8 public f;        // slot 2, offset 0 (1 byte，新槽位因為 slot 0 空間不足)

    uint[] public arr;     // slot 3，存儲數組長度，數據在 keccak256(3) 處
    mapping(address => uint) public map; // slot 4，數據在 keccak256(key . 4) 處
}
```

理解佈局規則後，可以通過優化聲明順序來節省 Gas：

```solidity
// 不優化的佈局 —— 佔用 3 個槽位
contract Unoptimized {
    uint64 public a;    // slot 0 (8 bytes)
    uint256 public b;   // slot 1 (32 bytes，無法打包)
    uint64 public c;    // slot 2 (8 bytes)
}
// 總共 3 個槽位，3 * 20000 = 60000 Gas（SSTORE）

// 優化的佈局 —— 佔用 2 個槽位
contract Optimized {
    uint64 public a;    // slot 0, offset 0
    uint64 public c;    // slot 0, offset 8
    uint256 public b;   // slot 1
}
// 總共 2 個槽位，2 * 20000 = 40000 Gas
```

## mapping 的存儲原理

mapping 不像傳統哈希表那樣存儲鍵值對數組。它的存儲位置通過 keccak256 哈希計算：

```
value_slot = keccak256(key . mapping_slot)
```

```solidity
contract MappingStorage {
    mapping(address => uint) public balances; // slot 0
    mapping(uint => address) public users;    // slot 1
}
```

對於 `balances[0xAlice]`，其存儲位置為：

```
keccak256(bytes32(0xAlice) . bytes32(0))
```

對於嵌套 mapping `mapping(address => mapping(address => uint))`：

```
inner_slot = keccak256(key1 . outer_mapping_slot)
value_slot = keccak256(key2 . inner_slot)
```

這意味著：

1. **mapping 無法遍歷**：沒有直接的方式獲取所有 key
2. **mapping 無法清空**：只能逐個 key 刪除
3. **key 不存在時返回零值**：`balances[address(0)]` 返回 0

如果需要遍歷 mapping，需要額外維護一個 key 列表：

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
        // 注意：從數組中刪除需要額外邏輯
    }

    function size() public view returns (uint) {
        return keys.length;
    }
}
```

## 動態數組與定長數組的存儲差異

### 定長數組

定長數組在 storage 中按聲明順序佔用連續槽位：

```solidity
contract FixedArray {
    uint[3] public arr; // 佔用 slot 0, 1, 2 三個槽位
    // 即使每個元素只需要 1 字節，也各佔 32 字節（定長數組不打包）
}
```

注意：定長數組在 storage 中**不會**打包存儲，每個元素獨佔一個槽位（除非元素類型本身小於 32 字節且有其他變量可以共享槽位——但數組元素之間不共享）。

### 動態數組

動態數組在槽位中存儲長度，實際數據存儲在 `keccak256(slot)` 開始的連續位置：

```solidity
contract DynamicArray {
    uint[] public arr; // slot 0 存儲長度
    // arr[0] 存儲在 keccak256(0) 處
    // arr[1] 存儲在 keccak256(0) + 1 處
    // arr[i] 存儲在 keccak256(0) + i 處
}
```

計算 `arr[i]` 的存儲位置：

```javascript
// 用 JavaScript 模擬
const ethUtil = require('ethereumjs-util');

function arraySlot(slot, index) {
    const slotHash = ethUtil.keccak256(ethUtil.setLengthLeft(slot, 32));
    return ethUtil.bufferToHex(BigNumber.from(slotHash).add(index).toHexString());
}
```

這也是為什麼動態數組的隨機訪問 Gas 消耗較高——需要先計算 keccak256 哈希來確定存儲位置。

## bytes32 vs string 的選擇

`bytes32` 和 `string` 在某些場景下可以互換，但存儲模型完全不同：

```solidity
contract BytesVsString {
    bytes32 public fixedData = "hello"; // 佔用 1 個槽位（32 字節）
    string public dynamicData = "hello"; // 佔用 1 個槽位存儲長度+指針，數據在別處
}
```

| 特性 | bytes32 | string |
|------|---------|--------|
| 最大長度 | 32 字節 | 無限制 |
| 存儲 | 1 個槽位 | 長度槽位 + 數據槽位 |
| Gas（寫入） | 20,000 | 20,000 + 數據槽位 |
| 訪問 | 直接讀取 | 需要解碼 |
| 適用場景 | 固定長度哈希、短標識符 | 變長文本 |

經驗法則：如果數據長度 ≤ 32 字節且固定，使用 `bytes32`；如果需要變長文本，使用 `string`。

## Gas 消耗對比

以下是一個展示不同類型 Gas 消耗的合約：

```solidity
pragma solidity ^0.4.24;

contract GasComparison {
    // 方案 A：未優化的變量聲明（3 個槽位）
    uint64 public a1;
    uint128 public b1;
    uint64 public c1;
    // 3 * 20000 = 60000 gas（首次寫入每個槽位）

    // 方案 B：優化的變量聲明（1 個槽位）
    uint64 public a2;
    uint64 public b2;
    uint128 public c2;
    // 1 * 20000 = 20000 gas

    // 方案 C：使用 mapping
    mapping(uint => uint) public map;
    // 每個鍵值對寫入：20000 gas（每個 key 獨立槽位）

    // 方案 D：使用動態數組
    uint[] public arr;
    // push 操作：20000 gas（首次寫入新槽位）
    // 後續寫入已存在的槽位：5000 gas
}
```

## 最佳實踐與常見陷阱

### 1. 合理排列狀態變量

將小類型變量放在一起聲明，利用打包機制減少槽位使用：

```solidity
// 推薦
contract Good {
    address public owner;       // 20 bytes
    uint8 public status;        // 1 byte
    uint8 public version;       // 1 byte
    bool public paused;         // 1 byte
    // slot 0: 共 23 字節，打包在一個槽位

    uint256 public totalSupply; // slot 1
}
```

### 2. 避免在 memory 中打包

memory 中的變量不會打包，每個元素佔獨立槽位：

```solidity
// memory 中 struct 不會打包
function test() public pure {
    MyStruct memory s;
    // s.a 和 s.b 各佔 32 字節，即使它們是 uint8
}
```

### 3. mapping 遍歷

如果需要遍歷，使用 key 數組 + mapping 的組合模式，但要注意刪除操作的複雜度。

### 4. delete 操作

`delete` 將變量重置為默認值（零值），對於 storage 變量會退還部分 Gas：

```solidity
function clearData(uint index) public {
    delete arr[index]; // 退還 15000 gas（SSTORE 零值）
}
```

### 5. storage 引用的隱式行為

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

## 小結

Solidity 的數據類型和存儲模型設計有兩個核心驅動因素：EVM 的 32 字節槽位架構和 Gas 經濟學。理解 storage 佈局規則不僅是優化 Gas 的手段，更是排查合約 bug 的基礎——許多合約漏洞（如 storage 碰撞、初始化覆蓋）都與存儲佈局有關。

從語言設計角度，Solidity 的數據位置（storage/memory/calldata）概念是獨特的。它要求開發者在每次變量聲明時都考慮數據生命週期，這增加了認知負擔但也提供了對 Gas 消耗的精細控制。

Solidity 0.4.x 在類型系統上存在諸多不足：`address` 與 `address payable` 未區分、`memory`/`calldata` 的默認規則不清晰、數組操作缺少邊界檢查。新版本的 Solidity 逐漸補齊了這些能力（如區分 `address` 與 `address payable`、明確 `calldata` 規則），但底層存儲模型的核心設計保持穩定——因為它是 EVM 規範的一部分。

對於從傳統前端轉入智能合約開發的工程師，最大的思維轉變在於：數據存儲不再是"免費的"，每一次狀態寫入都有實際的經濟成本。這種約束迫使開發者重新思考數據結構設計——在 Solidity 中，好的數據佈局本身就是最好的優化。
