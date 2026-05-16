---
title: "DeFi Protocol Frontend Development: Uniswap V2 Interaction Practical Guide"
date: 2020-01-08 15:14:28
tags:
  - Web3
  - DeFi
  - Ethereum
---

## The DeFi Ecosystem and Uniswap V2

The decentralized finance (DeFi) ecosystem is built on a layer of foundational protocols—MakerDAO's DAI stablecoin, Compound's lending protocol, and Synthetix's synthetic assets. Among them, Uniswap is the representative decentralized exchange (DEX) and one of the most liquid trading protocols in DeFi, thanks to its elegant automated market maker (AMM) mechanism.

Uniswap V2 is the version of the protocol that introduced ERC-20/ERC-20 trading pairs (V1 only supported ETH/ERC-20), price oracles, flash swaps, and other key features. For frontend developers, understanding its contract structure and interaction patterns is foundational for building DeFi frontends.

## Uniswap V2 Core Contract Architecture

The Uniswap V2 contract system consists of three core components:

### The Factory Contract

The Factory contract serves as the registry for all trading pairs. Every ERC-20/ERC-20 pair is created through the Factory and is globally unique:

```solidity
// UniswapV2Factory core methods
function createPair(address tokenA, address tokenB) external returns (address pair);
function getPair(address tokenA, address tokenB) external view returns (address pair);
function allPairs(uint) external view returns (address pair);
function allPairsLength() external view returns (uint);
```

The frontend uses `getPair()` to query the address of a specific token pair. If it returns `address(0)`, the pair has not been created yet.

### The Pair Contract

The Pair contract is the actual liquidity pool, holding the reserves of two ERC-20 tokens. Each Pair contract is itself an ERC-20 token (LP Token), representing the share of liquidity providers:

```solidity
// UniswapV2Pair core methods
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
function mint(address to) external returns (uint liquidity);
function burn(address to) external returns (uint amount0, uint amount1);
```

### The Router02 Contract

Router02 is the user-facing routing contract, encapsulating complex logic such as multi-hop trades, token wrapping/unwrapping, etc. The vast majority of frontend interactions go through Router02:

```solidity
// UniswapV2Router02 key methods
function swapExactTokensForTokens(
  uint amountIn,
  uint amountOutMin,
  address[] calldata path,
  address to,
  uint deadline
) external returns (uint[] memory amounts);

function addLiquidity(
  address tokenA,
  address tokenB,
  uint amountADesired,
  uint amountBDesired,
  uint amountAMin,
  uint amountBMin,
  address to,
  uint deadline
) external returns (uint amountA, uint amountB, uint liquidity);
```

## Reading Liquidity Pool Data from the Frontend

Reading on-chain data is the first step in building a DeFi frontend. Here's how to read Pair contract reserves using ethers.js:

```javascript
import { ethers } from 'ethers';

const UNISWAP_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const ROUTER02 = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address,address) view returns (uint256)',
  'function approve(address,uint256) returns (bool)',
];

const FACTORY_ABI = [
  'function getPair(address,address) view returns (address)',
];

const PAIR_ABI = [
  'function getReserves() view returns (uint112,uint112,uint32)',
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function totalSupply() view returns (uint256)',
];

const ROUTER_ABI = [
  'function getAmountsOut(uint,address[]) view returns (uint[])',
  'function getAmountsIn(uint,address[]) view returns (uint[])',
  'function swapExactTokensForTokens(uint,uint,address[],address,uint) returns (uint[])',
  'function swapExactETHForTokens(uint,address[],address,uint) payable returns (uint[])',
  'function addLiquidity(address,address,uint,uint,uint,uint,address,uint) returns (uint,uint,uint)',
  'function removeLiquidity(address,address,uint,uint,uint,address,uint) returns (uint,uint)',
];

async function getPairData(provider, tokenA, tokenB) {
  const factory = new ethers.Contract(UNISWAP_FACTORY, FACTORY_ABI, provider);
  const pairAddress = await factory.getPair(tokenA, tokenB);

  if (pairAddress === ethers.constants.AddressZero) {
    return null; // Pair does not exist
  }

  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  const [reserve0, reserve1, timestamp] = await pair.getReserves();
  const token0Address = await pair.token0();
  const totalSupply = await pair.totalSupply();

  // Ensure reserves correspond to the input token order
  const isTokenA0 = tokenA.toLowerCase() === token0Address.toLowerCase();

  return {
    pairAddress,
    reserveA: isTokenA0 ? reserve0 : reserve1,
    reserveB: isTokenA0 ? reserve1 : reserve0,
    reserve0,
    reserve1,
    timestamp,
    totalSupply,
  };
}
```

The `reserve0` and `reserve1` values returned by `getReserves()` are sorted—`token0` is always the token with the smaller address. The frontend must handle this ordering, otherwise it will introduce a price inversion bug.

