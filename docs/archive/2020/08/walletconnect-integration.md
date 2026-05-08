---
title: "WalletConnect 协议集成：跨钱包 DApp 连接"
date: 2020-08-15 11:44:27
tags:
  - Web3
  - DApp
---

## 为什么需要 WalletConnect

MetaMask 浏览器扩展在桌面端为 DApp 提供了便捷的连接方式，但它有一个根本局限：用户必须在桌面浏览器中安装 MetaMask 插件。移动端浏览器无法安装扩展，这意味着移动端用户无法直接使用 MetaMask 与 DApp 交互。

WalletConnect 协议正是为解决这个问题而生。它通过中继服务器在 DApp 和钱包之间建立加密通信通道，使得任何设备上的 DApp 都能与任何移动钱包配对连接。WalletConnect 已被 Trust Wallet、Rainbow、Argent 等主流移动钱包广泛支持，成为移动端 DApp 连接的事实标准。

## WalletConnect 协议核心原理

WalletConnect 的核心架构是一个**中继服务器 + 加密载荷**的通信模型：

1. **DApp** 生成一个随机密钥和连接 URI
2. **钱包** 扫描 URI，提取会话信息和中继服务器地址
3. 双方通过中继服务器建立 WebSocket 连接
4. 所有通信内容使用共享密钥加密，中继服务器只负责转发加密消息，无法读取内容

这种设计保证了即使中继服务器是中心化运行的，用户的私钥和交易内容也不会泄露——私钥永远不离开钱包应用。

## v1 协议架构

### Bridge/Relay Server

中继服务器是一个简单的消息代理，维护一个 topic 到 WebSocket 连接的映射。当 DApp 向某个 topic 发送消息时，中继服务器将消息转发给订阅了该 topic 的钱包。

```
DApp -> [encrypt payload] -> Relay Server -> [forward] -> Wallet
Wallet -> [encrypt payload] -> Relay Server -> [forward] -> DApp
```

v1 协议支持自建中继服务器，默认使用 `https://bridge.walletconnect.org`。

### Session 与 Peer

会话建立后，双方各自维护一个 session 对象，包含以下信息：

```typescript
interface WalletConnectSession {
  connected: boolean;
  accounts: string[];      // 钱包返回的地址列表
  chainId: number;         // 当前链 ID
  bridge: string;          // 中继服务器 URL
  key: string;             // 加密密钥（仅本地保存）
  clientId: string;        // DApp 端唯一标识
  clientMeta: {            // DApp 元信息
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  peerId: string;          // 钱包端唯一标识
  peerMeta: {              // 钱包元信息
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  handshakeId: number;
  handshakeTopic: string;
}
```

## 连接流程详解

### 1. 生成连接 URI

DApp 创建 WalletConnect 实例时，会生成一个 URI 格式的连接字符串：

```
wc:8a5e5bdc-b85b-4ac2-b8cc-ede3858f7c88@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=4b9ab...
```

URI 的结构：
- `wc:` 协议前缀
- `8a5e5bdc-...` 会话 topic（UUID）
- `@1` 协议版本
- `bridge=` 中继服务器 URL（URL 编码）
- `key=` 加密密钥（hex 编码）

### 2. 扫码与会话建立

钱包应用扫描二维码后，解析 URI，连接到同一个中继服务器，并返回一个 `session_request` 消息，包含钱包的 accounts 和 chainId。DApp 收到后确认会话建立。

## 前端集成实现

### 基础连接管理器

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

  // 初始化连接
  async connect() {
    this.connector = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org',
      qrcodeModal: false, // 自定义 QR 展示
    });

    // 检查是否已有会话
    if (this.connector.connected) {
      this.session = this.connector.session;
      this.setupEventListeners();
      return this.session;
    }

    // 创建新会话
    await this.connector.createSession();
    this.setupEventListeners();

    // 返回 URI 供前端生成二维码
    return {
      uri: this.connector.uri,
      pending: true,
    };
  }

  // 事件监听设置
  setupEventListeners() {
    // 会话建立
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

    // 会话更新（账户切换、链切换）
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

    // 断开连接
    this.connector.on('disconnect', (error, payload) => {
      this.session = null;
      this.connector = null;
      this.emit('disconnect', error);
    });

    // 响应签名请求的结果
    this.connector.on('call_request', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      this.emit('call_result', payload);
    });
  }

  // 断开连接
  async disconnect() {
    if (this.connector && this.connector.connected) {
      await this.connector.killSession();
    }
    this.connector = null;
    this.session = null;
  }

  // 恢复会话
  async restoreSession() {
    // 从 localStorage 恢复
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

  // 事件系统
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

### 交易发送与签名

```javascript
class WalletConnectManager {
  // ... 上面的方法

  // 发送交易
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

  // 签名消息
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

  // 签名 Typed Data (EIP-712)
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

  // 个人签名 (EIP-191)
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

  // 工具：转换为十六进制
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

### 合约调用封装

```javascript
import { ethers } from 'ethers';

// 将 ethers.js 与 WalletConnect 桥接
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

    // 通过 WalletConnect 发送
    const txHash = await this.wcManager.sendTransaction(txParams);

    // ethers.js 需要返回一个 Transaction 对象
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

  // 调用合约方法——交易会通过 WalletConnect 发到钱包
  const tx = await contract.transfer(toAddress, amount);
  const receipt = await tx.wait();
  return receipt;
}
```

## 移动端 DApp 浏览器适配

### Deep Link 与 Universal Link

在移动端，WalletConnect 的连接需要通过 Deep Link 唤起钱包应用。iOS 使用 Universal Link，Android 使用 App Link 或自定义 scheme：

```javascript
// 生成钱包 Deep Link
function getWalletDeepLink(wallet, wcUri) {
  const deepLinks = {
    trust: `trust://wc?uri=${encodeURIComponent(wcUri)}`,
    rainbow: `https://rnbwapp.com/wc?uri=${encodeURIComponent(wcUri)}`,
    metamask: `metamask://dapp/${encodeURIComponent(window.location.href)}`,
    argent: `argent://wc?uri=${encodeURIComponent(wcUri)}`,
  };

  return deepLinks[wallet] || null;
}

