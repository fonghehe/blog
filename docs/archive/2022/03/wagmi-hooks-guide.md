---
title: "Wagmi Hooks 实战：React DApp 状态管理"
date: 2022-03-15 21:02:46
tags:
  - Web3
  - React
  - DApp
readingTime: 15
description: "使用 wagmi Hooks 构建 React DApp，从钱包连接到合约交互的完整状态管理方案"
wordCount: 4200
---

## Wagmi 设计哲学

wagmi 由 Paradigm 团队开发，其核心理念是：**Web3 状态管理应该像使用 React Hooks 一样自然**。在此之前，DApp 前端通常需要手动管理 ethers.js 的 Provider/Signer 实例、监听账户和网络变化、处理合约调用状态——这些逻辑分散在组件各处，容易产生竞态条件和内存泄漏。

wagmi 的设计基于三个核心决策：

1. **React Hooks 原生**：所有 Web3 操作都封装为 Hooks，与 React 的数据流无缝集成
2. **基于 React Query**：合约读取操作利用 React Query 的缓存、自动刷新和乐观更新能力
3. **ethers.js 封装**：底层使用 ethers.js，但开发者大部分时间不需要直接接触 ethers.js API

## 核心 Hooks

### useAccount 和 useConnect

```tsx
import { useAccount, useConnect, useDisconnect, useNetwork } from 'wagmi';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';

function WalletConnectButton() {
  const { address, isConnected, isConnecting, isReconnecting } = useAccount();
  const { connect, connectors, error: connectError, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chain, chains } = useNetwork();

  if (isConnecting) return <div>Connecting...</div>;
  if (isReconnecting) return <div>Reconnecting...</div>;

  if (isConnected && address) {
    return (
      <div className="wallet-connected">
        <span className="address">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <span className="network">{chain?.name}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button
        onClick={() => connect({ connector: connectors[0] })}
        disabled={isPending}
      >
        {isPending ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {connectError && <p className="error">{connectError.message}</p>}
    </div>
  );
}
```

### 预配置 Connectors

```tsx
import { configureChains, createClient } from 'wagmi';
import { mainnet, polygon, optimism, arbitrum } from 'wagmi/chains';
import { publicProvider } from 'wagmi/providers/public';
import { infuraProvider } from 'wagmi/providers/infura';
import { InjectedConnector } from 'wagmi/connectors/injected';
import { WalletConnectConnector } from 'wagmi/connectors/walletConnect';
import { MetaMaskConnector } from 'wagmi/connectors/metaMask';

const { chains, provider, webSocketProvider } = configureChains(
  [mainnet, polygon, optimism, arbitrum],
  [
    infuraProvider({ apiKey: process.env.INFURA_KEY }),
    publicProvider(),
  ]
);

const client = createClient({
  autoConnect: true,
  connectors: [
    new MetaMaskConnector({ chains }),
    new WalletConnectConnector({
      chains,
      options: {
        qrcode: true,
      },
    }),
  ],
  provider,
  webSocketProvider,
});

// App 根组件包裹
import { WagmiConfig } from 'wagmi';

function App() {
  return (
    <WagmiConfig client={client}>
      <YourDApp />
    </WagmiConfig>
  );
}
```

## 合约交互

### useContractRead：读取链上数据

```tsx
import { useContractRead, useContract, Address } from 'wagmi';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
];

function TokenBalance({ tokenAddress, userAddress }: {
  tokenAddress: string;
  userAddress: string;
}) {
  const { data, isError, isLoading } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
    watch: true, // 自动刷新（基于区块）
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error fetching balance</span>;

  return <span>{data?.toString()}</span>;
}

// 多个合约读取
function TokenInfo({ tokenAddress }: { tokenAddress: string }) {
  const { data: name } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'name',
  });

  const { data: symbol } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
  });

  const { data: decimals } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  if (!name || !symbol || !decimals) return null;

  return (
    <div>
      <h3>{name} ({symbol})</h3>
      <p>Decimals: {decimals}</p>
    </div>
  );
}
```

### useContractReads：批量读取

