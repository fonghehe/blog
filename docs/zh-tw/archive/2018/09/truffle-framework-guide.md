---
readingTime: 8
wordCount: 1406
title: "Truffle 框架開發指南：DApp 項目工程化"
date: 2018-09-09 17:05:37
tags:
  - Web3
  - Ethereum
  - DApp
description: "當智能合約從簡單的存儲示例發展到真實業務邏輯時，Remix 的在線 IDE 很快就顯得力不從心。合約之間互相依賴、需要版本管理、需要自動化測試、需要多環境部署——這些需求催生了 Truffle 框架。Truffle 是以太坊 DApp 工程化的主流框架，它將合約開發從\"寫一個文件、部署一個文件\"的模式帶入了一個結構化的"
---

當智能合約從簡單的存儲示例發展到真實業務邏輯時，Remix 的在線 IDE 很快就顯得力不從心。合約之間互相依賴、需要版本管理、需要自動化測試、需要多環境部署——這些需求催生了 Truffle 框架。Truffle 是以太坊 DApp 工程化的主流框架，它將合約開發從"寫一個文件、部署一個文件"的模式帶入了一個結構化的項目管理體系。

## Truffle 項目結構

一個標準的 Truffle 項目包含以下目錄：

```
my-dapp/
├── contracts/           # Solidity 合約源文件
│   ├── Migrations.sol   # 遷移管理合約（Truffle 自動生成）
│   └── MyContract.sol   # 業務合約
├── migrations/          # 遷移腳本
│   ├── 1_initial_migration.js
│   └── 2_deploy_contracts.js
├── test/                # 測試文件
│   ├── mycontract.js    # JavaScript 測試
│   └── TestMyContract.sol  # Solidity 測試
├── build/               # 編譯輸出（自動生成）
│   └── contracts/       # 編譯後的 JSON 文件（含 ABI、bytecode）
├── truffle-config.js    # 配置文件（Windows 用 truffle.js）
└── package.json
```

初始化一個新項目：

```bash
npm install -g truffle
truffle init
```

`contracts/` 目錄存放所有 Solidity 源文件，`migrations/` 目錄存放部署腳本，`test/` 目錄存放測試文件。`build/` 目錄在編譯後自動生成，包含每個合約的 ABI、bytecode 和 AST 信息。

## 合約編譯：truffle compile

```bash
truffle compile
```

Truffle 讀取 `contracts/` 下所有 `.sol` 文件，使用 `solc` 編譯器編譯。編譯結果輸出到 `build/contracts/` 目錄，每個合約對應一個 JSON 文件：

```json
{
  "contractName": "MyContract",
  "abi": [...],
  "bytecode": "0x...",
  "deployedBytecode": "0x...",
  "sourceMap": "...",
  "ast": {...},
  "compiler": {
    "version": "0.4.24"
  },
  "networks": {
    "3": {
      "events": {},
      "links": {},
      "address": "0x...",
      "transactionHash": "0x..."
    }
  }
}
```

`networks` 字段記錄了合約在各網路上的部署地址。Truffle 通過這個字段實現"同一份代碼、多網路部署"的管理。

## 遷移腳本：truffle migrate

遷移腳本是 Truffle 的核心概念之一。它不是資料庫遷移，而是一組按順序執行的部署腳本，文件名前綴的數字決定了執行順序。

### Migrations.sol 合約

Truffle 自動生成的 `Migrations.sol` 用於跟蹤遷移狀態：

```solidity
pragma solidity ^0.4.24;

contract Migrations {
    address public owner;
    uint public last_completed_migration;

    constructor() public {
        owner = msg.sender;
    }

    modifier restricted() {
        if (msg.sender == owner) _;
    }

    function setCompleted(uint completed) public restricted {
        last_completed_migration = completed;
    }

    function upgrade(address new_address) public restricted {
        Migrations upgraded = Migrations(new_address);
        upgraded.setCompleted(last_completed_migration);
    }
}
```

### 遷移腳本編寫

```javascript
// migrations/1_initial_migration.js
var Migrations = artifacts.require("./Migrations.sol");

module.exports = function(deployer) {
    deployer.deploy(Migrations);
};
```

