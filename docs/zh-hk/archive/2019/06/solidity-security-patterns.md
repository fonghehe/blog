---
readingTime: 10
wordCount: 1833
title: "Solidity 安全實踐：常見漏洞與防禦模式"
date: 2019-06-22 17:12:45
tags:
  - Web3
  - Solidity
  - Smart Contract
description: "智能合約的安全問題不是\"可能發生\"的風險，而是\"已經發生且持續發生\"的現實。The DAO 在 2016 年因重入攻擊損失 6000 萬美元，Parity 錢包因 delegatecall 漏洞先後凍結 1.5 億美元和永久鎖定 2.8 億美元，多個 ERC20 代幣因整數溢出而歸零。智能合約一旦部署就不可修改（除非使"
---

智能合約的安全問題不是"可能發生"的風險，而是"已經發生且持續發生"的現實。The DAO 在 2016 年因重入攻擊損失 6000 萬美元，Parity 錢包因 `delegatecall` 漏洞先後凍結 1.5 億美元和永久鎖定 2.8 億美元，多個 ERC20 代幣因整數溢出而歸零。智能合約一旦部署就不可修改（除非使用代理模式），一個安全漏洞可能導致不可挽回的資金損失。安全不是事後的修補，而是從設計階段就必須融入的約束。

## 重入攻擊（Reentrancy）

### The DAO 事件解析

2016 年 6 月，The DAO 合約遭到攻擊。攻擊者利用提款函數中的邏輯缺陷，在合約更新餘額之前重複調用提款函數，將合約中的以太幣幾乎全部轉出。

漏洞的核心在於"檢查-生效-交互"順序的錯誤：

```solidity
// 漏洞合約：先轉賬再更新餘額
contract Vulnerable {
    mapping(address => uint256) public balances;

    function withdraw() public {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 錯誤順序：先轉賬（交互）
        msg.sender.call.value(amount)("");

        // 再更新餘額（生效）—— 此時餘額尚未清零，攻擊者可以再次調用 withdraw
        balances[msg.sender] = 0;
    }
}
```

攻擊合約的 fallback 函數在收到以太幣時被觸發，在 `balances[msg.sender] = 0` 執行之前再次調用 `withdraw`：

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

    // fallback 函數 —— 收到以太幣時觸發
    function() external payable {
        if (address(target).balance >= 1 ether) {
            target.withdraw();  // 重入！餘額尚未清零
        }
    }
}
```

### checks-effects-interactions 模式

防禦重入攻擊的標準模式是 **checks-effects-interactions**：

```solidity
// 修復版：checks -> effects -> interactions
contract SafeContract {
    mapping(address => uint256) public balances;
    bool internal locked;

    // 防重入鎖（額外保護）
    modifier noReentrant() {
        require(!locked, "Reentrant call detected");
        locked = true;
        _;
        locked = false;
    }

    function withdraw() public noReentrant {
        // 1. Checks —— 先檢查條件
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // 2. Effects —— 再更新狀態
        balances[msg.sender] = 0;

        // 3. Interactions —— 最後進行外部調用
        (bool success, ) = msg.sender.call.value(amount)("");
        require(success, "Transfer failed");
    }
}
```

關鍵點：

1. **在轉賬之前清零餘額**：即使攻擊者重入，`balances[msg.sender]` 已經是 0
2. **防重入鎖**：作為縱深防禦，阻止函數重入
3. **避免外部調用**：如果必須調用外部合約，使用 `transfer` 而非 `call.value`（`transfer` 限制 2300 Gas，不足以執行重入邏輯——但注意 EIP-1884 後此方案有變化）

### Pull over Push 模式

另一種防禦策略是"拉取而非推送"——讓用戶主動提取資金，而非合約主動推送：

```solidity
// Push（危險）：合約主動轉賬
function batchPay(address[] employees, uint256[] amounts) public {
    for (uint i = 0; i < employees.length; i++) {
        employees[i].transfer(amounts[i]);  // 一個失敗全部回滾
    }
}

// Pull（安全）：用户主動提取
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

## 整數溢出

### 溢出漏洞

Solidity 0.8.0 之前，整數運算不會自動檢查溢出：

```solidity
// 漏洞合約：無溢出檢查
contract TokenVulnerable {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // 如果 balances[msg.sender] - value 下溢出，結果變成極大值
        balances[msg.sender] -= value;
        balances[to] += value;
    }
}
```

如果 `balances[msg.sender]` 為 0，`0 - value` 會下溢出為 `2^256 - value`，攻擊者憑空獲得鉅額餘額。

### SafeMath 庫

OpenZeppelin 的 SafeMath 庫通過在每次運算後檢查溢出來防禦此漏洞：

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

### Solidity 0.8+ 內置檢查

Solidity 0.8.0 開始默認檢查整數溢出，不再需要 SafeMath。如果確實需要無檢查運算（用於 Gas 優化），可以使用 `unchecked` 塊：

