---
title: "Solidityデータ型とストレージモデルの詳解"
date: 2018-07-15 10:43:47
tags:
  - Web3
  - Solidity
  - Smart Contract
---

Solidityのデータ型システムは一見JavaScriptとC++の混合体のように見えますが、そのストレージモデルは両者とは全く異なります。スマートコントラクトの毎回の状態書き込みにはGasが消費され、Gas消費はstorage内のデータの配置方法に直接依存します。Solidityのデータ型とストレージモデルを理解することは、正しいコントラクトを書くための前提であるだけでなく、経済的なコントラクトを書くための鍵でもあります。

## 値型

値型は代入や引数渡しの際にコピーが作成され、コピーを変更しても元の値には影響しません：

### bool

```solidity
bool public flag = true;
```

`bool`は1バイトしか占有しません（storage内ではパッキングされます）。Solidityには暗黙的な型変換はなく、`bool`と`uint`を混用できないことに注意してください：

```solidity
// エラー
if (1) { ... }

// 正しい
if (true) { ... }
```

### uint / int

```solidity
uint256 public bigNumber = 1 ether;     // uint256はuintのエイリアス
uint8 public smallNumber = 255;         // 最大255
int256 public signedNumber = -100;
```

Solidityは`uint8`から`uint256`（ステップ8）までの符号なし整数型を提供します。適切なサイズを選択することでstorageスペースを節約できます——ただし、複数の小さな型の変数が同じスロットにパッキングできる場合にのみ意味があります。

### address

```solidity
address public owner = msg.sender;
// address payable（Solidity 0.5+）は.transfer()と.send()の呼び出しを許可
address payable public treasury = msg.sender;
```

`address`は20バイトを占有し、Ethereumアドレスを保存します。`address payable`は0.5.0で導入された区別で、`payable`アドレスのみがEtherを受信し、送金メソッドを呼び出すことができます。

### bytes

Solidityには固定長バイト配列`bytes1`から`bytes32`と動的バイト配列`bytes`があります：

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

`enum`は本質的に`uint8`のシンタックスシュガーで、0から増分されます。

## 参照型

参照型は代入や引数渡しの際にコピーではなく参照が渡されます。Solidityの参照型にはstring、array、struct、mappingが含まれます。

### string

```solidity
string public name = "Hello";
// stringは動的バイト配列であり、lengthやインデックスに直接アクセスできない
// bytesに変換する必要がある
function getNameLength() public view returns (uint) {
    return bytes(name).length;
}
```

### array

```solidity
// 固定長配列
uint[5] public fixedArray = [1, 2, 3, 4, 5];

// 動的配列
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

`mapping`はSolidityで最もよく使用されるデータ構造で、ハッシュテーブルに似ていますが反復をサポートしません。

## データロケーション：storage, memory, calldata

データロケーションはSolidity特有の概念であり、最もエラーを起こしやすい特性の一つです：

### storage

`storage`はブロックチェーン上の永続ストレージを指します。状態変数はデフォルトで`storage`に保存されます：

```solidity
contract StorageExample {
    uint[] public data; // 状態変数、storage

    function addToStorage(uint item) public {
        data.push(item); // storageを直接変更
    }
}
```

### memory

`memory`は一時的なメモリスペースで、関数呼び出し終了後に破棄されます。関数パラメータの参照型はデフォルトで`memory`です：

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

`calldata`は読み取り専用の変更不可の関数入力データ領域で、`memory`に似ていますがよりGasを節約できます：

```solidity
function externalFunc(uint[] calldata arr) external pure returns (uint) {
    return arr[0]; // 読み取りのみ可能、変更不可
}
```

### 3者の比較

| 特性 | storage | memory | calldata |
|------|---------|--------|----------|
| 永続性 | 永続 | 関数呼び出し中 | 関数呼び出し中 |
| 変更可能 | はい | はい | いいえ |
| Gas消費 | 最高 | 中 | 最低 |
| 適用シナリオ | 状態変数 | 内部計算 | external関数パラメータ |

### 参照の罠

```solidity
function dangerousLoop() public {
    uint[] storage s = data; // sはdataへの参照
    s.push(999); // これは状態変数dataを変更する！
}

