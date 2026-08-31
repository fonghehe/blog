---
title: "Truffle Framework Development Guide: Engineering DApp Projects"
date: 2018-09-09 17:05:37
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 7
wordCount: 830
description: "When smart contracts grow from simple storage examples into real business logic, Remix's online IDE quickly proves inadequate. Contracts depending on each other"
---

When smart contracts grow from simple storage examples into real business logic, Remix's online IDE quickly proves inadequate. Contracts depending on each other, the need for version management, automated testing, and multi-environment deployment create the need for a framework. Truffle is a widely used standard for Ethereum DApp engineering: it brings contract development from the "write a file, deploy a file" model into a structured project management system.

## Truffle Project Structure

A standard Truffle project contains the following directories:

```
my-dapp/
├── contracts/           # Solidity 合约源文件
│   ├── Migrations.sol   # 迁移管理合约（Truffle 自动生成）
│   └── MyContract.sol   # 业务合约
├── migrations/          # 迁移脚本
│   ├── 1_initial_migration.js
│   └── 2_deploy_contracts.js
├── test/                # 测试文件
│   ├── mycontract.js    # JavaScript 测试
│   └── TestMyContract.sol  # Solidity 测试
├── build/               # 编译输出（自动生成）
│   └── contracts/       # 编译后的 JSON 文件（含 ABI、bytecode）
├── truffle-config.js    # 配置文件（Windows 用 truffle.js）
└── package.json
```

Initialize a new project:

```bash
npm install -g truffle
truffle init
```

The `contracts/` directory holds all Solidity source files, the `migrations/` directory holds deployment scripts, and the `test/` directory holds test files. The `build/` directory is auto-generated after compilation, containing each contract's ABI, bytecode, and AST information.

## Contract Compilation: truffle compile

```bash
truffle compile
```

Truffle reads all `.sol` files under `contracts/` and compiles them using the `solc` compiler. The compilation output goes to the `build/contracts/` directory, with one JSON file per contract:

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

The `networks` field records the contract's deployment addresses across various networks. Truffle uses this field to manage "same code, multi-network deployment."

## Migration Scripts: truffle migrate

Migration scripts are one of Truffle's core concepts. They are not database migrations but rather a set of deployment scripts executed in order, with the numeric prefix in the filename determining execution order.

### The Migrations.sol Contract

The auto-generated `Migrations.sol` is used to track migration state:

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

### Writing Migration Scripts

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
    // 先部署依赖合约
    deployer.deploy(MyToken, 1000000, "MyToken", "MTK", 18)
        .then(function() {
            // 再部署依赖 MyToken 的合约
            return deployer.deploy(TokenSale, MyToken.address, accounts[0]);
        });
};
```

### Deployment Process

```bash
# 部署到本地 Ganache
truffle migrate

# 部署到 Ropsten 测试网
truffle migrate --network ropsten

# 重置迁移状态（从头开始）
truffle migrate --reset
```

The execution logic of `truffle migrate`:

1. Check the value of `last_completed_migration` in the `Migrations` contract
2. Execute migration scripts with numbers greater than that value
3. After each script completes, update `last_completed_migration`

This mechanism ensures migration scripts are executed only once, avoiding duplicate deployments. However, in practice, if contract logic changes require redeployment, you need to use the `--reset` flag or add new migration scripts.

## Test Network Configuration: truffle-config.js

```javascript
// truffle-config.js
const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'your twelve word mnemonic phrase here';

