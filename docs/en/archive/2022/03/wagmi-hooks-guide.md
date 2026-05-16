---
title: "Wagmi Hooks in Practice: React DApp State Management"
date: 2022-03-15 21:02:46
tags:
  - Web3
  - React
  - DApp
readingTime: 15
description: "Building React DApps with wagmi Hooks: a complete state management solution from wallet connection to contract interaction"
wordCount: 4200
---

## Wagmi Design Philosophy

wagmi is a React Hooks library for Web3, developed by the Paradigm team. Its core philosophy is: **Web3 state management should feel as natural as using React Hooks**. Before wagmi, DApp frontends typically needed to manually manage ethers.js Provider/Signer instances, listen for account and network changes, and handle contract call states—logic that was scattered across components, prone to race conditions and memory leaks.

wagmi's design is based on three core decisions:

1. **React Hooks native**: All Web3 operations are wrapped as Hooks, seamlessly integrating with React's data flow
2. **Built on React Query**: Contract read operations leverage React Query's caching, auto-refresh, and optimistic update capabilities
3. **ethers.js wrapper**: The underlying layer uses ethers.js, but developers don't need to directly interact with the ethers.js API most of the time

## Core Hooks

### useAccount and useConnect

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

### Pre-configured Connectors

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

// Root component wrapper
import { WagmiConfig } from 'wagmi';

function App() {
  return (
    <WagmiConfig client={client}>
      <YourDApp />
    </WagmiConfig>
  );
}
```

## Contract Interaction

### useContractRead: Reading On-chain Data

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
    watch: true, // Auto-refresh (block-based)
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error fetching balance</span>;

  return <span>{data?.toString()}</span>;
}

// Multiple contract reads
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

### useContractReads: Batch Reading

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

### useContractWrite: Sending Transactions

```tsx
import { useContractWrite, usePrepareContractWrite, useWaitForTransaction } from 'wagmi';

function TransferToken({ tokenAddress, toAddress, amount }: {
  tokenAddress: string;
  toAddress: string;
  amount: string;
}) {
  // 1. Pre-compute transaction (for gas estimation and parameter validation)
  const { config, error: prepareError } = usePrepareContractWrite({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress, ethers.utils.parseUnits(amount, 18)],
    enabled: !!toAddress && !!amount,
  });

  // 2. Send transaction
  const { write, data: writeData, error: writeError } = useContractWrite(config);

  // 3. Wait for transaction confirmation
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

### Approval Flow

```tsx
function ApproveAndSwap({ tokenIn, tokenOut, amount, spender }: {
  tokenIn: string;
  tokenOut: string;
  amount: string;
  spender: string;
}) {
  const { address } = useAccount();

  // Query current allowance
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, spender],
    watch: true,
  });

  const parsedAmount = ethers.utils.parseUnits(amount, 18);
  const needsApproval = !allowance || allowance.lt(parsedAmount);

  // Approval transaction
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

  // Swap transaction
  const { config: swapConfig } = usePrepareContractWrite({
    address: spender, // Router contract
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

## useWaitForTransaction: Transaction Status Tracking

```tsx
function TransactionStatus({ txHash }: { txHash: string }) {
  const { data, isError, isLoading } = useWaitForTransaction({
    hash: txHash,
    // Can set required confirmation blocks
    confirmations: 3,
    // Callback on success
    onSuccess(data) {
      console.log('Transaction confirmed:', data);
      // Trigger UI updates or data refresh
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

## Caching Strategy and React Query Integration

wagmi uses React Query under the hood to manage data caching. Understanding React Query's caching mechanism is critical for optimizing DApp performance:

```tsx
import { useQueryClient } from '@tanstack/react-query';

function useTokenData(tokenAddress: string) {
  const queryClient = useQueryClient();

  const { data: balance } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [useAccount().address!],
    // React Query configuration
    cacheTime: 30_000, // Cache for 30 seconds
    staleTime: 10_000, // Don't refetch within 10 seconds
    refetchInterval: 15_000, // Auto-refresh every 15 seconds
    select(data) {
      // Data transformation
      return ethers.utils.formatEther(data);
    },
  });

  // Manual refresh
  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: ['readContract', tokenAddress, 'balanceOf'],
    });
  };

  return { balance, refresh };
}

// Auto-refresh related queries after transaction success
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
      // Refresh balance queries
      queryClient.invalidateQueries({
        queryKey: ['readContract', tokenAddress],
      });
      // Refresh all balances (if user has multiple tokens)
      queryClient.invalidateQueries({
        queryKey: ['balances'],
      });
    },
  });

  return { transfer: write, isSuccess };
}
```

## Complete React DApp Component

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

  // Read token decimals
  const { data: decimalsIn } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'decimals',
  });

  // Read balance
  const { data: balance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    enabled: !!address,
    watch: true,
  });

  // Read expected output amount
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

  // Allowance check
  const { data: allowance } = useContractRead({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, routerAddress],
    enabled: !!address,
    watch: true,
  });

  const needsApprove = allowance && parsedAmountIn && allowance.lt(parsedAmountIn);

  // Approval transaction
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

  // Swap transaction
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

