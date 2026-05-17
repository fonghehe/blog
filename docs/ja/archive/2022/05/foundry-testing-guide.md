---
title: "Foundry テストガイド：Solidity ネイティブテストフレームワーク"
date: 2022-05-08 16:34:07
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 12
description: "Foundry は Rust で記述された Solidity 開発ツールチェーンです。最大の特徴はテストを Solidity 本体で記述できること、JavaScript 中間層が不要なことです。本記事では Forge、Cast、Anvil、Chisel の4つのツールを体系的に紹介し、Hardhat テスト体系との詳細な比較を行います。"
wordCount: 3200
---

Foundry（旧称 Forge）は、Georgios Konstantopoulos と Andreas Bigger によって立ち上げられた Rust 実装の Solidity 開発ツールチェーンです。Uniswap、MakerDAO、Compound などの主要な DeFi プロトコルでは、デフォルトのテストフレームワークとして採用されています。その核心的な理由はシンプルです：Solidity で Solidity をテストすることで、JavaScript 中間層による型変換のロスと認知的負荷を排除できます。

## Foundry ツールチェーンの概要

Foundry は単一のツールではなく、コマンドラインツールの集合です：

- **Forge**：コアのテスト・ビルドツール。コンパイル、テスト、デプロイ、Gas スナップショットを担当
- **Cast**：Ethereum RPC 連携ツール。「Web3 版 curl」のようなもので、トランザクション送信、コントラクト呼び出し、calldata デコードが可能
- **Anvil**：ローカルテストチェーン。Hardhat Network や Ganache に類似し、メインネットフォークをサポート
- **Chisel**：Solidity REPL。式の迅速な検証やデバッグに適している

```bash
# Foundry のインストール
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 新規プロジェクトの初期化
forge init my-project
```

インストール後、`foundryup` がバージョン更新を管理します。`nvm` のような役割です。

### Forge プロジェクト構成

```
my-project/
├── foundry.toml          # Foundry 設定ファイル
├── src/                  # コントラクトソースコード
│   └── Counter.sol
├── test/                 # テストファイル（.t.sol サフィックス）
│   └── Counter.t.sol
├── script/               # デプロイスクリプト（.s.sol サフィックス）
│   └── Counter.s.sol
└── lib/                  # 依存関係（node_modules に類似）
    └── forge-std/
```

`foundry.toml` がコア設定です：

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.13"
optimizer = true
optimizer_runs = 200

# テスト設定
fuzz_runs = 256
fuzz_max_local_rejects = 65536

# メインネットフォーク設定
[profile.default.fork]
url = "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY"
```

## Hardhat テストとの比較

Hardhat のテストモデルは JavaScript/TypeScript でテストを記述し、ethers.js を通じてコントラクトを呼び出します：

```typescript
// Hardhat スタイル：JavaScript で Solidity をテスト
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Counter", () => {
  it("should increment", async () => {
    const Counter = await ethers.getContractFactory("Counter");
    const counter = await Counter.deploy(0);
    await counter.increment();
    expect(await counter.number()).to.equal(1);
  });
});
```

Foundry のテストは Solidity 本体で記述します：

```solidity
// Foundry スタイル：Solidity で Solidity をテスト
import "forge-std/Test.sol";
import "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;

    function setUp() public {
        counter = new Counter(0);
    }

    function testIncrement() public {
        counter.increment();
        assertEq(counter.number(), 1);
    }
}
```

两者の核心的な違い：

| 次元 | Hardhat | Foundry |
|------|---------|---------|
| テスト言語 | JavaScript/TypeScript | Solidity |
| 型安全性 | TypeChain 生成が必要 | ネイティブ型安全性 |
| Fuzz テスト | 追加ツールが必要 | 組み込みサポート |
| 速度 | 遅い（Node.js 起動） | 非常に高速（Rust ネイティブ） |
| メインネットフォーク | サポート | サポート（Anvil） |
| スクリプト | JavaScript | Solidity (Script) |

実際の体験では、Foundry のテスト実行速度は Hardhat より 5-10 倍高速です。主に Node.js ランタイムと JS-Solidity 間の RPC 通信オーバーヘッドを省いているためです。

## テストの記述

### test キーワードとアサーション

Foundry は関数名のプレフィックスでテストを識別します：

- `test` で始まる：通常のテスト、成功を期待
- `testFail` で始まる：revert を期待（旧スタイル、非推奨）
- `testRevert` で始まる：revert を期待（新スタイル、`vm.expectRevert` と組み合わせ）

```solidity
import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // 通常のテスト
    function testName() public {
        assertEq(token.name(), "TestToken");
    }

    // revert のテスト
    function testTransferInsufficientBalance() public {
        address alice = address(0x1);
        address bob = address(0x2);

        // alice にトークンを付与
        token.mint(alice, 100);

        // caller を alice に切り替え
        vm.prank(alice);

        // revert を期待
        vm.expectRevert("InsufficientBalance");
        token.transfer(bob, 101);
    }
}
```

### setUp 関数

`setUp()` は各テストコントラクトの前置きフックで、各 `test` 関数の実行前に走ります。すべての状態はテスト間で分離されています——各 test 関数は `setUp()` 後のスナップショットから実行を開始します。

```solidity
contract TokenTest is Test {
    Token public token;
    address public owner = address(this);
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
        token.mint(alice, 1000 ether);
        token.mint(bob, 500 ether);

        // deal でアドレスの ETH 残高を直接設定可能
        deal(alice, 10 ether);
        deal(bob, 10 ether);
    }
}
```

### forge-std の Cheatcodes

`vm` は Foundry が注入する cheatcode アドレスで、強力なテスト機能を提供します：

```solidity
// アドレス偽装
vm.prank(alice);           // 次のトランザクションの msg.sender = alice
vm.startPrank(alice);      // 以降のすべてのトランザクションの msg.sender = alice
vm.stopPrank();

