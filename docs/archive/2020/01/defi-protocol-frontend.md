---
title: "DeFi 协议前端开发：Uniswap V2 交互实践"
date: 2020-01-08 15:14:28
tags:
  - Web3
  - DeFi
  - Ethereum
---

## DeFi 生态与 Uniswap V2 交互

去中心化金融（DeFi）生态由一组相互协作的协议构成：MakerDAO 的 DAI 稳定币、Compound 的借贷协议、Synthetix 的衍生资产，它们共同组成了 DeFi 的基础设施层。其中 Uniswap 作为去中心化交易所（DEX）的代表，凭借简洁的自动做市商（AMM）机制，成为 DeFi 生态中流动性最强的交易协议。

Uniswap V2 在 V1 的基础上引入了 ERC-20/ERC-20 交易对（V1 只支持 ETH/ERC-20）、价格预言机、闪电swap 等关键特性。对于前端开发者而言，理解 Uniswap V2 的合约结构和交互方式，是构建 DeFi 前端的基础。

## Uniswap V2 核心合约架构

Uniswap V2 的合约体系由三个核心部分组成：

### Factory 合约

Factory 合约是所有交易对（Pair）的注册中心。每个 ERC-20/ERC-20 交易对都通过 Factory 创建，且全局唯一：

```solidity
// UniswapV2Factory 核心方法
function createPair(address tokenA, address tokenB) external returns (address pair);
function getPair(address tokenA, address tokenB) external view returns (address pair);
function allPairs(uint) external view returns (address pair);
function allPairsLength() external view returns (uint);
```

前端通过 `getPair()` 查询特定代币对的地址，如果返回 `address(0)` 则说明该交易对尚未创建。

### Pair 合约

Pair 合约是实际的流动性池，持有两种 ERC-20 代币的储备量。每个 Pair 合约本身也是一个 ERC-20 代币（LP Token），代表流动性提供者的份额：

```solidity
// UniswapV2Pair 核心方法
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
function mint(address to) external returns (uint liquidity);
function burn(address to) external returns (uint amount0, uint amount1);
```

### Router02 合约

Router02 是面向前端的前端路由合约，封装了多跳交易、代币包装/解包等复杂逻辑。绝大多数前端交互都通过 Router02 完成：

```solidity
// UniswapV2Router02 关键方法
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

## 前端读取流动性池数据

读取链上数据是 DeFi 前端的第一步。以下是通过 ethers.js 读取 Pair 合约储备量的实现：

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
    return null; // 交易对不存在
  }

  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  const [reserve0, reserve1, timestamp] = await pair.getReserves();
  const token0Address = await pair.token0();
  const totalSupply = await pair.totalSupply();

  // 确保储备量与输入代币顺序对应
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

`getReserves()` 返回的 `reserve0` 和 `reserve1` 是排好序的——`token0` 是地址较小的那个代币。前端必须处理这个顺序问题，否则会出现价格反转的 bug。

## 恒定乘积公式与价格计算

Uniswap V2 使用恒定乘积公式（Constant Product Formula）进行定价：`x * y = k`，其中 x 和 y 分别是两种代币的储备量。交易后储备量的乘积必须保持不变（扣除手续费前）。

实际交易中需要扣除 0.3% 的手续费，输入金额的 99.7% 参与乘积计算：

```javascript
// 前端模拟价格计算（用于展示，实际交易以链上为准）
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

// 滑点计算
function calculateSlippage(amountIn, reserveIn, reserveOut) {
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
  // 假设没有手续费的理论价格
  const theoreticalOut = amountIn.mul(reserveOut).div(reserveIn);
  const slippage = theoreticalOut.sub(amountOut).mul(10000).div(theoreticalOut);
  return {
    amountOut,
    slippagePercent: slippage.toNumber() / 100,
  };
}
```

需要注意 ethers.js 的 `BigNumber` 不支持浮点运算，所有计算必须用整数完成。前端展示时再将 wei 单位转换为可读数量。

## Swap 交易的前端构造

一笔完整的 swap 交易前端流程包含以下步骤：

1. 查询代币授权额度
2. 如果授权不足，调用 `approve()`
3. 通过 Router 调用 swap 函数
4. 等待交易确认

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

  // 1. 检查授权额度
  const allowance = await token.allowance(await signer.getAddress(), ROUTER02);
  if (allowance.lt(amountIn)) {
    const approveTx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 2. 计算最小输出量
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amountIn, path);
  const expectedOut = amounts[amounts.length - 1];
  const amountOutMin = expectedOut.mul(1000 - Math.floor(slippageTolerance * 10)).div(1000);

  // 3. 设置 deadline（20 分钟）
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // 4. 执行 swap
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

  // 5. 等待确认
  const receipt = await swapTx.wait();
  return receipt;
}
```

