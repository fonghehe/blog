---
title: "Wagmi Hooks 実践：React DApp 状態管理"
date: 2022-03-15 21:02:46
tags:
  - Web3
  - React
  - DApp
readingTime: 10
description: "wagmi Hooks で React DApp を構築、ウォレット接続からコントラクト連携までの完全な状態管理ソリューション"
wordCount: 1055
---

## Wagmi の設計哲学

wagmi は Paradigm チームが開発した React 向けの Web3 状態管理ライブラリです。その中核理念は：**Web3 の状態管理は React Hooks を使うように自然であるべき**。従来、DApp フロントエンドは通常 ethers.js の Provider/Signer インスタンスを手動で管理し、アカウントやネットワークの変化をリスニングし、コントラクト呼び出しの状態を処理する必要がありました——これらのロジックがコンポーネントのあちこちに分散し、レースコンディションやメモリリークが発生しやすい問題がありました。

wagmi の設計は3つの中核的決定に基づいています：

1. **React Hooks ネイティブ**：すべての Web3 操作を Hooks としてカプセル化し、React のデータフローとシームレスに統合
2. **React Query ベース**：コントラクト読み取り操作は React Query のキャッシュ、自動リフレッシュ、楽観的アップデート能力を利用
3. **ethers.js カプセル化**：基盤は ethers.js を使用するが、開発者の大部分は ethers.js API に直接触れる必要がない

## 中核 Hooks

### useAccount と useConnect

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

### プレ設定 Connectors

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

## コントラクト連携

### useContractRead：オンチェーンデータの読み取り

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

### useContractReads：バッチ読み取り

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

### useContractWrite：トランザクション送信

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

### 許可フロー

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

## useWaitForTransaction：トランザクション状態の追跡

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

## キャッシュ戦略と React Query 統合

wagmi は基盤で React Query を使用してデータキャッシュを管理します。React Query のキャッシュメカニズムを理解することは DApp のパフォーマンス最適化において極めて重要です：

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

## 完全な React DApp コンポーネント

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

## エラー処理とローディング状態の管理

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

## パフォーマンス最適化

### 選択的 Hooks

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

### ブロックレベルのリフレッシュ制御

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

## ethers.js 直接使用との開発体験の比較

### ethers.js の直接使用

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

### wagmi の使用

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

wagmi バージョンは約70%のコード量を削減し、同時に以下の問題を自動的に処理します：
- Provider の初期化とライフサイクル管理
- アカウント切替時の再クエリ
- ネットワーク切替時の適応
- リクエストの重複排除とキャッシュ
- コンポーネントのアンマウント時のクリーンアップ

## まとめ

wagmi は React Hooks パラダイムを Web3 開発に導入し、DApp 状態管理の複雑さを大幅に削減しました。その中核的価値は：ethers.js の命令型 API を宣言型 Hooks に変換し、React 開発者が使い慣れたデータフローモデルでオンチェーン状態を処理できるようにすることです。

wagmi は完璧ではありません——その抽象化層は一部のシナリオでは障壁となり得ます。例えばトランザクション nonce の精密な制御、カスタム署名フロー、ethers.js の高度な機能の使用が必要な場合は、依然として ethers.js オブジェクトを直接操作する必要があります。しかし DApp フロントエンドの要件の90%（ウォレット接続、コントラクト読み書き、トランザクション追跡）について、wagmi は現在 最適な開発体験を提供しています。ethers.js の直接使用と比較して、wagmi の主な利点はボイラープレートコードの削減、状態同期の自動処理、React Query のキャッシュ能力によるパフォーマンス最適化にあります。
