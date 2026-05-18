---
readingTime: 5
wordCount: 1144
title: "WalletConnect 協議集成：跨錢包 DApp 連接"
date: 2020-08-15 11:44:27
tags:
  - Web3
  - DApp
---

## 為什麼需要 WalletConnect

MetaMask 瀏覽器擴展在桌面端為 DApp 提供了便捷的連接方式，但它有一個根本侷限：用戶必須在桌面瀏覽器中安裝 MetaMask 插件。移動端瀏覽器無法安裝擴展，這意味著移動端用戶無法直接使用 MetaMask 與 DApp 交互。

WalletConnect 協議正是為解決這個問題而生。它通過中繼服務器在 DApp 和錢包之間建立加密通信通道，使得任何設備上的 DApp 都能與任何移動錢包配對連接。WalletConnect 已被 Trust Wallet、Rainbow、Argent 等主流移動錢包廣泛支持，成為移動端 DApp 連接的事實標準。

## WalletConnect 協議核心原理

WalletConnect 的核心架構是一個**中繼服務器 + 加密載荷**的通信模型：

1. **DApp** 生成一個隨機密鑰和連接 URI
2. **錢包** 掃描 URI，提取會話信息和中繼服務器地址
3. 雙方通過中繼服務器建立 WebSocket 連接
4. 所有通信內容使用共享密鑰加密，中繼服務器只負責轉發加密消息，無法讀取內容

這種設計保證了即使中繼服務器是中心化運行的，用戶的私鑰和交易內容也不會洩露——私鑰永遠不離開錢包應用。

## v1 協議架構

### Bridge/Relay Server

中繼服務器是一個簡單的消息代理，維護一個 topic 到 WebSocket 連接的映射。當 DApp 向某個 topic 發送消息時，中繼服務器將消息轉發給訂閱了該 topic 的錢包。

```
DApp -> [encrypt payload] -> Relay Server -> [forward] -> Wallet
Wallet -> [encrypt payload] -> Relay Server -> [forward] -> DApp
```

v1 協議支持自建中繼服務器，默認使用 `https://bridge.walletconnect.org`。

### Session 與 Peer

會話建立後，雙方各自維護一個 session 對象，包含以下信息：

```typescript
interface WalletConnectSession {
  connected: boolean;
  accounts: string[];      // 錢包返回的地址列表
  chainId: number;         // 當前鏈 ID
  bridge: string;          // 中繼服務器 URL
  key: string;             // 加密密鑰（僅本地保存）
  clientId: string;        // DApp 端唯一標識
  clientMeta: {            // DApp 元信息
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  peerId: string;          // 錢包端唯一標識
  peerMeta: {              // 錢包元信息
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  handshakeId: number;
  handshakeTopic: string;
}
```

## 連接流程詳解

### 1. 生成連接 URI

DApp 創建 WalletConnect 實例時，會生成一個 URI 格式的連接字符串：

```
wc:8a5e5bdc-b85b-4ac2-b8cc-ede3858f7c88@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=4b9ab...
```

URI 的結構：
- `wc:` 協議前綴
- `8a5e5bdc-...` 會話 topic（UUID）
- `@1` 協議版本
- `bridge=` 中繼服務器 URL（URL 編碼）
- `key=` 加密密鑰（hex 編碼）

### 2. 掃碼與會話建立

錢包應用掃描二維碼後，解析 URI，連接到同一個中繼服務器，並返回一個 `session_request` 消息，包含錢包的 accounts 和 chainId。DApp 收到後確認會話建立。

## 前端集成實現

### 基礎連接管理器