function safeCopy() public {
    uint[] memory m = new uint[](0);
    m.push(1); // memoryコピーのみを変更、storageには影響しない
}
```

## 状態変数のstorage内での配置ルール

EVMのstorageは2^256個の32バイトのスロットで構成され、初期値はすべてゼロです。Solidityコンパイラは以下のルールで状態変数を配置します：

1. **順序配置**：状態変数は宣言順にスロット0から配置されます
2. **パッキング最適化**：複数の変数のサイズの合計が32バイト以下の場合、同じスロットにパッキングされます
3. **動的型は独立スロットを占有**：動的配列、mapping、stringなどの動的型は単独で1つのスロットを占有し、そのスロットにはデータ自体ではなくデータの参照位置が保存されます

```solidity
contract LayoutExample {
    uint8 public a;        // slot 0, offset 0 (1 byte)
    uint8 public b;        // slot 0, offset 1 (1 byte)
    uint16 public c;       // slot 0, offset 2 (2 bytes)
    address public d;      // slot 0, offset 4 (20 bytes)
                           // slot 0 合計24バイト、残り8バイト

    uint256 public e;      // slot 1 (32 bytes、slot 0にパッキング不可)

    uint8 public f;        // slot 2, offset 0 (1 byte、slot 0の空き不足で新しいスロット)

    uint[] public arr;     // slot 3、配列の長さを保存、データはkeccak256(3)の位置に
    mapping(address => uint) public map; // slot 4、データはkeccak256(key . 4)の位置に
}
```

配置ルールを理解した後、宣言順序を最適化することでGasを節約できます：

```solidity
// 最適化されていない配置 —— 3つのスロットを占有
contract Unoptimized {
    uint64 public a;    // slot 0 (8 bytes)
    uint256 public b;   // slot 1 (32 bytes、パッキング不可)
    uint64 public c;    // slot 2 (8 bytes)
}
// 合計3つのスロット、3 * 20000 = 60000 Gas（SSTORE）

// 最適化された配置 —— 2つのスロットを占有
contract Optimized {
    uint64 public a;    // slot 0, offset 0
    uint64 public c;    // slot 0, offset 8
    uint256 public b;   // slot 1
}
// 合計2つのスロット、2 * 20000 = 40000 Gas
```

## mappingのストレージ原理

mappingは従来のハッシュテーブルのようにキーと値のペアの配列を保存しません。そのストレージ位置はkeccak256ハッシュ計算によって決まります：

```
value_slot = keccak256(key . mapping_slot)
```

```solidity
contract MappingStorage {
    mapping(address => uint) public balances; // slot 0
    mapping(uint => address) public users;    // slot 1
}
```

`balances[0xAlice]`のストレージ位置は：

```
keccak256(bytes32(0xAlice) . bytes32(0))
```

ネストされたmapping `mapping(address => mapping(address => uint))`の場合：

```
inner_slot = keccak256(key1 . outer_mapping_slot)
value_slot = keccak256(key2 . inner_slot)
```

これは以下のことを意味します：

1. **mappingは反復できない**：すべてのキーを取得する直接的な方法がない
2. **mappingはクリアできない**：キーごとに削除するしかない
3. **キーが存在しない場合はゼロ値を返す**：`balances[address(0)]`は0を返す

mappingを反復する必要がある場合、キーのリストを別途管理する必要があります：

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
        // 注意：配列から削除には追加ロジックが必要
    }

    function size() public view returns (uint) {
        return keys.length;
    }
}
```

## 動的配列と固定長配列のストレージの違い

### 固定長配列

固定長配列はstorage内で宣言順に連続するスロットを占有します：

```solidity
contract FixedArray {
    uint[3] public arr; // slot 0, 1, 2の3つのスロットを占有
    // 各要素が1バイトしか必要ない場合でも、それぞれ32バイトを占有（固定長配列はパッキングされない）
}
```

注意：固定長配列はstorage内でパッキング**されません**。各要素が独立したスロットを占有します（要素の型自体が32バイト未満で、他の変数とスロットを共有できる場合を除く——ただし配列要素間では共有しない）。

### 動的配列

動的配列はスロットに長さを保存し、実際のデータは`keccak256(slot)`から始まる連続した位置に保存されます：

```solidity
contract DynamicArray {
    uint[] public arr; // slot 0に長さを保存
    // arr[0]はkeccak256(0)の位置に保存
    // arr[1]はkeccak256(0) + 1の位置に保存
    // arr[i]はkeccak256(0) + iの位置に保存
}
```

`arr[i]`のストレージ位置の計算：

```javascript
// JavaScriptでシミュレーション
const ethUtil = require('ethereumjs-util');

function arraySlot(slot, index) {
    const slotHash = ethUtil.keccak256(ethUtil.setLengthLeft(slot, 32));
    return ethUtil.bufferToHex(BigNumber.from(slotHash).add(index).toHexString());
}
```

これが動的配列のランダムアクセスのGas消費が高い理由です——ストレージ位置を決定するためにkeccak256ハッシュを計算する必要があるからです。

## bytes32 vs stringの選択

