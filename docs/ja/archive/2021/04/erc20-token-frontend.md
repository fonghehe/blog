---
title: "ERC-20 トークンフロントエンド連携の完全ガイド"
date: 2021-04-09 12:48:21
tags:
  - Web3
  - Ethereum
  - DeFi
readingTime: 10
description: "残高照会から許可・送金まで、ERC-20 トークンのフロントエンド連携パターンとエンジニアリング実践を包括的に解説"
wordCount: 1292
---

## ERC-20 標準インターフェースの概要

ERC-20 は Ethereum で最も広く使用されているトークン標準であり、代替性トークンの最小インターフェースセットを定義しています。Ethereum メインネットには30万種以上の ERC-20 トークンが存在し、ステーブルコイン（USDT、USDC、DAI）、ガバナンストークン（COMP、UNI）、DeFi LP トークンなど様々な用途をカバーしています。

ERC-20 標準インターフェースは9つの関数と2つのイベントで構成されます：

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

フロントエンド開発者にとって、ERC-20 の連携は2つの大きなカテゴリに分類できます：**読み取り操作**（balanceOf、allowance、メタデータ照会）と**書き込み操作**（transfer、approve、transferFrom）。書き込み操作の中で、approve + transferFrom の許可パターンは DeFi フロントエンド連携を理解する鍵となります。

## フロントエンドでのトークン残高照会

### 基礎残高照会

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

### フォーマットと精度の処理

ERC-20 トークンのオンチェーン保存は整数を使用し、精度は `decimals` で決まります。フロントエンド表示時は精度変換を正しく処理する必要があります：

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

## 送金トランザクション

### 直接送金

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

## 許可メカニズム：approve + transferFrom

ERC-20 の許可メカニズムは DeFi プロトコル連携の基礎です。ユーザーは `approve` で特定のコントラクト（Uniswap Router など）が自分のトークンを使用することを許可し、コントラクトはその後 `transferFrom` でユーザーのアドレスからトークンを転送します。

### 許可の照会と設定

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

### 無限許可 vs 精密許可

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

2つの戦略のトレードオフ：
- **無限許可**：ユーザー体験が良い（approve は一度だけでよい）が、セキュリティリスクがより高い——許可されたコントラクトに脆弱性があった場合、攻撃者はユーザーのすべてのトークンを転送できる
- **精密許可**：より安全だが、各取引前に追加の approve トランザクションが必要になる可能性があり、Gas コストと操作ステップが増加する

## イベントリスニング

### Transfer と Approval イベント

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

## 完全な ERC-20 連携カプセル化層

以上の機能を統合した完全なカプセル化層：

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

## マルチトークン管理と自動発見

### トークンリスト管理

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

## バッチ残高照会の最適化

大量のトークン残高を照会する必要がある場合（例：ユーザーウォレットのすべてのトークン残高を表示）、個別の RPC 呼び出しは非常に効率が低いです。Multicall コントラクトを使用すると1回の RPC 呼び出しで複数のビュー関数をバッチ実行できます：

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

### パフォーマンス比較

| 方式 | RPC 呼び出し数 | 100 トークンの所要時間 |
|---|---|---|
| 個別照会 | 300（残高+精度+シンボル） | ~30s |
| Promise.all 並行 | 300 | ~3s |
| Multicall | 1 | ~0.5s |

大量トークン照会の場面では、Multicall が RPC 呼び出しを数百回から1回に削減し、ネットワークレイテンシと Infura/Alchemy の API 呼び出し量を大幅に削減します。

## まとめ

ERC-20 は Web3 フロントエンド開発において最も基礎的で最も高頻度の連携対象です。残高照会から許可・送金まで、単一トークン操作からバッチ管理まで、包括的な ERC-20 連携層は精度変換、許可管理、イベントリスニング、パフォーマンス最適化という中心的な課題を適切に処理すべきです。

実際のプロジェクトでは、ERC-20 連携を独立した service 層にカプセル化し、UI コンポーネントと疎結合にすることを推奨します。Multicall はパフォーマンス最適化のキーツールです——複数のトークン情報を照会する必要があるあらゆる場面で、大量の RPC リクエストを並行送信する代わりに Multicall の使用を優先的に検討すべきです。許可戦略の選択はアプリケーションの場面に応じてセキュリティとユーザー体験のバランスを取る必要があり、DeFi プロトコル連携では通常無限許可を使用し、送金系操作では精密許可を使用すべきです。
