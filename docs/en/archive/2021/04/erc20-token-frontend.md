---
title: "ERC-20 Token Frontend Interaction: A Complete Guide"
date: 2021-04-09 12:48:21
tags:
  - Web3
  - Ethereum
  - DeFi
readingTime: 15
description: "From balance queries to approval transfers, a comprehensive guide to ERC-20 token frontend interaction patterns and engineering practices"
wordCount: 4200
---

## ERC-20 Standard Interface Review

ERC-20 is the most widely used token standard on Ethereum, defining the minimal interface set for fungible tokens. There are now hundreds of thousands of ERC-20 tokens on Ethereum mainnet, covering stablecoins (USDT, USDC, DAI), governance tokens (COMP, UNI), DeFi LP tokens, and various other application scenarios.

The ERC-20 standard interface includes 9 functions and 2 events:

```solidity
interface IERC20 {
    // Query methods
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);

    // Transaction methods
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    // Events
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

For frontend developers, ERC-20 interactions can be divided into two categories: **read operations** (balanceOf, allowance, metadata queries) and **write operations** (transfer, approve, transferFrom). Among write operations, the approve + transferFrom authorization pattern is key to understanding DeFi frontend interactions.

## Frontend Token Balance Query

### Basic Balance Query

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

  // Cache metadata to avoid redundant calls
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

### Formatting and Precision Handling

ERC-20 tokens store values on-chain as integers, with precision determined by `decimals`. The frontend must handle precision conversion correctly when displaying:

```javascript
// Precision conversion utility
const TokenFormatter = {
  // Raw on-chain value -> readable string
  format(rawValue, decimals) {
    return ethers.utils.formatUnits(rawValue, decimals);
  },

  // Readable string -> raw on-chain value
  parse(displayValue, decimals) {
    return ethers.utils.parseUnits(displayValue, decimals);
  },

  // Format to specified decimal places
  formatShort(rawValue, decimals, displayDecimals = 4) {
    const formatted = ethers.utils.formatUnits(rawValue, decimals);
    const [int, dec] = formatted.split('.');
    if (!dec) return int;
    return `${int}.${dec.slice(0, displayDecimals)}`;
  },

  // With thousands separator
  formatWithCommas(rawValue, decimals, displayDecimals = 2) {
    const short = this.formatShort(rawValue, decimals, displayDecimals);
    const [int, dec] = short.split('.');
    const intWithCommas = parseInt(int).toLocaleString('en-US');
    return dec ? `${intWithCommas}.${dec}` : intWithCommas;
  },
};

// Usage example
const balance = ethers.BigNumber.from('1234567890000000000'); // 1.234... ETH
console.log(TokenFormatter.formatWithCommas(balance, 18, 4)); // "1.2345"
```

## Transfer Transactions

### Direct Transfer

```javascript
async function transferToken(provider, tokenAddress, toAddress, amount) {
  const signer = provider.getSigner();
  const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);

  // Get decimals and parse amount
  const decimals = await token.decimals();
  const rawAmount = ethers.utils.parseUnits(amount, decimals);

  // Check balance
  const senderAddress = await signer.getAddress();
  const balance = await token.balanceOf(senderAddress);
  if (balance.lt(rawAmount)) {
    throw new Error(`Insufficient balance. Current: ${ethers.utils.formatUnits(balance, decimals)}, Needed: ${amount}`);
  }

  // Send transaction
  const tx = await token.transfer(toAddress, rawAmount);
  const receipt = await tx.wait();

  // Parse Transfer event
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

## The Authorization Mechanism: approve + transferFrom

ERC-20's authorization mechanism is the foundation of DeFi protocol interactions. Users authorize a contract (e.g., Uniswap Router) to use their tokens via `approve`, and the contract subsequently transfers tokens from the user's address via `transferFrom`.

### Allowance Queries and Setting

```javascript
class TokenApprovalManager {
  constructor(provider) {
    this.provider = provider;
  }

  // Query allowance
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

  // Set allowance
  async approve(tokenAddress, spenderAddress, amount) {
    const signer = this.provider.getSigner();
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
    const decimals = await token.decimals();

    let rawAmount;
    if (typeof amount === 'string' && amount === 'max') {
      // Unlimited approval
      rawAmount = ethers.constants.MaxUint256;
    } else {
      rawAmount = ethers.utils.parseUnits(amount, decimals);
    }

    const tx = await token.approve(spenderAddress, rawAmount);
    const receipt = await tx.wait();
    return receipt;
  }

  // Check and ensure sufficient allowance
  async ensureAllowance(tokenAddress, spenderAddress, requiredAmount) {
    const signer = this.provider.getSigner();
    const ownerAddress = await signer.getAddress();

    const allowance = await this.getAllowance(
      tokenAddress, ownerAddress, spenderAddress
    );

    if (allowance.raw.gte(requiredAmount)) {
      return { needsApproval: false };
    }

    // Approval needed
    return {
      needsApproval: true,
      approve: async () => {
        // If there is a partial allowance, reset to 0 first (required by some token contracts)
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

### Unlimited Approval vs. Exact Approval

```javascript
// Exact approval: approve only the amount needed each time
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