```solidity
// Solidity 0.8+
contract ModernToken {
    mapping(address => uint256) public balances;

    function transfer(address to, uint256 value) public {
        // 默認檢查溢出，不需要 SafeMath
        balances[msg.sender] -= value;
        balances[to] += value;
    }

    function incrementLoop(uint256 times) public {
        for (uint256 i = 0; i < times; i++) {
            // 在循環中使用 unchecked 節省 Gas
            unchecked { i++; }
        }
    }
}
```

## tx.origin vs msg.sender

`tx.origin` 是交易的最初發起者（用戶地址），`msg.sender` 是直接調用者。當合約 A 調用合約 B 時，在 B 中 `msg.sender` 是 A 的地址，但 `tx.origin` 仍然是用戶地址。

```solidity
// 漏洞合約：使用 tx.origin 做權限檢查
contract Phishable {
    address public owner;

    constructor() public {
        owner = msg.sender;
    }

    function withdraw() public {
        // 如果用户被釣魚調用了攻擊合約，攻擊合約再調用此函數
        // tx.origin 仍然是用户地址，權限檢查通過
        require(tx.origin == owner, "Not owner");
        owner.transfer(address(this).balance);
    }
}
```

攻擊流程：

1. 用戶被誘導調用攻擊合約的 `attack()` 函數
2. 攻擊合約調用 `Phishable.withdraw()`
3. `Phishable` 檢查 `tx.origin == owner`——通過，因為交易最初由用戶發起
4. 資金被轉走

修復：始終使用 `msg.sender` 做權限檢查：

```solidity
function withdraw() public {
    require(msg.sender == owner, "Not owner");
    owner.transfer(address(this).balance);
}
```

## delegatecall 的危險性

`delegatecall` 在當前合約的上下文中執行目標合約的代碼——這意味着 `msg.sender`、`msg.value` 和 storage 都保持當前合約的。

```solidity
// 漏洞合約：delegatecall 導致 storage 覆蓋
contract LibraryContract {
    function setTime(uint256 time) public {
        // 假設此合約的 slot 0 是 someVar
        // 但調用者合約的 slot 0 是 owner！
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
        // delegatecall 在當前上下文執行 lib.setTime
        // lib.setTime 修改 slot 0 —— 但在當前合約中 slot 0 是 owner
        lib.delegatecall(abi.encodeWithSignature("setTime(uint256)", time));
    }
}
```

Parity 錢包漏洞正是利用了這一機制——攻擊者通過 `delegatecall` 調用 `initWallet` 函數，覆蓋了 owner 變量，獲得了錢包的控制權。

防禦原則：

1. **避免使用 delegatecall**，除非必要（如代理模式）
2. 如果必須使用，確保兩個合約的 storage 佈局完全一致
3. 使用 `view` 或 `pure` 庫函數而非可變狀態庫函數

## 訪問控制模式

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

### 角色權限控制（RoleBased）

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
        // 管理員操作
    }

    function operatorOperation() public onlyOperator {
        // 操作員操作
    }
}
```

OpenZeppelin 的 `AccessControl` 提供了更完善的角色管理實現，支持角色繼承和多籤管理員。

## 閃電貸攻擊原理與防禦

閃電貸（Flash Loan）允許用戶在同一筆交易中借款並還款，無需任何抵押。攻擊者利用閃電貸借入大量資金，操縱去中心化交易所的價格，然後在同一筆交易中獲利還款。

```
閃電貸攻擊流程：
1. 從 Aave/dYdX 閃電貸借入大量 ETH
2. 用借來的 ETH 在 DEX A 上大量購買代幣 X（推高 X 的價格）
3. 在 DEX B 上以被操縱的高價賣出代幣 X
4. 歸還閃電貸借款 + 手續費
5. 保留套利利潤
```

防禦策略：

1. **不依賴單一 DEX 的價格**：使用去中心化預言機（如 Chainlink）獲取價格
2. **時間加權平均價格（TWAP）**：使用 Uniswap V2 的 TWAP 預言機，而非瞬時價格
3. **多源價格聚合**：從多個交易所取價格並取中位數

```solidity
// 使用 Chainlink 預言機獲取價格
contract PriceFeed {
    AggregatorV3Interface internal priceFeed;

    constructor() public {
        // ETH/USD 價格預言機
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

## 漏洞合約與修復版本對比

### 漏洞版本

```solidity
contract VulnerableAuction {
    address public highestBidder;
    uint256 public highestBid;

    function bid() public payable {
        require(msg.value > highestBid, "Bid too low");

        // 先更新狀態再退款 —— 但退款是外部調用
        require(highestBidder != address(0));
        highestBidder.transfer(highestBid);  // 如果 highestBidder 是合約，可以重入

        highestBidder = msg.sender;
        highestBid = msg.value;
    }
}
```

### 修復版本

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

        // Pull 模式：將退款記入 pendingReturns
        if (highestBidder != address(0)) {
            pendingReturns[highestBidder] += highestBid;
        }

        // 更新狀態
        highestBidder = msg.sender;
        highestBid = msg.value;
    }

    function withdraw() public noReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No pending returns");

        // 先清零再轉賬
        pendingReturns[msg.sender] = 0;
        msg.sender.transfer(amount);
    }
}
```

## 安全審計工具

### Mythril

Mythril 是 ConsenSys 開發的符號執行安全分析工具：

```bash
# 安裝
pip install mythril