`bytes32`と`string`は一部のシナリオで互換可能ですが、ストレージモデルは全く異なります：

```solidity
contract BytesVsString {
    bytes32 public fixedData = "hello"; // 1つのスロットを占有（32 bytes）
    string public dynamicData = "hello"; // 長さ+ポインタを保存する1つのスロットを占有、データは別の場所
}
```

| 特性 | bytes32 | string |
|------|---------|--------|
| 最大長 | 32バイト | 無制限 |
| ストレージ | 1つのスロット | 長さスロット + データスロット |
| Gas（書き込み） | 20,000 | 20,000 + データスロット |
| アクセス | 直接読み取り | デコードが必要 |
| 適用シナリオ | 固定長ハッシュ、短い識別子 | 可変長テキスト |

経験則：データ長が32バイト以下で固定の場合は`bytes32`を使用し、可変長テキストが必要な場合は`string`を使用します。

## Gas消費の比較

以下は異なる型のGas消費を示すコントラクトです：

```solidity
pragma solidity ^0.4.24;

contract GasComparison {
    // 方案A：最適化されていない変数宣言（3つのスロット）
    uint64 public a1;
    uint128 public b1;
    uint64 public c1;
    // 3 * 20000 = 60000 gas（各スロットの初回書き込み）

    // 方案B：最適化された変数宣言（1つのスロット）
    uint64 public a2;
    uint64 public b2;
    uint128 public c2;
    // 1 * 20000 = 20000 gas

    // 方案C：mappingを使用
    mapping(uint => uint) public map;
    // 各キーと値のペアの書き込み：20000 gas（各キーは独立スロット）

    // 方案D：動的配列を使用
    uint[] public arr;
    // push操作：20000 gas（初回の新スロット書き込み）
    // 既存スロットへの書き込み：5000 gas
}
```

## ベストプラクティスとよくある落とし穴

### 1. 状態変数の合理的な配置

小さな型の変数を一緒に宣言し、パッキングメカニズムを利用してスロット使用を削減します：

```solidity
// 推奨
contract Good {
    address public owner;       // 20 bytes
    uint8 public status;        // 1 byte
    uint8 public version;       // 1 byte
    bool public paused;         // 1 byte
    // slot 0: 合計23バイト、1つのスロットにパッキング

    uint256 public totalSupply; // slot 1
}
```

### 2. memory内でのパッキングを避ける

memory内の変数はパッキングされず、各要素が独立したスロットを占有します：

```solidity
// memory内のstructはパッキングされない
function test() public pure {
    MyStruct memory s;
    // s.aとs.bはuint8でもそれぞれ32バイトを占有
}
```

### 3. mappingの反復

反復が必要な場合、キー配列とmappingの組み合わせパターンを使用しますが、削除操作の複雑さに注意が必要です。

### 4. delete操作

`delete`は変数をデフォルト値（ゼロ値）にリセットし、storage変数の場合は一部のGasが返還されます：

```solidity
function clearData(uint index) public {
    delete arr[index]; // 15000 gas返還（SSTORE ゼロ値）
}
```

### 5. storage参照の暗黙的な挙動

```solidity
struct User {
    uint[] scores;
}

mapping(address => User) users;

function addScore(uint score) public {
    // users[msg.sender].scoresはstorage参照
    users[msg.sender].scores.push(score); // storageを直接変更
}
```

## まとめ

Solidityのデータ型とストレージモデル設計には2つのコアとなる推進要因があります：EVMの32バイトスロットアーキテクチャとGas経済学です。storage配置ルールを理解することはGas最適化の手段であるだけでなく、コントラクトバグの排查の基礎です——多くのコントラクトの脆弱性（storageの衝突、初期化の上書きなど）がストレージ配置に関連しています。

言語設計の観点から、Solidityのデータロケーション（storage/memory/calldata）の概念はユニークです。各変数宣言時にデータのライフサイクルを考慮することを開発者に求めており、認知負荷を増加させつつもGas消費のきめ細かい制御を提供しています。

Solidity 0.4.xの時点では、型システムにいくつかの不足がありました：`address`と`address payable`の未区別、`memory`/`calldata`のデフォルトルールの不明確さ、配列操作の境界チェック不足など。これらの欠陥は後のバージョンで修正されましたが、低レベルのストレージモデルのコア設計は変わっていません——EVM仕様の一部だからです。

従来のフロントエンドからスマートコントラクト開発に転向するエンジニアにとって、最大の思考の転換は：データストレージがもはや「無料」ではなく、毎回の状態書き込みに実際の経済コストがかかることです。この制約は開発者にデータ構造設計の再考を迫ります——Solidityにおいて、良いデータ配置こそが最高の最適化なのです。
