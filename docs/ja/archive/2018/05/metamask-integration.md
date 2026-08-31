---
title: "MetaMask統合の実践：ブラウザウォレットの連携"
date: 2018-05-21 12:08:47
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 10
wordCount: 1973
description: "MetaMaskはDAppエコシステムにおいて最も重要なインフラの一つです。ユーザーがEthereumアカウントを管理するウォレットであると同時に、DAppフロントエンドがブロックチェーンに接続するブリッジでもあります。フロントエンドデベロッパーにとって、MetaMaskの統合はDApp開発の必修科目です——しかし統合"
---

MetaMaskはDAppエコシステムにおいて最も重要なインフラの一つです。ユーザーがEthereumアカウントを管理するウォレットであると同時に、DAppフロントエンドがブロックチェーンに接続するブリッジでもあります。フロントエンドデベロッパーにとって、MetaMaskの統合はDApp開発の必修科目です——しかし統合の過程の落とし穴は想像よりはるかに多くあります：ユーザーがインストールしていない、ネットワークが一致しない、権限が拒否される、トランザクションがキャンセルされるなど、各シナリオを適切に処理する必要があります。

## MetaMaskブラウザ拡張の仕組み

MetaMaskは本質的にウェブページに注入されるEthereum Providerです。ユーザーがMetaMask拡張をインストールすると、各ページ読み込み時に`window`オブジェクトに`web3`インスタンス（初期）または`ethereum`オブジェクト（EIP-1102以降）を注入します。

内部アーキテクチャは以下の通りです：

1. **Background Script**：拡張のバックグラウンドで実行され、秘密鍵の管理、トランザクションの署名、Ethereumノードとの接続の維持を行います
2. **Content Script**：ウェブページに注入され、ウェブページとBackground Script間のメッセージブリッジとして機能します
3. **Injected Object**：ウェブページに公開される`window.web3` / `window.ethereum`オブジェクト

MetaMaskはユーザーの秘密鍵をウェブページに公開しません。DAppがトランザクションを送信する必要がある場合、MetaMaskが確認ウィンドウをポップアップし、ユーザーが拡張画面内で署名を確認すると、署名されたトランザクションはMetaMaskによってノードに送信されます。このプロセスにより、秘密鍵がMetaMaskのセキュアサンドボックスから出ることがありません。

## window.web3 / window.ethereum注入メカニズム

MetaMaskの注入メカニズムは重要な変化を経ており、現在は以下のようになっています：

### 初期のアプローチ（MetaMask < v4）

MetaMaskは`window`に完全なweb3.jsインスタンスを直接注入し、DAppは直接使用できました：

```javascript
// 初期：MetaMaskがweb3インスタンスを注入
if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    // ユーザーがMetaMaskをインストールしていない
    console.log('No MetaMask found');
}
```

このアプローチの問題はセキュリティです——任意のウェブページがユーザーアドレスを直接読み取れ、ユーザーの許可が不要でした。これはプライバシー上の問題を引き起こしました。

### EIP-1102アプローチ（MetaMask v4+）

MetaMask v4から`window.ethereum`オブジェクトを導入し、アカウント情報をデフォルトで公開しなくなりました。DAppはユーザーの許可を自らリクエストする必要があります：

```javascript
// EIP-1102：ユーザー許可を得てアカウントを取得
window.ethereum.enable()
    .then(accounts => {
        console.log('Authorized account:', accounts[0]);
    })
    .catch(error => {
        console.log('User denied authorization');
    });
```

この変化はDApp UXの転換点でした——「自動接続」から「ユーザーが手動で接続を確認」へと変わり、従来のWebにおけるOAuth認可フローに似ています。

## MetaMaskがインストールされているかの検出

```javascript
function detectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
        // 新版MetaMask（EIP-1102）
        return { installed: true, isEnabled: false, provider: window.ethereum };
    } else if (typeof window.web3 !== 'undefined') {
        // 旧版MetaMaskまたは他のウォレット（Mistブラウザなど）
        return { installed: true, isEnabled: true, provider: window.web3.currentProvider };
    } else {
        // インストールされていない
        return { installed: false };
    }
}

// ページ読み込み時に検出
window.addEventListener('load', function() {
    var metaMaskStatus = detectMetaMask();
    if (!metaMaskStatus.installed) {
        showInstallPrompt();
    } else if (!metaMaskStatus.isEnabled) {
        showConnectButton();
    } else {
        initializeDApp(metaMaskStatus.provider);
    }
});
```