```javascript
// migrations/2_deploy_contracts.js
var MyToken = artifacts.require("./MyToken.sol");
var TokenSale = artifacts.require("./TokenSale.sol");

module.exports = function(deployer, network, accounts) {
    // 先部署依賴合約
    deployer.deploy(MyToken, 1000000, "MyToken", "MTK", 18)
        .then(function() {
            // 再部署依賴 MyToken 的合約
            return deployer.deploy(TokenSale, MyToken.address, accounts[0]);
        });
};
```

### 部署流程

```bash
# 部署到本地 Ganache
truffle migrate

# 部署到 Ropsten 測試網
truffle migrate --network ropsten

# 重置遷移狀態（從頭開始）
truffle migrate --reset
```

`truffle migrate` 的執行邏輯：

1. 檢查 `Migrations` 合約中 `last_completed_migration` 的值
2. 執行編號大於該值的遷移腳本
3. 每個腳本執行完畢後，更新 `last_completed_migration`

這個機制確保了遷移腳本只執行一次，避免重複部署。但在實際開發中，如果合約邏輯變更需要重新部署，需要使用 `--reset` 參數或增加新的遷移腳本。

## 測試網路配置：truffle-config.js

```javascript
// truffle-config.js
const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'your twelve word mnemonic phrase here';

module.exports = {
    // 編譯器配置
    compilers: {
        solc: {
            version: '0.4.24',
            optimizer: {
                enabled: true,
                runs: 200
            }
        }
    },

    networks: {
        // 本地開發網路
        development: {
            host: '127.0.0.1',
            port: 7545,          // Ganache 預設埠
            network_id: '*',     // 匹配任何網路 ID
            gas: 6721975,
            gasPrice: 20000000000  // 20 Gwei
        },

        // Ganache CLI
        ganache: {
            host: '127.0.0.1',
            port: 8545,
            network_id: 5777
        },

        // Ropsten 測試網（通過 Infura）
        ropsten: {
            provider: function() {
                return new HDWalletProvider(
                    mnemonic,
                    'https://ropsten.infura.io/v3/YOUR_API_KEY'
                );
            },
            network_id: 3,
            gas: 5500000,
            gasPrice: web3.utils.toWei('10', 'gwei'),
            confirmations: 2,
            timeoutBlocks: 200,
            skipDryRun: true
        },

        // 主網
        mainnet: {
            provider: function() {
                return new HDWalletProvider(
                    mnemonic,
                    'https://mainnet.infura.io/v3/YOUR_API_KEY'
                );
            },
            network_id: 1,
            gas: 5500000,
            gasPrice: web3.utils.toWei('20', 'gwei'),
            confirmations: 5
        }
    }
};
```

`HDWalletProvider` 是 Truffle 的關鍵插件之一，它通過助記詞生成簽名賬戶，配合 Infura 節點實現無需本地節點的部署，讓開發者不需要同步整個以太坊區塊鏈就能部署合約。

## 合約測試

### JavaScript 測試

```javascript
// test/mytoken.js
const MyToken = artifacts.require('MyToken');

contract('MyToken', function(accounts) {
    const [owner, alice, bob] = accounts;

    beforeEach(async function() {
        this.token = await MyToken.new(1000000, 'MyToken', 'MTK', 18);
    });

    describe('基本屬性', function() {
        it('應該有正確的名稱', async function() {
            const name = await this.token.name();
            assert.equal(name, 'MyToken');
        });

        it('應該有正確的符號', async function() {
            const symbol = await this.token.symbol();
            assert.equal(symbol, 'MTK');
        });

        it('應該有正確的總供應量', async function() {
            const totalSupply = await this.token.totalSupply();
            assert.equal(totalSupply.toNumber(), 1000000);
        });
    });

    describe('轉賬功能', function() {
        it('應該正確轉賬', async function() {
            await this.token.transfer(alice, 100, { from: owner });

            const aliceBalance = await this.token.balanceOf(alice);
            assert.equal(aliceBalance.toNumber(), 100);

            const ownerBalance = await this.token.balanceOf(owner);
            assert.equal(ownerBalance.toNumber(), 999900);
        });

        it('餘額不足時應該失敗', async function() {
            // 使用 catchRevert 或 try/catch
            try {
                await this.token.transfer(bob, 100, { from: alice });
                assert.fail('應該拋出異常');
            } catch (error) {
                assert.include(error.message, 'revert');
            }
        });
    });

    describe('授權與額度', function() {
        it('應該正確授權並使用 transferFrom', async function() {
            // owner 授權 alice 1000
            await this.token.approve(alice, 1000, { from: owner });

            const allowance = await this.token.allowance(owner, alice);
            assert.equal(allowance.toNumber(), 1000);

            // alice 從 owner 轉給 bob
            await this.token.transferFrom(owner, bob, 500, { from: alice });

            const bobBalance = await this.token.balanceOf(bob);
            assert.equal(bobBalance.toNumber(), 500);
        });
    });
});
```

