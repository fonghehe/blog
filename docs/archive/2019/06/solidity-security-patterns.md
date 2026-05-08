---
title: "Solidity 安全实践：常见漏洞与防御模式"
date: 2019-06-22 17:12:45
tags:
  - Web3
  - Solidity
  - Smart Contract
---

智能合约的安全问题不是"可能发生"的风险，而是"已经发生且持续发生"的现实。The DAO 在 2016 年因重入攻击损失 6000 万美元，Parity 钱包因 `delegatecall` 漏洞先后冻结 1.5 亿美元和永久锁定 2.8 亿美元，多个 ERC20 代币因整数溢出而归零。智能合约一旦部署就不可修改（除非使用代理模式），一个安全漏洞可能导致不可挽回的资金损失。安全不是事后的修补，而是从设计阶段就必须融入的约束。

## 重入攻击（Reentrancy）

### The DAO 安全事件

2016 年 6 月，The DAO 合约遭到攻击。攻击者利用提款函数中的逻辑缺陷，在合约更新余额之前重复调用提款函数，将合约中的以太币几乎全部转出。

漏洞的核心在于"检查-生效-交互"顺序的错误：

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

攻击合约的 fallback 函数在收到以太币时被触发，在 `balances[msg.sender] = 0` 执行之前再次调用 `withdraw`：

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

### checks-effects-interactions 模式

防御重入攻击的标准模式是 **checks-effects-interactions**：

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

关键点：

1. **在转账之前清零余额**：即使攻击者重入，`balances[msg.sender]` 已经是 0
2. **防重入锁**：作为纵深防御，阻止函数重入
3. **避免外部调用**：如果必须调用外部合约，使用 `transfer` 而非 `call.value`（`transfer` 限制 2300 Gas，不足以执行重入逻辑——但注意 EIP-1884 后此方案有变化）

### Pull over Push 模式

另一种防御策略是"拉取而非推送"——让用户主动提取资金，而非合约主动推送：

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

## 整数溢出

### 溢出漏洞

Solidity 0.8.0 之前，整数运算不会自动检查溢出：

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

如果 `balances[msg.sender]` 为 0，`0 - value` 会下溢出为 `2^256 - value`，攻击者凭空获得巨额余额。

### SafeMath 库

OpenZeppelin 的 SafeMath 库通过在每次运算后检查溢出来防御此漏洞：

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

使用 SafeMath：

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

### Solidity 0.8+ 内置检查

Solidity 0.8.0 开始默认检查整数溢出，不再需要 SafeMath。如果确实需要无检查运算（用于 Gas 优化），可以使用 `unchecked` 块：

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

`tx.origin` 是交易的最初发起者（用户地址），`msg.sender` 是直接调用者。当合约 A 调用合约 B 时，在 B 中 `msg.sender` 是 A 的地址，但 `tx.origin` 仍然是用户地址。

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

攻击流程：

1. 用户被诱导调用攻击合约的 `attack()` 函数
2. 攻击合约调用 `Phishable.withdraw()`
3. `Phishable` 检查 `tx.origin == owner`——通过，因为交易最初由用户发起
4. 资金被转走

修复：始终使用 `msg.sender` 做权限检查：

```solidity
function withdraw() public {
    require(msg.sender == owner, "Not owner");
    owner.transfer(address(this).balance);
}
```

## delegatecall 的危险性

`delegatecall` 在当前合约的上下文中执行目标合约的代码——这意味着 `msg.sender`、`msg.value` 和 storage 都保持当前合约的。

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

Parity 钱包漏洞正是利用了这一机制——攻击者通过 `delegatecall` 调用 `initWallet` 函数，覆盖了 owner 变量，获得了钱包的控制权。

防御原则：

1. **避免使用 delegatecall**，除非必要（如代理模式）
2. 如果必须使用，确保两个合约的 storage 布局完全一致
3. 使用 `view` 或 `pure` 库函数而非可变状态库函数

## 访问控制模式

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

### 角色权限控制（RoleBased）

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

OpenZeppelin 的 `AccessControl` 提供了更完善的角色管理实现，支持角色继承和多签管理员。

## 闪电贷攻击原理与防御

闪电贷（Flash Loan）允许用户在同一笔交易中借款并还款，无需任何抵押。攻击者利用闪电贷借入大量资金，操纵去中心化交易所的价格，然后在同一笔交易中获利还款。