## Constant Product Formula and Price Calculation

Uniswap V2 uses the constant product formula for pricing: `x * y = k`, where x and y are the reserves of the two tokens. The product of reserves after a trade must remain constant (before deducting fees).

In actual trades, a 0.3% fee is deducted, meaning 99.7% of the input amount participates in the product calculation:

```javascript
// Frontend price simulation (for display; actual trade prices are determined on-chain)
function getAmountOut(amountIn, reserveIn, reserveOut) {
  const amountInWithFee = amountIn.mul(997);
  const numerator = amountInWithFee.mul(reserveOut);
  const denominator = reserveIn.mul(1000).add(amountInWithFee);
  return numerator.div(denominator);
}

function getAmountIn(amountOut, reserveIn, reserveOut) {
  const numerator = reserveIn.mul(amountOut).mul(1000);
  const denominator = reserveOut.sub(amountOut).mul(997);
  return numerator.div(denominator).add(1);
}

// Slippage calculation
function calculateSlippage(amountIn, reserveIn, reserveOut) {
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
  // Theoretical price without fees
  const theoreticalOut = amountIn.mul(reserveOut).div(reserveIn);
  const slippage = theoreticalOut.sub(amountOut).mul(10000).div(theoreticalOut);
  return {
    amountOut,
    slippagePercent: slippage.toNumber() / 100,
  };
}
```

Note that ethers.js's `BigNumber` does not support floating-point arithmetic—all calculations must be done with integers. The frontend converts wei units to readable amounts only when displaying.

## Frontend Swap Transaction Construction

A complete swap transaction flow on the frontend involves the following steps:

1. Query the token allowance
2. If allowance is insufficient, call `approve()`
3. Call the swap function through the Router
4. Wait for transaction confirmation

```javascript
async function executeSwap(
  provider,
  signer,
  tokenIn,
  tokenOut,
  amountIn,
  slippageTolerance = 0.5 // 0.5%
) {
  const router = new ethers.Contract(ROUTER02, ROUTER_ABI, signer);
  const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);

  // 1. Check allowance
  const allowance = await token.allowance(await signer.getAddress(), ROUTER02);
  if (allowance.lt(amountIn)) {
    const approveTx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 2. Calculate minimum output
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amountIn, path);
  const expectedOut = amounts[amounts.length - 1];
  const amountOutMin = expectedOut.mul(1000 - Math.floor(slippageTolerance * 10)).div(1000);

  // 3. Set deadline (20 minutes)
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // 4. Execute swap
  const isETHIn = tokenIn === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'; // WETH
  const isETHOut = tokenOut === '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

  let swapTx;
  if (isETHIn) {
    swapTx = await router.swapExactETHForTokens(
      amountOutMin,
      path,
      await signer.getAddress(),
      deadline,
      { value: amountIn }
    );
  } else if (isETHOut) {
    swapTx = await router.swapExactTokensForETH(
      amountOutMin,
      path,
      await signer.getAddress(),
      deadline
    );
  } else {
    swapTx = await router.swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      await signer.getAddress(),
      deadline
    );
  }

  // 5. Wait for confirmation
  const receipt = await swapTx.wait();
  return receipt;
}
```

### Multi-hop Trades and Path Construction

Uniswap's path parameter supports multi-hop routing. For example, `[USDC, WETH, DAI]` means routing through WETH. The frontend can query the optimal path using The Graph subgraph:

```javascript
// Multi-hop path price calculation
async function getMultiHopAmountOut(router, amountIn, path) {
  const amounts = await router.getAmountsOut(amountIn, path);
  return amounts[amounts.length - 1];
}

// Path selection strategy
function findBestPath(amountIn, pairsGraph, tokenIn, tokenOut) {
  // BFS search for paths with at most 3 hops
  const paths = [];
  const queue = [[tokenIn]];

  while (queue.length > 0 && paths.length < 10) {
    const currentPath = queue.shift();
    const lastToken = currentPath[currentPath.length - 1];

    if (lastToken === tokenOut && currentPath.length > 1) {
      paths.push(currentPath);
      continue;
    }

    if (currentPath.length >= 4) continue; // Limit maximum hops

    const neighbors = pairsGraph[lastToken] || [];
    for (const neighbor of neighbors) {
      if (!currentPath.includes(neighbor)) {
        queue.push([...currentPath, neighbor]);
      }
    }
  }

  return paths;
}
```

## Adding and Removing Liquidity

Adding liquidity requires depositing both tokens in proportion to the current reserves. The Router's `addLiquidity` method automatically handles proportion differences and refunds any excess:

```javascript
async function addLiquidity(
  provider,
  signer,
  tokenA,
  tokenB,
  amountADesired,
  amountBDesired
) {
  const router = new ethers.Contract(ROUTER02, ROUTER_ABI, signer);
  const tokenAContract = new ethers.Contract(tokenA, ERC20_ABI, signer);
  const tokenBContract = new ethers.Contract(tokenB, ERC20_ABI, signer);

  // Allowance check
  const userAddress = await signer.getAddress();
  for (const [token, amount] of [[tokenAContract, amountADesired], [tokenBContract, amountBDesired]]) {
    const allowance = await token.allowance(userAddress, ROUTER02);
    if (allowance.lt(amount)) {
      const tx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
      await tx.wait();
    }
  }

  // Calculate minimum accepted amounts (1% slippage tolerance)
  const amountAMin = amountADesired.mul(99).div(100);
  const amountBMin = amountBDesired.mul(99).div(100);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const tx = await router.addLiquidity(
    tokenA,
    tokenB,
    amountADesired,
    amountBDesired,
    amountAMin,
    amountBMin,
    userAddress,
    deadline
  );

  return await tx.wait();
}
```

When removing liquidity, the frontend needs to first get the user's LP Token balance, then call `removeLiquidity`:

```javascript
async function removeLiquidity(provider, signer, tokenA, tokenB, liquidity) {
  const router = new ethers.Contract(ROUTER02, ROUTER_ABI, signer);
  const factory = new ethers.Contract(UNISWAP_FACTORY, FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(tokenA, tokenB);
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);

  // Approve Router to use LP Token
  const userAddress = await signer.getAddress();
  const allowance = await pair.allowance(userAddress, ROUTER02);
  if (allowance.lt(liquidity)) {
    const approveTx = await pair.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // Calculate the token amounts to be received upon removal
  const [reserve0, reserve1] = await pair.getReserves();
  const totalSupply = await pair.totalSupply();
  const token0Address = await pair.token0();

  const isTokenA0 = tokenA.toLowerCase() === token0Address.toLowerCase();
  const reserveA = isTokenA0 ? reserve0 : reserve1;
  const reserveB = isTokenA0 ? reserve1 : reserve0;

  const amountAMin = liquidity.mul(reserveA).div(totalSupply).mul(99).div(100);
  const amountBMin = liquidity.mul(reserveB).div(totalSupply).mul(99).div(100);
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  const tx = await router.removeLiquidity(
    tokenA,
    tokenB,
    liquidity,
    amountAMin,
    amountBMin,
    userAddress,
    deadline
  );

  return await tx.wait();
}
```

## Common Causes of Transaction Failures

Transaction failures are the most common UX issue in DeFi frontend development. Here are several typical scenarios:

### 1. Slippage Exceeds Tolerance

On-chain reserves may change between transaction submission and inclusion (due to frontrunning), causing the actual output to fall below `amountOutMin`, resulting in a transaction revert. The solution is for the frontend to refresh prices in real-time and recalculate `amountOutMin` before each transaction.

### 2. Insufficient Allowance

The user's previously approved allowance may have been consumed or granted to an outdated Router version. The frontend must check `allowance` every time and initiate an `approve` transaction when insufficient.

### 3. Expired Deadline

The `deadline` parameter is a Unix timestamp. If the transaction is included after the deadline, it will automatically revert. This issue is particularly prominent during network congestion. It's recommended to set a deadline of at least 20 minutes on the frontend.

### 4. Gas Estimation Failure

When a transaction is destined to revert, the node will reject the gas estimation request, resulting in an `eth_estimateGas` error on the frontend. You can catch this error and fall back to a static call (`eth_call`) to obtain the revert reason:

```javascript
async function estimateGasWithFallback(contract, method, args, overrides) {
  try {
    return await contract.estimateGas[method](...args, overrides);
  } catch (estimateError) {
    // Fall back to eth_call to get the revert reason
    try {
      await contract.callStatic[method](...args, overrides);
    } catch (callError) {
      if (callError.reason) {
        throw new Error(`Transaction will fail: ${callError.reason}`);
      }
      throw callError;
    }
    throw estimateError;
  }
}
```

## Summary

Uniswap V2's frontend development covers the core patterns of DeFi interaction: contract data reading, price calculation, transaction construction, allowance management, and state synchronization. These patterns are reused in the frontends of almost all DeFi protocols.

The greatest challenge in DeFi frontend development lies in **balancing state consistency with user experience**. On-chain states change at any moment, and the frontend must strike a balance between real-time accuracy—the displayed price may become invalid in the next second. Reasonably setting slippage tolerance, deadline, and minimum output amount are the three key parameters for ensuring transaction success rates. At the same time, diagnosing transaction failures and providing user feedback is equally important—a good DeFi frontend should give clear reasons when a transaction fails, rather than a vague "Transaction Failed" popup.
