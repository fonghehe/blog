---
readingTime: 8
wordCount: 1087
title: "MetaMask 集成實踐：瀏覽器錢包對接"
date: 2018-05-21 12:08:47
tags:
  - Web3
  - Ethereum
  - DApp
description: "MetaMask 是 DApp 生態中最關鍵的基礎設施之一。它既是用戶管理以太坊賬戶的錢包，又是 DApp 前端連接區塊鏈的橋樑。對於前端開發者而言，MetaMask 集成是 DApp 開發的必修課——但集成過程中的坑遠比想象中多：用戶未安裝、網絡不匹配、權限拒絕、交易被取消，每個場景都需要妥善處理。"
---

MetaMask 是 DApp 生態中最關鍵的基礎設施之一。它既是用戶管理以太坊賬戶的錢包，又是 DApp 前端連接區塊鏈的橋樑。對於前端開發者而言，MetaMask 集成是 DApp 開發的必修課——但集成過程中的坑遠比想象中多：用戶未安裝、網絡不匹配、權限拒絕、交易被取消，每個場景都需要妥善處理。

## MetaMask 瀏覽器擴展的工作原理

MetaMask 本質上是一個注入到網頁中的以太坊 Provider。當用戶安裝 MetaMask 擴展後，它會在每個頁面加載時向 `window` 對象注入一個 `web3` 實例（早期）或 `ethereum` 對象（EIP-1102 之後）。

其內部架構如下：

1. **Background Script**：運行在擴展後臺，管理私鑰、簽名交易、維護與以太坊節點的連接
2. **Content Script**：注入到網頁中，作為網頁與 Background Script 之間的消息橋
3. **Injected Object**：暴露給網頁的 `window.web3` / `window.ethereum` 對象

MetaMask 不會將用戶的私鑰暴露給網頁。當 DApp 需要發送交易時，MetaMask 彈出確認窗口，用戶在擴展界面內確認簽名，簽名後的交易由 MetaMask 發送到節點。這個過程確保了私鑰永遠不會離開 MetaMask 的安全沙箱。

## window.web3 / window.ethereum 注入機制

MetaMask 的注入機制經歷了重要演進：

### 早期方案（MetaMask < v4）

MetaMask 直接在 `window` 上注入完整的 web3.js 實例，DApp 可以直接使用：

```javascript
// 早期：MetaMask 注入 web3 實例
if (typeof web3 !== 'undefined') {
    web3 = new Web3(web3.currentProvider);
} else {
    // 用戶未安裝 MetaMask
    console.log('No MetaMask found');
}
```

這種方案的問題在於安全性——任意網頁都能直接讀取用戶地址，無需用戶授權。這引發了隱私爭議。

### EIP-1102 方案（MetaMask v4+）

MetaMask v4 開始引入 `window.ethereum` 對象，不再默認暴露賬戶信息。DApp 必須主動請求用戶授權：

```javascript
// EIP-1102：需要用戶授權才能獲取賬戶
window.ethereum.enable()
    .then(accounts => {
        console.log('Authorized account:', accounts[0]);
    })
    .catch(error => {
        console.log('User denied authorization');
    });
```

這個變化是 DApp UX 的一個分水嶺——從"自動連接"變成了"用戶需手動確認連接"，類似於傳統 Web 中的 OAuth 授權流程。

## 檢測 MetaMask 是否安裝

```javascript
function detectMetaMask() {
    if (typeof window.ethereum !== 'undefined') {
        // 新版 MetaMask（EIP-1102）
        return { installed: true, isEnabled: false, provider: window.ethereum };
    } else if (typeof window.web3 !== 'undefined') {
        // 舊版 MetaMask 或其他錢包（如 Mist 瀏覽器）
        return { installed: true, isEnabled: true, provider: window.web3.currentProvider };
    } else {
        // 未安裝
        return { installed: false };
    }
}

// 在頁面加載時檢測
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

## 請求賬號授權

```javascript
function connectMetaMask() {
    return new Promise((resolve, reject) => {
        if (typeof window.ethereum === 'undefined') {
            reject(new Error('MetaMask is not installed'));
            return;
        }

        // EIP-1102 授權請求
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
                    // 用戶拒絕了授權請求
                    reject(new Error('User rejected authorization'));
                } else {
                    reject(error);
                }
            });
    });
}

// 在用戶點擊連接按鈕時調用
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

## 獲取當前網絡 ID 與鏈 ID

MetaMask 支持切換不同網絡（Mainnet、Ropsten、Rinkeby、Kovan、本地開發網）。DApp 需要檢測當前網絡並做出相應處理：

