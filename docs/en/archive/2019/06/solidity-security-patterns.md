---
title: "Solidity Security Practices: Common Vulnerabilities and Defense Patterns"
date: 2019-06-22 17:12:45
tags:
  - Web3
  - Solidity
  - Smart Contract
---

Smart contract security is not a "might happen" risk but a "has happened and continues to happen" reality. The DAO lost $60 million to a reentrancy attack in 2016, Parity wallets froze $150 million and permanently locked $280 million due to a `delegatecall` vulnerability, and multiple ERC20 tokens went to zero due to integer overflows. Once deployed, a smart contract is immutable (unless using a proxy pattern)—a single security vulnerability can lead to irrecoverable financial losses. Security is not a patch applied after the fact but a constraint that must be incorporated from the design phase.

## Reentrancy Attacks

### The DAO Incident

In June 2016, The DAO contract was attacked. The attacker exploited a logic flaw in the withdrawal function—repeatedly calling the withdrawal function before the contract updated the balance, draining nearly all of the contract's Ether.

The core of the vulnerability was an incorrect "checks-effects-interactions" ordering:

```solidity
// 漏洞合约：先转账再更新余额
contract Vulnerable {
    mapping(address => uint256) public balances;

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 错误顺序：先转账（交互）
        msg.sender.call.value(amount)("");

        // 再更新余额（生效）—— 此时余额尚未清零，攻击者可以再次调用 withdraw
        balances[msg.sender] = 0;
    }
}
```

The attacker contract's fallback function was triggered upon receiving Ether, calling `withdraw` again before `balances[msg.sender] = 0` was executed:

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

    // fallback 函数 —— 收到以太币时触发
    function() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw();  // 重入！余额尚未清零
        }
    }
}
```

### The checks-effects-interactions Pattern

The standard pattern for defending against reentrancy attacks is **checks-effects-interactions**:

```solidity
// 修复版：checks -> effects -> interactions
contract SafeContract {
    mapping(address => uint256) public balances;
    bool internal locked;

    // 防重入锁（额外保护）
    modifier noReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    function withdraw() public noReentrant {
        // 1. Checks —— 先检查条件
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 2. Effects —— 再更新状态
        balances[msg.sender] = 0;

        // 3. Interactions —— 最后进行外部调用
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Transfer failed");
    }
}
```

Key points:

1. **Zero the balance before transferring**: Even if the attacker reenters, `balances[msg.sender]` is already 0
2. **Reentrancy guard**: As defense in depth, prevents function reentry
3. **Avoid external calls**: If external contract calls are necessary, use `transfer` instead of `call.value` (`transfer` limits gas to 2300, insufficient for reentrancy logic—though note this changed after EIP-1884)

### Pull over Push Pattern

Another defense strategy is "pull rather than push"—let users actively withdraw funds rather than the contract proactively pushing:

```solidity
// Push（危险）：合约主动转账
function batchPay(address[] employees, uint256[] amounts) public {
    for (uint i = 0; i < employees.length; i++) {
        employees[i].transfer(amounts[i]);  // 一个失败全部回滚
    }
}

// Pull（安全）：用户主动提取
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

## Integer Overflow

### Overflow Vulnerability

Prior to Solidity 0.8.0, integer operations did not automatically check for overflow:

```solidity
// 漏洞合约：无溢出检查
contract TokenVulnerable {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // 如果 balances[msg.sender] - value 下溢出，结果变成极大值
        balances[msg.sender] -= value;
        balances[to] += value;
    }
}
```

If `balances[msg.sender]` is 0, `0 - value` underflows to `2^256 - value`, giving the attacker an enormous balance out of thin air.

### The SafeMath Library

OpenZeppelin's SafeMath library defends against this by checking for overflow after each operation:

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

Using SafeMath:

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

### Solidity 0.8+ Built-in Checks

Starting from Solidity 0.8.0, integer overflow is checked by default, making SafeMath unnecessary. If unchecked arithmetic is truly needed (for gas optimization), the `unchecked` block can be used:

```solidity
// Solidity 0.8+
contract ModernToken {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // 默认检查溢出，不需要 SafeMath
        balances[msg.sender] -= value;
        balances[to] += value;
    }

    function incrementLoop(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            // 在循环中使用 unchecked 节省 Gas
            unchecked { i++; }
        }
    }
}
```

## tx.origin vs msg.sender

