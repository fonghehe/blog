---
title: "Wagmi Hooks 實戰：React DApp 狀態管理"
date: 2022-03-15 21:02:46
tags:
  - Web3
  - React
  - DApp
readingTime: 9
description: "使用 wagmi Hooks 構建 React DApp，從錢包連接到合約交互的完整狀態管理方案"
wordCount: 621
---

## Wagmi 設計哲學

wagmi 由 Paradigm 團隊開發。它的核心理念是：**Web3 狀態管理應該像使用 React Hooks 一樣自然**。在此之前，DApp 前端通常需要手動管理 ethers.js 的 Provider/Signer 實例、監聽賬户和網絡變化、處理合約調用狀態——這些邏輯分散在組件各處，容易產生競態條件和內存泄漏。

wagmi 的設計基於三個核心決策：

1. **React Hooks 原生**：所有 Web3 操作都封裝為 Hooks，與 React 的數據流無縫集成
2. **基於 React Query**：合約讀取操作利用 React Query 的緩存、自動刷新和樂觀更新能力
3. **ethers.js 封裝**：底層使用 ethers.js，但開發者大部分時間不需要直接接觸 ethers.js API

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

### 預配置 Connectors

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

// App 根組件包裹
import { WagmiConfig } from 'wagmi';

function App() {
  return (
    <WagmiConfig client={client}>
      <YourDApp />
    </WagmiConfig>
  );
}
```

## 合約交互

### useContractRead：讀取鏈上數據

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
    watch: true, // 自動刷新（基於區塊）
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error fetching balance</span>;

  return <span>{data?.toString()}</span>;
}

// 多個合約讀取
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

### useContractReads：批量讀取

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

### useContractWrite：發送交易

```tsx
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

function TransferToken({ tokenAddress, toAddress, amount }: {
  tokenAddress: string;
  toAddress: string;
  amount: string;
}) {
  // 1. 預計算交易（用於 gas 估算和參數驗證）
  const { config, error: prepareError } = usePrepareContractWrite({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress, ethers.utils.parseUnits(amount, 18)],
    enabled: !!toAddress && !!amount,
  });

  // 2. 發送交易
  const { write, data: writeData, error: writeError } = useContractWrite(config);

  // 3. 等待交易確認
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

### 授權流程

```tsx
function ApproveAndSwap({ tokenIn, tokenOut, amount, spender }: {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  spender: string;
}) {
  const { address } = useAccount();

  // 查詢當前授權額度
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, spender],
    watch: true,
  });

  const parsedAmount = ethers.utils.parseUnits(amount, 18);
  const needsApproval = !allowance || allowance.lt(parsedAmount);

  // 授權交易
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
    address: spender, // Router 合約
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

## useWaitForTransaction：交易狀態追蹤

```tsx
function TransactionStatus({ txHash }: { txHash: string }) {
  const { data, isError, isLoading } = useWaitForTransaction({
    hash: txHash,
    // 可以設置確認區塊數
    confirmations: 3,
    // 交易成功後的回調
    onSuccess(data) {
      console.log('Transaction confirmed:', data);
      // 觸發 UI 更新或數據刷新
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

## 緩存策略與 React Query 集成

wagmi 底層使用 React Query 管理數據緩存。理解 React Query 的緩存機制對於優化 DApp 性能至關重要：

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
    cacheTime: 30_000, // 緩存 30 秒
    staleTime: 10_000, // 10 秒內不重新請求
    refetchInterval: 15_000, // 每 15 秒自動刷新
    select(data) {
      // 數據轉換
      return ethers.utils.formatEther(data);
    },
  });

  // 手動刷新
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['readContract', tokenAddress, 'balanceOf'],
    });
  };

  return { balance, refresh };
}

