---
title: "Web3.js入門：JavaScriptでEthereumと相互作用する"
date: 2018-04-03 20:17:15
tags:
  - Web3
  - Ethereum
  - DApp
---

web3.jsはEthereum公式がメンテナンスするJavaScript SDKであり、フロントエンドエンジニアがDApp開発に入るための最初の壁でもあります。0.20.x系と1.x系でAPI設計の差が大きく、0.20.xはコールバック関数を使用し、1.xはPromiseとイベントエミッターを導入しています。本記事では両方のスタイルを扱い、それぞれの違いを整理します。

## web3.js 0.xバージョンのAPI設計

web3.js 0.20.xのAPI設計はNode.jsの初期スタイルに深く影響を受けており、Promiseではなくコールバック関数を多用しています。コアモジュールには以下が含まれます：

- `web3.eth`：Ethereumブロックチェーン関連の操作
- `web3.net`：ネットワーク情報
- `web3.personal`：アカウント管理
- `web3.shh`：Whisperプロトコル（メッセージパッシング）

```javascript
// 0.20.xの典型的なコールバックスタイル
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

web3.eth.getBlockNumber(function(error, result) {
    if (!error) {
        console.log('Current block:', result);
    } else {
        console.error(error);
    }
});

// 1.0 betaのPromiseスタイル
const Web3 = require('web3');
const web3 = new Web3('http://localhost:8545');

web3.eth.getBlockNumber().then(result => {
    console.log('Current block:', result);
});
```

実際のプロジェクトでは、0.20.xがPromiseをサポートしていないため、通常手動でラップする必要があります：

```javascript
// コールバックスタイルのAPIをPromiseにラップ
function promisify(fn) {
    return function(...args) {
        return new Promise((resolve, reject) => {
            fn.apply(null, [...args, (err, result) => {
                if (err) reject(err);
                else resolve(result);
            }]);
        });
    };
}

const getBalance = promisify(web3.eth.getBalance);
const getBlockNumber = promisify(web3.eth.getBlockNumber);
```

## Ethereumノードへの接続

web3.jsはProvider抽象レイヤーを通じてEthereumノードと通信し、2つの主要なProviderをサポートしています：

### HttpProvider

```javascript
// ローカルノードに接続
var web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

// リモートノードに接続（Infuraなど）
var web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/YOUR_API_KEY'));
```

HttpProviderは標準HTTPリクエストに基づいており、各呼び出しが独立したリクエスト-レスポンスサイクルです。利点はシンプルで安定していること、欠点はリアルタイムイベントリスニングが実現できないことです——ポーリングで模擬する必要があります。

### IpcProvider

```javascript
// IPC ProviderはNode.js環境でのみ利用可能。ローカルGeth/Parityノードに接続
var net = require('net');
var web3 = new Web3(new Web3.providers.IpcProvider('/path/to/geth.ipc', net));
```

IpcProviderはUnix Domain Socketを通じて通信し、HTTPよりも高効率で、ローカルノードを運用するシナリオに適しています。

### Providerの切り替え

DApp開発では、通常環境に応じてProviderを動的に切り替える必要があります：

```javascript
var Web3 = require('web3');
var web3;

if (typeof web3 !== 'undefined') {
    // MetaMaskがweb3インスタンスを注入した
    web3 = new Web3(web3.currentProvider);
} else {
    // ローカルノードまたはリモートノードにフォールバック
    web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
}
```

## アカウント管理

### 新規アカウントの作成

```javascript
// 0.20.xでアカウントを作成（注意：ローカルアカウントを生成するだけで、ノードには同期されません）
var account = web3.eth.accounts.create();
console.log(account.address);   // 0x...
console.log(account.privateKey); // 0x...

// 1.0 beta
web3.eth.accounts.create().then(account => {
    console.log(account.address);
});
```

### Keystoreのインポート

Keystoreファイルは暗号化保存された秘密鍵であり、パスワードで復号してアカウントを取得します：

```javascript
// Keystoreファイルからアカウントを復元
var keythereum = require('keythereum');
var datadir = '/path/to/ethereum/data';
var address = '0x...';
var password = 'your-password';

var keyObject = keythereum.importFromFile(address, datadir);
var privateKey = keythereum.recover(password, keyObject);
console.log('Private key:', privateKey.toString('hex'));
```

### 署名トランザクション

```javascript
// 秘密鍵で署名してトランザクションを送信
var tx = {
    from: '0x...',
    to: '0x...',
    value: web3.utils.toWei('1', 'ether'),
    gas: 21000,
    gasPrice: web3.utils.toWei('10', 'gwei'),
    nonce: 0
};

// 1.0 betaで秘密鍵を使用して署名
web3.eth.accounts.signTransaction(tx, privateKey)
    .then(signed => {
        return web3.eth.sendSignedTransaction(signed.rawTransaction);
    })
    .then(receipt => {
        console.log('Transaction mined:', receipt.transactionHash);
    });
```