### 多跳交易与 Path 构造

Uniswap 的 path 参数支持多跳路由，例如 `[USDC, WETH, DAI]` 表示通过 WETH 中转。前端可以配合 The Graph 子图查询最优路径：

```javascript
// 多跳路径价格计算
async function getMultiHopAmountOut(router, amountIn, path) {
  const amounts = await router.getAmountsOut(amountIn, path);
  return amounts[amounts.length - 1];
}

// 路径选择策略
function findBestPath(amountIn, pairsGraph, tokenIn, tokenOut) {
  // BFS 搜索最多 3 跳的路径
  const paths = [];
  const queue = [[tokenIn]];

  while (queue.length > 0 && paths.length < 10) {
    const currentPath = queue.shift();
    const lastToken = currentPath[currentPath.length - 1];

    if (lastToken === tokenOut && currentPath.length > 1) {
      paths.push(currentPath);
      continue;
    }

    if (currentPath.length >= 4) continue; // 限制最大跳数

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

## 流动性添加与移除

添加流动性需要同时存入两种代币，按当前储备比例计算。Router 的 `addLiquidity` 方法会自动处理比例差异，退还多余的部分：

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

  // 授权检查
  const userAddress = await signer.getAddress();
  for (const [token, amount] of [[tokenAContract, amountADesired], [tokenBContract, amountBDesired]]) {
    const allowance = await token.allowance(userAddress, ROUTER02);
    if (allowance.lt(amount)) {
      const tx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
      await tx.wait();
    }
  }

  // 计算最小接受量（1% 滑点容忍）
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

移除流动性时，前端需要先获取用户持有的 LP Token 余额，然后调用 `removeLiquidity`：

```javascript
async function removeLiquidity(provider, signer, tokenA, tokenB, liquidity) {
  const router = new ethers.Contract(ROUTER02, ROUTER_ABI, signer);
  const factory = new ethers.Contract(UNISWAP_FACTORY, FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(tokenA, tokenB);
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);

  // 授权 Router 使用 LP Token
  const userAddress = await signer.getAddress();
  const allowance = await pair.allowance(userAddress, ROUTER02);
  if (allowance.lt(liquidity)) {
    const approveTx = await pair.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 计算移除后可获得的代币量
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

## 交易失败常见原因分析

DeFi 前端开发中，交易失败是最常见的用户体验问题。以下是几种典型场景：

### 1. Slippage 超出容忍范围

链上储备量在交易提交和打包之间可能发生变化（被抢跑），导致实际输出低于 `amountOutMin`，交易 revert。解决方案是前端实时刷新价格，并在交易前重新计算 `amountOutMin`。

### 2. 授权额度不足

用户之前授权的额度已被消耗或授权给了旧版 Router。前端必须每次检查 `allowance`，并在不足时发起 `approve` 交易。

### 3. Deadline 过期

`deadline` 参数是 Unix 时间戳，如果交易在 deadline 之后才被打包，会自动 revert。网络拥堵时这个问题尤为突出。建议前端设置至少 20 分钟的 deadline。

### 4. Gas 估算失败

当交易注定会 revert 时，节点会拒绝 gas 估算请求，前端收到 `eth_estimateGas` 错误。可以捕获这个错误并回退到静态调用（`eth_call`）来获取 revert 原因：

```javascript
async function estimateGasWithFallback(contract, method, args, overrides) {
  try {
    return await contract.estimateGas[method](...args, overrides);
  } catch (estimateError) {
    // 回退到 eth_call 获取 revert 原因
    try {
      await contract.callStatic[method](...args, overrides);
    } catch (callError) {
      if (callError.reason) {
        throw new Error(`交易将失败: ${callError.reason}`);
      }
      throw callError;
    }
    throw estimateError;
  }
}
```

## 小结

Uniswap V2 的前端开发涵盖了 DeFi 交互的核心模式：合约数据读取、价格计算、交易构造、授权管理和状态同步。这些模式在几乎所有 DeFi 协议前端中都会复用。

DeFi 前端开发最大的挑战在于**状态一致性和用户体验的平衡**。链上状态随时变化，前端必须在实时性和准确性之间做权衡——显示的价格可能在下一秒就不再有效。合理设置滑点容忍度、deadline 和最小输出量，是保证交易成功率的三个关键参数。同时，交易失败的诊断和用户反馈设计同样重要，一个好的 DeFi 前端应该能在交易失败时给出清晰的原因，而不是一个含糊的 "Transaction Failed" 弹窗。
