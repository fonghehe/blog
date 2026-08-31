---
title: "Foundry 測試指南：Solidity 原生測試框架"
date: 2022-05-08 16:34:07
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 8
description: "Foundry 是用 Rust 編寫的 Solidity 開發工具鏈，最大的特點是測試用 Solidity 本身編寫，無需 JavaScript 中間層。本文系統介紹 Forge、Cast、Anvil、Chisel 四件套，並與 Hardhat 測試體系做深度對比。"
wordCount: 1173
---

Foundry（前身 Forge）是 Georgios Konstantopoulos 和 Andreas Bigger 發起的 Rust 實現的 Solidity 開發工具鏈。它已經成為許多頭部 DeFi 協議（Uniswap、MakerDAO、Compound 等）的默認測試框架。核心原因很簡單：用 Solidity 測試 Solidity，消除了 JavaScript 中間層帶來的類型翻譯損失和心智負擔。

## Foundry 工具鏈概述

Foundry 不是一個單一工具，而是一組命令行工具的集合：

- **Forge**：核心測試與構建工具，負責編譯、測試、部署、gas 快照
- **Cast**：以太坊 RPC 交互工具，類似於 "Web3 版的 curl"，可以發送交易、調用合約、解碼 calldata
- **Anvil**：本地測試鏈，類似 Hardhat Network 或 Ganache，支持主網分叉
- **Chisel**：Solidity REPL，適合快速驗證表達式和調試

```bash
# 安裝 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 初始化新項目
forge init my-project
```

安裝後 `foundryup` 會管理版本更新，類似 `nvm` 的角色。

### Forge 項目結構

```
my-project/
├── foundry.toml          # Foundry 配置文件
├── src/                  # 合約源碼
│   └── Counter.sol
├── test/                 # 測試文件（.t.sol 後綴）
│   └── Counter.t.sol
├── script/               # 部署腳本（.s.sol 後綴）
│   └── Counter.s.sol
└── lib/                  # 依賴（類似 node_modules）
    └── forge-std/
```

`foundry.toml` 是核心配置：

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.13"
optimizer = true
optimizer_runs = 200

# 測試配置
fuzz_runs = 256
fuzz_max_local_rejects = 65536

# 主網分叉配置
[profile.default.fork]
url = "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY"
```

## 與 Hardhat 測試的對比

Hardhat 的測試模型是 JavaScript/TypeScript 編寫測試，通過 ethers.js 調用合約：

```typescript
// Hardhat 風格：JavaScript 測試 Solidity
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

Foundry 的測試用 Solidity 本身編寫：

```solidity
// Foundry 風格：Solidity 測試 Solidity
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

兩者的核心差異：

| 維度 | Hardhat | Foundry |
|------|---------|---------|
| 測試語言 | JavaScript/TypeScript | Solidity |
| 類型安全 | 需要 TypeChain 生成 | 原生類型安全 |
| Fuzz 測試 | 需要額外工具 | 內置支持 |
| 速度 | 較慢（Node.js 啟動） | 極快（Rust 原生） |
| 主網分叉 | 支持 | 支持（Anvil） |
| 腳本 | JavaScript | Solidity (Script) |

實際體驗上，Foundry 的測試執行速度比 Hardhat 快 5-10 倍，主要因為省去了 Node.js 運行時和 JS-Solidity 之間的 RPC 通信開銷。

## 編寫測試

### test 關鍵字與斷言

Foundry 通過函數名前綴識別測試：

- `test` 開頭：常規測試，期望成功
- `testFail` 開頭：期望 revert（舊風格，不推薦）
- `testRevert` 開頭：期望 revert（新風格，配合 `vm.expectRevert`）

```solidity
import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // 常規測試
    function testName() public {
        assertEq(token.name(), "TestToken");
    }

    // 測試 revert
    function testTransferInsufficientBalance() public {
        address alice = address(0x1);
        address bob = address(0x2);

        // 給 alice 一些代幣
        token.mint(alice, 100);

        // 切換 caller 為 alice
        vm.prank(alice);

        // 期望 revert
        vm.expectRevert("InsufficientBalance");
        token.transfer(bob, 101);
    }
}
```

### setUp 函數

`setUp()` 是每個測試合約的前置鉤子，在每個 `test` 函數執行前運行。所有狀態在測試間是隔離的——每個 test 函數都從 `setUp()` 後的快照開始執行。

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

        // deal 可以直接設置地址的 ETH 餘額
        deal(alice, 10 ether);
        deal(bob, 10 ether);
    }
}
```

### forge-std 的 Cheatcodes

`vm` 是 Foundry 注入的 cheatcode 地址，提供強大的測試能力：

```solidity
// 地址偽裝
vm.prank(alice);           // 下一筆交易的 msg.sender = alice
vm.startPrank(alice);      // 後續所有交易 msg.sender = alice
vm.stopPrank();

// 時間操控
vm.warp(1 days);           // 設置 block.timestamp
vm.roll(100);              // 設置 block.number
vm.skip(3600);             // 快進時間

// 狀態修改
vm.deal(alice, 100 ether); // 直接設置餘額
vm.store(addr, slot, val); // 直接寫存儲槽

// 期望與斷言
vm.expectRevert("ErrorMessage");
vm.expectEmit(true, true, false, true);
vm.expectCall(addr, calldata);

// 快照
uint256 snapshot = vm.snapshot();
// ... 執行操作 ...
vm.revertTo(snapshot);     // 回滾到快照
```