## コントラクトのインスタンス化

コントラクトのインスタンス化にはABI（Application Binary Interface）とコントラクトアドレスが必要です。ABIはJSON配列で、コントラクトの関数、イベント、構造体などの情報を記述します：

```javascript
var abi = [{
    "constant": true,
    "inputs": [],
    "name": "getValue",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
}, {
    "constant": false,
    "inputs": [{"name": "_value", "type": "string"}],
    "name": "setValue",
    "outputs": [],
    "type": "function"
}, {
    "anonymous": false,
    "inputs": [{"indexed": false, "name": "value", "type": "string"}],
    "name": "ValueChanged",
    "type": "event"
}];

var contractAddress = '0x1234567890abcdef...';

// 0.20.x方式
var contract = web3.eth.contract(abi).at(contractAddress);

// 1.0 beta方式
var contract = new web3.eth.Contract(abi, contractAddress);
```

## オンチェーンデータの読み取り：callメソッド

読み取り操作はオンチェーンでなく、Gasを消費せず、`call`メソッドを使用します：

```javascript
// 0.20.x
contract.getValue(function(err, result) {
    if (!err) {
        console.log('Value:', result);
    }
});

// 1.0 beta
contract.methods.getValue().call()
    .then(result => {
        console.log('Value:', result);
    });

// 特定アドレスから呼び出し
contract.methods.getValue().call({ from: '0x...' })
    .then(result => console.log(result));
```

`call`メソッドにはトランザクションパラメータを渡すこともできます。例えば`from`アドレスを指定して、特定ユーザーの視点からの状態をシミュレートできます（コントラクトロジックが`msg.sender`に依存する場合）。

## トランザクションの送信：sendメソッドとイベントリスニング

書き込み操作はトランザクションをオンチェーンで送信する必要があり、Gasを消費します。1.0 betaの`send`メソッドは豊富なチェーン式イベントリスニングを提供します：

```javascript
// 1.0 betaでトランザクション送信
contract.methods.setValue('Hello Ethereum').send({
    from: '0x...',
    gas: 200000,
    gasPrice: web3.utils.toWei('10', 'gwei')
})
.on('transactionHash', function(hash) {
    console.log('Transaction sent:', hash);
})
.on('receipt', function(receipt) {
    console.log('Transaction mined:', receipt.transactionHash);
})
.on('confirmation', function(confirmationNumber, receipt) {
    console.log('Confirmations:', confirmationNumber);
})
.on('error', function(error) {
    console.error('Transaction failed:', error);
});
```

```javascript
// 0.20.xでトランザクション送信 + イベントリスニング
contract.setValue('Hello Ethereum', {
    from: web3.eth.accounts[0],
    gas: 200000
}, function(err, txHash) {
    if (!err) {
        // ValueChangedイベントをリスニング
        var event = contract.ValueChanged();
        event.watch(function(error, result) {
            if (!error) {
                console.log('Value changed to:', result.args.value);
                console.log('By:', result.args.changer);
                event.stopWatching();
            }
        });
    }
});
```

## 完全なフロントエンドDApp相互作用モジュール

```javascript
// dapp-client.js —— DAppフロントエンド相互作用レイヤー
var Web3 = require('web3');
var contractAbi = require('./abi.json');

var DAppClient = {
    web3: null,
    contract: null,
    account: null,

    init: function(provider, contractAddress) {
        this.web3 = new Web3(provider);
        this.contract = this.web3.eth.contract(contractAbi).at(contractAddress);
        return this;
    },

    getAccount: function(callback) {
        var self = this;
        this.web3.eth.getAccounts(function(err, accounts) {
            if (err) return callback(err);
            self.account = accounts[0];
            callback(null, accounts[0]);
        });
    },

    getBalance: function(address, callback) {
        this.web3.eth.getBalance(address, function(err, balance) {
            if (err) return callback(err);
            callback(null, this.web3.fromWei(balance, 'ether').toNumber());
        }.bind(this));
    },

    // コントラクトの値を読み取り
    getValue: function(callback) {
        this.contract.getValue(callback);
    },

    // コントラクトに値を書き込み
    setValue: function(value, callback) {
        var self = this;
        this.contract.setValue(value, {
            from: this.account,
            gas: 200000
        }, function(err, txHash) {
            if (err) return callback(err);

            // ポーリングでトランザクション確定を待機
            var filter = self.web3.eth.filter('latest');
            filter.watch(function(error) {
                if (error) return;
                self.web3.eth.getTransactionReceipt(txHash, function(err, receipt) {
                    if (receipt && receipt.blockNumber) {
                        filter.stopWatching();
                        callback(null, receipt);
                    }
                });
            });
        });
    },

    // コントラクトイベントをリスニング
    watchEvent: function(eventName, callback) {
        var event = this.contract[eventName]({}, { fromBlock: 0, toBlock: 'latest' });
        event.watch(function(error, result) {
            if (!error) {
                callback(result.args);
            }
        });
        return event;
    }
};

module.exports = DAppClient;
```