### Solidity 測試

Solidity 測試的優勢是可以直接在 EVM 環境中運行，更接近合約的實際執行環境：

```solidity
// test/TestMyToken.sol
pragma solidity ^0.4.24;

import "truffle/Assert.sol";
import "../contracts/MyToken.sol";

contract TestMyToken {
    MyToken token;

    function beforeEach() public {
        token = new MyToken(1000000, "MyToken", "MTK", 18);
    }

    function testInitialBalance() public {
        uint expected = 1000000;
        Assert.equal(token.totalSupply(), expected, "Total supply should be 1000000");
    }

    function testTransfer() public {
        address sender = address(this);
        address receiver = address(0x1234);

        token.transfer(receiver, 100);

        Assert.equal(token.balanceOf(receiver), 100, "Receiver balance should be 100");
    }
}
```

## OpenZeppelin 合約庫集成

OpenZeppelin 是最廣泛使用的 Solidity 合約庫之一，提供了經過安全審計的標準合約實現：

```bash
npm install openzeppelin-solidity
```

```javascript
// truffle-config.js 增加 import 路徑
module.exports = {
    compilers: {
        solc: {
            version: '0.4.24',
            optimizer: { enabled: true, runs: 200 }
        }
    },
    // ...
};
```

```solidity
// contracts/MyToken.sol
pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract MyToken is ERC20, ERC20Detailed, Ownable {
    constructor(
        uint256 initialSupply,
        string memory name,
        string memory symbol,
        uint8 decimals
    )
        public
        ERC20Detailed(name, symbol, decimals)
    {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}
```

使用 OpenZeppelin 的好處：

1. **安全審計**：所有合約經過社區審計，減少漏洞風險
2. **標準實現**：ERC20、ERC721 等標準接口的正確實現
3. **可複用模塊**：Ownable、Pausable、SafeMath 等常用功能

## truffle-contract 在前端的使用

Truffle 編譯後的 JSON 文件可以直接在前端使用，簡化合約實例化過程：

```javascript
// 前端中使用 truffle-contract
const contract = require('truffle-contract');
const Web3 = require('web3');

// 導入編譯後的合約 JSON
const MyTokenArtifact = require('./build/contracts/MyToken.json');

const MyToken = contract(MyTokenArtifact);

// 設置 Provider
if (typeof web3 !== 'undefined') {
    MyToken.setProvider(web3.currentProvider);
} else {
    MyToken.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
}

// 獲取已部署的合約實例
async function getTokenInstance(networkId) {
    // 從 networks 字段中獲取部署地址
    const deployedAddress = MyTokenArtifact.networks[networkId].address;
    const instance = await MyToken.at(deployedAddress);
    return instance;
}

// 使用合約
async function getTokenInfo() {
    const accounts = await web3.eth.getAccounts();
    const instance = await getTokenInstance(await web3.eth.net.getId());

    const name = await instance.name();
    const symbol = await instance.symbol();
    const totalSupply = await instance.totalSupply();
    const balance = await instance.balanceOf(accounts[0]);

    return { name, symbol, totalSupply: totalSupply.toNumber(), balance: balance.toNumber() };
}
```

