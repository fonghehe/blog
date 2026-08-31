---
title: "ERC-20 代幣前端交互完整方案"
date: 2021-04-09 12:48:21
tags:
  - Web3
  - Ethereum
  - DeFi
readingTime: 9
description: "從餘額查詢到授權轉賬，全面解析 ERC-20 代幣的前端交互模式與工程實踐"
wordCount: 797
---

## ERC-20 標準接口

ERC-20 是以太坊上最廣泛使用的代幣標準，定義了同質化代幣的最小接口集合。以太坊主網上存在大量 ERC-20 代幣，涵蓋穩定幣（USDT、USDC、DAI）、治理代幣（COMP、UNI）、DeFi LP 代幣等各種應用場景。

ERC-20 標準接口包含 9 個函數和 2 個事件：

```solidity
interface IERC20 {
    // 查詢類
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // 交易類
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // 事件
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

對於前端開發者而言，ERC-20 的交互可以分為兩大類：**讀取操作**（balanceOf、allowance、元數據查詢）和**寫入操作**（transfer、approve、transferFrom）。寫入操作中，approve + transferFrom 的授權模式是理解 DeFi 前端交互的關鍵。

## 前端代幣餘額查詢

### 基礎餘額查詢

```javascript
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function transfer(address,uint256) returns (bool)',
  'function approve(address,uint256) returns (bool)',
  'function transferFrom(address,address,uint256) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
];

class ERC20Token {
  constructor(address, provider) {
    this.address = address;
    this.contract = new ethers.Contract(address, ERC20_ABI, provider);
    this._decimals = null;
    this._symbol = null;
    this._name = null;
  }

  // 緩存元數據，避免重複調用
  async getDecimals() {
    if (this._decimals === null) {
      this._decimals = await this.contract.decimals();
    }
    return this._decimals;
  }

  async getSymbol() {
    if (this._symbol === null) {
      this._symbol = await this.contract.symbol();
    }
    return this._symbol;
  }

  async getName() {
    if (this._name === null) {
      this._name = await this.contract.name();
    }
    return this._name;
  }

  async getBalance(address) {
    const balance = await this.contract.balanceOf(address);
    const decimals = await this.getDecimals();
    return {
      raw: balance,
      formatted: ethers.utils.formatUnits(balance, decimals),
    };
  }
}
```

### 格式化與精度處理

ERC-20 代幣的鏈上存儲使用整數，精度由 `decimals` 決定。前端展示時必須正確處理精度轉換：

```javascript
// 精度轉換工具
const TokenFormatter = {
  // 鏈上原始值 -> 可讀字符串
  format(rawValue, decimals) {
    return ethers.utils.formatUnits(rawValue, decimals);
  },

  // 可讀字符串 -> 鏈上原始值
  parse(displayValue, decimals) {
    return ethers.utils.parseUnits(displayValue, decimals);
  },

  // 格式化為指定小數位
  formatShort(rawValue, decimals, displayDecimals = 4) {
    const formatted = ethers.utils.formatUnits(rawValue, decimals);
    const [int, dec] = formatted.split('.');
    if (!dec) return int;
    return `${int}.${dec.slice(0, displayDecimals)}`;
  },

  // 帶千位分隔符
  formatWithCommas(rawValue, decimals, displayDecimals = 2) {
    const short = this.formatShort(rawValue, decimals, displayDecimals);
    const [int, dec] = short.split('.');
    const intWithCommas = parseInt(int).toLocaleString('en-US');
    return dec ? `${intWithCommas}.${dec}` : intWithCommas;
  },
};