// Unlimited approval: one-time max authorization, no subsequent approvals needed
async function maxApprove(provider, tokenAddress, spenderAddress) {
  const manager = new TokenApprovalManager(provider);
  const allowance = await manager.getAllowance(
    tokenAddress,
    await provider.getSigner().getAddress(),
    spenderAddress
  );

  if (allowance.isMax) return; // Already max approval

  return manager.approve(tokenAddress, spenderAddress, 'max');
}
```

Trade-offs between the two strategies:
- **Unlimited approval**: Better user experience (only one approve needed), but higher security risk—if the approved contract has a vulnerability, an attacker can drain all the user's tokens
- **Exact approval**: More secure, but each transaction may require an additional approve transaction before it, increasing Gas costs and operational steps

## Event Listening

### Transfer and Approval Events

```javascript
class TokenEventWatcher {
  constructor(provider, tokenAddress) {
    this.provider = provider;
    this.token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    this.handlers = new Map();
  }

  // Watch incoming transfers for a specific address
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

  // Watch outgoing transfers for a specific address
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

  // Watch approval events
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

  // Query historical transfer records
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

    // Sort by block number
    allTransfers.sort((a, b) => b.blockNumber - a.blockNumber);

    return allTransfers;
  }

  destroy() {
    this.token.removeAllListeners();
  }
}
```

## Complete ERC-20 Interaction Wrapper Layer

Consolidating the above functionality into a complete wrapper layer:

```javascript
class ERC20Manager {
  constructor(provider) {
    this.provider = provider;
    this.tokenCache = new Map(); // address -> ERC20Token
    this.metadataCache = new Map(); // address -> {decimals, symbol, name}
  }

  // Get or create token instance
  getToken(address) {
    if (!this.tokenCache.has(address)) {
      this.tokenCache.set(address, new ERC20Token(address, this.provider));
    }
    return this.tokenCache.get(address);
  }

  // Batch fetch token metadata
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

  // Batch fetch balances for multiple tokens
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

  // Token transfer
  async transfer(tokenAddress, to, amount) {
    return transferToken(this.provider, tokenAddress, to, amount);
  }

  // Allowance management
  async approve(tokenAddress, spender, amount) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.approve(tokenAddress, spender, amount);
  }

  // Check allowance
  async checkAllowance(tokenAddress, owner, spender) {
    const manager = new TokenApprovalManager(this.provider);
    return manager.getAllowance(tokenAddress, owner, spender);
  }
}
```

## Multi-Token Management and Auto-Discovery

### Token List Management

```javascript
// Common token preset list
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
    this.customTokens = new Map(); // Manually added tokens

    // Load default list
    this.loadDefaultList();
  }

  loadDefaultList() {
    const list = TOKEN_LISTS[this.chainId] || [];
    list.forEach(token => {
      this.tokens.set(token.address.toLowerCase(), token);
    });
  }

  // Add custom token
  async addToken(address) {
    if (this.tokens.has(address.toLowerCase())) {
      return this.tokens.get(address.toLowerCase());
    }

    // Read metadata from chain
    const token = new ethers.Contract(address, ERC20_ABI, this.provider);
    const [name, symbol, decimals] = await Promise.all([
      token.name(),
      token.symbol(),
      token.decimals(),
    ]);

    const tokenInfo = { address, name, symbol, decimals };
    this.tokens.set(address.toLowerCase(), tokenInfo);
    this.customTokens.set(address.toLowerCase(), tokenInfo);

    // Persist to localStorage
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

  // Search tokens
  search(query) {
    const q = query.toLowerCase();
    return Array.from(this.tokens.values()).filter(token =>
      token.symbol.toLowerCase().includes(q) ||
      token.name.toLowerCase().includes(q) ||
      token.address.toLowerCase().includes(q)
    );
  }

  // Get all token addresses
  getAllAddresses() {
    return Array.from(this.tokens.keys());
  }
}
```

## Batch Balance Query Optimization

When querying balances for a large number of tokens (e.g., displaying all token balances in a user's wallet), making individual RPC calls is extremely inefficient. Using a Multicall contract allows batch execution of multiple view functions in a single RPC call:

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

  // Batch query token balances
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

  // Batch query token metadata + balances
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

// Usage example
async function getUserTokenPortfolio(provider, chainId, userAddress, tokenAddresses) {
  const reader = new MulticallReader(provider, chainId);

  // Single RPC call to get all token information
  const tokens = await reader.batchTokenInfoWithBalance(userAddress, tokenAddresses);

  // Filter tokens with balance greater than 0
  return tokens.filter(t => !t.balance.isZero());
}
```

### Performance Comparison

| Method | RPC Calls | Time for 100 Tokens |
|---|---|---|
| Sequential queries | 300 (balance+decimals+symbol) | ~30s |
| Promise.all concurrency | 300 | ~3s |
| Multicall | 1 | ~0.5s |

In large-scale token query scenarios, Multicall reduces RPC calls from hundreds to just 1, significantly reducing network latency and Infura/Alchemy API call volume.

## Summary

ERC-20 is the most fundamental and most frequently interacted object in Web3 frontend development. From balance queries to approval transfers, from single-token operations to batch management, a well-designed ERC-20 interaction layer should handle the core issues of precision conversion, allowance management, event listening, and performance optimization.

In actual projects, it's recommended to encapsulate ERC-20 interactions as an independent service layer, decoupled from UI components. Multicall is a key tool for performance optimization—any scenario requiring queries for multiple token information should prioritize Multicall over sending a large number of concurrent RPC requests. The choice of approval strategy needs to balance security and user experience based on the application scenario; DeFi protocol interactions typically use unlimited approval, while transfer-type operations should use exact approval.
