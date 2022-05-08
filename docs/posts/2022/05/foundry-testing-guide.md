---
title: "Foundry 测试指南：Solidity 原生测试框架"
date: 2022-05-08 16:34:07
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 12
description: "Foundry 是用 Rust 编写的 Solidity 开发工具链，最大的特点是测试用 Solidity 本身编写，无需 JavaScript 中间层。本文系统介绍 Forge、Cast、Anvil、Chisel 四件套，并与 Hardhat 测试体系做深度对比。"
wordCount: 3200
---

Foundry（前身 Forge）是 2021 年由 Georgios Konstantopoulos 和 Andreas Bigger 发起的 Rust 实现的 Solidity 开发工具链。到 2022 年中期，它已经成为许多头部 DeFi 协议（Uniswap、MakerDAO、Compound 等）的默认测试框架。核心原因很简单：用 Solidity 测试 Solidity，消除了 JavaScript 中间层带来的类型翻译损失和心智负担。

## Foundry 工具链概述

Foundry 不是一个单一工具，而是一组命令行工具的集合：

- **Forge**：核心测试与构建工具，负责编译、测试、部署、gas 快照
- **Cast**：以太坊 RPC 交互工具，类似于 "Web3 版的 curl"，可以发送交易、调用合约、解码 calldata
- **Anvil**：本地测试链，类似 Hardhat Network 或 Ganache，支持主网分叉
- **Chisel**：Solidity REPL，适合快速验证表达式和调试

```bash
# 安装 Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 初始化新项目
forge init my-project
```

安装后 `foundryup` 会管理版本更新，类似 `nvm` 的角色。

### Forge 项目结构

```
my-project/
├── foundry.toml          # Foundry 配置文件
├── src/                  # 合约源码
│   └── Counter.sol
├── test/                 # 测试文件（.t.sol 后缀）
│   └── Counter.t.sol
├── script/               # 部署脚本（.s.sol 后缀）
│   └── Counter.s.sol
└── lib/                  # 依赖（类似 node_modules）
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

# 测试配置
fuzz_runs = 256
fuzz_max_local_rejects = 65536

# 主网分叉配置
[profile.default.fork]
url = "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY"
```

## 与 Hardhat 测试的对比

Hardhat 的测试模型是 JavaScript/TypeScript 编写测试，通过 ethers.js 调用合约：

```typescript
// Hardhat 风格：JavaScript 测试 Solidity
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

Foundry 的测试用 Solidity 本身编写：

```solidity
// Foundry 风格：Solidity 测试 Solidity
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

两者的核心差异：

| 维度 | Hardhat | Foundry |
|------|---------|---------|
| 测试语言 | JavaScript/TypeScript | Solidity |
| 类型安全 | 需要 TypeChain 生成 | 原生类型安全 |
| Fuzz 测试 | 需要额外工具 | 内置支持 |
| 速度 | 较慢（Node.js 启动） | 极快（Rust 原生） |
| 主网分叉 | 支持 | 支持（Anvil） |
| 脚本 | JavaScript | Solidity (Script) |

实际体验上，Foundry 的测试执行速度比 Hardhat 快 5-10 倍，主要因为省去了 Node.js 运行时和 JS-Solidity 之间的 RPC 通信开销。

## 编写测试

### test 关键字与断言

Foundry 通过函数名前缀识别测试：

- `test` 开头：常规测试，期望成功
- `testFail` 开头：期望 revert（旧风格，不推荐）
- `testRevert` 开头：期望 revert（新风格，配合 `vm.expectRevert`）

```solidity
import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // 常规测试
    function testName() public {
        assertEq(token.name(), "TestToken");
    }

    // 测试 revert
    function testTransferInsufficientBalance() public {
        address alice = address(0x1);
        address bob = address(0x2);

        // 给 alice 一些代币
        token.mint(alice, 100);

        // 切换 caller 为 alice
        vm.prank(alice);

        // 期望 revert
        vm.expectRevert("InsufficientBalance");
        token.transfer(bob, 101);
    }
}
```

### setUp 函数

`setUp()` 是每个测试合约的前置钩子，在每个 `test` 函数执行前运行。所有状态在测试间是隔离的——每个 test 函数都从 `setUp()` 后的快照开始执行。

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

        // deal 可以直接设置地址的 ETH 余额
        deal(alice, 10 ether);
        deal(bob, 10 ether);
    }
}
```

### forge-std 的 Cheatcodes

`vm` 是 Foundry 注入的 cheatcode 地址，提供强大的测试能力：

```solidity
// 地址伪装
vm.prank(alice);           // 下一笔交易的 msg.sender = alice
vm.startPrank(alice);      // 后续所有交易 msg.sender = alice
vm.stopPrank();

// 时间操控
vm.warp(1 days);           // 设置 block.timestamp
vm.roll(100);              // 设置 block.number
vm.skip(3600);             // 快进时间

// 状态修改
vm.deal(alice, 100 ether); // 直接设置余额
vm.store(addr, slot, val); // 直接写存储槽

// 期望与断言
vm.expectRevert("ErrorMessage");
vm.expectEmit(true, true, false, true);
vm.expectCall(addr, calldata);