// 使用示例
const balance = ethers.BigNumber.from('1234567890000000000'); // 1.234... ETH
console.log(TokenFormatter.formatWithCommas(balance, 18, 4)); // "1.2345"
```

## 轉賬交易

### 直接轉賬

```javascript
async function transferToken(provider, tokenAddress, toAddress, amount) {
  const signer = provider.getSigner();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // 獲取精度並解析金額
  const decimals = await token.decimals();
  const rawAmount = ethers.utils.parseUnits(amount, decimals);

  // 檢查餘額
  const senderAddress = await signer.getAddress();
  const balance = await token.balanceOf(senderAddress);
  if (balance.lt(rawAmount)) {
    throw new Error(`餘額不足。當前: ${ethers.utils.formatUnits(balance, decimals)}, 需要: ${amount}`);
  }

  // 發送交易
  const tx = await token.transfer(toAddress, rawAmount);
  const receipt = await tx.wait();

  // 解析 Transfer 事件
  const iface = new ethers.utils.Interface(ERC20_ABI);
  const transferLog = receipt.logs
    .map(log => {
      try { return iface.parseLog(log); } catch { return null; }
    })
    .find(event => event?.name === 'Transfer');

  return {
    txHash: receipt.transactionHash,
    from: transferLog?.args.from,
    to: transferLog?.args.to,
    amount: transferLog?.args.value.toString(),
  };
}
```

## 授權機制：approve + transferFrom

ERC-20 的授權機制是 DeFi 協議交互的基礎。用戶通過 `approve` 授權某個合約（如 Uniswap Router）可以使用自己的代幣，合約隨後通過 `transferFrom` 將代幣從用戶地址轉出。

### 授權查詢與設置

```javascript
class TokenApprovalManager {
  constructor(provider) {
    this.provider = provider;
  }

  // 查詢授權額度
  async getAllowance(tokenAddress, ownerAddress, spenderAddress) {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
    const allowance = await token.allowance(ownerAddress, spenderAddress);
    const decimals = await token.decimals();
    return {
      raw: allowance,
      formatted: ethers.utils.formatUnits(allowance, decimals),
      isZero: allowance.isZero(),
      isMax: allowance.gte(ethers.constants.MaxUint256.div(2)),
    };
  }

  // 設置授權
  async approve(tokenAddress, spenderAddress, amount) {
    const signer = this.provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await token.decimals();

    let rawAmount;
    if (typeof amount === 'string' && amount === 'max') {
      // 無限授權
      rawAmount = ethers.constants.MaxUint256;
    } else {
      rawAmount = ethers.utils.parseUnits(amount, decimals);
    }

    const tx = await token.approve(spenderAddress, rawAmount);
    const receipt = await tx.wait();
    return receipt;
  }

  // 檢查並確保授權額度充足
  async ensureAllowance(tokenAddress, spenderAddress, requiredAmount) {
    const signer = this.provider.getSigner();
    const ownerAddress = await signer.getAddress();

    const allowance = await this.getAllowance(
      tokenAddress, ownerAddress, spenderAddress
    );

    if (allowance.raw.gte(requiredAmount)) {
      return { needsApproval: false };
    }

    // 需要授權
    return {
      needsApproval: true,
      approve: async () => {
        // 如果已有部分授權額度，先重置為 0（部分代幣合約要求）
        if (!allowance.isZero && !allowance.isMax) {
          const resetTx = await this.approve(tokenAddress, spenderAddress, '0');
          await resetTx.wait();
        }
        return this.approve(tokenAddress, spenderAddress, 'max');
      },
    };
  }
}
```

### 無限授權 vs 精確授權

```javascript
// 精確授權：每次只授權需要的金額
async function preciseApprove(provider, tokenAddress, spenderAddress, amount) {
  const signer = provider.getSigner();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
  const decimals = await token.decimals();
  const rawAmount = ethers.utils.parseUnits(amount, decimals);

  const manager = new TokenApprovalManager(provider);
  const check = await manager.ensureAllowance(tokenAddress, spenderAddress, rawAmount);

  if (check.needsApproval) {
    await check.approve();
  }

  return true;
}

