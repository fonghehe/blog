---
title: "MetaMask Integration in Practice: Connecting Browser Wallets"
date: 2018-05-21 12:08:47
tags:
  - Web3
  - Ethereum
  - DApp
---

MetaMask is one of the most critical pieces of infrastructure in the DApp ecosystem. It serves both as a wallet for users to manage their Ethereum accounts and as the bridge connecting DApp frontends to the blockchain. For frontend developers, MetaMask integration is a mandatory subject in DApp development—but the pitfalls encountered during integration are far more numerous than expected: users not having it installed, network mismatches, permission denials, and cancelled transactions—each scenario requires proper handling.

## How the MetaMask Browser Extension Works

MetaMask is essentially an Ethereum Provider injected into web pages. When a user installs the MetaMask extension, it injects a `web3` instance (earlier versions) or an `ethereum` object (post-EIP-1102) into the `window` object on every page load.

Its internal architecture is as follows:

1. **Background Script**: Runs in the extension's background, managing private keys, signing transactions, and maintaining the connection to Ethereum nodes
2. **Content Script**: Injected into web pages, serving as a message bridge between the page and the Background Script
3. **Injected Object**: The `window.web3` / `window.ethereum` object exposed to the page

MetaMask does not expose the user's private keys to web pages. When a DApp needs to send a transaction, MetaMask pops up a confirmation window, the user confirms the signature within the extension interface, and the signed transaction is sent to the node by MetaMask. This process ensures that private keys never leave MetaMask's secure sandbox.

## The window.web3 / window.ethereum Injection Mechanism

The MetaMask injection mechanism changed with the introduction of EIP-1102:

### Early Approach (MetaMask < v4)

MetaMask directly injected a complete web3.js instance onto `window`, which DApps could use directly:

```javascript
// 早期：MetaMask 注入 web3 实例
if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    // 用户未安装 MetaMask
    console.log('No MetaMask found');
}
```

The problem with this approach was security—any webpage could directly read the user's address without authorization. This raised privacy concerns.

### EIP-1102 Approach (MetaMask v4+)

Starting with v4, MetaMask introduced the `window.ethereum` object and no longer exposed account information by default. DApps must actively request user authorization:

```javascript
// EIP-1102：需要用户授权才能获取账户
window.ethereum.enable()
    .then(accounts => {
        console.log('Authorized account:', accounts[0]);
    })
    .catch(error => {
        console.log('User denied authorization');
    });
```

This change was a watershed moment for DApp UX—shifting from "auto-connect" to "user must manually confirm connection," similar to the OAuth authorization flow in traditional web.

## Detecting Whether MetaMask Is Installed

```javascript
function detectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
        // 新版 MetaMask（EIP-1102）
        return { installed: true, isEnabled: false, provider: window.ethereum };
    } else if (typeof window.web3 !== 'undefined') {
        // 旧版 MetaMask 或其他钱包（如 Mist 浏览器）
        return { installed: true, isEnabled: true, provider: window.web3.currentProvider };
    } else {
        // 未安装
        return { installed: false };
    }
}

// 在页面加载时检测
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

## Requesting Account Authorization

```javascript
function connectMetaMask() {
    return new Promise((resolve, reject) => {
        if (typeof window.ethereum === 'undefined') {
            reject(new Error('MetaMask is not installed'));
            return;
        }

        // EIP-1102 授权请求
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
                    // 用户拒绝了授权请求
                    reject(new Error('User rejected authorization'));
                } else {
                    reject(error);
                }
            });
    });
}

// 在用户点击连接按钮时调用
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

## Getting the Current Network ID and Chain ID

MetaMask supports switching between different networks (Mainnet, Ropsten, Rinkeby, Kovan, local dev network). DApps need to detect the current network and handle it accordingly:

```javascript
var web3 = new Web3(window.ethereum || window.web3.currentProvider);

// 获取网络 ID
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

// 获取链 ID（web3.js 1.0）
web3.eth.getChainId().then(chainId => {
    console.log('Chain ID:', chainId);
});
```