```javascript
import WalletConnect from '@walletconnect/client';
import { IClientMeta } from '@walletconnect/types';

const DAPP_METADATA = {
  name: 'MyDApp',
  description: 'A decentralized application',
  url: 'https://mydapp.com',
  icons: ['https://mydapp.com/logo.png'],
};

class WalletConnectManager {
  constructor() {
    this.connector = null;
    this.session = null;
    this.listeners = new Map();
  }

  // 初始化連接
  async connect() {
    this.connector = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org',
      qrcodeModal: false, // 自定義 QR 展示
    });

    // 檢查是否已有會話
    if (this.connector.connected) {
      this.session = this.connector.session;
      this.setupEventListeners();
      return this.session;
    }

    // 創建新會話
    await this.connector.createSession();
    this.setupEventListeners();

    // 返回 URI 供前端生成二維碼
    return {
      uri: this.connector.uri,
      pending: true,
    };
  }

  // 事件監聽設置
  setupEventListeners() {
    // 會話建立
    this.connector.on('connect', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      const { accounts, chainId } = payload.params[0];
      this.session = {
        ...this.connector.session,
        accounts,
        chainId,
      };
      this.emit('connected', this.session);
    });

    // 會話更新（賬戶切換、鏈切換）
    this.connector.on('session_update', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      const { accounts, chainId } = payload.params[0];
      this.session = {
        ...this.connector.session,
        accounts,
        chainId,
      };
      this.emit('session_update', this.session);
    });

    // 斷開連接
    this.connector.on('disconnect', (error, payload) => {
      this.session = null;
      this.connector = null;
      this.emit('disconnect', error);
    });

    // 響應簽名請求的結果
    this.connector.on('call_request', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      this.emit('call_result', payload);
    });
  }

  // 斷開連接
  async disconnect() {
    if (this.connector && this.connector.connected) {
      await this.connector.killSession();
    }
    this.connector = null;
    this.session = null;
  }

  // 恢復會話
  async restoreSession() {
    // 從 localStorage 恢復
    const stored = localStorage.getItem('walletconnect');
    if (!stored) return null;

    const session = JSON.parse(stored);

    this.connector = new WalletConnect({
      bridge: session.bridge,
      session,
      qrcodeModal: false,
    });

    if (this.connector.connected) {
      this.session = this.connector.session;
      this.setupEventListeners();
      return this.session;
    }

    return null;
  }

  // 事件系統
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }
}
```

### 交易發送與簽名

```javascript
class WalletConnectManager {
  // ... 上面的方法

  // 發送交易
  async sendTransaction(txParams) {
    if (!this.connector || !this.session) {
      throw new Error('Wallet not connected');
    }

    const tx = {
      from: this.session.accounts[0],
      to: txParams.to,
      data: txParams.data || '0x',
      gas: txParams.gasLimit ? this.toHex(txParams.gasLimit) : undefined,
      gasPrice: txParams.gasPrice ? this.toHex(txParams.gasPrice) : undefined,
      value: txParams.value ? this.toHex(txParams.value) : '0x0',
      nonce: txParams.nonce ? this.toHex(txParams.nonce) : undefined,
    };

    return new Promise((resolve, reject) => {
      this.connector.sendTransaction(tx).then(resolve).catch(reject);
    });
  }

  // 簽名消息
  async signMessage(message) {
    if (!this.connector || !this.session) {
      throw new Error('Wallet not connected');
    }

    const msgParams = [
      this.session.accounts[0],
      this.toHex(message),
    ];

    return this.connector.signMessage(msgParams);
  }

  // 簽名 Typed Data (EIP-712)
  async signTypedData(typedData) {
    if (!this.connector || !this.session) {
      throw new Error('Wallet not connected');
    }

    const msgParams = [
      this.session.accounts[0],
      JSON.stringify(typedData),
    ];

    return this.connector.signTypedData(msgParams);
  }

  // 個人簽名 (EIP-191)
  async personalSign(message) {
    if (!this.connector || !this.session) {
      throw new Error('Wallet not connected');
    }

    const msgParams = [
      this.toHex(message),
      this.session.accounts[0],
    ];

    return this.connector.personalSign(msgParams);
  }

  // 工具：轉換為十六進制
  toHex(value) {
    if (typeof value === 'string' && value.startsWith('0x')) {
      return value;
    }
    if (typeof value === 'number') {
      return '0x' + value.toString(16);
    }
    if (typeof value === 'string') {
      // BigNumber 字符串
      return '0x' + BigInt(value).toString(16);
    }
    return value;
  }
}
```