// 時間操作
vm.warp(1 days);           // block.timestamp を設定
vm.roll(100);              // block.number を設定
vm.skip(3600);             // 時間を早送り

// 状態変更
vm.deal(alice, 100 ether); // 残高を直接設定
vm.store(addr, slot, val); // ストレージスロットに直接書き込み

// 期待とアサーション
vm.expectRevert("ErrorMessage");
vm.expectEmit(true, true, false, true);
vm.expectCall(addr, calldata);

// スナップショット
uint256 snapshot = vm.snapshot();
// ... 操作を実行 ...
vm.revertTo(snapshot);     // スナップショットにロールバック
```

## Fuzz テスト

Fuzz テストは Foundry の最も強力な機能の一つです。テスト関数にパラメータを追加すると、Foundry が自動的にランダム入力を生成して複数回実行します。

```solidity
contract TokenFuzzTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // Fuzz テスト：Foundry がランダムな amount を自動生成
    function testMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max / 2);

        uint256 balanceBefore = token.balanceOf(to);
        token.mint(to, amount);

        assertEq(token.balanceOf(to), balanceBefore + amount);
        assertEq(token.totalSupply(), token.totalSupply() + amount);
    }

    // vm.assume で制約条件を追加
    function testTransferFuzz(
        address from,
        address to,
        uint256 mintAmount,
        uint256 transferAmount
    ) public {
        vm.assume(from != to);
        vm.assume(from != address(0) && to != address(0));
        vm.assume(mintAmount > 0);
        vm.assume(transferAmount <= mintAmount);

        token.mint(from, mintAmount);

        vm.startPrank(from);
        token.transfer(to, transferAmount);
        vm.stopPrank();

        assertEq(token.balanceOf(from), mintAmount - transferAmount);
        assertEq(token.balanceOf(to), transferAmount);
    }
}
```

デフォルトで 256 回実行され、`foundry.toml` で調整可能です：

```toml
[profile.default]
fuzz_runs = 1000
```

コマンドラインパラメータでも制御可能です：

```bash
forge test --fuzz-runs 10000
```

## Invariant テスト

Invariant テスト（不変量テスト）は、プロトコルが任意の呼び出しシーケンスの後でも特定の性質を満たすことを検証します。Foundry 1.0 以降で組み込みサポートされています。

```solidity
import "forge-std/Test.sol";
import "../src/Exchange.sol";

contract ExchangeHandler {
    Exchange public exchange;

    constructor(Exchange _exchange) {
        exchange = _exchange;
    }

    function deposit(uint256 amount) external {
        exchange.deposit(amount);
    }

    function withdraw(uint256 amount) external {
        exchange.withdraw(amount);
    }
}