Contract addresses differ across networks. A DApp should maintain a network-to-address mapping:

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

## Sending Transactions: eth_sendTransaction

MetaMask intercepts `eth_sendTransaction` RPC calls and pops up a transaction confirmation window:

```javascript
function sendTransaction(txParams) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction(txParams, function(err, txHash) {
            if (err) {
                // 用户可能在 MetaMask 中拒绝了交易
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

// 调用示例
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

// 等待交易确认
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

## Network Change Event Listening

When a user switches networks in MetaMask, the DApp needs to detect the change and reinitialize:

```javascript
// MetaMask 在网络切换时会重新加载页面（旧版行为）
// 但在某些版本中，页面不会自动重载，需要主动监听

// 方法 1：轮询网络 ID（兼容所有版本）
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

// 方法 2：监听 MetaMask 注入的事件（较新版本）
if (window.ethereum) {
    window.ethereum.on('networkChanged', function(netId) {
        console.log('Network changed to:', netId);
        handleNetworkChange(netId);
    });

    // 账户切换监听
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
    // 重新初始化合约实例
    contract = new web3.eth.Contract(abi, getContractAddress(netId));
    refreshUI();
}

function handleAccountChange(newAccount) {
    currentAccount = newAccount;
    refreshUI();
}
```

## Complete MetaMask Connection Manager

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

        // 检测 MetaMask
        var provider = this._detectProvider();
        if (!provider) {
            this._emit('error', new Error('MetaMask not installed'));
            return;
        }

        this.web3 = new Web3(provider);
        this._startNetworkPolling();

        // 监听 MetaMask 事件（如果支持）
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
                // 旧版兼容
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

## User Experience Design

### Installation Guidance

When it is detected that the user does not have MetaMask installed, clear guidance should be provided:

```javascript
function showInstallPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'metamask-install-overlay';
    overlay.innerHTML = '\
        <div class="install-card">\
            <h3>MetaMask Installation Required</h3>\
            <p>This application requires the MetaMask wallet to interact with the Ethereum blockchain.</p>\
            <a href="https://metamask.io/" target="_blank" class="btn-primary">\
                Install MetaMask\
            </a>\
            <p class="hint">Please refresh this page after installation</p>\
        </div>\
    ';
    document.body.appendChild(overlay);
}
```

### Network Mismatch Notification

```javascript
function checkNetwork() {
    if (!MetaMaskManager.isNetworkSupported()) {
        showNetworkBanner(
            'Current Network: ' + MetaMaskManager.getNetworkName(),
            'Please switch to Mainnet or Ropsten in MetaMask'
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

## Security Considerations

1. **Do not trust addresses passed from the frontend**: Contracts should use `msg.sender` rather than address parameters passed from the frontend to determine the operator's identity
2. **Verify transaction parameters**: Before sending a transaction, the frontend should clearly display the recipient address, amount, and data for user confirmation
3. **Prevent phishing**: DApps should never ask users to enter private keys or keystore passwords—all signing operations should be done through MetaMask
4. **HTTPS**: Production environments must use HTTPS, otherwise MetaMask may refuse to inject
5. **Validate contract addresses**: The frontend should verify that contract address formats are correct and verify them on Etherscan after deployment

## Summary

MetaMask integration appears simple—detect, connect, send transactions in three steps—but the details involved far exceed expectations. Network switching, account switching, authorization denial, transaction cancellation, and gas estimation errors—each edge case directly impacts the user experience.

The biggest pain point of MetaMask integration is API instability across versions. From `window.web3` to `window.ethereum.enable()`, from automatic page reloads to event listening, the API has undergone multiple changes. DApp developers need to write compatibility code to handle different MetaMask versions.

From a higher perspective, MetaMask represents a new identity authentication paradigm—no longer "username + password" but "wallet address + signature authorization." This paradigm shifts identity control from the server to the user, and is the concrete manifestation of Web3's decentralization philosophy in the frontend. Understanding this paradigm shift is more important than mastering any specific MetaMask API.