### 合約調用封裝

```javascript
import { ethers } from 'ethers';

// 將 ethers.js 與 WalletConnect 橋接
class WalletConnectSigner extends ethers.Signer {
  constructor(provider, wcManager) {
    super();
    this.provider = provider;
    this.wcManager = wcManager;
    this._address = null;
  }

  async getAddress() {
    if (!this._address) {
      const session = this.wcManager.session;
      this._address = session.accounts[0];
    }
    return this._address;
  }

  async sendTransaction(transaction) {
    const from = await this.getAddress();

    const txParams = {
      from,
      to: transaction.to,
      data: transaction.data || '0x',
      value: transaction.value ? transaction.value.toHexString() : '0x0',
      gasPrice: transaction.gasPrice ? transaction.gasPrice.toHexString() : undefined,
      gas: transaction.gasLimit ? transaction.gasLimit.toHexString() : undefined,
      nonce: transaction.nonce ? transaction.nonce.toHexString() : undefined,
    };

    // 通過 WalletConnect 發送
    const txHash = await this.wcManager.sendTransaction(txParams);

    // ethers.js 需要返回一個 Transaction 對象
    return this.provider.getTransaction(txHash);
  }

  async signMessage(message) {
    return this.wcManager.personalSign(message);
  }

  async signTransaction(transaction) {
    throw new Error('signTransaction not supported via WalletConnect');
  }

  connect(provider) {
    return new WalletConnectSigner(provider, this.wcManager);
  }
}

// 使用示例
async function interactWithContract(wcManager, jsonRpcProvider) {
  const signer = new WalletConnectSigner(jsonRpcProvider, wcManager);
  const contract = new ethers.Contract(address, abi, signer);

  // 調用合約方法——交易會通過 WalletConnect 發到錢包
  const tx = await contract.transfer(toAddress, amount);
  const receipt = await tx.wait();
  return receipt;
}
```

## 移動端 DApp 瀏覽器適配

### Deep Link 與 Universal Link

在移動端，WalletConnect 的連接需要通過 Deep Link 喚起錢包應用。iOS 使用 Universal Link，Android 使用 App Link 或自定義 scheme：

```javascript
// 生成錢包 Deep Link
function getWalletDeepLink(wallet, wcUri) {
  const deepLinks = {
    trust: `trust://wc?uri=${encodeURIComponent(wcUri)}`,
    rainbow: `https://rnbwapp.com/wc?uri=${encodeURIComponent(wcUri)}`,
    metamask: `metamask://dapp/${encodeURIComponent(window.location.href)}`,
    argent: `argent://wc?uri=${encodeURIComponent(wcUri)}`,
  };

  return deepLinks[wallet] || null;
}

// 檢測移動端環境並自動喚起
function detectMobileAndRedirect(wcUri) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // 嘗試喚起已安裝的錢包
    const supportedWallets = ['trust', 'rainbow', 'metamask', 'argent'];
    const wallet = detectInstalledWallet();

    if (wallet) {
      const deepLink = getWalletDeepLink(wallet, wcUri);
      window.location.href = deepLink;
    } else {
      // 顯示錢包下載引導
      showWalletDownloadGuide();
    }
  }
  // 桌面端顯示二維碼
}
```

### 內置瀏覽器檢測

部分移動錢包（如 MetaMask App、Trust Wallet）內置了 DApp 瀏覽器。在這些瀏覽器中，可以直接使用 `window.ethereum` 注入的 Provider，無需 WalletConnect：

```javascript
function detectInjectedProvider() {
  if (typeof window.ethereum !== 'undefined') {
    // 內置 DApp 瀏覽器，直接使用注入 Provider
    return window.ethereum;
  }

  if (typeof window.web3 !== 'undefined') {
    // 舊版注入，兼容處理
    return window.web3.currentProvider;
  }

  // 需要使用 WalletConnect
  return null;
}

