---
title: "Solidityセキュリティ実践：よくある脆弱性と防御パターン"
date: 2019-06-22 17:12:45
tags:
  - Web3
  - Solidity
  - Smart Contract
---

スマートコントラクトのセキュリティ問題は「起こり得る」リスクではなく、「すでに起こっており継続的に発生している」現実です。The DAOは2016年にリエントランシー攻撃で6,000万ドルを失い、Parityウォレットは`delegatecall`の脆弱性により相次いで1.5億ドルを凍結し2.8億ドルを永久にロックしました。複数のERC20トークンが整数オーバーフローでゼロになりました。スマートコントラクトは一度デプロイすると変更不可能です（プロキシパターンを使用しない限り）。一つのセキュリティ脆弱性が取り返しのつかない資金損失をもたらす可能性があります。セキュリティは事後のパッチではなく、設計段階から組み込まなければならない制約です。

## リエントランシー攻撃（Reentrancy）

### The DAOインシデントの解説

2016年6月、The DAOコントラクトが攻撃を受けました。攻撃者は引き出し関数のロジックの欠陥を利用し、コントラクトが残高を更新する前に引き出し関数を繰り返し呼び出し、コントラクト内のEtherをほぼ全額引き出しました。

脆弱性のコアは「チェック-エフェクト-インタラクション」の順序の誤りです：

```solidity
// 脆弱なコントラクト：先に転送してから残高を更新
contract Vulnerable {
    mapping(address => uint256) public balances;

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 誤った順序：先に転送（インタラクション）
        msg.sender.call.value(amount)("");

        // その後に残高を更新（エフェクト）—— この時点では残高はまだゼロになっておらず、攻撃者は再度withdrawを呼び出し可能
        balances[msg.sender] = 0;
    }
}
```

攻撃コントラクトのfallback関数はEther受信時にトリガーされ、`balances[msg.sender] = 0`が実行される前に再度`withdraw`を呼び出します：

```solidity
contract Attacker {
    Vulnerable target;

    constructor(address _target) public {
        target = Vulnerable(_target);
    }

    function attack() public payable {
        target.deposit.value(msg.value)();
        target.withdraw();
    }

    // fallback関数 —— Ether受信時にトリガー
    function() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw();  // リエントランシー！残高はまだゼロになっていない
        }
    }
}
```

### checks-effects-interactionsパターン

リエントランシー攻撃に対する標準的な防御パターンは **checks-effects-interactions** です：

```solidity
// 修正版：checks -> effects -> interactions
contract SafeContract {
    mapping(address => uint256) public balances;
    bool internal locked;

    // リエントランシー防止ロック（追加保護）
    modifier noReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    function withdraw() public noReentrant {
        // 1. Checks —— 先に条件をチェック
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 2. Effects —— 状態を更新
        balances[msg.sender] = 0;

        // 3. Interactions —— 最後に外部呼び出しを実行
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Transfer failed");
    }
}
```

重要なポイント：

1. **転送前に残高をゼロにする**：攻撃者がリエントランシーしても、`balances[msg.sender]`はすでに0
2. **リエントランシー防止ロック**：多重防御として、関数のリエントランシーを阻止
3. **外部呼び出しの回避**：外部コントラクトを呼び出す必要がある場合、`call.value`ではなく`transfer`を使用（`transfer`は2,300 Gasに制限し、リエントランシーロジックを実行するのに不十分——ただしEIP-1884以降この方案には変化があることに注意）

### Pull over Pushパターン

もう一つの防御戦略は「プッシュではなくプル」です——コントラクトが能動的に送金するのではなく、ユーザーが能動的に資金を引き出すようにします：

```solidity
// Push（危険）：コントラクトが能動的に送金
function batchPay(address[] employees, uint256[] amounts) public {
    for (uint i = 0; i < employees.length; i++) {
        employees[i].transfer(amounts[i]);  // 一つ失敗すると全てロールバック
    }
}

// Pull（安全）：ユーザーが能動的に引き出し
mapping(address => uint256) public pendingPayments;

function creditPayment(address employee, uint256 amount) internal {
    pendingPayments[employee] += amount;
}

function withdrawPayment() public {
    uint256 amount = pendingPayments[msg.sender];
    require(amount > 0);
    pendingPayments[msg.sender] = 0;
    msg.sender.transfer(amount);
}
```

## 整数オーバーフロー

### オーバーフローの脆弱性

Solidity 0.8.0より前では、整数演算はオーバーフローを自動チェックしません：

```solidity
// 脆弱なコントラクト：オーバーフローチェックなし
contract TokenVulnerable {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // balances[msg.sender] - value がアンダーフローすると、結果は極大値になる
        balances[msg.sender] -= value;
        balances[to] += value;
    }
}
```

