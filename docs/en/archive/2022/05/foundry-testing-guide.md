---
title: "Foundry Testing Guide: The Native Solidity Testing Framework"
date: 2022-05-08 16:34:07
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 12
description: "Foundry is a Solidity development toolchain written in Rust. Its biggest feature is that tests are written in Solidity itself, eliminating the need for a JavaScript intermediary layer. This article systematically covers the Forge, Cast, Anvil, and Chisel suite, with an in-depth comparison against the Hardhat testing ecosystem."
wordCount: 3200
---

Foundry (formerly Forge) is a Rust-implemented Solidity development toolchain initiated by Georgios Konstantopoulos and Andreas Bigger. It has become the default testing framework for many top DeFi protocols (Uniswap, MakerDAO, Compound, etc.). The core reason is simple: testing Solidity with Solidity eliminates the type translation overhead and cognitive burden introduced by the JavaScript intermediary layer.

## Foundry Toolchain Overview

Foundry is not a single tool, but a collection of command-line tools:

- **Forge**: Core testing and build tool, responsible for compilation, testing, deployment, and gas snapshots
- **Cast**: Ethereum RPC interaction tool, similar to "curl for Web3," can send transactions, call contracts, and decode calldata
- **Anvil**: Local test chain, similar to Hardhat Network or Ganache, supports mainnet forking
- **Chisel**: Solidity REPL, ideal for quickly verifying expressions and debugging

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Initialize a new project
forge init my-project
```

After installation, `foundryup` manages version updates, similar to the role of `nvm`.

### Forge Project Structure

```
my-project/
├── foundry.toml          # Foundry configuration file
├── src/                  # Contract source code
│   └── Counter.sol
├── test/                 # Test files (.t.sol suffix)
│   └── Counter.t.sol
├── script/               # Deployment scripts (.s.sol suffix)
│   └── Counter.s.sol
└── lib/                  # Dependencies (similar to node_modules)
    └── forge-std/
```

`foundry.toml` is the core configuration:

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.13"
optimizer = true
optimizer_runs = 200

# Test configuration
fuzz_runs = 256
fuzz_max_local_rejects = 65536

# Mainnet fork configuration
[profile.default.fork]
url = "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY"
```

## Comparison with Hardhat Testing

Hardhat's testing model uses JavaScript/TypeScript to write tests, calling contracts through ethers.js:

```typescript
// Hardhat style: JavaScript testing Solidity
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

Foundry's tests are written in Solidity itself:

```solidity
// Foundry style: Solidity testing Solidity
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

Core differences between the two:

| Dimension | Hardhat | Foundry |
|------|---------|---------|
| Test language | JavaScript/TypeScript | Solidity |
| Type safety | Requires TypeChain generation | Native type safety |
| Fuzz testing | Requires additional tools | Built-in support |
| Speed | Slower (Node.js startup) | Extremely fast (Rust native) |
| Mainnet forking | Supported | Supported (Anvil) |
| Scripts | JavaScript | Solidity (Script) |

In practice, Foundry's test execution speed is 5-10x faster than Hardhat, primarily because it eliminates the Node.js runtime and the RPC communication overhead between JS and Solidity.

## Writing Tests

### The test Keyword and Assertions

Foundry identifies tests by function name prefix:

- `test` prefix: Regular tests, expected to succeed
- `testFail` prefix: Expected to revert (old style, not recommended)
- `testRevert` prefix: Expected to revert (new style, used with `vm.expectRevert`)

```solidity
import "forge-std/Test.sol";
import "../src/Token.sol";

contract TokenTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // Regular test
    function testName() public {
        assertEq(token.name(), "TestToken");
    }

    // Test revert
    function testTransferInsufficientBalance() public {
        address alice = address(0x1);
        address bob = address(0x2);

        // Give alice some tokens
        token.mint(alice, 100);

        // Switch caller to alice
        vm.prank(alice);

        // Expect revert
        vm.expectRevert("InsufficientBalance");
        token.transfer(bob, 101);
    }
}
```

### The setUp Function

`setUp()` is a pre-hook for each test contract, running before each `test` function. All state is isolated between tests—each test function starts from the snapshot after `setUp()`.

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

        // deal can directly set an address's ETH balance
        deal(alice, 10 ether);
        deal(bob, 10 ether);
    }
}
```

### forge-std Cheatcodes

`vm` is the cheatcode address injected by Foundry, providing powerful testing capabilities:

```solidity
// Address impersonation
vm.prank(alice);           // Next transaction's msg.sender = alice
vm.startPrank(alice);      // All subsequent transactions' msg.sender = alice
vm.stopPrank();

// Time manipulation
vm.warp(1 days);           // Set block.timestamp
vm.roll(100);              // Set block.number
vm.skip(3600);             // Fast-forward time

// State modification
vm.deal(alice, 100 ether); // Directly set balance
vm.store(addr, slot, val); // Directly write storage slot

// Expectations and assertions
vm.expectRevert("ErrorMessage");
vm.expectEmit(true, true, false, true);
vm.expectCall(addr, calldata);

