---
title: "Truffleフレームワーク開発ガイド：DAppプロジェクトのエンジニアリング"
date: 2018-09-09 17:05:37
tags:
  - Web3
  - Ethereum
  - DApp
---

スマートコントラクトがシンプルなストレージの例から実際のビジネスロジックへと発展するにつれ、RemixのオンラインIDEはすぐに力不足となりました。コントラクト間の相互依存、バージョン管理の必要性、自動テストの必要性、マルチ環境デプロイの必要性——これらのニーズがTruffleフレームワークの誕生を促しました。TruffleはEthereum DAppエンジニアリングのデファクトスタンダードであり、コントラクト開発を「1つのファイルを書いて、1つのファイルをデプロイする」モードから、構造化されたプロジェクト管理体系へと導きました。

## Truffleプロジェクト構造

標準的なTruffleプロジェクトは以下のディレクトリで構成されます：

```
my-dapp/
├── contracts/           # Solidityコントラクトソースファイル
│   ├── Migrations.sol   # マイグレーション管理コントラクト（Truffleが自動生成）
│   └── MyContract.sol   # ビジネスコントラクト
├── migrations/          # マイグレーションスクリプト
│   ├── 1_initial_migration.js
│   └── 2_deploy_contracts.js
├── test/                # テストファイル
│   ├── mycontract.js    # JavaScriptテスト
│   └── TestMyContract.sol  # Solidityテスト
├── build/               # コンパイル出力（自動生成）
│   └── contracts/       # コンパイル後のJSONファイル（ABI、bytecodeを含む）
├── truffle-config.js    # 設定ファイル（Windowsはtruffle.js）
└── package.json
```

新規プロジェクトの初期化：

```bash
npm install -g truffle
truffle init
```

`contracts/`ディレクトリにはすべてのSolidityソースファイルを格納し、`migrations/`ディレクトリにはデプロイスクリプトを、`test/`ディレクトリにはテストファイルを格納します。`build/`ディレクトリはコンパイル後に自動生成され、各コントラクトのABI、bytecode、AST情報を含みます。

## コントラクトのコンパイル：truffle compile

```bash
truffle compile
```

Truffleは`contracts/`以下のすべての`.sol`ファイルを読み込み、`solc`コンパイラでコンパイルします。コンパイル結果は`build/contracts/`ディレクト вих に出力され、各コントラクトにつき1つのJSONファイルが対応します：

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

`networks`フィールドはコントラクトが各ネットワークにデプロイしたアドレスを記録します。Truffleはこのフィールドを通じて「同一コード、マルチネットワークデプロイ」の管理を実現します。

## マイグレーションスクリプト：truffle migrate

マイグレーションスクリプトはTruffleのコアコンセプトの一つです。データベースのマイグレーションではなく、順序付きで実行されるデプロイスクリプトのセットで、ファイル名のプレフィックスの数字が実行順序を決定します。

### Migrations.solコントラクト

Truffleが自動生成する`Migrations.sol`はマイグレーション状態を追跡します：

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

### マイグレーションスクリプトの作成

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
    // 最初に依存コントラクトをデプロイ
    deployer.deploy(MyToken, 1000000, "MyToken", "MTK", 18)
        .then(function() {
            // MyTokenに依存するコントラクトをデプロイ
            return deployer.deploy(TokenSale, MyToken.address, accounts[0]);
        });
};
```

### デプロイフロー

```bash
# ローカルGanacheにデプロイ
truffle migrate

# Ropstenテストネットにデプロイ
truffle migrate --network ropsten

# マイグレーション状態をリセット（最初からやり直し）
truffle migrate --reset
```

`truffle migrate`の実行ロジック：

1. `Migrations`コントラクトの`last_completed_migration`の値をチェック
2. その値より大きい番号のマイグレーションスクリプトを実行
3. 各スクリプトの実行完了後、`last_completed_migration`を更新

このメカニズムにより、マイグレーションスクリプトは1回のみ実行され、重複デプロイを回避できます。ただし実際の開発では、コントラクトロジックの変更で再デプロイが必要な場合、`--reset`パラメータを使用するか新しいマイグレーションスクリプトを追加する必要があります。

## テストネットワーク設定：truffle-config.js

```javascript
// truffle-config.js
const HDWalletProvider = require('truffle-hdwallet-provider');

const mnemonic = 'your twelve word mnemonic phrase here';