```tsx
import { useContractReads } from 'wagmi';

function MultiTokenBalances({ tokens, userAddress }: {
  tokens: string[];
  userAddress: string;
}) {
  const { data, isError, isLoading } = useContractReads({
    contracts: tokens.map(tokenAddress => ({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddress],
    })),
  });

  if (isLoading) return <div>Loading all balances...</div>;
  if (isError) return <div>Error loading balances</div>;

  return (
    <div className="token-balances">
      {tokens.map((tokenAddress, i) => (
        <div key={tokenAddress}>
          <span>{tokenAddress.slice(0, 8)}...</span>
          <span>{data?.[i]?.toString() || '0'}</span>
        </div>
      ))}
    </div>
  );
}
```

### useContractWrite：发送交易

```tsx
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

function TransferToken({ tokenAddress, toAddress, amount }: {
  tokenAddress: string;
  toAddress: string;
  amount: string;
}) {
  // 1. 预计算交易（用于 gas 估算和参数验证）
  const { config, error: prepareError } = usePrepareContractWrite({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress, ethers.utils.parseUnits(amount, 18)],
    enabled: !!toAddress && !!amount,
  });

  // 2. 发送交易
  const { write, data: writeData, error: writeError } = useContractWrite(config);

  // 3. 等待交易确认
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransaction({
    hash: writeData?.hash,
  });

  return (
    <div>
      <button
        onClick={() => write?.()}
        disabled={!write || isConfirming}
      >
        {isConfirming ? 'Confirming...' : 'Transfer'}
      </button>
      {isConfirmed && (
        <p className="success">
          Transaction confirmed! Hash: {writeData?.hash}
        </p>
      )}
      {prepareError && (
        <p className="error">Prepare error: {prepareError.message}</p>
      )}
      {writeError && (
        <p className="error">Write error: {writeError.message}</p>
      )}
    </div>
  );
}
```

### 授权流程

```tsx
function ApproveAndSwap({ tokenIn, tokenOut, amount, spender }: {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  spender: string;
}) {
  const { address } = useAccount();

  // 查询当前授权额度
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, spender],
    watch: true,
  });

  const parsedAmount = ethers.utils.parseUnits(amount, 18);
  const needsApproval = !allowance || allowance.lt(parsedAmount);

  // 授权交易
  const { config: approveConfig } = usePrepareContractWrite({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spender, ethers.constants.MaxUint256],
    enabled: needsApproval,
  });

  const { write: approve, isLoading: isApproving } = useContractWrite(approveConfig);
  const { isSuccess: isApproved } = useWaitForTransaction({
    hash: approveConfig?.request?.data,
  });

  // Swap 交易
  const { config: swapConfig } = usePrepareContractWrite({
    address: spender, // Router 合约
    abi: ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [parsedAmount, 0, [tokenIn, tokenOut], address!, deadline],
    enabled: !needsApproval || isApproved,
  });

  const { write: swap, isLoading: isSwapping } = useContractWrite(swapConfig);
  const { isSuccess: isSwapped } = useWaitForTransaction({
    hash: swapConfig?.request?.data,
  });

  return (
    <div>
      {needsApproval ? (
        <button
          onClick={() => approve?.()}
          disabled={!approve || isApproving}
        >
          {isApproving ? 'Approving...' : 'Approve Token'}
        </button>
      ) : (
        <button
          onClick={() => swap?.()}
          disabled={!swap || isSwapping}
        >
          {isSwapping ? 'Swapping...' : 'Swap'}
        </button>
      )}
      {isSwapped && <p>Swap successful!</p>}
    </div>
  );
}
```

## useWaitForTransaction：交易状态追踪