module.exports = {
    // 编译器配置
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
        // 本地开发网络
        development: {
            host: '127.0.0.1',
            port: 7545,          // Ganache 默认端口
            network_id: '*',     // 匹配任何网络 ID
            gas: 6721975,
            gasPrice: 20000000000  // 20 Gwei
        },

        // Ganache CLI
        ganache: {
            host: '127.0.0.1',
            port: 8545,
            network_id: 5777
        },

        // Ropsten 测试网（通过 Infura）
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

        // 主网
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

`HDWalletProvider` is one of Truffle's key plugins—it generates signing accounts from a mnemonic phrase and works with Infura nodes to enable deployment without running a local node. This is a major convenience: you can deploy contracts without syncing the entire Ethereum blockchain.

## Contract Testing

### JavaScript Tests

```javascript
// test/mytoken.js
const MyToken = artifacts.require('MyToken');

contract('MyToken', function(accounts) {
    const [owner, alice, bob] = accounts;

    beforeEach(async function() {
        this.token = await MyToken.new(1000000, 'MyToken', 'MTK', 18);
    });

    describe('基本属性', function() {
        it('应该有正确的名称', async function() {
            const name = await this.token.name();
            assert.equal(name, 'MyToken');
        });

        it('应该有正确的符号', async function() {
            const symbol = await this.token.symbol();
            assert.equal(symbol, 'MTK');
        });

        it('应该有正确的总供应量', async function() {
            const totalSupply = await this.token.totalSupply();
            assert.equal(totalSupply.toNumber(), 1000000);
        });
    });

    describe('转账功能', function() {
        it('应该正确转账', async function() {
            await this.token.transfer(alice, 100, { from: owner });

            const aliceBalance = await this.token.balanceOf(alice);
            assert.equal(aliceBalance.toNumber(), 100);

            const ownerBalance = await this.token.balanceOf(owner);
            assert.equal(ownerBalance.toNumber(), 999900);
        });

        it('余额不足时应该失败', async function() {
            // 使用 catchRevert 或 try/catch
            try {
                await this.token.transfer(bob, 100, { from: alice });
                assert.fail('应该抛出异常');
            } catch (error) {
                assert.include(error.message, 'revert');
            }
        });
    });

    describe('授权与额度', function() {
        it('应该正确授权并使用 transferFrom', async function() {
            // owner 授权 alice 1000
            await this.token.approve(alice, 1000, { from: owner });

            const allowance = await this.token.allowance(owner, alice);
            assert.equal(allowance.toNumber(), 1000);

            // alice 从 owner 转给 bob
            await this.token.transferFrom(owner, bob, 500, { from: alice });

            const bobBalance = await this.token.balanceOf(bob);
            assert.equal(bobBalance.toNumber(), 500);
        });
    });
});
```

### Solidity Tests

Solidity tests have the advantage of running directly in the EVM environment, closer to the actual execution environment of the contract:

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

## OpenZeppelin Contract Library Integration

OpenZeppelin is the most important Solidity contract library, providing security-audited standard contract implementations:

```bash
npm install openzeppelin-solidity
```

```javascript
// truffle-config.js 增加 import 路径
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

Benefits of using OpenZeppelin:

1. **Security audit**: All contracts are community-audited, reducing vulnerability risk
2. **Standard implementations**: Correct, audited implementations of interfaces like ERC20 and ERC721
3. **Reusable modules**: Common functionality like Ownable, Pausable, SafeMath

## Using truffle-contract in the Frontend

Truffle's compiled JSON files can be used directly in the frontend, simplifying contract instantiation:

```javascript
// 前端中使用 truffle-contract
const contract = require('truffle-contract');
const Web3 = require('web3');

// 导入编译后的合约 JSON
const MyTokenArtifact = require('./build/contracts/MyToken.json');

const MyToken = contract(MyTokenArtifact);

// 设置 Provider
if (typeof web3 !== 'undefined') {
    MyToken.setProvider(web3.currentProvider);
} else {
    MyToken.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
}

// 获取已部署的合约实例
async function getTokenInstance(networkId) {
    // 从 networks 字段中获取部署地址
    const deployedAddress = MyTokenArtifact.networks[networkId].address;
    const instance = await MyToken.at(deployedAddress);
    return instance;
}

// 使用合约
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

`truffle-contract` has several advantages over the native `web3.js` contract API:

1. **Automatic gas estimation**: No need to manually set gas limits
2. **Promise style**: Returns Promises even when the underlying layer is web3.js 0.20.x
3. **Unified transaction hash and receipt handling**: The `send` method returns a receipt rather than just a transaction hash
4. **Network awareness**: The contract JSON contains deployment addresses, automatically matching the current network

## Complete Truffle Project Configuration and Migration Script

```javascript
// migrations/2_deploy_token.js
const MyToken = artifacts.require('MyToken');
const TokenVesting = artifacts.require('TokenVesting');

module.exports = function(deployer, network, accounts) {
    const [owner, teamWallet, advisorWallet] = accounts;

    deployer.deploy(
        MyToken,
        1000000000,          // 10 亿总量
        'MyToken',
        'MTK',
        18,
        { from: owner, gas: 2000000 }
    ).then(async function(tokenInstance) {
        console.log('MyToken deployed at:', tokenInstance.address);

        // 部署锁仓合约
        await deployer.deploy(
            TokenVesting,
            teamWallet,
            Math.floor(Date.now() / 1000) + 86400 * 90,  // 90 天后开始释放
            86400 * 30,   // 每月释放
            12,            // 12 期
            { from: owner, gas: 1500000 }
        );

        const vestingInstance = await TokenVesting.deployed();
        console.log('TokenVesting deployed at:', vestingInstance.address);

        // 将锁仓代币转入锁仓合约
        await tokenInstance.transfer(
            vestingInstance.address,
            200000000,  // 2 亿锁仓
            { from: owner }
        );

        console.log('Deployment complete');
        console.log('Total supply:', (await tokenInstance.totalSupply()).toNumber());
        console.log('Vesting balance:', (await tokenInstance.balanceOf(vestingInstance.address)).toNumber());
    });
};
```

## Comparison with Plain web3.js Development

| Feature | Plain web3.js | Truffle |
|---------|--------------|---------|
| Project structure | Freely organized | Standardized directory structure |
| Compilation | Manual solc invocation | One-command `truffle compile` |
| Deployment | Hand-written deployment scripts | Migration script management |
| Testing | Manual test environment setup | Built-in Mocha + Assert |
| Contract ABI management | Manually maintained JSON files | Auto-generated from compilation output |
| Multi-network deployment | Manual Provider switching | Configuration file management |
| Dependency management | Manual contract file copying | npm integration |

The problem with plain web3.js development is the lack of engineering standards—each developer decides their own directory structure, deployment process, and testing approach, making it difficult to reuse experience across projects. Truffle's value lies in providing a convention-over-configuration engineering standard.

## Summary

Truffle plays the role of "webpack" in the Ethereum ecosystem—it may not be the most elegant tool, but it is indispensable. It brings smart contract development from a manual workshop model into the engineering stage: project structure, compilation pipeline, deployment management, and testing framework—these infrastructure components significantly improve DApp project maintainability.

Truffle's migration mechanism is a commendable design. Through simple numeric prefixes and state tracking via the Migrations contract, it achieves reproducible deployment processes. This is particularly important for team collaboration—different developers can ensure they deploy the same version of contracts to different environments.

However, Truffle also has its limitations. Slow compilation speed (dependent on the solc compiler), shallow integration with the JavaScript ecosystem in the testing framework, and the extra dependency footprint that truffle-contract introduces in the frontend. These issues later catalyzed more modern alternatives like Hardhat.

From a practical perspective, Truffle's positioning as an engineering tool is "good enough but not perfect." It solves the "can we do it" question, but leaves significant room for improvement on the "do it well" front. For engineers transitioning from traditional frontend to DApp development, Truffle provides a familiar npm/Mocha experience, lowering the barrier to entry. Understanding Truffle's engineering philosophy—even if you later migrate to other toolchains—the core concepts (compilation, migration, testing) remain universally applicable.
