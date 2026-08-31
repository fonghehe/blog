---
title: "WalletConnect Protocol Integration: Cross-Wallet DApp Connectivity"
date: 2020-08-15 11:44:27
tags:
  - Web3
  - DApp
readingTime: 9
wordCount: 733
description: "The MetaMask browser extension provides a convenient connection method for DApps on desktop, but it has a fundamental limitation: users must install the MetaMas"
---

## Why WalletConnect Is Needed

The MetaMask browser extension provides a convenient connection method for DApps on desktop, but it has a fundamental limitation: users must install the MetaMask plugin in their desktop browser. Mobile browsers cannot install extensions, meaning mobile users cannot directly use MetaMask to interact with DApps.

The WalletConnect protocol was created to address this exact problem. It establishes an encrypted communication channel between the DApp and the wallet through a relay server, allowing DApps on any device to pair and connect with any mobile wallet. WalletConnect is now widely adopted by mainstream mobile wallets such as Trust Wallet, Rainbow, and Argent, and is the de facto standard for mobile DApp connectivity.

## WalletConnect Protocol Core Principles

WalletConnect's core architecture is a **relay server + encrypted payload** communication model:

1. The **DApp** generates a random key and connection URI
2. The **wallet** scans the URI, extracting session information and the relay server address
3. Both parties establish a WebSocket connection through the relay server
4. All communication is encrypted using a shared key; the relay server only forwards encrypted messages and cannot read the contents

This design ensures that even if the relay server is run centrally, the user's private key and transaction content are never exposed—the private key never leaves the wallet application.

## v1 Protocol Architecture

### Bridge/Relay Server

The relay server is a simple message broker that maintains a mapping from topic to WebSocket connection. When the DApp sends a message to a topic, the relay server forwards it to the wallet subscribed to that topic.

```
DApp -> [encrypt payload] -> Relay Server -> [forward] -> Wallet
Wallet -> [encrypt payload] -> Relay Server -> [forward] -> DApp
```

The v1 protocol supports self-hosted relay servers, with the default being `https://bridge.walletconnect.org`.

### Session and Peer

Once a session is established, both parties each maintain a session object containing the following information:

```typescript
interface WalletConnectSession {
  connected: boolean;
  accounts: string[];      // List of addresses returned by the wallet
  chainId: number;         // Current chain ID
  bridge: string;          // Relay server URL
  key: string;             // Encryption key (stored locally only)
  clientId: string;        // DApp-side unique identifier
  clientMeta: {            // DApp metadata
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  peerId: string;          // Wallet-side unique identifier
  peerMeta: {              // Wallet metadata
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
  handshakeId: number;
  handshakeTopic: string;
}
```

## Connection Flow in Detail

### 1. Generating the Connection URI

When the DApp creates a WalletConnect instance, it generates a connection string in URI format:

```
wc:8a5e5bdc-b85b-4ac2-b8cc-ede3858f7c88@1?bridge=https%3A%2F%2Fbridge.walletconnect.org&key=4b9ab...
```

URI structure:
- `wc:` protocol prefix
- `8a5e5bdc-...` session topic (UUID)
- `@1` protocol version
- `bridge=` relay server URL (URL-encoded)
- `key=` encryption key (hex-encoded)

### 2. QR Code Scanning and Session Establishment

The wallet application scans the QR code, parses the URI, connects to the same relay server, and returns a `session_request` message containing the wallet's accounts and chainId. The DApp receives and confirms the session establishment.

## Frontend Integration Implementation

### Basic Connection Manager

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

  // Initialize connection
  async connect() {
    this.connector = new WalletConnect({
      bridge: 'https://bridge.walletconnect.org',
      qrcodeModal: false, // Custom QR display
    });

    // Check for existing session
    if (this.connector.connected) {
      this.session = this.connector.session;
      this.setupEventListeners();
      return this.session;
    }

    // Create new session
    await this.connector.createSession();
    this.setupEventListeners();

    // Return URI for frontend to generate QR code
    return {
      uri: this.connector.uri,
      pending: true,
    };
  }

  // Set up event listeners
  setupEventListeners() {
    // Session established
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

    // Session update (account switch, chain switch)
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

    // Disconnection
    this.connector.on('disconnect', (error, payload) => {
      this.session = null;
      this.connector = null;
      this.emit('disconnect', error);
    });

    // Response to signature request results
    this.connector.on('call_request', (error, payload) => {
      if (error) {
        this.emit('error', error);
        return;
      }
      this.emit('call_result', payload);
    });
  }

  // Disconnect
  async disconnect() {
    if (this.connector && this.connector.connected) {
      await this.connector.killSession();
    }
    this.connector = null;
    this.session = null;
  }

  // Restore session
  async restoreSession() {
    // Restore from localStorage
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

  // Event system
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

### Transaction Sending and Signing

```javascript
class WalletConnectManager {
  // ... previous methods

  // Send transaction
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

  // Sign message
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

  // Sign Typed Data (EIP-712)
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

  // Personal sign (EIP-191)
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

  // Utility: convert to hex
  toHex(value) {
    if (typeof value === 'string' && value.startsWith('0x')) {
      return value;
    }
    if (typeof value === 'number') {
      return '0x' + value.toString(16);
    }
    if (typeof value === 'string') {
      // BigNumber string
      return '0x' + BigInt(value).toString(16);
    }
    return value;
  }
}
```

### Contract Call Wrapper

```javascript
import { ethers } from 'ethers';

// Bridge ethers.js with WalletConnect
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

    // Send via WalletConnect
    const txHash = await this.wcManager.sendTransaction(txParams);

    // ethers.js requires a Transaction object to be returned
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

// Usage example
async function interactWithContract(wcManager, jsonRpcProvider) {
  const signer = new WalletConnectSigner(jsonRpcProvider, wcManager);
  const contract = new ethers.Contract(address, abi, signer);

  // Call contract method—transaction will be sent to wallet via WalletConnect
  const tx = await contract.transfer(toAddress, amount);
  const receipt = await tx.wait();
  return receipt;
}
```

## Mobile DApp Browser Adaptation

### Deep Links and Universal Links

On mobile, WalletConnect connections need to invoke the wallet app via deep links. iOS uses Universal Links, and Android uses App Links or custom schemes:

```javascript
// Generate wallet deep link
function getWalletDeepLink(wallet, wcUri) {
  const deepLinks = {
    trust: `trust://wc?uri=${encodeURIComponent(wcUri)}`,
    rainbow: `https://rnbwapp.com/wc?uri=${encodeURIComponent(wcUri)}`,
    metamask: `metamask://dapp/${encodeURIComponent(window.location.href)}`,
    argent: `argent://wc?uri=${encodeURIComponent(wcUri)}`,
  };

  return deepLinks[wallet] || null;
}