async function connectWallet() {
  const injected = detectInjectedProvider();

  if (injected) {
    // 使用注入 Provider
    const provider = new ethers.providers.Web3Provider(injected);
    await provider.send('eth_requestAccounts', []);
    return { provider, type: 'injected' };
  } else {
    // 回退到 WalletConnect
    const wcManager = new WalletConnectManager();
    const result = await wcManager.connect();
    return { wcManager, type: 'walletconnect', uri: result.uri };
  }
}
```

## 多鏈支持與網絡切換

WalletConnect v1 的會話綁定了一個 `chainId`，用戶切換鏈時需要更新會話：

```javascript
class WalletConnectManager {
  // 切換鏈
  async switchChain(targetChainId) {
    if (!this.connector || !this.session) {
      throw new Error('Not connected');
    }

    // 發送會話更新請求
    await this.connector.updateSession({
      chainId: targetChainId,
      accounts: this.session.accounts,
    });

    // 更新本地 session
    this.session.chainId = targetChainId;
    this.emit('chainChanged', targetChainId);
  }

  // 添加新鏈支持（需要錢包端支持）
  async addChain(chainParams) {
    const params = {
      chainId: this.toHex(chainParams.chainId),
      chainName: chainParams.name,
      nativeCurrency: chainParams.nativeCurrency,
      rpcUrls: chainParams.rpcUrls,
      blockExplorerUrls: chainParams.blockExplorerUrls,
    };

    return this.connector.sendCustomRequest({
      method: 'wallet_addEthereumChain',
      params: [params],
    });
  }
}

// 常見鏈配置
const CHAIN_CONFIGS = {
  1: { name: 'Ethereum Mainnet', rpcUrls: ['https://mainnet.infura.io/v3/'] },
  137: { name: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com'] },
  56: { name: 'BSC Mainnet', rpcUrls: ['https://bsc-dataseed.binance.org'] },
};
```

## 二維碼展示組件

```jsx
import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

function WalletConnectModal({ wcManager, onClose, onConnected }) {
  const [uri, setUri] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    async function init() {
      const result = await wcManager.connect();
      if (result.uri) {
        setUri(result.uri);
        const dataUrl = await QRCode.toDataURL(result.uri, { width: 256 });
        setQrCode(dataUrl);
      }
    }
    init();

    const handleConnected = (session) => {
      setStatus('connected');
      onConnected(session);
    };

    const handleError = () => setStatus('error');

    wcManager.on('connected', handleConnected);
    wcManager.on('error', handleError);

    return () => {
      wcManager.disconnect();
    };
  }, []);

  return (
    <div className="wc-modal">
      <div className="wc-modal__content">
        <button className="wc-modal__close" onClick={onClose}>&times;</button>
        <h2>Connect Wallet</h2>
        {status === 'pending' && qrCode && (
          <>
            <p>Scan QR code with your wallet app</p>
            <img src={qrCode} alt="WalletConnect QR Code" />
          </>
        )}
        {status === 'connected' && (
          <p>Connected!</p>
        )}
        {status === 'error' && (
          <p>Connection failed. Please try again.</p>
        )}
      </div>
    </div>
  );
}
```

## 與 MetaMask 的共存策略

一個成熟的 DApp 需要同時支持 MetaMask 和 WalletConnect。統一的錢包管理器可以抹平兩者的差異：

```javascript
class WalletManager {
  constructor() {
    this.type = null; // 'metamask' | 'walletconnect' | 'injected'
    this.provider = null;
    this.signer = null;
    this.account = null;
    this.chainId = null;
  }

  async connectMetaMask() {
    if (!window.ethereum) throw new Error('MetaMask not installed');

    await window.ethereum.request({ method: 'eth_requestAccounts' });
    this.provider = new ethers.providers.Web3Provider(window.ethereum);
    this.signer = this.provider.getSigner();
    this.account = await this.signer.getAddress();
    this.chainId = (await this.provider.getNetwork()).chainId;
    this.type = 'metamask';

    this.setupMetaMaskListeners();
    return this.getWalletState();
  }