```
闪电贷攻击流程：
1. 从 Aave/dYdX 闪电贷借入大量 ETH
2. 用借来的 ETH 在 DEX A 上大量购买代币 X（推高 X 的价格）
3. 在 DEX B 上以被操纵的高价卖出代币 X
4. 归还闪电贷借款 + 手续费
5. 保留套利利润
```

防御策略：

1. **不依赖单一 DEX 的价格**：使用去中心化预言机（如 Chainlink）获取价格
2. **时间加权平均价格（TWAP）**：使用 Uniswap V2 的 TWAP 预言机，而非瞬时价格
3. **多源价格聚合**：从多个交易所取价格并取中位数

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

## 漏洞合约与修复版本对比

### 漏洞版本

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

### 修复版本

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

## 安全审计工具

### Mythril

Mythril 是 ConsenSys 开发的符号执行安全分析工具：

```bash
# 安装
pip install mythril

# 分析合约
myth analyze contracts/MyToken.sol --solc-json solc-config.json

# 分析已部署的合约
myth analyze -a 0xContractAddress --rpc https://mainnet.infura.io/v3/YOUR_KEY
```

Mythril 能检测的漏洞类型包括重入、整数溢出、未授权访问、delegatecall 滥用等。但符号执行的速度较慢，分析复杂合约可能需要数分钟。

### Slither

Slither 是 Trail of Bits 开发的静态分析工具，速度比 Mythril 快得多：

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

Slither 的检测速度快（秒级），可以集成到 CI/CD 流程中：

```yaml
# .gitlab-ci.yml
security-scan:
  script:
    - slither contracts/ --detect all --exclude solc-version
    - myth analyze contracts/ --solc-json solc-config.json
```

### MythX

MythX 是 Mythril 和其他分析工具的云端聚合服务，提供更全面的分析：

```bash
# 通过 truffle 插件使用
npm install truffle-security
truffle run verify
```

## OpenZeppelin 安全合约库

OpenZeppelin 提供了经过审计的安全合约组件：

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

## 实践建议：安全清单与审计流程

### 部署前安全清单

1. **重入检查**：所有涉及外部调用的函数是否遵循 checks-effects-interactions 模式？
2. **整数溢出**：是否使用了 SafeMath（0.8 以下）或确认 0.8+ 默认检查？
3. **权限控制**：所有状态修改函数是否有正确的访问控制？
4. **tx.origin**：是否误用了 `tx.origin`？
5. **delegatecall**：是否使用了 `delegatecall`？storage 布局是否一致？
6. **外部调用**：是否最小化了对外部合约的调用？是否处理了调用失败的情况？
7. **事件覆盖**：所有状态变更是否都有对应的事件？
8. **边界条件**：空地址、零值、最大值等边界条件是否测试？
9. **Gas 限制**：循环是否有 Gas DoS 风险？
10. **价格预言机**：是否依赖单一价格源？

### 审计流程

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

## 小结

智能合约安全的核心困难在于：合约部署后不可修改（除非采用代理模式升级），一个漏洞可能导致永久性的资金损失。这与传统 Web 开发的"发现 bug -> 发布补丁"模式截然不同。

从技术角度看，Solidity 的大部分安全漏洞源于语言设计的不成熟。`tx.origin` 的存在增加了钓鱼攻击面，0.8 之前的整数无溢出检查要求开发者手动使用 SafeMath，`delegatecall` 的 storage 布局共享机制违反了最小意外原则。这些问题在后续版本中逐步改善，但已部署的合约无法自动受益于语言升级。

从工程角度看，安全审计工具（Slither、Mythril）的存在降低了漏洞遗漏的概率，但远未达到"银弹"级别。静态分析无法覆盖逻辑漏洞，符号执行在复杂合约上速度极慢。最终的安全保障仍然依赖于人类审计和充分的测试覆盖。

一个务实的观点是：智能合约的安全不在于"写出完美的代码"，而在于"限制单个漏洞的破坏范围"。最小权限原则（只给合约必要的权限）、最小上链逻辑（减少攻击面）、多签管理（避免单点故障）、渐进式部署（先测试网后主网）——这些工程实践比掌握每个攻击手法更重要。因为攻击手法会不断进化，但良好的工程实践能将损害控制在可接受的范围内。