// Detect mobile environment and auto-redirect
function detectMobileAndRedirect(wcUri) {
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    // Try to invoke installed wallet
    const supportedWallets = ['trust', 'rainbow', 'metamask', 'argent'];
    const wallet = detectInstalledWallet();

    if (wallet) {
      const deepLink = getWalletDeepLink(wallet, wcUri);
      window.location.href = deepLink;
    } else {
      // Show wallet download guide
      showWalletDownloadGuide();
    }
  }
  // Desktop shows QR code
}
```

### Built-in Browser Detection

Some mobile wallets (such as MetaMask App, Trust Wallet) have built-in DApp browsers. In these browsers, you can directly use the `window.ethereum` injected Provider without WalletConnect:

```javascript
function detectInjectedProvider() {
  if (typeof window.ethereum !== 'undefined') {
    // Built-in DApp browser, use injected Provider directly
    return window.ethereum;
  }

  if (typeof window.web3 !== 'undefined') {
    // Legacy injection, compatibility handling
    return window.web3.currentProvider;
  }

  // Need to use WalletConnect
  return null;
}

async function connectWallet() {
  const injected = detectInjectedProvider();

  if (injected) {
    // Use injected Provider
    const provider = new ethers.providers.Web3Provider(injected);
    await provider.send('eth_requestAccounts', []);
    return { provider, type: 'injected' };
  } else {
    // Fall back to WalletConnect
    const wcManager = new WalletConnectManager();
    const result = await wcManager.connect();
    return { wcManager, type: 'walletconnect', uri: result.uri };
  }
}
```

## Multi-chain Support and Network Switching

WalletConnect v1 sessions are bound to a single `chainId`. When a user switches chains, the session needs to be updated:

```javascript
class WalletConnectManager {
  // Switch chain
  async switchChain(targetChainId) {
    if (!this.connector || !this.session) {
      throw new Error('Not connected');
    }

    // Send session update request
    await this.connector.updateSession({
      chainId: targetChainId,
      accounts: this.session.accounts,
    });

    // Update local session
    this.session.chainId = targetChainId;
    this.emit('chainChanged', targetChainId);
  }

  // Add new chain support (requires wallet-side support)
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

// Common chain configurations
const CHAIN_CONFIGS = {
  1: { name: 'Ethereum Mainnet', rpcUrls: ['https://mainnet.infura.io/v3/'] },
  137: { name: 'Polygon Mainnet', rpcUrls: ['https://polygon-rpc.com'] },
  56: { name: 'BSC Mainnet', rpcUrls: ['https://bsc-dataseed.binance.org'] },
};
```

## QR Code Display Component

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

## Coexistence Strategy with MetaMask

A mature DApp needs to support both MetaMask and WalletConnect simultaneously. A unified wallet manager can smooth over the differences between the two:

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

## Security Considerations and User Experience

### Security Points

1. **Key management**: WalletConnect's encryption key exists only in the DApp frontend and the wallet, and should never be passed to third parties via URL parameters
2. **Relay server selection**: The default relay server is trusted (only forwards encrypted messages), but for DApps with higher security requirements, self-hosting is recommended
3. **Session persistence**: Session data in localStorage contains encryption keys and should have reasonable expiration times set
4. **Transaction confirmation UI**: WalletConnect transactions are confirmed on the wallet side; the DApp frontend should display a transaction summary so users understand what they are about to sign before confirming in the wallet

### User Experience Optimization

```javascript
// Transaction status tracking and user feedback
class TransactionTracker {
  constructor(wcManager) {
    this.wcManager = wcManager;
  }

  async sendWithTracking(txParams, provider) {
    // 1. Broadcast status
    this.notify('pending_wallet_confirmation');

    let txHash;
    try {
      txHash = await this.wcManager.sendTransaction(txParams);
    } catch (err) {
      if (err.message.includes('User rejected')) {
        this.notify('rejected');
        throw new Error('User rejected the transaction');
      }
      this.notify('error', err.message);
      throw err;
    }

    // 2. Wait for on-chain confirmation
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

## Summary

WalletConnect solves the core problem of mobile DApp connectivity. Its encrypted relay design ensures security while providing excellent cross-wallet compatibility. For DApp developers, the main integration effort with WalletConnect lies in session management, transaction status tracking, and multi-wallet coexistence logic.

The v1 protocol has some known limitations: single-chain sessions (only one chain can be connected at a time), reliance on the relay server, and relatively slow connection establishment. These pain points have been improved in later protocol versions, but WalletConnect remains the best practice for mobile DApp connectivity. In actual projects, it's recommended to offer WalletConnect and MetaMask as equivalent options to users, smoothing over the underlying differences through a unified wallet manager.
