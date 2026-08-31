---
title: "ERC-20 代币前端交互完整方案"
date: 2021-04-09 12:48:21
tags:
  - Web3
  - Ethereum
  - DeFi
readingTime: 9
description: "从余额查询到授权转账，全面解析 ERC-20 代币的前端交互模式与工程实践"
wordCount: 798
---

## ERC-20 标准接口

ERC-20 是以太坊上最广泛使用的代币标准，定义了同质化代币的最小接口集合。以太坊主网上有数十万种 ERC-20 代币，涵盖稳定币（USDT、USDC、DAI）、治理代币（COMP、UNI）、DeFi LP 代币等各种应用场景。

ERC-20 标准接口包含 9 个函数和 2 个事件：

```solidity
interface IERC20 {
    // 查询类
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // 交易类
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // 事件
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

对于前端开发者而言，ERC-20 的交互可以分为两大类：**读取操作**（balanceOf、allowance、元数据查询）和**写入操作**（transfer、approve、transferFrom）。写入操作中，approve + transferFrom 的授权模式是理解 DeFi 前端交互的关键。

## 前端代币余额查询

### 基础余额查询

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

  // 缓存元数据，避免重复调用
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

### 格式化与精度处理

ERC-20 代币的链上存储使用整数，精度由 `decimals` 决定。前端展示时必须正确处理精度转换：

```javascript
// 精度转换工具
const TokenFormatter = {
  // 链上原始值 -> 可读字符串
  format(rawValue, decimals) {
    return ethers.utils.formatUnits(rawValue, decimals);
  },

  // 可读字符串 -> 链上原始值
  parse(displayValue, decimals) {
    return ethers.utils.parseUnits(displayValue, decimals);
  },

  // 格式化为指定小数位
  formatShort(rawValue, decimals, displayDecimals = 4) {
    const formatted = ethers.utils.formatUnits(rawValue, decimals);
    const [int, dec] = formatted.split('.');
    if (!dec) return int;
    return `${int}.${dec.slice(0, displayDecimals)}`;
  },

  // 带千位分隔符
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

## 转账交易

### 直接转账

```javascript
async function transferToken(provider, tokenAddress, toAddress, amount) {
  const signer = provider.getSigner();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // 获取精度并解析金额
  const decimals = await token.decimals();
  const rawAmount = ethers.utils.parseUnits(amount, decimals);

  // 检查余额
  const senderAddress = await signer.getAddress();
  const balance = await token.balanceOf(senderAddress);
  if (balance.lt(rawAmount)) {
    throw new Error(`余额不足。当前: ${ethers.utils.formatUnits(balance, decimals)}, 需要: ${amount}`);
  }

  // 发送交易
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

## 授权机制：approve + transferFrom

ERC-20 的授权机制是 DeFi 协议交互的基础。用户通过 `approve` 授权某个合约（如 Uniswap Router）可以使用自己的代币，合约随后通过 `transferFrom` 将代币从用户地址转出。

### 授权查询与设置

```javascript
class TokenApprovalManager {
  constructor(provider) {
    this.provider = provider;
  }

  // 查询授权额度
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

  // 设置授权
  async approve(tokenAddress, spenderAddress, amount) {
    const signer = this.provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await token.decimals();

    let rawAmount;
    if (typeof amount === 'string' && amount === 'max') {
      // 无限授权
      rawAmount = ethers.constants.MaxUint256;
    } else {
      rawAmount = ethers.utils.parseUnits(amount, decimals);
    }

    const tx = await token.approve(spenderAddress, rawAmount);
    const receipt = await tx.wait();
    return receipt;
  }

  // 检查并确保授权额度充足
  async ensureAllowance(tokenAddress, spenderAddress, requiredAmount) {
    const signer = this.provider.getSigner();
    const ownerAddress = await signer.getAddress();

    const allowance = await this.getAllowance(
      tokenAddress, ownerAddress, spenderAddress
    );

    if (allowance.raw.gte(requiredAmount)) {
      return { needsApproval: false };
    }

    // 需要授权
    return {
      needsApproval: true,
      approve: async () => {
        // 如果已有部分授权额度，先重置为 0（部分代币合约要求）
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

### 无限授权 vs 精确授权

```javascript
// 精确授权：每次只授权需要的金额
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

// 无限授权：一次性授权最大值，后续交易无需再次授权
async function maxApprove(provider, tokenAddress, spenderAddress) {
  const manager = new TokenApprovalManager(provider);
  const allowance = await manager.getAllowance(
    tokenAddress,
    await provider.getSigner().getAddress(),
    spenderAddress
  );

  if (allowance.isMax) return; // 已经是无限授权

  return manager.approve(tokenAddress, spenderAddress, 'max');
}
```

两种策略的权衡：
- **无限授权**：用户体验好（只需一次 approve），但安全风险更高——如果被授权合约存在漏洞，攻击者可以转走用户的所有代币
- **精确授权**：更安全，但每笔交易前可能需要额外的 approve 交易，增加 Gas 成本和操作步骤

## 事件监听

### Transfer 和 Approval 事件

```javascript
class TokenEventWatcher {
  constructor(provider, tokenAddress) {
    this.provider = provider;
    this.token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    this.handlers = new Map();
  }

  // 监听指定地址的转入事件
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

  // 监听指定地址的转出事件
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

  // 监听授权事件
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

  // 查询历史转账记录
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

    // 按区块号排序
    allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);

    return allTransfers;
  }

  destroy() {
    this.token.removeAllListeners();
  }
}
```

## 完整的 ERC-20 交互封装层

将以上功能整合为一个完整的封装层：

```javascript
class ERC20Manager {
  constructor(provider) {
    this.provider = provider;
    this.tokenCache = new Map(); // address -> ERC20Token
    this.metadataCache = new Map(); // address -> {decimals, symbol, name}
  }

  // 获取或创建代币实例
  getToken(address) {
    if (!this.tokenCache.has(address)) {
      this.tokenCache.set(address, new ERC20Token(address, this.provider));
    }
    return this.tokenCache.get(address);
  }

  // 批量获取代币元数据
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

  // 批量获取多个代币的余额
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

  // 代币转账
  async transfer(tokenAddress, to, amount) {
    return transferToken(this.provider, tokenAddress, to, amount);
  }

  // 授权管理
  async approve(tokenAddress, spender, amount) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.approve(tokenAddress, spender, amount);
  }

  // 检查授权
  async checkAllowance(tokenAddress, owner, spender) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.getAllowance(tokenAddress, owner, spender);
  }
}
```

## 多代币管理与自动发现

### 代币列表管理

```javascript
// 常见代币预设列表
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
    this.customTokens = new Map(); // 用户手动添加的代币

    // 加载预设列表
    this.loadDefaultList();
  }

  loadDefaultList() {
    const list = TOKEN_LISTS[this.chainId] || [];
    list.forEach(token => {
      this.tokens.set(token.address.toLowerCase(), token);
    });
  }

  // 添加自定义代币
  async addToken(address) {
    if (this.tokens.has(address.toLowerCase())) {
      return this.tokens.get(address.toLowerCase());
    }

    // 从链上读取元数据
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

  // 搜索代币
  search(query) {
    const q = query.toLowerCase();
    return Array.from(this.tokens.values()).filter(token =>
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  }

  // 获取所有代币地址
  getAllAddresses() {
    return Array.from(this.tokens.keys());
  }
}
```

## 批量余额查询优化

当需要查询大量代币余额时（如展示用户钱包中的所有代币余额），逐个 RPC 调用效率极低。使用 Multicall 合约可以在一次 RPC 调用中批量执行多个视图函数：

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

  // 批量查询代币余额
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

  // 批量查询代币元数据 + 余额
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

  // 一次 RPC 调用获取所有代币信息
  const tokens = await reader.batchTokenInfoWithBalance(userAddress, tokenAddresses);

  // 过滤余额大于 0 的代币
  return tokens.filter(t => !t.balance.isZero());
}
```

### 性能对比

| 方式 | RPC 调用数 | 100 个代币耗时 |
|---|---|---|
| 逐个查询 | 300（余额+精度+符号） | ~30s |
| Promise.all 并发 | 300 | ~3s |
| Multicall | 1 | ~0.5s |

在大量代币查询场景下，Multicall 将 RPC 调用从数百次减少到 1 次，显著降低了网络延迟和 Infura/Alchemy 的 API 调用量。

## 小结

ERC-20 是 Web3 前端开发中最基础也是最高频的交互对象。从余额查询到授权转账，从单代币操作到批量管理，一个完善的 ERC-20 交互层应该处理好精度转换、授权管理、事件监听和性能优化这几个核心问题。

在实际项目中，建议将 ERC-20 交互封装为独立的 service 层，与 UI 组件解耦。Multicall 是优化性能的关键工具——任何需要查询多个代币信息的场景都应该优先考虑使用 Multicall，而不是并发发送大量 RPC 请求。授权策略的选择需要根据应用场景平衡安全性和用户体验，DeFi 协议交互通常使用无限授权，而转账类操作则应使用精确授权。