// 快照
uint256 snapshot = vm.snapshot();
// ... 执行操作 ...
vm.revertTo(snapshot);     // 回滚到快照
```

## Fuzz 测试

Fuzz 测试是 Foundry 最强大的特性之一。给测试函数添加参数，Foundry 会自动生成随机输入运行多次。

```solidity
contract TokenFuzzTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // Fuzz 测试：Foundry 自动生成随机 amount
    function testMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max / 2);

        uint256 balanceBefore = token.balanceOf(to);
        token.mint(to, amount);

        assertEq(token.balanceOf(to), balanceBefore + amount);
        assertEq(token.totalSupply(), token.totalSupply() + amount);
    }

    // 用 vm.assume 添加约束条件
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

默认运行 256 次，可以在 `foundry.toml` 中调整：

```toml
[profile.default]
fuzz_runs = 1000
```

也可以通过命令行参数控制：

```bash
forge test --fuzz-runs 10000
```

## Invariant 测试

Invariant 测试（不变量测试）验证协议在任意调用序列后仍满足特定性质。Foundry 1.0 后内置支持。

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

        // 注册 handler，Foundry 会随机调用其函数
        targetContract(address(handler));
    }

    // 不变量：总余额永远等于所有用户余额之和
    function invariantTotalBalanceConservation() public {
        assertEq(
            exchange.totalDeposits(),
            exchange.sumOfUserBalances(),
            "Total deposits must equal sum of balances"
        );
    }

    // 不变量：单个用户余额不能超过总存款
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

Foundry 会随机调用 handler 上的函数，然后检查每个 `invariant` 函数是否始终成立。这比单元测试更能发现边界情况和意外交互。

## Cast 命令行交互

Cast 是日常开发中最常用的调试工具：

```bash
# 读取合约数据（call）
cast call 0xContract "balanceOf(address)(uint256)" 0xUser

# 发送交易
cast send 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --private-key 0x...

# 估算 gas
cast estimate 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --from 0xSender

# 解码 calldata
cast decode-calldata "transfer(address,uint256)" \
  0xa9059cbb000000000000000000000000...

# 获取最新区块
cast block latest

# 监听事件
cast logs --address 0xContract "Transfer(address,address,uint256)" \
  --rpc-url $RPC_URL

# 类型转换
cast --to-unit 1000000000000000000 ether  # 输出 1
cast --to-wei 1 ether                      # 输出 1000000000000000000
cast --to-checksum-address 0xabc...        # 转为 EIP-55 校验格式
```

## Anvil 本地链

Anvil 是 Foundry 的本地链实现，启动后可以分叉主网：

```bash
# 启动空白本地链
anvil --port 8545

# 分叉以太坊主网
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000

# 分叉并指定区块号，保证可复现性
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000 \
  --block-time 12
```

在测试中直接使用分叉：

```solidity
// 在 foundry.toml 中配置分叉
// [profile.default]
// fork_block_number = 15000000

// 或者通过环境变量
// forge test --fork-url $MAINNET_RPC_URL

contract ForkTest is Test {
    function testForkMainnet() public {
        // 直接与主网上的合约交互
        IERC20 weth = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        // 模拟持有 WETH 的巨鲸
        address whale = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
        vm.prank(whale);
        weth.transfer(address(this), 100 ether);

        assertEq(weth.balanceOf(address(this)), 100 ether);
    }
}
```

## 完整测试套件示例

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
        // 简化：shares = assets 比例
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

    // Fuzz 测试
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

    // Invariant 测试
    function invariantTotalAssetsNonNegative() public {
        assertGe(vault.totalAssets(), 0);
    }
}
```

## CI 集成

在 GitHub Actions 中运行 Foundry 测试：

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

`forge snapshot` 生成 gas 消耗快照，可以追踪 gas 变化：

```bash
# 生成快照
forge snapshot

# 检查是否有 gas 退化
forge snapshot --check

# 比较差异
forge snapshot --diff
```

## 个人观点

Foundry 的出现代表了一个重要的范式转变：把测试语言和被测语言统一。这不是简单的工具切换，而是思维方式的改变。

**Solidity 原生测试的最大价值**不在于速度（虽然确实快很多），而在于消除了"翻译损失"。在 Hardhat 中写测试时，开发者需要同时在两个语言生态中思考：Solidity 的类型系统和 JavaScript 的类型系统不完全对应，uint256 在 JS 中是 BigNumber，address 是字符串，bytes 是 hex string。这些翻译不仅繁琐，还容易隐藏 bug。

**Fuzz 和 Invariant 测试**是真正的 game-changer。传统单元测试只能覆盖你能想到的场景，而 Fuzz 测试能发现你没想到的边界。在 DeFi 协议中，一个未处理的 uint256 溢出或精度问题可能导致数百万美元的损失，Fuzz 测试提供了这一层的保护。

到 2022 年中，Foundry 的生态仍在快速发展中。文档、教程、第三方库（如 forge-std）的成熟度还不如 Hardhat 生态，但核心工具链已经足够稳定用于生产项目。对于新项目，建议直接采用 Foundry；对于已有 Hardhat 项目，可以逐步迁移——Foundry 可以与 Hardhat 共存，在同一个项目中两者并用。

Solidity 测试的未来方向可能包括：更强大的符号执行（symbolic execution）、与形式化验证工具的集成、以及更好的覆盖率分析工具。这些能力将进一步缩小智能合约测试与传统软件测试的差距。