## アカウント許可のリクエスト

```javascript
function connectMetaMask() {
    return new Promise((resolve, reject) => {
        if (typeof window.ethereum === 'undefined') {
            reject(new Error('MetaMask is not installed'));
            return;
        }

        // EIP-1102許可リクエスト
        window.ethereum.enable()
            .then(accounts => {
                if (accounts.length === 0) {
                    reject(new Error('No accounts returned'));
                    return;
                }
                resolve(accounts[0]);
            })
            .catch(error => {
                if (error.code === 4001) {
                    // ユーザーが許可リクエストを拒否した
                    reject(new Error('User rejected authorization'));
                } else {
                    reject(error);
                }
            });
    });
}

// ユーザーが接続ボタンをクリックした時に呼び出し
document.getElementById('connect-btn').addEventListener('click', async function() {
    try {
        this.disabled = true;
        this.textContent = 'Connecting...';

        var account = await connectMetaMask();
        console.log('Connected account:', account);

        this.textContent = 'Connected';
        initializeDApp(account);
    } catch (error) {
        console.error(error.message);
        this.disabled = false;
        this.textContent = 'Connect MetaMask';
        showErrorMessage(error.message);
    }
});
```

## 現在のネットワークIDとチェーンIDの取得

MetaMaskは異なるネットワークの切り替えをサポートしています（Mainnet、Ropsten、Rinkeby、Kovan、ローカル開発ネット）。DAppは現在のネットワークを検出し、適切に処理する必要があります：

```javascript
var web3 = new Web3(window.ethereum || window.web3.currentProvider);

// ネットワークIDを取得
web3.eth.net.getId(function(err, netId) {
    switch (netId) {
        case 1:
            console.log('Mainnet');
            break;
        case 3:
            console.log('Ropsten Testnet');
            break;
        case 4:
            console.log('Rinkeby Testnet');
            break;
        case 42:
            console.log('Kovan Testnet');
            break;
        default:
            console.log('Unknown network:', netId);
    }
});

// チェーンIDを取得（web3.js 1.0）
web3.eth.getChainId().then(chainId => {
    console.log('Chain ID:', chainId);
});
```

ネットワークが異なるとコントラクトアドレスも異なります。DAppはネットワーク-アドレスのマッピングテーブルを維持すべきです：

```javascript
var CONTRACT_ADDRESSES = {
    1: '0xmainnet...',     // Mainnet
    3: '0xropsten...',     // Ropsten
    4: '0xrinkeby...',     // Rinkeby
    42: '0xkovan...'       // Kovan
};

function getContractAddress(networkId) {
    var address = CONTRACT_ADDRESSES[networkId];
    if (!address) {
        throw new Error('Contract not deployed on network ' + networkId);
    }
    return address;
}
```

## トランザクション送信：eth_sendTransaction

MetaMaskは`eth_sendTransaction` RPC呼び出しをインターセプトし、トランザクション確認ウィンドウをポップアップします：

```javascript
function sendTransaction(txParams) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction(txParams, function(err, txHash) {
            if (err) {
                // ユーザーがMetaMask内でトランザクションを拒否した可能性
                if (err.code === 4001 || err.message.includes('User denied')) {
                    reject(new Error('Transaction rejected by user'));
                } else {
                    reject(err);
                }
            } else {
                resolve(txHash);
            }
        });
    });
}

// 呼び出し例
var txParams = {
    from: currentAccount,
    to: contractAddress,
    gas: web3.utils.toHex(200000),
    gasPrice: web3.utils.toHex(web3.utils.toWei('10', 'gwei')),
    value: '0x0',
    data: contract.methods.setValue('hello').encodeABI()
};

sendTransaction(txParams)
    .then(txHash => {
        console.log('Transaction sent:', txHash);
        return waitForTransaction(txHash);
    })
    .then(receipt => {
        console.log('Transaction confirmed:', receipt);
    })
    .catch(error => {
        if (error.message === 'Transaction rejected by user') {
            console.log('User cancelled the transaction');
        } else {
            console.error('Transaction failed:', error);
        }
    });

// トランザクション確定を待機
function waitForTransaction(txHash) {
    return new Promise((resolve, reject) => {
        var checkInterval = setInterval(function() {
            web3.eth.getTransactionReceipt(txHash, function(err, receipt) {
                if (receipt) {
                    clearInterval(checkInterval);
                    if (receipt.status === '0x1') {
                        resolve(receipt);
                    } else {
                        reject(new Error('Transaction reverted'));
                    }
                }
            });
        }, 2000);
    });
}
```