// 交易成功後自動刷新相關查詢
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
      // 刷新餘額查詢
      queryClient.invalidateQueries({
        queryKey: ['readContract', tokenAddress],
      });
      // 刷新所有餘額（如果用户有多個代幣）
      queryClient.invalidateQueries({
        queryKey: ['balances'],
      });
    },
  });

  return { transfer: write, isSuccess };
}
```

## 完整 React DApp 組件

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

  // 讀取代幣精度
  const { data: decimalsIn } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // 讀取餘額
  const { data: balance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    enabled: !!address,
    watch: true,
  });

  // 讀取預期輸出量
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

  // 授權檢查
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, routerAddress],
    enabled: !!address,
    watch: true,
  });

  const needsApprove = allowance && parsedAmountIn && allowance.lt(parsedAmountIn);

  // 授權交易
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

## 錯誤處理與加載狀態管理

```tsx
// 統一的錯誤處理 Hook
function useContractError(error: Error | null) {
  return useMemo(() => {
    if (!error) return null;

    // 解析常見錯誤
    if (error.message.includes('user rejected')) {
      return '用户拒絕了交易';
    }
    if (error.message.includes('insufficient funds')) {
      return 'ETH 餘額不足以支付 Gas';
    }
    if (error.message.includes('execution reverted')) {
      // 嘗試解析 revert 原因
      const reasonMatch = error.message.match(/reason="([^"]+)"/);
      if (reasonMatch) return `合約執行失敗: ${reasonMatch[1]}`;
      return '合約執行失敗';
    }
    if (error.message.includes('nonce too low')) {
      return 'Nonce 錯誤，請重試';
    }

    return error.message;
  }, [error]);
}

// 加載狀態組合
function useTransactionLoading(prepareLoading, writeLoading, waitLoading) {
  if (prepareLoading) return { status: 'preparing', label: '準備交易...' };
  if (writeLoading) return { status: 'sending', label: '等待錢包簽名...' };
  if (waitLoading) return { status: 'confirming', label: '等待鏈上確認...' };
  return { status: 'idle', label: '' };
}
```

## 性能優化

### 選擇性 Hooks

```tsx
// 避免不必要的重新渲染
function OptimizedTokenList({ tokens, userAddress }: {
  tokens: string[];
  userAddress: string;
}) {
  // 使用 useContractReads 一次性查詢所有代幣
  // 而不是為每個代幣創建單獨的 useContractRead
  const { data, isLoading } = useContractReads({
    contracts: tokens.flatMap(tokenAddress => [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ]),
    // 批量查詢配置
    cacheTime: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <div>Loading tokens...</div>;

  // 將扁平化的結果按 3 個一組分組
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

### 區塊級刷新控制

```tsx
// 根據網絡條件調整刷新策略
function useAdaptiveRefresh(chainId: number) {
  const blockTime = useMemo(() => {
    // 不同鏈的區塊時間
    const blockTimes: Record<number, number> = {
      1: 13_000,    // Ethereum: ~13s
      137: 2_000,   // Polygon: ~2s
      42161: 250,   // Arbitrum: ~0.25s
      10: 2_000,    // Optimism: ~2s
    };
    return blockTimes[chainId] || 13_000;
  }, [chainId]);

  return {
    // 在新區塊到來時刷新
    refetchInterval: blockTime,
    // 但不超過 30 秒
    refetchIntervalInBackground: 30_000,
  };
}
```

## 與直接使用 ethers.js 的開發體驗對比

### 直接使用 ethers.js

```tsx
// 手動管理 Provider、Signer、狀態
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

    // 手動監聽新區塊
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
// wagmi 版本：一行 Hook 完成所有邏輯
function BalanceWagmi({ tokenAddress }: { tokenAddress: string }) {
  const { address } = useAccount();

  const { data: balance, isError, isLoading } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    watch: true, // 自動監聽新區塊刷新
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error</span>;
  return <span>{balance?.toString()}</span>;
}
```

wagmi 版本減少了約 70% 的代碼量，同時自動處理了以下問題：
- Provider 初始化和生命週期管理
- 賬户切換時的重新查詢
- 網絡切換時的適配
- 請求去重和緩存
- 組件卸載時的清理

## 小結

wagmi 將 React Hooks 範式引入 Web3 開發，大幅降低了 DApp 狀態管理的複雜度。它的核心價值在於：將 ethers.js 的命令式 API 轉化為聲明式 Hooks，讓 React 開發者可以用熟悉的數據流模式來處理鏈上狀態。

wagmi 並非完美——它的抽象層在某些場景下會成為障礙，比如需要精細控制交易 nonce、自定義簽名流程或使用 ethers.js 的高級特性時，仍然需要直接操作 ethers.js 對象。但對於 90% 的 DApp 前端需求（錢包連接、合約讀寫、交易追蹤），wagmi 提供了目前最優的開發體驗。與直接使用 ethers.js 相比，wagmi 的主要優勢在於減少樣板代碼、自動處理狀態同步和利用 React Query 的緩存能力優化性能。