  async connectWalletConnect(wcManager) {
    const result = await wcManager.connect();
    if (result.pending) {
      return { pending: true, uri: result.uri };
    }

    const jsonRpcProvider = new ethers.providers.JsonRpcProvider(
      this.getRpcUrl(wcManager.session.chainId)
    );
    this.signer = new WalletConnectSigner(jsonRpcProvider, wcManager);
    this.provider = jsonRpcProvider;
    this.account = wcManager.session.accounts[0];
    this.chainId = wcManager.session.chainId;
    this.type = 'walletconnect';

    return this.getWalletState();
  }

  setupMetaMaskListeners() {
    window.ethereum.on('accountsChanged', (accounts) => {
      this.account = accounts[0];
      this.notifyListeners('accountsChanged', accounts);
    });

    window.ethereum.on('chainChanged', (chainIdHex) => {
      this.chainId = parseInt(chainIdHex, 16);
      this.notifyListeners('chainChanged', this.chainId);
    });
  }

  async disconnect() {
    if (this.type === 'walletconnect' && this.wcManager) {
      await this.wcManager.disconnect();
    }
    this.type = null;
    this.provider = null;
    this.signer = null;
    this.account = null;
  }

  getWalletState() {
    return {
      type: this.type,
      account: this.account,
      chainId: this.chainId,
      provider: this.provider,
      signer: this.signer,
    };
  }

  getRpcUrl(chainId) {
    const rpcUrls = {
      1: `https://mainnet.infura.io/v3/${INFURA_KEY}`,
      137: 'https://polygon-rpc.com',
    };
    return rpcUrls[chainId] || rpcUrls[1];
  }
}
```

## 安全考量與用戶體驗

### 安全要點

1. **密鑰管理**：WalletConnect 的加密密鑰只存在於 DApp 前端和錢包中，不應通過 URL 參數傳遞給第三方
2. **中繼服務器選擇**：默認中繼服務器是可信的（只轉發加密消息），但對於高安全要求的 DApp，建議自建中繼
3. **會話持久化**：localStorage 中的 session 數據包含加密密鑰，應設置合理的過期時間
4. **交易確認 UI**：WalletConnect 交易在錢包端確認，DApp 前端應顯示交易內容摘要，讓用戶在錢包確認前瞭解即將簽名的交易

### 用戶體驗優化

```javascript
// 交易狀態追蹤與用戶反饋
class TransactionTracker {
  constructor(wcManager) {
    this.wcManager = wcManager;
  }

  async sendWithTracking(txParams, provider) {
    // 1. 廣播狀態
    this.notify('pending_wallet_confirmation');

    let txHash;
    try {
      txHash = await this.wcManager.sendTransaction(txParams);
    } catch (err) {
      if (err.message.includes('User rejected')) {
        this.notify('rejected');
        throw new Error('用戶拒絕了交易');
      }
      this.notify('error', err.message);
      throw err;
    }

    // 2. 等待鏈上確認
    this.notify('pending_chain_confirmation', txHash);
    const receipt = await provider.waitForTransaction(txHash);

    if (receipt.status === 1) {
      this.notify('confirmed', receipt);
    } else {
      this.notify('failed', receipt);
    }

    return receipt;
  }

  notify(status, data = null) {
    window.dispatchEvent(new CustomEvent('tx_status', { detail: { status, data } }));
  }
}
```

## 小結

WalletConnect 解決了移動端 DApp 連接的核心問題，其加密中繼的設計在保證安全性的同時提供了良好的跨錢包兼容性。對於 DApp 開發者來說，集成 WalletConnect 的主要工作量在於會話管理、交易狀態追蹤和多錢包共存邏輯。

v1 協議存在一些已知的侷限性：單鏈會話（一次只能連接一條鏈）、中繼服務器依賴、以及較慢的連接建立速度。這些痛點在後續版本中逐步改善，WalletConnect 已成為移動端 DApp 連接的最佳實踐方案。在實際項目中，建議將 WalletConnect 與 MetaMask 作為對等選項提供給用戶，通過統一的 Wallet 管理器抹平底層差異。