module.exports = {
    // コンパイラ設定
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
        // ローカル開発ネットワーク
        development: {
            host: '127.0.0.1',
            port: 7545,          // Ganacheのデフォルトポート
            network_id: '*',     // 任意のネットワークIDにマッチ
            gas: 6721975,
            gasPrice: 20000000000  // 20 Gwei
        },

        // Ganache CLI
        ganache: {
            host: '127.0.0.1',
            port: 8545,
            network_id: 5777
        },

        // Ropstenテストネット（Infura経由）
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

        // メインネット
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

`HDWalletProvider`はTruffleの重要なプラグインの一つで、ニーモニックから署名アカウントを生成し、Infuraノードと組み合わせることでローカルノード不要のデプロイを実現します。これは大きな利便性です——Ethereumブロックチェーン全体を同期することなくコントラクトをデプロイできます。

## コントラクトのテスト

### JavaScriptテスト

```javascript
// test/mytoken.js
const MyToken = artifacts.require('MyToken');

contract('MyToken', function(accounts) {
    const [owner, alice, bob] = accounts;

    beforeEach(async function() {
        this.token = await MyToken.new(1000000, 'MyToken', 'MTK', 18);
    });

    describe('基本属性', function() {
        it('正しい名前を持つべき', async function() {
            const name = await this.token.name();
            assert.equal(name, 'MyToken');
        });

        it('正しいシンボルを持つべき', async function() {
            const symbol = await this.token.symbol();
            assert.equal(symbol, 'MTK');
        });

        it('正しい総供給量を持つべき', async function() {
            const totalSupply = await this.token.totalSupply();
            assert.equal(totalSupply.toNumber(), 1000000);
        });
    });

    describe('転送機能', function() {
        it('正しく転送されるべき', async function() {
            await this.token.transfer(alice, 100, { from: owner });

            const aliceBalance = await this.token.balanceOf(alice);
            assert.equal(aliceBalance.toNumber(), 100);

            const ownerBalance = await this.token.balanceOf(owner);
            assert.equal(ownerBalance.toNumber(), 999900);
        });

        it('残高不足の場合は失敗すべき', async function() {
            // catchRevertまたはtry/catchを使用
            try {
                await this.token.transfer(bob, 100, { from: alice });
                assert.fail('例外がスローされるべき');
            } catch (error) {
                assert.include(error.message, 'revert');
            }
        });
    });

    describe('認可とアローワンス', function() {
        it('正しく認可しtransferFromを使用すべき', async function() {
            // ownerがaliceに1000を認可
            await this.token.approve(alice, 1000, { from: owner });

            const allowance = await this.token.allowance(owner, alice);
            assert.equal(allowance.toNumber(), 1000);

            // aliceがownerからbobに転送
            await this.token.transferFrom(owner, bob, 500, { from: alice });

            const bobBalance = await this.token.balanceOf(bob);
            assert.equal(bobBalance.toNumber(), 500);
        });
    });
});
```

### Solidityテスト

Solidityテストの利点は、EVM環境で直接実行でき、コントラクトの実際の実行環境に近いことです：

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

## OpenZeppelinコントラクトライブラリの統合

OpenZeppelinは最も重要なSolidityコントラクトライブラリの一つで、セキュリティ監査済みの標準コントラクト実装を提供します：

```bash
npm install openzeppelin-solidity
```

```javascript
// truffle-config.jsにimport パスを追加
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

OpenZeppelinを使用する利点：

1. **セキュリティ監査**：すべてのコントラクトがコミュニティによる監査を受けており、脆弱性リスクを低減
2. **標準実装**：ERC20、ERC721などの標準インターフェースの正しい実装
3. **再利用可能なモジュール**：Ownable、Pausable、SafeMathなどのよく使われる機能

## truffle-contractのフロントエンドでの使用

TruffleがコンパイルしたJSONファイルはフロントエンドで直接使用でき、コントラクトのインスタンス化プロセスを簡素化します：

```javascript
// フロントエンドでtruffle-contractを使用
const contract = require('truffle-contract');
const Web3 = require('web3');

// コンパイル後のコントラクトJSONをインポート
const MyTokenArtifact = require('./build/contracts/MyToken.json');

const MyToken = contract(MyTokenArtifact);

// Providerを設定
if (typeof web3 !== 'undefined') {
    MyToken.setProvider(web3.currentProvider);
} else {
    MyToken.setProvider(new Web3.providers.HttpProvider('http://localhost:8545'));
}

// デプロイ済みコントラクトインスタンスを取得
async function getTokenInstance(networkId) {
    // networks フィールドからデプロイアドレスを取得
    const deployedAddress = MyTokenArtifact.networks[networkId].address;
    const instance = await MyToken.at(deployedAddress);
    return instance;
}

// コントラクトを使用
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

`truffle-contract`はネイティブの`web3.js`コントラクトAPIに比べていくつかの利点があります：

1. **Gas推定の自動処理**：手動でGas Limitを設定する必要がない
2. **Promiseスタイル**：ベースがweb3.js 0.20.xでもPromiseを返す
3. **トランザクションハッシュとレシートの統一処理**：`send`メソッドはハッシュだけでなくレシートを返す
4. **ネットワーク認識**：コントラクトJSONにデプロイアドレスが含まれ、現在のネットワークに自動的にマッチ

## 完全なTruffleプロジェクト設定とマイグレーションスクリプト

```javascript
// migrations/2_deploy_token.js
const MyToken = artifacts.require('MyToken');
const TokenVesting = artifacts.require('TokenVesting');

module.exports = function(deployer, network, accounts) {
    const [owner, teamWallet, advisorWallet] = accounts;

    deployer.deploy(
        MyToken,
        1000000000,          // 10億総量
        'MyToken',
        'MTK',
        18,
        { from: owner, gas: 2000000 }
    ).then(async function(tokenInstance) {
        console.log('MyToken deployed at:', tokenInstance.address);

        // ロックアップコントラクトをデプロイ
        await deployer.deploy(
            TokenVesting,
            teamWallet,
            Math.floor(Date.now() / 1000) + 86400 * 90,  // 90日後にリリース開始
            86400 * 30,   // 毎月リリース
            12,            // 12期
            { from: owner, gas: 1500000 }
        );

        const vestingInstance = await TokenVesting.deployed();
        console.log('TokenVesting deployed at:', vestingInstance.address);

        // ロックアップトークンをロックアップコントラクトに転送
        await tokenInstance.transfer(
            vestingInstance.address,
            200000000,  // 2億ロックアップ
            { from: owner }
        );

        console.log('Deployment complete');
        console.log('Total supply:', (await tokenInstance.totalSupply()).toNumber());
        console.log('Vesting balance:', (await tokenInstance.balanceOf(vestingInstance.address)).toNumber());
    });
};
```

## プレーンなweb3.js開発との比較

| 特性 | プレーンなweb3.js | Truffle |
|------|--------------|---------|
| プロジェクト構造 | 自由な組織 | 規範化されたディレクトリ構造 |
| コンパイル | solcを手動呼び出し | `truffle compile`でワンクリックコンパイル |
| デプロイ | デプロイスクリプトを手動作成 | マイグレーションスクリプトで管理 |
| テスト | テスト環境を手動構築 | Mocha + Assertを内蔵 |
| コントラクトABI管理 | JSONファイルを手動メンテナンス | コンパイル出力を自動生成 |
| マルチネットワークデプロイ | Providerを手動切り替え | 設定ファイルで管理 |
| 依存関係管理 | コントラクトファイルを手動コピー | npm統合 |

プレーンなweb3.js開発の問題はエンジニアリングの規範がないことです——各デベロッパーが独自にディレクトリ構造、デプロイフロー、テスト方案を決定するため、プロジェクト間で経験を再利用しづらかったです。Truffleの価値は設定より規約のエンジニアリング規範を提供したことにあります。

## まとめ

TruffleはEthereumエコシステムにおいて「webpack」の役割を果たします——必ずしも最もエレガントなツールではありませんが、不可欠なものです。スマートコントラクト開発を手工芸的モードからエンジニアリング段階へと導きました：プロジェクト構造、コンパイルフロー、デプロイ管理、テストフレームワークといったインフラにより、DAppプロジェクトの保守性が大幅に向上しました。

Truffleのマイグレーションメカニズムは称賛に値する設計です。シンプルな番号プレフィックスとMigrationsコントラクトの状態追跡により、再現可能なデプロイフローを実現しました。これはチームコラボレーションにおいて特に重要です——異なるデベロッパーが同じバージョンのコントラクトを異なる環境にデプロイすることを保証できます。

しかしTruffleにも限界があります。コンパイル速度が遅い（solcコンパイラへの依存）、テストフレームワークとJavaScriptエコシステムの統合が浅い、truffle-contractがフロントエンドで余分な依存ボリュームを導入するなどです。これらの問題は、Truffle以降のツールチェーン（Hardhatなど）が改善を目指すポイントでもあります。

個人の観点から見ると、Truffleの位置づけは「使えるが完璧ではない」エンジニアリングツールです。「できるかどうか」の問題を解決しますが、「良くできているか」の面ではまだ大きな改善余地があります。従来のフロントエンドからDApp開発に転向するエンジニアにとって、Truffleは使い慣れたnpm/Mocha体験を提供し、入門の敷居を下げました。Truffleのエンジニアリングの考え方を理解することは、他のツールチェーンに移行した後でも、そのコアコンセプト（コンパイル、マイグレーション、テスト）は依然として通用します。