`balances[msg.sender]`が0の場合、`0 - value`はアンダーフローして`2^256 - value`になり、攻撃者は架空の巨額残高を獲得します。

### SafeMathライブラリ

OpenZeppelinのSafeMathライブラリは、各演算後にオーバーフローをチェックすることでこの脆弱性を防御します：

```solidity
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }

    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "SafeMath: division by zero");
        return a / b;
    }
}
```

SafeMathの使用：

```solidity
contract SafeToken {
    using SafeMath for uint256;
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        balances[msg.sender] = balances[msg.sender].sub(value);
        balances[to] = balances[to].add(value);
    }
}
```

### Solidity 0.8+の組み込みチェック

Solidity 0.8.0からデフォルトで整数オーバーフローをチェックし、SafeMathは不要になりました。チェックなしの演算が必要な場合（Gas最適化のため）、`unchecked`ブロックを使用できます：

```solidity
// Solidity 0.8+
contract ModernToken {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // デフォルトでオーバーフローをチェック、SafeMath不要
        balances[msg.sender] -= value;
        balances[to] += value;
    }

    function incrementLoop(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            // ループ内でuncheckedを使用してGasを節約
            unchecked { i++; }
        }
    }
}
```

## tx.origin vs msg.sender

`tx.origin`はトランザクションの最初の発信者（ユーザーアドレス）で、`msg.sender`は直接の呼び出し元です。コントラクトAがコントラクトBを呼び出す場合、B内では`msg.sender`はAのアドレスですが、`tx.origin`は引き続きユーザーアドレスです。

```solidity
// 脆弱なコントラクト：tx.originを使用して権限チェック
contract Phishable {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    function withdraw() public {
        // ユーザーがフィッシングで攻撃コントラクトを呼び出し、攻撃コントラクトがこの関数を呼び出した場合
        // tx.originは引き続きユーザーアドレスなので、権限チェックが通過する
        require(tx.origin == owner, "Not owner");
        owner.transfer(address(this).balance);
    }
}
```

攻撃フロー：

1. ユーザーが誘導されて攻撃コントラクトの`attack()`関数を呼び出す
2. 攻撃コントラクトが`Phishable.withdraw()`を呼び出す
3. `Phishable`が`tx.origin == owner`をチェック——通過、トランザクションは元々ユーザーが発信したため
4. 資金が引き出される

修正：常に`msg.sender`で権限チェックを行う：

```solidity
function withdraw() public {
    require(msg.sender == owner, "Not owner");
    owner.transfer(address(this).balance);
}
```

## delegatecallの危険性

`delegatecall`は現在のコントラクトのコンテキストで対象コントラクトのコードを実行します——つまり`msg.sender`、`msg.value`、storageがすべて現在のコントラクトのものが保持されます。

```solidity
// 脆弱なコントラクト：delegatecallがstorageの上書きを引き起こす
contract LibraryContract {
    function setTime(uint256 time) public {
        // このコントラクトのslot 0がsomeVarだと仮定
        // しかし呼び出し元コントラクトのslot 0はowner！
    }
}

contract VulnerableProxy {
    address public owner;       // slot 0
    LibraryContract lib;        // slot 1

    constructor(address _lib) public {
        lib = LibraryContract(_lib);
        owner = msg.sender;
    }

    function setTime(uint256 time) public {
        // delegatecallは現在のコンテキストでlib.setTimeを実行
        // lib.setTimeはslot 0を変更 —— しかし現在のコントラクトではslot 0はowner
        lib.delegatecall(abi.encodeWithSignature("setTime(uint256)", time));
    }
}
```

Parityウォレットの脆弱性はまさにこのメカニズムを利用しました——攻撃者は`delegatecall`を通じて`initWallet`関数を呼び出し、owner変数を上書きしてウォレットの制御権を獲得しました。

防御原則：

1. **delegatecallの使用を避ける**、必要な場合を除く（プロキシパターンなど）
2. 使用する必要がある場合、2つのコントラクトのstorageレイアウトが完全に一致することを確認
3. 可変状態ライブラリ関数ではなく`view`または`pure`ライブラリ関数を使用

## アクセス制御パターン

### Ownable

```solidity
contract Ownable {
    address public owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
```

### ロールベース権限管理（RoleBased）

```solidity
contract RoleBased {
    mapping(address => bool) public admins;
    mapping(address => bool) public operators;
    mapping(address => bool) public pausers;

    modifier onlyAdmin() {
        require(admins[msg.sender], "Not admin");
        _;
    }

    modifier onlyOperator() {
        require(operators[msg.sender], "Not operator");
        _;
    }

    function addAdmin(address account) public onlyAdmin {
        admins[account] = true;
    }

    function removeAdmin(address account) public onlyAdmin {
        require(account != msg.sender, "Cannot remove self");
        admins[account] = false;
    }

    function adminOperation() public onlyAdmin {
        // 管理者操作
    }

    function operatorOperation() public onlyOperator {
        // オペレーター操作
    }
}
```