## ネットワーク切り替えイベントのリスニング

ユーザーがMetaMaskでネットワークを切り替えた時、DAppは変化を感知して再初期化する必要があります：

```javascript
// MetaMaskはネットワーク切り替え時にページをリロードする（旧版の挙動）
// ただし一部のバージョンではページが自動リロードされず、明示的にリスニングする必要があります

// 方法1：ネットワークIDをポーリング（全バージョン互換）
var currentNetworkId = null;

function checkNetworkChange() {
    web3.eth.net.getId(function(err, netId) {
        if (netId !== currentNetworkId) {
            currentNetworkId = netId;
            handleNetworkChange(netId);
        }
    });
}

setInterval(checkNetworkChange, 2000);

// 方法2：MetaMaskが注入したイベントをリスニング（比較的新しいバージョン）
if (window.ethereum) {
    window.ethereum.on('networkChanged', function(netId) {
        console.log('Network changed to:', netId);
        handleNetworkChange(netId);
    });

    // アカウント切り替えのリスニング
    window.ethereum.on('accountsChanged', function(accounts) {
        console.log('Account switched to:', accounts[0]);
        handleAccountChange(accounts[0]);
    });
}

function handleNetworkChange(netId) {
    if (!CONTRACT_ADDRESSES[netId]) {
        showNetworkError('Please switch to a supported network');
        return;
    }
    // コントラクトインスタンスを再初期化
    contract = new web3.eth.Contract(abi, getContractAddress(netId));
    refreshUI();
}

function handleAccountChange(newAccount) {
    currentAccount = newAccount;
    refreshUI();
}
```

## 完全なMetaMask接続マネージャー

```javascript
// metamask-manager.js
var Web3 = require('web3');
var abi = require('./contract-abi.json');

var NETWORKS = {
    1: 'Mainnet',
    3: 'Ropsten',
    4: 'Rinkeby',
    42: 'Kovan'
};

var CONTRACT_ADDRESSES = {
    1: '0x...',
    3: '0x...',
    4: '0x...'
};

var MetaMaskManager = {
    web3: null,
    account: null,
    networkId: null,
    contract: null,
    listeners: {},

    init: function() {
        var self = this;

        // MetaMaskを検出
        var provider = this._detectProvider();
        if (!provider) {
            this._emit('error', new Error('MetaMask not installed'));
            return;
        }

        this.web3 = new Web3(provider);
        this._startNetworkPolling();

        // MetaMaskイベントをリスニング（サポートされている場合）
        if (window.ethereum && window.ethereum.on) {
            window.ethereum.on('accountsChanged', function(accounts) {
                self.account = accounts[0];
                self._emit('accountChanged', self.account);
            });
        }
    },

    _detectProvider: function() {
        if (typeof window.ethereum !== 'undefined') {
            return window.ethereum;
        } else if (typeof window.web3 !== 'undefined') {
            return window.web3.currentProvider;
        }
        return null;
    },

    connect: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            if (typeof window.ethereum !== 'undefined') {
                window.ethereum.enable()
                    .then(function(accounts) {
                        self.account = accounts[0];
                        self._initContract();
                        self._emit('connected', self.account);
                        resolve(self.account);
                    })
                    .catch(reject);
            } else if (typeof window.web3 !== 'undefined') {
                // 旧版互換
                self.account = window.web3.eth.accounts[0];
                self._initContract();
                resolve(self.account);
            } else {
                reject(new Error('MetaMask not installed'));
            }
        });
    },

    _initContract: function() {
        if (!CONTRACT_ADDRESSES[this.networkId]) {
            this._emit('error', new Error('Unsupported network: ' + NETWORKS[this.networkId]));
            return;
        }
        this.contract = new this.web3.eth.Contract(
            abi,
            CONTRACT_ADDRESSES[this.networkId]
        );
    },

    _startNetworkPolling: function() {
        var self = this;
        function check() {
            self.web3.eth.net.getId().then(function(netId) {
                if (netId !== self.networkId) {
                    self.networkId = netId;
                    if (self.account) {
                        self._initContract();
                    }
                    self._emit('networkChanged', netId);
                }
            });
        }
        check();
        setInterval(check, 3000);
    },

    on: function(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    },

    _emit: function(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(function(cb) { cb(data); });
        }
    },

    getNetworkName: function() {
        return NETWORKS[this.networkId] || 'Unknown';
    },

    isNetworkSupported: function() {
        return !!CONTRACT_ADDRESSES[this.networkId];
    }
};

module.exports = MetaMaskManager;
```