## Error Handling and Loading State Management

```tsx
// Unified error handling Hook
function useContractError(error: Error | null) {
  return useMemo(() => {
    if (!error) return null;

    // Parse common errors
    if (error.message.includes('user rejected')) {
      return 'User rejected the transaction';
    }
    if (error.message.includes('insufficient funds')) {
      return 'Insufficient ETH balance for Gas';
    }
    if (error.message.includes('execution reverted')) {
      // Try to parse revert reason
      const reasonMatch = error.message.match(/reason="([^"]+)"/);
      if (reasonMatch) return `Contract execution failed: ${reasonMatch[1]}`;
      return 'Contract execution failed';
    }
    if (error.message.includes('nonce too low')) {
      return 'Nonce error, please retry';
    }

    return error.message;
  }, [error]);
}

// Loading state composition
function useTransactionLoading(prepareLoading, writeLoading, waitLoading) {
  if (prepareLoading) return { status: 'preparing', label: 'Preparing transaction...' };
  if (writeLoading) return { status: 'sending', label: 'Waiting for wallet signature...' };
  if (waitLoading) return { status: 'confirming', label: 'Waiting for on-chain confirmation...' };
  return { status: 'idle', label: '' };
}
```

## Performance Optimization

### Selective Hooks

```tsx
// Avoid unnecessary re-renders
function OptimizedTokenList({ tokens, userAddress }: {
  tokens: string[];
  userAddress: string;
}) {
  // Use useContractReads to query all tokens at once
  // instead of creating separate useContractRead for each token
  const { data, isLoading } = useContractReads({
    contracts: tokens.flatMap(tokenAddress => [
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [userAddress] },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'symbol' },
      { address: tokenAddress, abi: ERC20_ABI, functionName: 'decimals' },
    ]),
    // Batch query configuration
    cacheTime: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) return <div>Loading tokens...</div>;

  // Group the flat results into groups of 3
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

// Use React.memo to avoid unnecessary re-renders
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

### Block-Level Refresh Control

```tsx
// Adjust refresh strategy based on network conditions
function useAdaptiveRefresh(chainId: number) {
  const blockTime = useMemo(() => {
    // Block times for different chains
    const blockTimes: Record<number, number> = {
      1: 13_000,    // Ethereum: ~13s
      137: 2_000,   // Polygon: ~2s
      42161: 250,   // Arbitrum: ~0.25s
      10: 2_000,    // Optimism: ~2s
    };
    return blockTimes[chainId] || 13_000;
  }, [chainId]);

  return {
    // Refresh on new blocks
    refetchInterval: blockTime,
    // But not more frequently than every 30 seconds
    refetchIntervalInBackground: 30_000,
  };
}
```

## Development Experience Comparison: Direct ethers.js vs wagmi

### Direct ethers.js Usage

```tsx
// Manually managing Provider, Signer, state
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

    // Manually listen for new blocks
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

### Using wagmi

```tsx
// wagmi version: one Hook handles all the logic
function BalanceWagmi({ tokenAddress }: { tokenAddress: string }) {
  const { address } = useAccount();

  const { data: balance, isError, isLoading } = useContractRead({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [address!],
    watch: true, // Auto-refresh on new blocks
  });

  if (isLoading) return <span>Loading...</span>;
  if (isError) return <span>Error</span>;
  return <span>{balance?.toString()}</span>;
}
```

The wagmi version reduces code volume by approximately 70% while automatically handling the following:
- Provider initialization and lifecycle management
- Re-querying on account switches
- Adaptation on network switches
- Request deduplication and caching
- Cleanup on component unmount

## Summary

wagmi brings the React Hooks paradigm to Web3 development, significantly reducing the complexity of DApp state management. Its core value lies in transforming ethers.js's imperative API into declarative Hooks, allowing React developers to handle on-chain state using the data flow patterns they are already familiar with.

wagmi is not perfect—its abstraction layer can become an obstacle in certain scenarios, such as when fine-grained control over transaction nonces, custom signing flows, or use of ethers.js advanced features is needed, in which case direct ethers.js manipulation is still required. However, for 90% of DApp frontend needs (wallet connection, contract reading/writing, transaction tracking), wagmi currently offers the best development experience. Compared to using ethers.js directly, wagmi's main advantages are reducing boilerplate code, automatically handling state synchronization, and leveraging React Query's caching capabilities to optimize performance.