// 無限授權：一次性授權最大值，後續交易無需再次授權
async function maxApprove(provider, tokenAddress, spenderAddress) {
  const manager = new TokenApprovalManager(provider);
  const allowance = await manager.getAllowance(
    tokenAddress,
    await provider.getSigner().getAddress(),
    spenderAddress
  );

  if (allowance.isMax) return; // 已經是無限授權

  return manager.approve(tokenAddress, spenderAddress, 'max');
}
```

兩種策略的權衡：
- **無限授權**：用戶體驗好（只需一次 approve），但安全風險更高——如果被授權合約存在漏洞，攻擊者可以轉走用戶的所有代幣
- **精確授權**：更安全，但每筆交易前可能需要額外的 approve 交易，增加 Gas 成本和操作步驟

## 事件監聽

### Transfer 和 Approval 事件

```javascript
class TokenEventWatcher {
  constructor(provider, tokenAddress) {
    this.provider = provider;
    this.token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    this.handlers = new Map();
  }

  // 監聽指定地址的轉入事件
  watchIncoming(address, callback) {
    const filter = this.token.filters.Transfer(null, address);
    this.token.on(filter, (from, to, value, event) => {
      callback({
        type: 'incoming',
        from,
        to,
        value: value.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });
    });
    this.handlers.set(`incoming:${address}`, filter);
  }

  // 監聽指定地址的轉出事件
  watchOutgoing(address, callback) {
    const filter = this.token.filters.Transfer(address, null);
    this.token.on(filter, (from, to, value, event) => {
      callback({
        type: 'outgoing',
        from,
        to,
        value: value.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });
    });
    this.handlers.set(`outgoing:${address}`, filter);
  }

  // 監聽授權事件
  watchApproval(address, callback) {
    const filter = this.token.filters.Approval(address, null);
    this.token.on(filter, (owner, spender, value, event) => {
      callback({
        owner,
        spender,
        value: value.toString(),
        txHash: event.transactionHash,
      });
    });
    this.handlers.set(`approval:${address}`, filter);
  }

  // 查詢歷史轉賬記錄
  async getTransferHistory(address, fromBlock = 0, toBlock = 'latest') {
    const incomingFilter = this.token.filters.Transfer(null, address);
    const outgoingFilter = this.token.filters.Transfer(address, null);

    const [incoming, outgoing] = await Promise.all([
      this.token.queryFilter(incomingFilter, fromBlock, toBlock),
      this.token.queryFilter(outgoingFilter, fromBlock, toBlock),
    ]);

    const allTransfers = [
      ...incoming.map(e => ({ ...e.args, direction: 'in', blockNumber: e.blockNumber, txHash: e.transactionHash })),
      ...outgoing.map(e => ({ ...e.args, direction: 'out', blockNumber: e.blockNumber, txHash: e.transactionHash })),
    ];

    // 按區塊號排序
    allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);

    return allTransfers;
  }

  destroy() {
    this.token.removeAllListeners();
  }
}
```

## 完整的 ERC-20 交互封裝層

將以上功能整合為一個完整的封裝層：

```javascript
class ERC20Manager {
  constructor(provider) {
    this.provider = provider;
    this.tokenCache = new Map(); // address -> ERC20Token
    this.metadataCache = new Map(); // address -> {decimals, symbol, name}
  }

  // 獲取或創建代幣實例
  getToken(address) {
    if (!this.tokenCache.has(address)) {
      this.tokenCache.set(address, new ERC20Token(address, this.provider));
    }
    return this.tokenCache.get(address);
  }

  // 批量獲取代幣元數據
  async getMetadata(address) {
    if (this.metadataCache.has(address)) {
      return this.metadataCache.get(address);
    }
    const token = this.getToken(address);
    const [name, symbol, decimals] = await Promise.all([
      token.getName(),
      token.getSymbol(),
      token.getDecimals(),
    ]);
    const metadata = { name, symbol, decimals };
    this.metadataCache.set(address, metadata);
    return metadata;
  }