```javascript
var web3 = new Web3(window.ethereum || window.web3.currentProvider);

// 獲取網絡 ID
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

// 獲取鏈 ID（web3.js 1.0）
web3.eth.getChainId().then(chainId => {
    console.log('Chain ID:', chainId);
});
```

不同網絡下的合約地址不同。DApp 應該維護一個網絡-地址映射表：

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

## 發送交易：eth_sendTransaction

MetaMask 攔截 `eth_sendTransaction` RPC 調用，彈出交易確認窗口：

```javascript
function sendTransaction(txParams) {
    return new Promise((resolve, reject) => {
        web3.eth.sendTransaction(txParams, function(err, txHash) {
            if (err) {
                // 用戶可能在 MetaMask 中拒絕了交易
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

// 調用示例
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

// 等待交易確認
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

## 網絡切換事件監聽

當用戶在 MetaMask 中切換網絡時，DApp 需要感知變化並重新初始化：

```javascript
// MetaMask 在網絡切換時會重新加載頁面（舊版行為）
// 但在某些版本中，頁面不會自動重載，需要主動監聽

// 方法 1：輪詢網絡 ID（兼容所有版本）
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

// 方法 2：監聽 MetaMask 注入的事件（較新版本）
if (window.ethereum) {
    window.ethereum.on('networkChanged', function(netId) {
        console.log('Network changed to:', netId);
        handleNetworkChange(netId);
    });

    // 賬戶切換監聽
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
    // 重新初始化合約實例
    contract = new web3.eth.Contract(abi, getContractAddress(netId));
    refreshUI();
}

function handleAccountChange(newAccount) {
    currentAccount = newAccount;
    refreshUI();
}
```

## 完整的 MetaMask 連接管理器

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

        // 檢測 MetaMask
        var provider = this._detectProvider();
        if (!provider) {
            this._emit('error', new Error('MetaMask not installed'));
            return;
        }

        this.web3 = new Web3(provider);
        this._startNetworkPolling();

        // 監聽 MetaMask 事件（如果支持）
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
                // 舊版兼容
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

## 用戶體驗設計

### 引導安裝

當檢測到用戶未安裝 MetaMask 時，應提供清晰的引導：

```javascript
function showInstallPrompt() {
    var overlay = document.createElement('div');
    overlay.className = 'metamask-install-overlay';
    overlay.innerHTML = '\
        <div class="install-card">\
            <h3>需要安裝 MetaMask</h3>\
            <p>本應用需要 MetaMask 錢包來與以太坊區塊鏈交互。</p>\
            <a href="https://metamask.io/" target="_blank" class="btn-primary">\
                安裝 MetaMask\
            </a>\
            <p class="hint">安裝後請刷新此頁面</p>\
        </div>\
    ';
    document.body.appendChild(overlay);
}
```

### 網絡不匹配提示

```javascript
function checkNetwork() {
    if (!MetaMaskManager.isNetworkSupported()) {
        showNetworkBanner(
            '當前網絡: ' + MetaMaskManager.getNetworkName(),
            '請在 MetaMask 中切換到 Mainnet 或 Ropsten'
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

## 安全注意事項

1. **不要信任前端傳入的地址**：合約中應使用 `msg.sender` 而非前端傳入的地址參數來確定操作者身份
2. **驗證交易參數**：在發送交易前，前端應清晰展示交易的接收地址、金額、數據等內容，讓用戶確認
3. **防止釣魚**：DApp 不應要求用戶輸入私鑰或 Keystore 密碼——所有簽名操作都應通過 MetaMask 完成
4. **HTTPS**：生產環境必須使用 HTTPS，否則 MetaMask 可能拒絕注入
5. **校驗合約地址**：前端應驗證合約地址格式正確，並在部署後通過 Etherscan 驗證

## 小結

MetaMask 集成看似簡單——檢測、連接、發交易三步走——但實際涉及的細節遠超預期。網絡切換、賬戶切換、授權拒絕、交易取消、Gas 估算錯誤，每個邊界條件都直接影響用戶體驗。

MetaMask 集成最大的挑戰在於 API 的演進與不穩定性。從 `window.web3` 到 `window.ethereum.enable()`，從頁面自動重載到事件監聽，API 隨版本變動。DApp 開發者需要編寫兼容代碼來處理不同版本的 MetaMask。

從更高層面看，MetaMask 代表了一種新的身份認證範式——不再是"用戶名+密碼"，而是"錢包地址+簽名授權"。這種範式將身份控制權從服務端轉移到了用戶手中，是 Web3 去中心化理念在前端的具體體現。理解這種範式轉變，比掌握 MetaMask 的某個具體 API 更重要。