`truffle-contract` 相比原生 `web3.js` 的合約 API 有幾個優勢：

1. **自動處理 Gas 估算**：不需要手動設置 Gas Limit
2. **Promise 風格**：即使底層是 web3.js 0.20.x 也返回 Promise
3. **交易哈希和回執統一處理**：`send` 方法返回回執而非僅返回交易哈希
4. **網路感知**：合約 JSON 中包含部署地址，自動匹配當前網路

## 完整的 Truffle 項目配置與遷移腳本

```javascript
// migrations/2_deploy_token.js
const MyToken = artifacts.require('MyToken');
const TokenVesting = artifacts.require('TokenVesting');

module.exports = function(deployer, network, accounts) {
    const [owner, teamWallet, advisorWallet] = accounts;

    deployer.deploy(
        MyToken,
        1000000000,          // 10 億總量
        'MyToken',
        'MTK',
        18,
        { from: owner, gas: 2000000 }
    ).then(async function(tokenInstance) {
        console.log('MyToken deployed at:', tokenInstance.address);

        // 部署鎖倉合約
        await deployer.deploy(
            TokenVesting,
            teamWallet,
            Math.floor(Date.now() / 1000) + 86400 * 90,  // 90 天后開始釋放
            86400 * 30,   // 每月釋放
            12,            // 12 期
            { from: owner, gas: 1500000 }
        );

        const vestingInstance = await TokenVesting.deployed();
        console.log('TokenVesting deployed at:', vestingInstance.address);

        // 將鎖倉代幣轉入鎖倉合約
        await tokenInstance.transfer(
            vestingInstance.address,
            200000000,  // 2 億鎖倉
            { from: owner }
        );

        console.log('Deployment complete');
        console.log('Total supply:', (await tokenInstance.totalSupply()).toNumber());
        console.log('Vesting balance:', (await tokenInstance.balanceOf(vestingInstance.address)).toNumber());
    });
};
```

## 與 plain web3.js 開發的對比

| 特性 | plain web3.js | Truffle |
|------|--------------|---------|
| 項目結構 | 自由組織 | 規範化目錄結構 |
| 編譯 | 手動調用 solc | `truffle compile` 一鍵編譯 |
| 部署 | 手動編寫部署腳本 | 遷移腳本管理 |
| 測試 | 手動搭建測試環境 | 內置 Mocha + Assert |
| 合約 ABI 管理 | 手動維護 JSON 文件 | 編譯輸出自動生成 |
| 多網路部署 | 手動切換 Provider | 配置文件管理 |
| 依賴管理 | 手動複製合約文件 | npm 集成 |

plain web3.js 開發的問題在於沒有工程規範——每個開發者自行決定目錄結構、部署流程和測試方案，導致項目間難以複用經驗。Truffle 的價值在於提供了一套約定優於配置的工程規範。

## 小結

Truffle 在以太坊 DApp 工程化中扮演了基礎設施的角色——它不一定是最優雅的工具，但它是不可或缺的。它將智能合約開發從手工作坊模式帶入了工程化階段：項目結構、編譯流程、部署管理、測試框架，這些基礎設施讓 DApp 項目的可維護性大幅提升。

Truffle 的遷移機制是一個值得稱道的設計。通過簡單的序號前綴和 Migrations 合約的狀態跟蹤，實現了可復現的部署流程。這對團隊協作尤為重要——不同的開發者可以確保部署相同版本的合約到不同環境。

但 Truffle 也有其侷限。編譯速度慢（依賴 solc 編譯器）、測試框架與 JavaScript 生態集成不深、truffle-contract 在前端引入了額外的依賴體積。這些侷限也為 Hardhat 等更現代化的替代方案提供了發展空間。

Truffle 的定位是"夠用但不完美"的工程化工具。它解決了"能不能做"的問題，但在"做得好不好"方面還有提升空間。對於從傳統前端轉入 DApp 開發的工程師，Truffle 提供了熟悉的 npm/Mocha 體驗，降低了入門門檻。理解 Truffle 的工程化思路，其核心概念（編譯、遷移、測試）在其他工具鏈中同樣適用。