OpenZeppelinの`AccessControl`はより完成したロール管理実装を提供し、ロールの継承とマルチシグ管理者をサポートします。

## フラッシュローン攻撃の原理と防御

フラッシュローン（Flash Loan）はユーザーが同一トランザクション内で借り入れと返済を行え、担保が不要です。攻撃者はフラッシュローンで多額の資金を借り入れ、非中央集権取引所の価格を操作し、同一トランザクション内で利益を得て返済します。

```
フラッシュローン攻撃フロー：
1. Aave/dYdXのフラッシュローンで大量のETHを借り入れ
2. 借り入れたETHでDEX Aで大量にトークンXを購入（Xの価格を押し上げる）
3. DEX Bで操作された高価格でトークンXを売却
4. フラッシュローンの借り入れ＋手数料を返済
5. アービトラージ利益を保持
```

防御戦略：

1. **単一DEXの価格に依存しない**：非中央集権オラクル（Chainlinkなど）を使用して価格を取得
2. **時間加重平均価格（TWAP）**：Uniswap V2のTWAPオラクルを使用し、瞬時価格ではなく
3. **マルチソース価格集約**：複数の取引所から価格を取得し中央値を採用

```solidity
// Chainlinkオラクルを使用して価格を取得
contract PriceFeed {
    AggregatorV3Interface internal priceFeed;

    constructor() public {
        // ETH/USD価格オラクル
        priceFeed = AggregatorV3Interface(0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419);
    }

    function getLatestPrice() public view returns (int) {
        (
            uint80 roundID,
            int price,
            uint startedAt,
            uint timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();
        return price;
    }
}
```

## 脆弱なコントラクトと修正版の比較

### 脆弱版

```solidity
contract VulnerableAuction {
    address public highestBidder;
    uint256 public highestBid;

    function bid() public payable {
        require(msg.value > highestBid, "Bid too low");

        // 先に状態を更新してから返金 —— しかし返金は外部呼び出し
        require(highestBidder != address(0));
        highestBidder.transfer(highestBid);  // highestBidderがコントラクトの場合、リエントランシー可能

        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
```

### 修正版

```solidity
contract SafeAuction {
    address public highestBidder;
    uint256 public highestBid;
    mapping(address => uint256) public pendingReturns;
    bool internal locked;

    modifier noReentrant() {
        require(!locked, "No reentrancy");
        locked = true;
        _;
        locked = false;
    }

    function bid() public payable noReentrant {
        require(msg.value > highestBid, "Bid too low");

        // Pullパターン：返金をpendingReturnsに記録
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        // 状態を更新
        highestBidder = msg.sender;
        highestBid = msg.value;
    }

    function withdraw() public noReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No pending returns");

        // 先にゼロにしてから転送
        pendingReturns[msg.sender] = 0;
        msg.sender.transfer(amount);
    }
}
```

## セキュリティ監査ツール

### Mythril

MythrilはConsenSysが開発したシンボリック実行セキュリティ分析ツールです：

```bash
# インストール
pip install mythril

# コントラクトを分析
myth analyze contracts/MyToken.sol --solc-json solc-config.json

# デプロイ済みコントラクトを分析
myth analyze -a 0xContractAddress --rpc https://mainnet.infura.io/v3/YOUR_KEY
```

Mythrilが検出できる脆弱性タイプにはリエントランシー、整数オーバーフロー、不正アクセス、delegatecallの濫用などがあります。ただしシンボリック実行の速度は遅く、複雑なコントラクトの分析には数分かかる場合があります。

### Slither

SlitherはTrail of Bitsが開発した静的分析ツールで、Mythrilよりはるかに高速です：

```bash
# インストール
pip install slither-analyzer

# コントラクトを分析
slither contracts/MyToken.sol

# 特定の脆弱性を分析
slither contracts/MyToken.sol --detect reentrancy-eth,reentrancy-no-eth,arithmetic

# JSON形式で出力
slither contracts/MyToken.sol --json results.json
```

Slitherの検出速度は速く（秒単位）、CI/CDフローに統合できます：

```yaml
# .gitlab-ci.yml
security-scan:
  script:
    - slither contracts/ --detect all --exclude solc-version
    - myth analyze contracts/ --solc-json solc-config.json
```

### MythX

MythXはMythrilや他の分析ツールのクラウド集約サービスで、より包括的な分析を提供します：