// 检测移动端环境并自动唤起
function detectMobileAndRedirect(wcUri) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // 尝试唤起已安装的钱包
    const supportedWallets = ['trust', 'rainbow', 'metamask', 'argent'];
    const wallet = detectInstalledWallet();

    if (wallet) {
      const deepLink = getWalletDeepLink(wallet, wcUri);
      window.location.href = deepLink;
    } else {
      // 显示钱包下载引导
      showWalletDownloadGuide();
    }
  }
  // 桌面端显示二维码
}
```

### 内置浏览器检测

部分移动钱包（如 MetaMask App、Trust Wallet）内置了 DApp 浏览器。在这些浏览器中，可以直接使用 `window.ethereum` 注入的 Provider，无需 WalletConnect：

```javascript
function detectInjectedProvider() {
  if (typeof window.ethereum !== 'undefined') {
    // 内置 DApp 浏览器，直接使用注入 Provider
    return window.ethereum;
  }

  if (typeof window.web3 !== 'undefined') {
    // 旧版注入，兼容处理
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

## 多链支持与网络切换

WalletConnect v1 的会话绑定了一个 `chainId`，用户切换链时需要更新会话：

```javascript
class WalletConnectManager {
  // 切换链
  async switchChain(targetChainId) {
    if (!this.connector || !this.session) {
      throw new Error('Not connected');
    }

    // 发送会话更新请求
    await this.connector.updateSession({
      chainId: targetChainId,
      accounts: this.session.accounts,
    });

    // 更新本地 session
    this.session.chainId = targetChainId;
    this.emit('chainChanged', targetChainId);
  }

  // 添加新链支持（需要钱包端支持）
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

// 常见链配置
const CHAIN_CONFIGS = {
  1: { name: 'Ethereum Mainnet', rpcUrls: ['https://mainnet.infura.io/v3/'] },
  137: { name: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com'] },
  56: { name: 'BSC Mainnet', rpcUrls: ['https://bsc-dataseed.binance.org'] },
};
```

## 二维码展示组件

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

## 与 MetaMask 的共存策略

一个成熟的 DApp 需要同时支持 MetaMask 和 WalletConnect。统一的钱包管理器可以抹平两者的差异：

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

## 安全考量与用户体验

### 安全要点

1. **密钥管理**：WalletConnect 的加密密钥只存在于 DApp 前端和钱包中，不应通过 URL 参数传递给第三方
2. **中继服务器选择**：默认中继服务器是可信的（只转发加密消息），但对于高安全要求的 DApp，建议自建中继
3. **会话持久化**：localStorage 中的 session 数据包含加密密钥，应设置合理的过期时间
4. **交易确认 UI**：WalletConnect 交易在钱包端确认，DApp 前端应显示交易内容摘要，让用户在钱包确认前了解即将签名的交易

### 用户体验优化

```javascript
// 交易状态追踪与用户反馈
class TransactionTracker {
  constructor(wcManager) {
    this.wcManager = wcManager;
  }

  async sendWithTracking(txParams, provider) {
    // 1. 广播状态
    this.notify('pending_wallet_confirmation');

    let txHash;
    try {
      txHash = await this.wcManager.sendTransaction(txParams);
    } catch (err) {
      if (err.message.includes('User rejected')) {
        this.notify('rejected');
        throw new Error('用户拒绝了交易');
      }
      this.notify('error', err.message);
      throw err;
    }

    // 2. 等待链上确认
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

## 小结

WalletConnect 解决了移动端 DApp 连接的核心问题，其加密中继的设计在保证安全性的同时提供了良好的跨钱包兼容性。对于 DApp 开发者来说，集成 WalletConnect 的主要工作量在于会话管理、交易状态追踪和多钱包共存逻辑。

v1 协议存在一些已知的局限性：单链会话（一次只能连接一条链）、中继服务器依赖、以及较慢的连接建立速度。这些局限在后续版本中得到改善，WalletConnect 已经是移动端 DApp 连接的最佳实践方案。在实际项目中，建议将 WalletConnect 与 MetaMask 作为对等选项提供给用户，通过统一的 Wallet 管理器抹平底层差异。
