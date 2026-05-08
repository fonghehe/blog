---
title: "MetaMask 集成实践：浏览器钱包对接"
date: 2018-05-21 12:08:47
tags:
  - Web3
  - Ethereum
  - DApp
---

MetaMask 是 DApp 生态中最关键的基础设施之一。它既是用户管理以太坊账户的钱包，又是 DApp 前端连接区块链的桥梁。对于前端开发者而言，MetaMask 集成是 DApp 开发的必修课——但集成过程中的坑远比想象中多：用户未安装、网络不匹配、权限拒绝、交易被取消，每个场景都需要妥善处理。

## MetaMask 浏览器扩展的工作原理

MetaMask 本质上是一个注入到网页中的以太坊 Provider。当用户安装 MetaMask 扩展后，它会在每个页面加载时向 `window` 对象注入一个 `web3` 实例（早期）或 `ethereum` 对象（EIP-1102 之后）。

其内部架构如下：

1. **Background Script**：运行在扩展后台，管理私钥、签名交易、维护与以太坊节点的连接
2. **Content Script**：注入到网页中，作为网页与 Background Script 之间的消息桥
3. **Injected Object**：暴露给网页的 `window.web3` / `window.ethereum` 对象

MetaMask 不会将用户的私钥暴露给网页。当 DApp 需要发送交易时，MetaMask 弹出确认窗口，用户在扩展界面内确认签名，签名后的交易由 MetaMask 发送到节点。这个过程确保了私钥永远不会离开 MetaMask 的安全沙箱。

## window.web3 / window.ethereum 注入机制

MetaMask 的账户注入机制包含两种主要方案：

### 早期方案（MetaMask < v4）

MetaMask 直接在 `window` 上注入完整的 web3.js 实例，DApp 可以直接使用：

```javascript
// 早期：MetaMask 注入 web3 实例
if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    // 用户未安装 MetaMask
    console.log('No MetaMask found');
}
```

这种方案的问题在于安全性——任意网页都能直接读取用户地址，无需用户授权。这引发了隐私争议。

### EIP-1102 方案（MetaMask v4+）

MetaMask v4 开始引入 `window.ethereum` 对象，不再默认暴露账户信息。DApp 必须主动请求用户授权：

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

这个变化是 DApp UX 的一个分水岭——从"自动连接"变成了"用户需手动确认连接"，类似于传统 Web 中的 OAuth 授权流程。

## 检测 MetaMask 是否安装

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

## 请求账号授权

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

## 获取当前网络 ID 与链 ID

MetaMask 支持切换不同网络（Mainnet、Ropsten、Rinkeby、Kovan、本地开发网）。DApp 需要检测当前网络并做出相应处理：

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

不同网络下的合约地址不同。DApp 应该维护一个网络-地址映射表：

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

## 发送交易：eth_sendTransaction

MetaMask 拦截 `eth_sendTransaction` RPC 调用，弹出交易确认窗口：

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

## 网络切换事件监听

当用户在 MetaMask 中切换网络时，DApp 需要感知变化并重新初始化：

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

## 完整的 MetaMask 连接管理器

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

## 用户体验设计

### 引导安装

当检测到用户未安装 MetaMask 时，应提供清晰的引导：

```javascript
function showInstallPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'metamask-install-overlay';
    overlay.innerHTML = '\
        <div class="install-card">\
            <h3>需要安装 MetaMask</h3>\
            <p>本应用需要 MetaMask 钱包来与以太坊区块链交互。</p>\
            <a href="https://metamask.io/" target="_blank" class="btn-primary">\
                安装 MetaMask\
            </a>\
            <p class="hint">安装后请刷新此页面</p>\
        </div>\
    ';
    document.body.appendChild(overlay);
}
```

### 网络不匹配提示

```javascript
function checkNetwork() {
    if (!MetaMaskManager.isNetworkSupported()) {
        showNetworkBanner(
            '当前网络: ' + MetaMaskManager.getNetworkName(),
            '请在 MetaMask 中切换到 Mainnet 或 Ropsten'
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

## 安全注意事项

1. **不要信任前端传入的地址**：合约中应使用 `msg.sender` 而非前端传入的地址参数来确定操作者身份
2. **验证交易参数**：在发送交易前，前端应清晰展示交易的接收地址、金额、数据等内容，让用户确认
3. **防止钓鱼**：DApp 不应要求用户输入私钥或 Keystore 密码——所有签名操作都应通过 MetaMask 完成
4. **HTTPS**：生产环境必须使用 HTTPS，否则 MetaMask 可能拒绝注入
5. **校验合约地址**：前端应验证合约地址格式正确，并在部署后通过 Etherscan 验证

## 小结

MetaMask 集成看似简单——检测、连接、发交易三步走——但实际涉及的细节远超预期。网络切换、账户切换、授权拒绝、交易取消、Gas 估算错误，每个边界条件都直接影响用户体验。

MetaMask 集成最大的痛点之一在于 API 的版本差异。从 `window.web3` 到 `window.ethereum.enable()`，从页面自动重载到事件监听，API 几经变动。DApp 开发者需要编写兼容代码来处理不同版本的 MetaMask。

从更高层面看，MetaMask 代表了一种新的身份认证范式——不再是"用户名+密码"，而是"钱包地址+签名授权"。这种范式将身份控制权从服务端转移到了用户手中，是 Web3 去中心化理念在前端的具体体现。理解这种范式转变，比掌握 MetaMask 的某个具体 API 更重要。