```bash
# truffleプラグイン経由で使用
npm install truffle-security
truffle run verify
```

## OpenZeppelinセキュリティコントラクトライブラリ

OpenZeppelinは監査済みのセキュリティコントラクトコンポーネントを提供します：

```solidity
import "openzeppelin-solidity/contracts/access/Ownable.sol";
import "openzeppelin-solidity/contracts/utils/Pausable.sol";
import "openzeppelin-solidity/contracts/utils/ReentrancyGuard.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract MyToken is Ownable, Pausable, ReentrancyGuard {
    using SafeMath for uint256;

    mapping(address => uint256) public balances;

    function withdraw(uint256 amount)
        public
        whenNotPaused       // 一時停止保護
        nonReentrant        // リエントランシー防止
    {
        require(balances[msg.sender] >= amount, "Insufficient balance");

        balances[msg.sender] = balances[msg.sender].sub(amount);
        msg.sender.transfer(amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
```

## 実践のアドバイス：セキュリティチェックリストと監査フロー

### デプロイ前セキュリティチェックリスト

1. **リエントランシーチェック**：外部呼び出しを含むすべての関数はchecks-effects-interactionsパターンに従っているか？
2. **整数オーバーフロー**：SafeMathを使用しているか（0.8未満）、または0.8+のデフォルトチェックを確認しているか？
3. **権限制御**：すべての状態変更関数に正しいアクセス制御があるか？
4. **tx.origin**：`tx.origin`を誤使用していないか？
5. **delegatecall**：`delegatecall`を使用しているか？storageレイアウトは一致しているか？
6. **外部呼び出し**：外部コントラクトへの呼び出しを最小化しているか？呼び出し失敗を処理しているか？
7. **イベントカバレッジ**：すべての状態変更に対応するイベントがあるか？
8. **境界条件**：空アドレス、ゼロ値、最大値などの境界条件をテストしたか？
9. **Gas制限**：ループにGas DoSリスクはないか？
10. **価格オラクル**：単一の価格ソースに依存していないか？

### 監査フロー

```
1. コード自己レビュー（デベロッパー）
   ├── セキュリティチェックリストの項目ごとにチェック
   └── Slitherでクイックスキャン実行

2. 自動化分析（CI/CD）
   ├── Slither静的分析
   ├── Mythrilシンボリック実行
   └── ユニットテストカバレッジ

3. 内部レビュー（チーム）
   ├── クロスコードレビュー
   └── テストネットデプロイテスト

4. 外部監査（サードパーティ）
   ├── 専門セキュリティ企業の監査
   └── バグバウンティプログラム

5. ローンチ後
   ├── リアルタイム監視（イベントアラート）
   ├── バウンティプログラム（Immunefiなど）
   └── インシデントレスポンス計画
```

## まとめ

スマートコントラクトセキュリティのコアの困難は：コントラクトはデプロイ後に変更不可能（プロキシパターンを使用しない限り）で、一つの脆弱性が永久な資金損失をもたらす可能性があることです。これは従来Web開発の「バグ発見 -> パッチリリース」モデルとは全く異なります。

技術的な観点から見ると、Solidityのセキュリティ脆弱性の大部分は言語設計の未成熟に起因します。`tx.origin`の存在がフィッシング攻撃面を増やし、0.8以前の整数オーバーフローチェックなしはデベロッパーに手動でのSafeMath使用を要求し、`delegatecall`のstorageレイアウト共有メカニズムは最小驚きの原則に違反しています。これらの問題は後続のバージョンで徐々に改善されましたが、すでにデプロイされたコントラクトは言語のアップグレードの恩恵を自動的には受けられません。

エンジニアリングの観点から見ると、セキュリティ監査ツール（Slither、Mythril）の存在は脆弱性の見逃し確率を下げましたが、「シルバーバレット」レベルには程遠いです。静的分析はロジックの脆弱性をカバーできず、シンボリック実行は複雑なコントラクトでは極めて遅いです。最終的なセキュリティ保障は依然として人間の監査と十分なテストカバレッジに依存しています。

現実的な観点として：スマートコントラクトのセキュリティは「完璧なコードを書く」ことではなく、「単一の脆弱性の破壊範囲を制限する」ことにあります。最小権限の原則（コントラクトに必要な権限のみ付与）、最小オンチェーンロジック（攻撃面を削減）、マルチシグ管理（単一障害点の回避）、段階的デプロイ（まずテストネット然后メインネット）——これらのエンジニアリングプラクティスは、個々の攻撃手法を習得するよりも重要です。なぜなら攻撃手法は進化し続けますが、良好なエンジニアリングプラクティスは損害を許容範囲に抑えられるからです。