contract ExchangeInvariantTest is Test {
    Exchange public exchange;
    ExchangeHandler public handler;

    function setUp() public {
        exchange = new Exchange();
        handler = new ExchangeHandler(exchange);

        // handler を登録、Foundry がその関数をランダムに呼び出す
        targetContract(address(handler));
    }

    // 不変量：総残高は常に全ユーザー残高の合計と等しい
    function invariantTotalBalanceConservation() public {
        assertEq(
            exchange.totalDeposits(),
            exchange.sumOfUserBalances(),
            "Total deposits must equal sum of balances"
        );
    }

    // 不変量：単一ユーザーの残高は総預金を超えない
    function invariantNoBalanceExceedsTotal() public {
        address[] memory users = exchange.getUsers();
        for (uint256 i = 0; i < users.length; i++) {
            assertLe(
                exchange.balanceOf(users[i]),
                exchange.totalDeposits()
            );
        }
    }
}
```

Foundry は handler 上の関数をランダムに呼び出し、その後各 `invariant` 関数が常に成立するかをチェックします。これはユニットテストよりも境界ケースや予期しない相互作用を発見しやすくなります。

## Cast コマンドライン連携

Cast は日常開発で最もよく使われるデバッグツールです：

```bash
# コントラクトデータの読み取り（call）
cast call 0xContract "balanceOf(address)(uint256)" 0xUser

# トランザクション送信
cast send 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --private-key 0x...

# Gas 見積もり
cast estimate 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --from 0xSender

# calldata のデコード
cast decode-calldata "transfer(address,uint256)" \
  0xa9059cbb000000000000000000000000...

# 最新ブロックの取得
cast block latest

# イベントの監視
cast logs --address 0xContract "Transfer(address,address,uint256)" \
  --rpc-url $RPC_URL

# 型変換
cast --to-unit 1000000000000000000 ether  # 出力 1
cast --to-wei 1 ether                      # 出力 1000000000000000000
cast --to-checksum-address 0xabc...        # EIP-55 チェックサム形式に変換
```

## Anvil ローカルチェーン

Anvil は Foundry のローカルチェーン実装で、起動後にメインネットをフォークできます：

```bash
# 空のローカルチェーンを起動
anvil --port 8545

# Ethereum メインネットをフォーク
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000

# ブロック番号を指定してフォーク、再現性を保証
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000 \
  --block-time 12
```

テスト内でフォークを直接使用：

```solidity
// foundry.toml でフォークを設定
// [profile.default]
// fork_block_number = 15000000

// または環境変数で
// forge test --fork-url $MAINNET_RPC_URL

contract ForkTest is Test {
    function testForkMainnet() public {
        // メインネット上のコントラクトと直接対話
        IERC20 weth = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        // WETH を保有するクジラをシミュレート
        address whale = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
        vm.prank(whale);
        weth.transfer(address(this), 100 ether);

        assertEq(weth.balanceOf(address(this)), 100 ether);
    }
}
```

## 完全なテストスイートの例

```solidity
// src/Vault.sol
pragma solidity 0.8.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Vault is ReentrancyGuard {
    IERC20 public immutable asset;
    mapping(address => uint256) public balanceOf;
    uint256 public totalAssets;

    event Deposit(address indexed caller, uint256 assets, uint256 shares);
    event Withdraw(address indexed caller, uint256 assets, uint256 shares);

    constructor(address _asset) {
        asset = IERC20(_asset);
    }

    function deposit(uint256 assets) external nonReentrant returns (uint256) {
        require(assets > 0, "ZeroAmount");

        uint256 shares = _convertToShares(assets);
        asset.transferFrom(msg.sender, address(this), assets);

        balanceOf[msg.sender] += shares;
        totalAssets += assets;

        emit Deposit(msg.sender, assets, shares);
        return shares;
    }

    function withdraw(uint256 shares) external nonReentrant returns (uint256) {
        require(shares > 0, "ZeroShares");
        require(balanceOf[msg.sender] >= shares, "InsufficientShares");

        uint256 assets = _convertToAssets(shares);
        balanceOf[msg.sender] -= shares;
        totalAssets -= assets;

        asset.transfer(msg.sender, assets);

        emit Withdraw(msg.sender, assets, shares);
        return assets;
    }

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        if (totalAssets == 0) return assets;
        return (assets * totalShares()) / totalAssets;
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        return (shares * totalAssets) / totalShares();
    }

    function totalShares() public view returns (uint256) {
        // 簡略化：shares = assets の比率
        return address(this).balance > 0 ? totalAssets : 1;
    }
}
```

```solidity
// test/Vault.t.sol
pragma solidity 0.8.13;