  // 批量獲取多個代幣的餘額
  async getBalances(address, tokenAddresses) {
    const results = await Promise.all(
      tokenAddresses.map(async (tokenAddress) => {
        const token = this.getToken(tokenAddress);
        const [balance, metadata] = await Promise.all([
          token.getBalance(address),
          this.getMetadata(tokenAddress),
        ]);
        return {
          address: tokenAddress,
          symbol: metadata.symbol,
          name: metadata.name,
          decimals: metadata.decimals,
          balance: balance.raw,
          formatted: balance.formatted,
        };
      })
    );
    return results;
  }

  // 代幣轉賬
  async transfer(tokenAddress, to, amount) {
    return transferToken(this.provider, tokenAddress, to, amount);
  }

  // 授權管理
  async approve(tokenAddress, spender, amount) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.approve(tokenAddress, spender, amount);
  }

  // 檢查授權
  async checkAllowance(tokenAddress, owner, spender) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.getAllowance(tokenAddress, owner, spender);
  }
}
```

## 多代幣管理與自動發現

### 代幣列表管理

```javascript
// 常見代幣預設列表
const TOKEN_LISTS = {
  mainnet: [
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
  ],
};

class TokenListManager {
  constructor(provider, chainId) {
    this.provider = provider;
    this.chainId = chainId;
    this.tokens = new Map();
    this.customTokens = new Map(); // 用戶手動添加的代幣

    // 加載預設列表
    this.loadDefaultList();
  }

  loadDefaultList() {
    const list = TOKEN_LISTS[this.chainId] || [];
    list.forEach(token => {
      this.tokens.set(token.address.toLowerCase(), token);
    });
  }

  // 添加自定義代幣
  async addToken(address) {
    if (this.tokens.has(address.toLowerCase())) {
      return this.tokens.get(address.toLowerCase());
    }

    // 從鏈上讀取元數據
    const token = new ethers.Contract(address, ERC20_ABI, this.provider);
    const [name, symbol, decimals] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
    ]);

    const tokenInfo = { address, name, symbol, decimals };
    this.tokens.set(address.toLowerCase(), tokenInfo);
    this.customTokens.set(address.toLowerCase(), tokenInfo);

    // 持久化到 localStorage
    this.saveCustomTokens();

    return tokenInfo;
  }

  saveCustomTokens() {
    const custom = Array.from(this.customTokens.values());
    localStorage.setItem(`custom_tokens_${this.chainId}`, JSON.stringify(custom));
  }

  loadCustomTokens() {
    const stored = localStorage.getItem(`custom_tokens_${this.chainId}`);
    if (stored) {
      const tokens = JSON.parse(stored);
      tokens.forEach(t => {
        this.tokens.set(t.address.toLowerCase(), t);
        this.customTokens.set(t.address.toLowerCase(), t);
      });
    }
  }

  // 搜索代幣
  search(query) {
    const q = query.toLowerCase();
    return Array.from(this.tokens.values()).filter(token =>
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  }

  // 獲取所有代幣地址
  getAllAddresses() {
    return Array.from(this.tokens.keys());
  }
}
```

## 批量餘額查詢優化

當需要查詢大量代幣餘額時（如展示用戶錢包中的所有代幣餘額），逐個 RPC 調用效率極低。使用 Multicall 合約可以在一次 RPC 調用中批量執行多個視圖函數：

```javascript
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
  'function getEthBalance(address addr) view returns (uint256)',
];

const MULTICALL_ADDRESSES = {
  1: '0xeefba1e63905ef1d7acba5a8513c70307c1ce441',     // Multicall v1
  137: '0x275617327c958bD06b5Dab0BCbe1710A7C8246C7',   // Polygon
};

class MulticallReader {
  constructor(provider, chainId) {
    this.provider = provider;
    this.multicallAddress = MULTICALL_ADDRESSES[chainId];
    this.multicall = new ethers.Contract(this.multicallAddress, MULTICALL_ABI, provider);
  }