```tsx
function TransactionStatus({ txHash }: { txHash: string }) {
  const { data, isError, isLoading } = useWaitForTransaction({
    hash: txHash,
    // 可以设置确认区块数
    confirmations: 3,
    // 交易成功后的回调
    onSuccess(data) {
      console.log('Transaction confirmed:', data);
      // 触发 UI 更新或数据刷新
      queryClient.invalidateQueries({ queryKey: ['balances'] });
    },
    onError(error) {
      console.error('Transaction failed:', error);
    },
  });

  if (isLoading) {
    return (
      <div className="tx-status tx-status--pending">
        <span className="spinner" />
        <span>Waiting for confirmation...</span>
        <a href={`https://etherscan.io/tx/${txHash}`} target="_blank">
          View on Etherscan
        </a>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="tx-status tx-status--failed">
        <span>Transaction failed</span>
      </div>
    );
  }

  return (
    <div className="tx-status tx-status--confirmed">
      <span>Transaction confirmed!</span>
      <span>Block: {data?.blockNumber}</span>
      <span>Gas used: {data?.gasUsed?.toString()}</span>
    </div>
  );
}
```

## 缓存策略与 React Query 集成

wagmi 底层使用 React Query 管理数据缓存。理解 React Query 的缓存机制对于优化 DApp 性能至关重要：

```tsx
import { useQueryClient } from '@tanstack/react-query';

function useTokenData(tokenAddress: string) {
  const queryClient = useQueryClient();

  const { data: balance } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [useAccount().address!],
    // React Query 配置
    cacheTime: 30_000, // 缓存 30 秒
    staleTime: 10_000, // 10 秒内不重新请求
    refetchInterval: 15_000, // 每 15 秒自动刷新
    select(data) {
      // 数据转换
      return ethers.utils.formatEther(data);
    },
  });

  // 手动刷新
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['readContract', tokenAddress, 'balanceOf'],
    });
  };

  return { balance, refresh };
}

// 交易成功后自动刷新相关查询
function useTransferWithRefresh(tokenAddress: string) {
  const queryClient = useQueryClient();
  const { address } = useAccount();

  const { write, data } = useContractWrite({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    mode: 'recklesslyUnprepared',
  });

  const { isSuccess } = useWaitForTransaction({
    hash: data?.hash,
    onSuccess() {
      // 刷新余额查询
      queryClient.invalidateQueries({
        queryKey: ['readContract', tokenAddress],
      });
      // 刷新所有余额（如果用户有多个代币）
      queryClient.invalidateQueries({
        queryKey: ['balances'],
      });
    },
  });

  return { transfer: write, isSuccess };
}
```

## 完整 React DApp 组件

```tsx
import React, { useState, useMemo } from 'react';
import {
  useAccount,
  useNetwork,
  useContractRead,
  useContractWrite,
  usePrepareContractWrite,
  useWaitForTransaction,
  useSwitchNetwork,
} from 'wagmi';
import { ethers } from 'ethers';
import { parseUnits, formatUnits } from 'viem';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address, uint256) returns (bool)',
];

const ROUTER_ABI = [
  'function swapExactTokensForTokens(uint256, uint256, address[], address, uint256) returns (uint256[])',
  'function getAmountsOut(uint256, address[]) view returns (uint256[])',
];