`tx.origin` is the original initiator of the transaction (the user's address), while `msg.sender` is the direct caller. When contract A calls contract B, in B, `msg.sender` is A's address, but `tx.origin` is still the user's address.

```solidity
// 漏洞合约：使用 tx.origin 做权限检查
contract Phishable {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    function withdraw() public {
        // 如果用户被钓鱼调用了攻击合约，攻击合约再调用此函数
        // tx.origin 仍然是用户地址，权限检查通过
        require(tx.origin == owner, "Not owner");
        owner.transfer(address(this).balance);
    }
}
```

Attack flow:

1. User is tricked into calling the attacker contract's `attack()` function
2. The attacker contract calls `Phishable.withdraw()`
3. `Phishable` checks `tx.origin == owner`—passes, because the transaction was originally initiated by the user
4. Funds are transferred away

Fix: Always use `msg.sender` for authorization checks:

```solidity
function withdraw() public {
    require(msg.sender == owner, "Not owner");
    owner.transfer(address(this).balance);
}
```

## The Dangers of delegatecall

`delegatecall` executes the target contract's code in the context of the current contract—meaning `msg.sender`, `msg.value`, and storage all remain those of the current contract.

```solidity
// 漏洞合约：delegatecall 导致 storage 覆盖
contract LibraryContract {
    function setTime(uint256 time) public {
        // 假设此合约的 slot 0 是 someVar
        // 但调用者合约的 slot 0 是 owner！
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
        // delegatecall 在当前上下文执行 lib.setTime
        // lib.setTime 修改 slot 0 —— 但在当前合约中 slot 0 是 owner
        lib.delegatecall(abi.encodeWithSignature("setTime(uint256)", time));
    }
}
```

The Parity wallet vulnerability exploited exactly this mechanism—the attacker used `delegatecall` to call the `initWallet` function, overwriting the owner variable and gaining control of the wallet.

Defense principles:

1. **Avoid using delegatecall** unless necessary (e.g., proxy patterns)
2. If its use is unavoidable, ensure both contracts have identical storage layouts
3. Use `view` or `pure` library functions rather than state-mutating library functions

## Access Control Patterns

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

### Role-Based Access Control

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
        // 管理员操作
    }

    function operatorOperation() public onlyOperator {
        // 操作员操作
    }
}
```

OpenZeppelin's `AccessControl` provides a more comprehensive role management implementation, supporting role inheritance and multi-sig administrators.

## Flash Loan Attack Principles and Defenses

Flash loans allow users to borrow and repay within the same transaction, without any collateral. Attackers use flash loans to borrow large amounts of funds, manipulate prices on decentralized exchanges, and then profit within the same transaction by repaying the loan.

```
Flash loan attack flow:
1. Borrow a large amount of ETH from Aave/dYdX flash loan
2. Use the borrowed ETH to buy large amounts of token X on DEX A (driving up X's price)
3. Sell token X at the manipulated high price on DEX B
4. Repay the flash loan + fees
5. Keep the arbitrage profit
```

Defense strategies:

1. **Don't rely on a single DEX's price**: Use decentralized oracles (like Chainlink) for price feeds
2. **Time-Weighted Average Price (TWAP)**: Use Uniswap V2's TWAP oracle instead of instantaneous prices
3. **Multi-source price aggregation**: Get prices from multiple exchanges and take the median

```solidity
// 使用 Chainlink 预言机获取价格
contract PriceFeed {
    AggregatorV3Interface internal priceFeed;

    constructor() public {
        // ETH/USD 价格预言机
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

## Vulnerable Contract vs Fixed Version Comparison

### Vulnerable Version

```solidity
contract VulnerableAuction {
    address public highestBidder;
    uint256 public highestBid;

    function bid() public payable {
        require(msg.value > highestBid, "Bid too low");

        // 先更新状态再退款 —— 但退款是外部调用
        require(highestBidder != address(0));
        highestBidder.transfer(highestBid);  // 如果 highestBidder 是合约，可以重入

        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
```

### Fixed Version

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

        // Pull 模式：将退款记入 pendingReturns
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        // 更新状态
        highestBidder = msg.sender;
        highestBid = msg.value;
    }

    function withdraw() public noReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No pending returns");

        // 先清零再转账
        pendingReturns[msg.sender] = 0;
        msg.sender.transfer(amount);
    }
}
```

## Security Audit Tools

### Mythril

Mythril is a symbolic execution security analysis tool developed by ConsenSys:

```bash
# 安装
pip install mythril