// Snapshots
uint256 snapshot = vm.snapshot();
// ... perform operations ...
vm.revertTo(snapshot);     // Roll back to snapshot
```

## Fuzz Testing

Fuzz testing is one of Foundry's most powerful features. By adding parameters to test functions, Foundry automatically generates random inputs and runs them multiple times.

```solidity
contract TokenFuzzTest is Test {
    Token public token;

    function setUp() public {
        token = new Token("TestToken", "TST", 18);
    }

    // Fuzz test: Foundry automatically generates random amount
    function testMint(address to, uint256 amount) public {
        vm.assume(to != address(0));
        vm.assume(amount < type(uint256).max / 2);

        uint256 balanceBefore = token.balanceOf(to);
        token.mint(to, amount);

        assertEq(token.balanceOf(to), balanceBefore + amount);
        assertEq(token.totalSupply(), token.totalSupply() + amount);
    }

    // Add constraints with vm.assume
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

By default, it runs 256 times, which can be adjusted in `foundry.toml`:

```toml
[profile.default]
fuzz_runs = 1000
```

You can also control it via command-line parameters:

```bash
forge test --fuzz-runs 10000
```

## Invariant Testing

Invariant testing verifies that a protocol still satisfies certain properties after arbitrary call sequences. Built-in support has been available since Foundry 1.0.

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

        // Register handler, Foundry will randomly call its functions
        targetContract(address(handler));
    }

    // Invariant: total balance must always equal the sum of all user balances
    function invariantTotalBalanceConservation() public {
        assertEq(
            exchange.totalDeposits(),
            exchange.sumOfUserBalances(),
            "Total deposits must equal sum of balances"
        );
    }

    // Invariant: no single user's balance can exceed total deposits
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

Foundry randomly calls functions on the handler, then checks whether each `invariant` function still holds. This is more effective than unit testing at discovering edge cases and unexpected interactions.

## Cast Command-Line Interaction

Cast is the most commonly used debugging tool in daily development:

```bash
# Read contract data (call)
cast call 0xContract "balanceOf(address)(uint256)" 0xUser

# Send transaction
cast send 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --private-key 0x...

# Estimate gas
cast estimate 0xContract "transfer(address,uint256)" 0xRecipient 100 \
  --from 0xSender

# Decode calldata
cast decode-calldata "transfer(address,uint256)" \
  0xa9059cbb000000000000000000000000...

# Get latest block
cast block latest

# Listen to events
cast logs --address 0xContract "Transfer(address,address,uint256)" \
  --rpc-url $RPC_URL

# Type conversion
cast --to-unit 1000000000000000000 ether  # Outputs 1
cast --to-wei 1 ether                      # Outputs 1000000000000000000
cast --to-checksum-address 0xabc...        # Convert to EIP-55 checksum format
```

## Anvil Local Chain

Anvil is Foundry's local chain implementation. Once started, it can fork mainnet:

```bash
# Start a blank local chain
anvil --port 8545

# Fork Ethereum mainnet
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000

# Fork with specified block number for reproducibility
anvil --fork-url $MAINNET_RPC_URL --fork-block-number 15000000 \
  --block-time 12
```

Use forking directly in tests:

```solidity
// Configure fork in foundry.toml
// [profile.default]
// fork_block_number = 15000000

// Or via environment variable
// forge test --fork-url $MAINNET_RPC_URL

contract ForkTest is Test {
    function testForkMainnet() public {
        // Directly interact with contracts on mainnet
        IERC20 weth = IERC20(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);

        // Simulate a whale holding WETH
        address whale = 0xF977814e90dA44bFA03b6295A0616a897441aceC;
        vm.prank(whale);
        weth.transfer(address(this), 100 ether);

        assertEq(weth.balanceOf(address(this)), 100 ether);
    }
}
```

## Complete Test Suite Example

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
        // Simplified: shares = assets ratio
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

    // Fuzz test
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

    // Invariant test
    function invariantTotalAssetsNonNegative() public {
        assertGe(vault.totalAssets(), 0);
    }
}
```

## CI Integration

Running Foundry tests in GitHub Actions:

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

`forge snapshot` generates gas consumption snapshots that can track gas changes:

```bash
# Generate snapshot
forge snapshot

# Check for gas regressions
forge snapshot --check

# Compare differences
forge snapshot --diff
```

## Personal Thoughts

The emergence of Foundry represents an important paradigm shift: unifying the testing language with the language under test. This is not simply a tool switch, but a change in mindset.

**The greatest value of native Solidity testing** lies not in speed (though it is indeed much faster), but in eliminating "translation loss." When writing tests in Hardhat, developers need to think simultaneously in two language ecosystems: Solidity's type system and JavaScript's type system don't fully correspond—uint256 is BigNumber in JS, address is a string, and bytes is a hex string. These translations are not only tedious but also prone to hiding bugs.

**Fuzz and Invariant testing** are the real game-changers. Traditional unit tests can only cover scenarios you can think of, while fuzz testing can discover edge cases you hadn't considered. In DeFi protocols, an unhandled uint256 overflow or precision issue can lead to millions of dollars in losses, and fuzz testing provides this layer of protection.

Foundry's ecosystem continues to develop rapidly. Documentation, tutorials, and third-party libraries (like forge-std) are maturing toward the depth of the Hardhat ecosystem, and the core toolchain is stable enough for production projects. For new projects, adopting Foundry directly is recommended; for existing Hardhat projects, gradual migration is possible—Foundry can coexist with Hardhat, with both used in the same project.

The future direction of Solidity testing may include: more powerful symbolic execution, integration with formal verification tools, and better coverage analysis tools. These capabilities will further narrow the gap between smart contract testing and traditional software testing.