## Fuzz 測試

Fuzz 測試是 Foundry 最強大的特性之一。給測試函數添加參數，Foundry 會自動生成隨機輸入運行多次。

```solidity
contract TokenFuzzTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // Fuzz 測試：Foundry 自動生成隨機 amount
    function testMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max / 2);

        uint256 balanceBefore = token.balanceOf(to);
        token.mint(to, amount);

        assertEq(token.balanceOf(to), balanceBefore + amount);
        assertEq(token.totalSupply(), token.totalSupply() + amount);
    }

    // 用 vm.assume 添加約束條件
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

默認運行 256 次，可以在 `foundry.toml` 中調整：

```toml
[profile.default]
fuzz_runs = 1000
```

也可以通過命令行參數控制：

```bash
forge test --fuzz-runs 10000
```

## Invariant 測試

Invariant 測試（不變量測試）驗證協議在任意調用序列後仍滿足特定性質。Foundry 1.0 後內置支持。

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

        // 註冊 handler，Foundry 會隨機調用其函數
        targetContract(address(handler));
    }

    // 不變量：總餘額永遠等於所有用戶餘額之和
    function invariantTotalBalanceConservation() public {
        assertEq(
            exchange.totalDeposits(),
            exchange.sumOfUserBalances(),
            "Total deposits must equal sum of balances"
        );
    }

    // 不變量：單個用戶餘額不能超過總存款
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

Foundry 會隨機調用 handler 上的函數，然後檢查每個 `invariant` 函數是否始終成立。這比單元測試更能發現邊界情況和意外交互。

## Cast 命令行交互

Cast 是日常開發中最常用的調試工具：

```bash
# 讀取合約數據（call）
cast call 0xContract "balanceOf(address)(uint256)" 0xUser

# 發送交易
cast send 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --private-key 0x...

# 估算 gas
cast estimate 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --from 0xSender

# 解碼 calldata
cast decode-calldata "transfer(address,uint256)" \
  0xa9059cbb000000000000000000000000...

# 獲取最新區塊
cast block latest

# 監聽事件
cast logs --address 0xContract "Transfer(address,address,uint256)" \
  --rpc-url $RPC_URL

# 類型轉換
cast --to-unit 1000000000000000000 ether  # 輸出 1
cast --to-wei 1 ether                      # 輸出 1000000000000000000
cast --to-checksum-address 0xabc...        # 轉為 EIP-55 校驗格式
```

## Anvil 本地鏈

Anvil 是 Foundry 的本地鏈實現，啟動後可以分叉主網：

```bash
# 啟動空白本地鏈
anvil --port 8545

# 分叉以太坊主網
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000

# 分叉並指定區塊號，保證可復現性
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000 \
  --block-time 12
```

在測試中直接使用分叉：

```solidity
// 在 foundry.toml 中配置分叉
// [profile.default]
// fork_block_number = 15000000

// 或者通過環境變量
// forge test --fork-url $MAINNET_RPC_URL

contract ForkTest is Test {
    function testForkMainnet() public {
        // 直接與主網上的合約交互
        IERC20 weth = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        // 模擬持有 WETH 的巨鯨
        address whale = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
        vm.prank(whale);
        weth.transfer(address(this), 100 ether);

        assertEq(weth.balanceOf(address(this)), 100 ether);
    }
}
```

## 完整測試套件示例

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
        // 簡化：shares = assets 比例
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

    // Fuzz 測試
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

    // Invariant 測試
    function invariantTotalAssetsNonNegative() public {
        assertGe(vault.totalAssets(), 0);
    }
}
```

## CI 集成

在 GitHub Actions 中運行 Foundry 測試：

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

`forge snapshot` 生成 gas 消耗快照，可以追蹤 gas 變化：

```bash
# 生成快照
forge snapshot

# 檢查是否有 gas 退化
forge snapshot --check

# 比較差異
forge snapshot --diff
```

## 個人觀點

Foundry 的出現代表了一個重要的範式轉變：把測試語言和被測語言統一。這不是簡單的工具切換，而是思維方式的改變。

**Solidity 原生測試的最大價值**不在於速度（雖然確實快很多），而在於消除了"翻譯損失"。在 Hardhat 中寫測試時，開發者需要同時在兩個語言生態中思考：Solidity 的類型系統和 JavaScript 的類型系統不完全對應，uint256 在 JS 中是 BigNumber，address 是字符串，bytes 是 hex string。這些翻譯不僅繁瑣，還容易隱藏 bug。

**Fuzz 和 Invariant 測試**是真正的 game-changer。傳統單元測試只能覆蓋你能想到的場景，而 Fuzz 測試能發現你沒想到的邊界。在 DeFi 協議中，一個未處理的 uint256 溢出或精度問題可能導致數百萬美元的損失，Fuzz 測試提供了這一層的保護。

Foundry 的生態仍在持續發展中。文檔、教程、第三方庫（如 forge-std）的成熟度還不如 Hardhat 生態，但核心工具鏈已經足夠穩定用於生產項目。對於新項目，建議直接採用 Foundry；對於已有 Hardhat 項目，可以逐步遷移——Foundry 可以與 Hardhat 共存，在同一個項目中兩者並用。

Solidity 測試的未來方向可能包括：更強大的符號執行（symbolic execution）、與形式化驗證工具的集成、以及更好的覆蓋率分析工具。這些能力將進一步縮小智能合約測試與傳統軟件測試的差距。