# 分析合约
myth analyze contracts/MyToken.sol --solc-json solc-config.json

# 分析已部署的合约
myth analyze -a 0xContractAddress --rpc https://mainnet.infura.io/v3/YOUR_KEY
```

Mythril can detect vulnerability types including reentrancy, integer overflow, unauthorized access, and delegatecall abuse. However, symbolic execution is relatively slow—analyzing complex contracts may take several minutes.

### Slither

Slither is a static analysis tool developed by Trail of Bits, much faster than Mythril:

```bash
# 安装
pip install slither-analyzer

# 分析合约
slither contracts/MyToken.sol

# 分析特定漏洞
slither contracts/MyToken.sol --detect reentrancy-eth,reentrancy-no-eth,arithmetic

# 输出 JSON 格式
slither contracts/MyToken.sol --json results.json
```

Slither's detection speed is fast (seconds), making it suitable for CI/CD integration:

```yaml
# .gitlab-ci.yml
security-scan:
  script:
    - slither contracts/ --detect all --exclude solc-version
    - myth analyze contracts/ --solc-json solc-config.json
```

### MythX

MythX is a cloud-based aggregation service for Mythril and other analysis tools, providing more comprehensive analysis:

```bash
# 通过 truffle 插件使用
npm install truffle-security
truffle run verify
```

## OpenZeppelin Security Contract Library

OpenZeppelin provides audited security contract components:

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
        whenNotPaused       // 暂停保护
        nonReentrant        // 防重入
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

## Practical Recommendations: Security Checklist and Audit Process

### Pre-Deployment Security Checklist

1. **Reentrancy check**: Do all functions involving external calls follow the checks-effects-interactions pattern?
2. **Integer overflow**: Is SafeMath used (below 0.8) or is 0.8+ default checking confirmed?
3. **Access control**: Do all state-modifying functions have proper access control?
4. **tx.origin**: Is `tx.origin` mistakenly used?
5. **delegatecall**: Is `delegatecall` used? Is the storage layout consistent?
6. **External calls**: Are external contract calls minimized? Are call failures handled?
7. **Event coverage**: Do all state changes have corresponding events?
8. **Boundary conditions**: Are edge cases like zero address, zero value, and maximum values tested?
9. **Gas limits**: Do loops have gas DoS risks?
10. **Price oracles**: Is there reliance on a single price source?

### Audit Process

```
1. 代码自查（开发者）
   ├── 对照安全清单逐项检查
   └── 运行 Slither 快速扫描

2. 自动化分析（CI/CD）
   ├── Slither 静态分析
   ├── Mythril 符号执行
   └── 单元测试覆盖

3. 内部审查（团队）
   ├── 交叉代码审查
   └── 测试网部署测试

4. 外部审计（第三方）
   ├── 专业安全公司审计
   └── 漏洞赏金计划

5. 上线后
   ├── 实时监控（事件告警）
   ├── 悬赏计划（Immunefi 等）
   └── 应急响应计划
```

## Summary

The core difficulty of smart contract security is that contracts are immutable after deployment (unless a proxy pattern is used)—a single vulnerability can lead to permanent financial loss. This is fundamentally different from the traditional web development model of "discover bug -> release patch."

From a technical perspective, most Solidity security vulnerabilities stem from the language design's immaturity. The existence of `tx.origin` increases the phishing attack surface, pre-0.8 integer overflow absence requiring manual SafeMath usage, and `delegatecall`'s storage layout sharing mechanism violating the principle of least surprise. These issues are addressed in later language versions, but already-deployed contracts cannot automatically benefit from language upgrades.

From an engineering perspective, the existence of security audit tools (Slither, Mythril) reduces the probability of overlooked vulnerabilities but is far from a "silver bullet." Static analysis cannot cover logic vulnerabilities, and symbolic execution is extremely slow on complex contracts. Ultimate security assurance still relies on human audits and thorough test coverage.

A pragmatic view is: smart contract security is not about "writing perfect code" but about "limiting the damage scope of any single vulnerability." The principle of least privilege (giving contracts only necessary permissions), minimal on-chain logic (reducing the attack surface), multi-sig management (avoiding single points of failure), and progressive deployment (testnet before mainnet)—these engineering practices are more important than mastering every attack technique. Because attack methods continually evolve, but good engineering practices can keep damage within acceptable bounds.