## よくあるエラーとデバッグのヒント

### BigNumberの問題

web3.jsは内部でBigNumber.jsを使用して大きな数を処理します。JavaScriptネイティブのNumberではuint256を正確に表現できないためです：

```javascript
// エラー：Number型を直接使用
var balance = web3.eth.getBalance(address); // BigNumber
console.log(balance); // BigNumber object

// 正しい：単位に変換してから使用
var etherBalance = web3.fromWei(balance, 'ether').toNumber();
```

### トランザクションの「消失」

トランザクション送信後にレシートがないのはよくある問題です。原因は通常Gas不足またはnonceが正しくないことです：

```javascript
// Gasを推定
contract.methods.setValue('test').estimateGas({ from: account })
    .then(gas => {
        console.log('Estimated gas:', gas);
        // gas = estimated * 1.2 に設定することを推奨
    });

// nonceを確認
web3.eth.getTransactionCount(account)
    .then(nonce => console.log('Next nonce:', nonce));
```

### イベントが取得できない

0.20.xではイベントリスニングはノードが`eth_getLogs`と`eth_subscribe`をサポートすることに依存します。InfuraのHTTPエンドポイントを使用している場合、リアルタイムリスニングができず、`getPastEvents`をポーリングするしかありません：

```javascript
// ポーリングで履歴イベントを取得
function pollEvents(contract, eventName, lastBlock) {
    var event = contract[eventName]({}, { fromBlock: lastBlock, toBlock: 'latest' });
    event.get(function(error, logs) {
        if (!error && logs.length > 0) {
            logs.forEach(log => console.log(log));
        }
        setTimeout(() => pollEvents(contract, eventName, lastBlock + 1), 5000);
    });
}
```

## JSON-RPCインターフェースとの低レベルな関係

web3.jsは本質的にEthereumのJSON-RPCインターフェースのラッパーです。各web3.jsメソッド呼び出しは最終的にHTTP POSTリクエストに変換されます：

```javascript
// web3.js呼び出し
web3.eth.getBalance('0x...');

// 低レベルで送信されるJSON-RPCリクエスト
// POST http://localhost:8545
// {
//     "jsonrpc": "2.0",
//     "method": "eth_getBalance",
//     "params": ["0x...", "latest"],
//     "id": 1
// }
```

これを理解することは重要です。なぜなら：

1. **RPCメソッドマッピング**：web3.jsの各メソッドはJSON-RPCメソッドに対応します。例：`eth_sendTransaction`、`eth_call`、`eth_getLogs`など
2. **ノードの制限**：一部のパブリックノードは特定のRPCメソッドを無効化している場合があります（例：`personal_*`）
3. **JSON-RPCの直接使用**：極端なケースではweb3.jsをバイパスして直接RPCリクエストを送信できます

```javascript
// JSON-RPCを直接使用
var request = require('request');

function rpcCall(method, params) {
    return new Promise((resolve, reject) => {
        request({
            url: 'http://localhost:8545',
            method: 'POST',
            json: {
                jsonrpc: '2.0',
                method: method,
                params: params,
                id: 1
            }
        }, function(error, response, body) {
            if (error) reject(error);
            else resolve(body.result);
        });
    });
}

// 残高を直接取得
rpcCall('eth_getBalance', ['0x...', 'latest']).then(result => {
    console.log('Balance:', parseInt(result, 16));
});
```

## まとめ

web3.jsはDAppフロントエンド開発のインフラですが、いくつかの設計上の癖があります。0.20.xと1.xの併存により、開発者は2セットのAPIドキュメントを扱う必要があります。コールバック地獄の手動Promise化、BigNumberの使い方によるエラーの発生しやすさ、イベントリスニングがProviderによって挙動が異なる問題などです。

アーキテクチャの観点から見ると、web3.jsの設計はEthereum自体の複雑さを反映しています——トランザクション署名、ABIエンコード/デコード、イベントフィルタリング、単位変換などを同時に処理する必要があり、各段階でエラーが発生する可能性があります。これらのAPIの背後にあるJSON-RPCメカニズムを理解することは、API自体を暗記することよりも重要です。ライブラリに問題が発生した場合、最終的にはプロトコルレベルに戻って調査する必要があるからです。

ethers.jsなどの後発ライブラリは、よりクリアな型設計、より一貫したAPIスタイル、より充実したドキュメントでweb3.jsの多くの痛点を解決しています。web3.jsの設計上の特徴を理解することは、Ethereumフロントエンド開発の全体像を把握する上で重要です。