# 分析合約
myth analyze contracts/MyToken.sol --solc-json solc-config.json

# 分析已部署的合約
myth analyze -a 0xContractAddress --rpc https://mainnet.infura.io/v3/YOUR_KEY
```

Mythril 能檢測的漏洞類型包括重入、整數溢出、未授權訪問、delegatecall 濫用等。但符號執行的速度較慢，分析複雜合約可能需要數分鐘。

### Slither

Slither 是 Trail of Bits 開發的靜態分析工具，速度比 Mythril 快得多：

```bash
# 安裝
pip install slither-analyzer

# 分析合約
slither contracts/MyToken.sol

# 分析特定漏洞
slither contracts/MyToken.sol --detect reentrancy-eth,reentrancy-no-eth,arithmetic

# 輸出 JSON 格式
slither contracts/MyToken.sol --json results.json
```

Slither 的檢測速度快（秒級），可以集成到 CI/CD 流程中：

```yaml
# .gitlab-ci.yml
security-scan:
  script:
    - slither contracts/ --detect all --exclude solc-version
    - myth analyze contracts/ --solc-json solc-config.json
```

### MythX

MythX 是 Mythril 和其他分析工具的雲端聚合服務，提供更全面的分析：

```bash
# 通過 truffle 插件使用
npm install truffle-security
truffle run verify
```

## OpenZeppelin 安全合約庫

OpenZeppelin 提供了經過審計的安全合約組件：

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
        whenNotPaused       // 暫停保護
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

## 實踐建議：安全清單與審計流程

### 部署前安全清單

1. **重入檢查**：所有涉及外部調用的函數是否遵循 checks-effects-interactions 模式？
2. **整數溢出**：是否使用了 SafeMath（0.8 以下）或確認 0.8+ 默認檢查？
3. **權限控制**：所有狀態修改函數是否有正確的訪問控制？
4. **tx.origin**：是否誤用了 `tx.origin`？
5. **delegatecall**：是否使用了 `delegatecall`？storage 佈局是否一致？
6. **外部調用**：是否最小化了對外部合約的調用？是否處理了調用失敗的情況？
7. **事件覆蓋**：所有狀態變更是否都有對應的事件？
8. **邊界條件**：空地址、零值、最大值等邊界條件是否測試？
9. **Gas 限制**：循環是否有 Gas DoS 風險？
10. **價格預言機**：是否依賴單一價格源？

### 審計流程

```
1. 代碼自查（開發者）
   ├── 對照安全清單逐項檢查
   └── 運行 Slither 快速掃描

2. 自動化分析（CI/CD）
   ├── Slither 靜態分析
   ├── Mythril 符號執行
   └── 單元測試覆蓋

3. 內部審查（團隊）
   ├── 交叉代碼審查
   └── 測試網部署測試

4. 外部審計（第三方）
   ├── 專業安全公司審計
   └── 漏洞賞金計劃

5. 上線後
   ├── 實時監控（事件告警）
   ├── 懸賞計劃（Immunefi 等）
   └── 應急響應計劃
```

## 小結

智能合約安全的核心困難在於：合約部署後通常不可修改（除非使用代理模式升級），一個漏洞可能導致永久性的資金損失。這與傳統 Web 開發的"發現 bug -> 發佈補丁"模式截然不同。

從技術角度看，Solidity 的大部分安全漏洞源於語言設計的不成熟。`tx.origin` 的存在增加了釣魚攻擊面，0.8 之前的整數無溢出檢查要求開發者手動使用 SafeMath，`delegatecall` 的 storage 佈局共享機制違反了最小意外原則。這些問題在後續版本中逐步改善，但已部署的合約無法自動受益於語言升級。

從工程角度看，安全審計工具（Slither、Mythril）的存在降低了漏洞遺漏的概率，但遠未達到"銀彈"級別。靜態分析無法覆蓋邏輯漏洞，符號執行在複雜合約上速度極慢。最終的安全保障仍然依賴於人類審計和充分的測試覆蓋。

一個務實的觀點是：智能合約的安全不在於"寫出完美的代碼"，而在於"限制單個漏洞的破壞範圍"。最小權限原則（只給合約必要的權限）、最小上鍊邏輯（減少攻擊面）、多籤管理（避免單點故障）、漸進式部署（先測試網後主網）——這些工程實踐比掌握每個攻擊手法更重要。因為攻擊手法會不斷進化，但良好的工程實踐能將損害控制在可接受的範圍內。