## ユーザーエクスペリエンス設計

### インストールのガイド

ユーザーがMetaMaskをインストールしていないと検出した場合、明確なガイドを提供すべきです：

```javascript
function showInstallPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'metamask-install-overlay';
    overlay.innerHTML = '\
        <div class="install-card">\
            <h3>MetaMaskのインストールが必要です</h3>\
            <p>このアプリケーションはEthereumブロックチェーンと相互作用するためにMetaMaskウォレットが必要です。</p>\
            <a href="https://metamask.io/" target="_blank" class="btn-primary">\
                MetaMaskをインストール\
            </a>\
            <p class="hint">インストール後にこのページをリロードしてください</p>\
        </div>\
    ';
    document.body.appendChild(overlay);
}
```

### ネットワーク不一致のヒント

```javascript
function checkNetwork() {
    if (!MetaMaskManager.isNetworkSupported()) {
        showNetworkBanner(
            '現在のネットワーク: ' + MetaMaskManager.getNetworkName(),
            'MetaMaskでMainnetまたはRopstenに切り替えてください'
        );
        return false;
    }
    return true;
}

function showNetworkBanner(title, message) {
    var banner = document.createElement('div');
    banner.className = 'network-warning';
    banner.innerHTML = '<strong>' + title + '</strong> — ' + message;
    document.body.insertBefore(banner, document.body.firstChild);
}
```

## セキュリティ上の注意事項

1. **フロントエンドから入力されたアドレスを信頼しない**：コントラクトではフロントエンドから渡されるアドレスパラメータではなく`msg.sender`を使用して操作者を特定すべきです
2. **トランザクションパラメータの検証**：トランザクション送信前に、フロントエンドは受信アドレス、金額、データなどを明確に表示し、ユーザーに確認させるべきです
3. **フィッシングの防止**：DAppはユーザーに秘密鍵やKeystoreパスワードの入力を求めるべきではありません——すべての署名操作はMetaMaskを通じて行うべきです
4. **HTTPS**：本番環境ではHTTPSが必須です。そうしないとMetaMaskが注入を拒否する可能性があります
5. **コントラクトアドレスの検証**：フロントエンドはコントラクトアドレスの形式が正しいことを検証し、デプロイ後にEtherscanで検証すべきです

## まとめ

MetaMask統合はシンプルに見えます——検出、接続、トランザクション送信の3ステップ——しかし実際に関わる詳細は予想をはるかに超えています。ネットワーク切り替え、アカウント切り替え、許可の拒否、トランザクションのキャンセル、Gas推定エラーなど、各エッジケースがユーザーエクスペリエンスに直接影響します。

MetaMask統合における最大の痛点の一つは、過去のAPI変更への対応です。`window.web3`から`window.ethereum.enable()`へ、ページ自動リロードからイベントリスニングへとAPIは移行しました。そのため、DAppデベロッパーは異なるバージョンのMetaMaskを処理するための互換コードを含めるのが一般的です。

より高い視点から見ると、MetaMaskは新しいアイデンティティ認証パラダイムを代表しています——「ユーザー名＋パスワード」ではなく「ウォレットアドレス＋署名認可」です。このパラダイムはアイデンティティの管理権をサーバーサイドからユーザーの手に移しました。これはWeb3の分散型の理念のフロントエンドにおける具体的な現れです。このパラダイムシフトを理解することは、MetaMaskの特定のAPIを習得することよりも重要です。
