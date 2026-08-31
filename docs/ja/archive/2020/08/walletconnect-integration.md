---
title: "WalletConnect プロトコル統合：クロスウォレット DApp 接続"
date: 2020-08-15 11:44:27
tags:
  - Web3
  - DApp
readingTime: 12
wordCount: 2018
description: "MetaMask ブラウザ拡張機能はデスクトップで DApp に便利な接続方法を提供していますが、根本的な制限があります：ユーザーがデスクトップブラウザに MetaMask プラグインをインストールしている必要があります。モバイルブラウザは拡張機能をインストールできないため、モバイルユーザーは MetaMask を直接"
---

## WalletConnect が必要な理由

MetaMask ブラウザ拡張機能はデスクトップで DApp に便利な接続方法を提供していますが、根本的な制限があります：ユーザーがデスクトップブラウザに MetaMask プラグインをインストールしている必要があります。モバイルブラウザは拡張機能をインストールできないため、モバイルユーザーは MetaMask を直接使用して DApp と連携できませんでした。

WalletConnect プロトコルはまさにこの問題を解決するために誕生しました。リレイサーバーを介して DApp とウォレット間に暗号化通信チャネルを構築し、いかなるデバイス上の DApp ともいかなるモバイルウォレットとペアリング接続できるようにします。WalletConnect は Trust Wallet、Rainbow、Argent などの主要なモバイルウォレットで広くサポートされており、モバイル DApp 接続の事実上の標準となっています。

## WalletConnect プロトコルの中核原理

WalletConnect の中核アーキテクチャは**リレイサーバー + 暗号化ペイロード**の通信モデルです：

1. **DApp** がランダムキーと接続 URI を生成
2. **ウォレット** が URI をスキャンし、セッション情報とリレイサーバーアドレスを抽出
3. 双方がリレイサーバー経由で WebSocket 接続を確立
4. すべての通信内容は共有キーで暗号化され、リレイサーバーは暗号化メッセージの転送のみを行い、内容を読み取れない

この設計は、リレイサーバーがセントラライズドに運用されていても、ユーザーの秘密鍵とトランザクション内容が漏洩しないことを保証します——秘密鍵はウォレットアプリから絶対に出ません。

## v1 プロトコルアーキテクチャ

### Bridge/Relay Server

リレイサーバーはシンプルなメッセージブローカーで、topic から WebSocket 接続へのマッピングを維持します。DApp がある topic にメッセージを送信すると、リレイサーバーはその topic をサブスクライブしているウォレットにメッセージを転送します。

```
DApp -> [encrypt payload] -> Relay Server -> [forward] -> Wallet
Wallet -> [encrypt payload] -> Relay Server -> [forward] -> DApp
```

v1 プロトコルはリレイサーバーのセルフホスティングをサポートし、デフォルトは `https://bridge.walletconnect.org` を使用します。

### Session と Peer

セッション確立後、双方はそれぞれセッションオブジェクトを維持し、以下の情報を含みます：

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

## 接続フローの詳細

### 1. 接続 URI の生成

DApp が WalletConnect インスタンスを作成する際、URI フォーマットの接続文字列が生成されます：

```
wc:8a5e5bdc-b85b-4ac2-b8cc-ede3858f7c88@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=4b9ab...
```

URI の構造：
- `wc:` プロトコルプレフィックス
- `8a5e5bdc-...` セッション topic（UUID）
- `@1` プロトコルバージョン
- `bridge=` リレイサーバー URL（URL エンコード）
- `key=` 暗号化キー（hex エンコード）

### 2. スキャンとセッション確立

ウォレットアプリがQRコードをスキャン後、URI をパースし、同じリレイサーバーに接続し、`session_request` メッセージを返します。これにはウォレットの accounts と chainId が含まれます。DApp は受信後にセッション確立を確認します。

## フロントエンド統合の実装

### 基礎接続マネージャー

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

### トランザクション送信と署名

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

### コントラクト呼び出しのカプセル化

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

## モバイル DApp ブラウザの適応

### Deep Link と Universal Link

モバイルでは、WalletConnect の接続は Deep Link でウォレットアプリを起動する必要があります。iOS は Universal Link、Android は App Link またはカスタムスキームを使用します：

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

### 内蔵ブラウザの検出

一部のモバイルウォレット（MetaMask App、Trust Wallet など）は DApp ブラウザを内蔵しています。これらのブラウザでは `window.ethereum` インジェクトされた Provider を直接使用でき、WalletConnect は不要です：

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

### 多様なチェーンサポートとネットワーク切替

WalletConnect v1 のセッションは1つの `chainId` にバインドされており、ユーザーがチェーンを切替える際はセッションを更新する必要があります：

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

## QRコード表示コンポーネント

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

## MetaMask との共存戦略

成熟した DApp は MetaMask と WalletConnect の両方をサポートする必要があります。統一されたウォレットマネージャーで両者の差異を吸収できます：

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

## セキュリティ考慮とユーザー体験

### セキュリティのポイント

1. **キー管理**：WalletConnect の暗号化キーは DApp フロントエンドとウォレットにのみ存在し、URL パラメータで第三者に渡すべきではありません
2. **リレイサーバーの選択**：デフォルトのリレイサーバーは信頼できます（暗号化メッセージの転送のみ）が、高いセキュリティが求められる DApp ではリレイサーバーのセルフホスティングを推奨します
3. **セッションの永続化**：localStorage 内のセッションデータには暗号化キーが含まれるため、合理的な有効期限を設定すべきです
4. **トランザクション確認 UI**：WalletConnect トランザクションはウォレット側で確認されるため、DApp フロントエンドはトランザクション内容のサマリーを表示し、ユーザーがウォレットで確認する前に署名しようとしているトランザクションを理解できるようにすべきです

### ユーザー体験の最適化

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

## まとめ

WalletConnect はモバイル DApp 接続の中核的問題を解決し、その暗号化リレイの設計はセキュリティを保証しつつ良好なクロスウォレット互換性を提供します。DApp 開発者にとって、WalletConnect 統合の主な作業量はセッション管理、トランザクション状態追跡、マルチウォレット共存ロジックにあります。

v1 プロトコルにはいくつかの既知の制限があります：シングルチェーンセッション（一度に1つのチェーンのみ接続可能）、リレイサーバーへの依存、および比較的遅い接続確立速度。これらの課題は後続バージョンで改善されていますが、WalletConnect は依然としてモバイル DApp 接続のベストプラクティスソリューションです。実際のプロジェクトでは、WalletConnect と MetaMask を同等のオプションとしてユーザーに提供し、統一されたウォレットマネージャーで基盤の差異を吸収することを推奨します。