  // 批量查詢代幣餘額
  async batchBalancesOf(ownerAddress, tokenAddresses) {
    const erc20Interface = new ethers.utils.Interface(ERC20_ABI);

    const calls = tokenAddresses.map(tokenAddress => ({
      target: tokenAddress,
      callData: erc20Interface.encodeFunctionData('balanceOf', [ownerAddress]),
    }));

    const [, returnData] = await this.multicall.aggregate(calls);

    return tokenAddresses.map((tokenAddress, i) => {
      const decoded = erc20Interface.decodeFunctionResult('balanceOf', returnData[i]);
      return {
        tokenAddress,
        balance: decoded[0],
      };
    });
  }

  // 批量查詢代幣元數據 + 餘額
  async batchTokenInfoWithBalance(ownerAddress, tokenAddresses) {
    const erc20Interface = new ethers.utils.Interface(ERC20_ABI);

    const calls = [];
    for (const tokenAddress of tokenAddresses) {
      calls.push({ target: tokenAddress, callData: erc20Interface.encodeFunctionData('balanceOf', [ownerAddress]) });
      calls.push({ target: tokenAddress, callData: erc20Interface.encodeFunctionData('decimals', []) });
      calls.push({ target: tokenAddress, callData: erc20Interface.encodeFunctionData('symbol', []) });
      calls.push({ target: tokenAddress, callData: erc20Interface.encodeFunctionData('name', []) });
    }

    const [, returnData] = await this.multicall.aggregate(calls);

    const results = [];
    for (let i = 0; i < tokenAddresses.length; i++) {
      const offset = i * 4;
      const balance = erc20Interface.decodeFunctionResult('balanceOf', returnData[offset])[0];
      const decimals = erc20Interface.decodeFunctionResult('decimals', returnData[offset + 1])[0];
      const symbol = erc20Interface.decodeFunctionResult('symbol', returnData[offset + 2])[0];
      const name = erc20Interface.decodeFunctionResult('name', returnData[offset + 3])[0];

      results.push({
        address: tokenAddresses[i],
        name,
        symbol,
        decimals,
        balance,
        formatted: ethers.utils.formatUnits(balance, decimals),
      });
    }

    return results;
  }
}

// 使用示例
async function getUserTokenPortfolio(provider, chainId, userAddress, tokenAddresses) {
  const reader = new MulticallReader(provider, chainId);

  // 一次 RPC 調用獲取所有代幣信息
  const tokens = await reader.batchTokenInfoWithBalance(userAddress, tokenAddresses);

  // 過濾餘額大於 0 的代幣
  return tokens.filter(t => !t.balance.isZero());
}
```

### 性能對比

| 方式 | RPC 調用數 | 100 個代幣耗時 |
|---|---|---|
| 逐個查詢 | 300（餘額+精度+符號） | ~30s |
| Promise.all 並發 | 300 | ~3s |
| Multicall | 1 | ~0.5s |

在大量代幣查詢場景下，Multicall 將 RPC 調用從數百次減少到 1 次，顯著降低了網絡延遲和 Infura/Alchemy 的 API 調用量。

## 小結

ERC-20 是 Web3 前端開發中最基礎也是最高頻的交互對象。從餘額查詢到授權轉賬，從單代幣操作到批量管理，一個完善的 ERC-20 交互層應該處理好精度轉換、授權管理、事件監聽和性能優化這幾個核心問題。

在實際項目中，建議將 ERC-20 交互封裝為獨立的 service 層，與 UI 組件解耦。Multicall 是優化性能的關鍵工具——任何需要查詢多個代幣信息的場景都應該優先考慮使用 Multicall，而不是並發發送大量 RPC 請求。授權策略的選擇需要根據應用場景平衡安全性和用戶體驗，DeFi 協議交互通常使用無限授權，而轉賬類操作則應使用精確授權。