function DEXSwapInterface() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { switchNetwork } = useSwitchNetwork();

  const [tokenIn, setTokenIn] = useState('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'); // USDC
  const [tokenOut, setTokenOut] = useState('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'); // WETH
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState(0.5);

  const routerAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

  // 读取代币精度
  const { data: decimalsIn } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // 读取余额
  const { data: balance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    enabled: !!address,
    watch: true,
  });

  // 读取预期输出量
  const parsedAmountIn = useMemo(() => {
    if (!amountIn || !decimalsIn) return undefined;
    try {
      return parseUnits(amountIn, decimalsIn);
    } catch {
      return undefined;
    }
  }, [amountIn, decimalsIn]);

  const { data: amountsOut } = useContractRead({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [parsedAmountIn!, [tokenIn, tokenOut]],
    enabled: !!parsedAmountIn,
  });

  const expectedOut = amountsOut?.[1];
  const amountOutMin = expectedOut
    ? expectedOut.mul(1000 - Math.floor(slippage * 10)).div(1000)
    : undefined;

  // 授权检查
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, routerAddress],
    enabled: !!address,
    watch: true,
  });

  const needsApprove = allowance && parsedAmountIn && allowance.lt(parsedAmountIn);

  // 授权交易
  const { config: approveConfig } = usePrepareContractWrite({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [routerAddress, ethers.constants.MaxUint256],
    enabled: needsApprove,
  });

  const {
    write: approveWrite,
    data: approveTxData,
  } = useContractWrite(approveConfig);

  const { isLoading: isApproving } = useWaitForTransaction({
    hash: approveTxData?.hash,
  });

  // Swap 交易
  const { config: swapConfig } = usePrepareContractWrite({
    address: routerAddress,
    abi: ROUTER_ABI,
    functionName: 'swapExactTokensForTokens',
    args: [
      parsedAmountIn!,
      amountOutMin!,
      [tokenIn, tokenOut],
      address!,
      Math.floor(Date.now() / 1000) + 1200,
    ],
    enabled: !!parsedAmountIn && !!amountOutMin && !needsApprove,
  });

  const { write: swapWrite, data: swapTxData } = useContractWrite(swapConfig);

  const { isLoading: isSwapping } = useWaitForTransaction({
    hash: swapTxData?.hash,
  });

  if (!isConnected) {
    return <div>Please connect your wallet</div>;
  }

  if (chain?.id !== 1) {
    return (
      <div>
        <p>Please switch to Ethereum Mainnet</p>
        <button onClick={() => switchNetwork?.(1)}>Switch Network</button>
      </div>
    );
  }

  return (
    <div className="swap-interface">
      <div className="swap-input">
        <label>From</label>
        <input
          type="text"
          value={amountIn}
          onChange={(e) => setAmountIn(e.target.value)}
          placeholder="0.0"
        />
        <span className="balance">
          Balance: {balance && decimalsIn
            ? formatUnits(balance, decimalsIn)
            : '0'}
        </span>
      </div>

      <div className="swap-output">
        <label>To (estimated)</label>
        <input
          type="text"
          value={expectedOut && decimalsIn
            ? formatUnits(expectedOut, decimalsIn)
            : '0.0'
          }
          readOnly
        />
      </div>

      <div className="swap-settings">
        <label>Slippage: {slippage}%</label>
        <input
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          value={slippage}
          onChange={(e) => setSlippage(parseFloat(e.target.value))}
        />
      </div>

      {needsApprove ? (
        <button
          onClick={() => approveWrite?.()}
          disabled={!approveWrite || isApproving}
        >
          {isApproving ? 'Approving...' : 'Approve Token'}
        </button>
      ) : (
        <button
          onClick={() => swapWrite?.()}
          disabled={!swapWrite || isSwapping}
        >
          {isSwapping ? 'Swapping...' : 'Swap'}
        </button>
      )}
    </div>
  );
}
```

## 错误处理与加载状态管理

```tsx
// 统一的错误处理 Hook
function useContractError(error: Error | null) {
  return useMemo(() => {
    if (!error) return null;

    // 解析常见错误
    if (error.message.includes('user rejected')) {
      return '用户拒绝了交易';
    }
    if (error.message.includes('insufficient funds')) {
      return 'ETH 余额不足以支付 Gas';
    }
    if (error.message.includes('execution reverted')) {
      // 尝试解析 revert 原因
      const reasonMatch = error.message.match(/reason="([^"]+)"/);
      if (reasonMatch) return `合约执行失败: ${reasonMatch[1]}`;
      return '合约执行失败';
    }
    if (error.message.includes('nonce too low')) {
      return 'Nonce 错误，请重试';
    }

    return error.message;
  }, [error]);
}