import "forge-std/Test.sol";
import "../src/Vault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock", "MCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VaultTest is Test {
    Vault public vault;
    MockToken public token;

    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");

    function setUp() public {
        token = new MockToken();
        vault = new Vault(address(token));

        token.mint(alice, 1000 ether);
        token.mint(bob, 1000 ether);

        vm.startPrank(alice);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();

        vm.startPrank(bob);
        token.approve(address(vault), type(uint256).max);
        vm.stopPrank();
    }

    function testDeposit() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(100 ether);

        assertEq(shares, 100 ether);
        assertEq(vault.balanceOf(alice), 100 ether);
        assertEq(vault.totalAssets(), 100 ether);
        assertEq(token.balanceOf(alice), 900 ether);
    }

    function testWithdraw() public {
        vm.startPrank(alice);
        vault.deposit(100 ether);
        uint256 assets = vault.withdraw(50 ether);
        vm.stopPrank();

        assertEq(assets, 50 ether);
        assertEq(vault.balanceOf(alice), 50 ether);
        assertEq(token.balanceOf(alice), 950 ether);
    }

    function testRevertDepositZero() public {
        vm.prank(alice);
        vm.expectRevert("ZeroAmount");
        vault.deposit(0);
    }

    function testRevertInsufficientShares() public {
        vm.prank(alice);
        vm.expectRevert("InsufficientShares");
        vault.withdraw(1);
    }

    // Fuzz テスト
    function testDepositWithdrawRoundTrip(
        uint256 depositAmount,
        uint256 withdrawAmount
    ) public {
        vm.assume(depositAmount > 0 && depositAmount <= 1000 ether);
        vm.assume(withdrawAmount > 0 && withdrawAmount <= depositAmount);

        vm.startPrank(alice);
        vault.deposit(depositAmount);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();

        assertEq(
            token.balanceOf(alice),
            1000 ether - depositAmount + withdrawAmount
        );
    }

    // Invariant テスト
    function invariantTotalAssetsNonNegative() public {
        assertGe(vault.totalAssets(), 0);
    }
}
```

## CI 統合

GitHub Actions で Foundry テストを実行：

```yaml
# .github/workflows/foundry-test.yml
name: Foundry Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: recursive

      - name: Install Foundry
        uses: foundry-rs/foundry-toolchain@v1
        with:
          version: nightly

      - name: Build
        run: forge build

      - name: Run tests
        run: forge test -vvv

      - name: Gas snapshot
        run: forge snapshot --check
```

`forge snapshot` は Gas 消費スナップショットを生成し、Gas の変化を追跡できます：

```bash
# スナップショットの生成
forge snapshot

# Gas 退行がないかチェック
forge snapshot --check

# 差分の比較
forge snapshot --diff
```

## 個人的な見解

Foundry の登場は重要なパラダイムシフトを表しています：テスト言語と被テスト言語を統一することです。これは単なるツールの切り替えではなく、考え方の変化です。

**Solidity ネイティブテストの最大の価値**は速度（確かに大幅に高速ですが）ではなく、「変換ロス」の排除にあります。Hardhat でテストを書く際、開発者は2つの言語エコシステムで同時に考える必要があります：Solidity の型システムと JavaScript の型システムは完全には対応せず、uint256 は JS では BigNumber、address は文字列、bytes は hex string になります。これらの変換は煩雑であるだけでなく、バグを隠しやすくなります。

**Fuzz と Invariant テスト**は真の game-changer です。従来のユニットテストは思いつくシナリオしかカバーできませんが、Fuzz テストは予想外の境界を発見できます。DeFi プロトコルにおいて、未処理の uint256 オーバーフローや精度問題は数百万ドルの損失をもたらす可能性があり、Fuzz テストはこの層の保護を提供します。

2022年半ば時点で、Foundry のエコシステムはまだ急速に発展中です。ドキュメント、チュートリアル、サードパーティライブラリ（forge-std など）の成熟度は Hardhat エコシステムに及びませんが、コアツールチェーンは本番プロジェクトに使用できるほど安定しています。新規プロジェクトには Foundry の採用を推奨します。既存の Hardhat プロジェクトについては、段階的に移行可能です——Foundry は Hardhat と共存でき、同じプロジェクトで両方を併用できます。

Solidity テストの今後の方向性には、より強力なシンボリック実行（symbolic execution）、形式検証ツールとの統合、より良いカバレッジ分析ツールなどが含まれる可能性があります。これらの機能はスマートコントラクトのテストと従来のソフトウェアテストのギャップをさらに縮めるでしょう。