// 加载状态组合
function useTransactionLoading(prepareLoading, writeLoading, waitLoading) {
  if (prepareLoading) return { status: 'preparing', label: '准备交易...' };
  if (writeLoading) return { status: 'sending', label: '等待钱包签名...' };
  if (waitLoading) return { status: 'confirming', label: '等待链上确认...' };
  return { status: 'idle', label: '' };
}
```

## 性能优化

### 选择性 Hooks

```tsx
// 避免不必要的重新渲染
function OptimizedTokenList({ tokens, userAddress }: {
  tokens: string[];
  userAddress: string;
}) {
  // 使用 useContractReads 一次性查询所有代币
  // 而不是为每个代币创建单独的 useContractRead
  const { data, isLoading } = useContractReads({
    contracts: tokens.flatMap(tokenAddress => [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ]),
    // 批量查询配置
    cacheTime: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <div>Loading tokens...</div>;

  // 将扁平化的结果按 3 个一组分组
  return (
    <div>
      {tokens.map((tokenAddress, i) => {
        const offset = i * 3;
        const balance = data?.[offset];
        const symbol = data?.[offset + 1];
        const decimals = data?.[offset + 2];

        if (!balance || !symbol || !decimals) return null;

        return (
          <TokenRow
            key={tokenAddress}
            address={tokenAddress}
            symbol={symbol}
            balance={balance}
            decimals={decimals}
          />
        );
      })}
    </div>
  );
}

// 使用 React.memo 避免不必要的重渲染
const TokenRow = React.memo(function TokenRow({
  address,
  symbol,
  balance,
  decimals,
}: {
  address: string;
  symbol: string;
  balance: ethers.BigNumber;
  decimals: number;
}) {
  const formatted = formatUnits(balance, decimals);
  return (
    <div className="token-row">
      <span>{symbol}</span>
      <span>{formatted}</span>
    </div>
  );
});
```

### 区块级刷新控制

```tsx
// 根据网络条件调整刷新策略
function useAdaptiveRefresh(chainId: number) {
  const blockTime = useMemo(() => {
    // 不同链的区块时间
    const blockTimes: Record<number, number> = {
      1: 13_000,    // Ethereum: ~13s
      137: 2_000,   // Polygon: ~2s
      42161: 250,   // Arbitrum: ~0.25s
      10: 2_000,    // Optimism: ~2s
    };
    return blockTimes[chainId] || 13_000;
  }, [chainId]);

  return {
    // 在新区块到来时刷新
    refetchInterval: blockTime,
    // 但不超过 30 秒
    refetchIntervalInBackground: 30_000,
  };
}
```

## 与直接使用 ethers.js 的开发体验对比

### 直接使用 ethers.js

```tsx
// 手动管理 Provider、Signer、状态
function BalanceDirect({ tokenAddress }: { tokenAddress: string }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { ethereum } = window;

  useEffect(() => {
    let cancelled = false;

    async function fetchBalance() {
      try {
        setLoading(true);
        const provider = new ethers.providers.Web3Provider(ethereum);
        const signer = provider.getSigner();
        const address = await signer.getAddress();
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const balance = await token.balanceOf(address);

        if (!cancelled) {
          setBalance(balance);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchBalance();

    // 手动监听新区块
    const provider = new ethers.providers.Web3Provider(ethereum);
    provider.on('block', fetchBalance);

    return () => {
      cancelled = true;
      provider.removeAllListeners('block');
    };
  }, [tokenAddress, ethereum]);

  if (loading) return <span>Loading...</span>;
  if (error) return <span>{error}</span>;
  return <span>{balance?.toString()}</span>;
}
```

### 使用 wagmi

```tsx
// wagmi 版本：一行 Hook 完成所有逻辑
function BalanceWagmi({ tokenAddress }: { tokenAddress: string }) {
  const { address } = useAccount();

  const { data: balance, isError, isLoading } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    watch: true, // 自动监听新区块刷新
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error</span>;
  return <span>{balance?.toString()}</span>;
}
```

wagmi 版本减少了约 70% 的代码量，同时自动处理了以下问题：
- Provider 初始化和生命周期管理
- 账户切换时的重新查询
- 网络切换时的适配
- 请求去重和缓存
- 组件卸载时的清理

## 小结

wagmi 将 React Hooks 范式引入 Web3 开发，大幅降低了 DApp 状态管理的复杂度。它的核心价值在于：将 ethers.js 的命令式 API 转化为声明式 Hooks，让 React 开发者可以用熟悉的数据流模式来处理链上状态。

wagmi 并非完美——它的抽象层在某些场景下会成为障碍，比如需要精细控制交易 nonce、自定义签名流程或使用 ethers.js 的高级特性时，仍然需要直接操作 ethers.js 对象。但对于 90% 的 DApp 前端需求（钱包连接、合约读写、交易追踪），wagmi 提供了目前最优的开发体验。与直接使用 ethers.js 相比，wagmi 的主要优势在于减少样板代码、自动处理状态同步和利用 React Query 的缓存能力优化性能。
