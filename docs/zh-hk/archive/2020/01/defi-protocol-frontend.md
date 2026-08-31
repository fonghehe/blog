---
readingTime: 8
wordCount: 1288
title: "DeFi 協議前端開發：Uniswap V2 交互實踐"
date: 2020-01-08 15:14:28
tags:
  - Web3
  - DeFi
  - Ethereum
description: "去中心化金融（DeFi）生態由多種協議構成基礎設施層：MakerDAO 的 DAI 穩定幣、Compound 的借貸協議、Synthetix 的衍生資產等。其中，Uniswap 作為去中心化交易所（DEX）的代表，憑藉其簡潔的自動做市商（AMM）機制，成為 DeFi 生態中流動性最強的交易協議。"
---

## DeFi 生態與 Uniswap V2 的崛起

去中心化金融（DeFi）生態由多種協議構成基礎設施層：MakerDAO 的 DAI 穩定幣、Compound 的借貸協議、Synthetix 的衍生資產等。其中，Uniswap 作為去中心化交易所（DEX）的代表，憑藉其簡潔的自動做市商（AMM）機制，成為 DeFi 生態中流動性最強的交易協議。

Uniswap V2 於 2019 年 11 月部署到以太坊主網，相比 V1 版本，V2 引入了 ERC-20/ERC-20 交易對（V1 只支持 ETH/ERC-20）、價格預言機、閃電swap 等關鍵特性。對於前端開發者而言，理解 Uniswap V2 的合約結構和交互方式，是構建 DeFi 前端的基礎。

## Uniswap V2 核心合約架構

Uniswap V2 的合約體系由三個核心部分組成：

### Factory 合約

Factory 合約是所有交易對（Pair）的註冊中心。每個 ERC-20/ERC-20 交易對都通過 Factory 創建，且全局唯一：

```solidity
// UniswapV2Factory 核心方法
function createPair(address tokenA, address tokenB) external returns (address pair);
function getPair(address tokenA, address tokenB) external view returns (address pair);
function allPairs(uint) external view returns (address pair);
function allPairsLength() external view returns (uint);
```

前端通過 `getPair()` 查詢特定代幣對的地址，如果返回 `address(0)` 則説明該交易對尚未創建。

### Pair 合約

Pair 合約是實際的流動性池，持有兩種 ERC-20 代幣的儲備量。每個 Pair 合約本身也是一個 ERC-20 代幣（LP Token），代表流動性提供者的份額：

```solidity
// UniswapV2Pair 核心方法
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
function mint(address to) external returns (uint liquidity);
function burn(address to) external returns (uint amount0, uint amount1);
```

### Router02 合約

Router02 是供前端使用的路由合約，封裝了多跳交易、代幣包裝/解包等複雜邏輯。絕大多數前端交互都通過 Router02 完成：

```solidity
// UniswapV2Router02 關鍵方法
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

## 前端讀取流動性池數據

讀取鏈上數據是 DeFi 前端的第一步。以下是通過 ethers.js 讀取 Pair 合約儲備量的實現：

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
    return null; // 交易對不存在
  }

  const pair = new ethers.Contract(pairAddress, PAIR_ABI, provider);
  const [reserve0, reserve1, timestamp] = await pair.getReserves();
  const token0Address = await pair.token0();
  const totalSupply = await pair.totalSupply();

  // 確保儲備量與輸入代幣順序對應
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

`getReserves()` 返回的 `reserve0` 和 `reserve1` 是排好序的——`token0` 是地址較小的那個代幣。前端必須處理這個順序問題，否則會出現價格反轉的 bug。

## 恆定乘積公式與價格計算

Uniswap V2 使用恆定乘積公式（Constant Product Formula）進行定價：`x * y = k`，其中 x 和 y 分別是兩種代幣的儲備量。交易後儲備量的乘積必須保持不變（扣除手續費前）。

實際交易中需要扣除 0.3% 的手續費，輸入金額的 99.7% 參與乘積計算：

```javascript
// 前端模擬價格計算（用於展示，實際交易以鏈上為準）
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

// 滑點計算
function calculateSlippage(amountIn, reserveIn, reserveOut) {
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
  // 假設沒有手續費的理論價格
  const theoreticalOut = amountIn.mul(reserveOut).div(reserveIn);
  const slippage = theoreticalOut.sub(amountOut).mul(10000).div(theoreticalOut);
  return {
    amountOut,
    slippagePercent: slippage.toNumber() / 100,
  };
}
```

需要注意 ethers.js 的 `BigNumber` 不支持浮點運算，所有計算必須用整數完成。前端展示時再將 wei 單位轉換為可讀數量。

## Swap 交易的前端構造

一筆完整的 swap 交易前端流程包含以下步驟：

1. 查詢代幣授權額度
2. 如果授權不足，調用 `approve()`
3. 通過 Router 調用 swap 函數
4. 等待交易確認

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

  // 1. 檢查授權額度
  const allowance = await token.allowance(await signer.getAddress(), ROUTER02);
  if (allowance.lt(amountIn)) {
    const approveTx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 2. 計算最小輸出量
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amountIn, path);
  const expectedOut = amounts[amounts.length - 1];
  const amountOutMin = expectedOut.mul(1000 - Math.floor(slippageTolerance * 10)).div(1000);

  // 3. 設置 deadline（20 分鐘）
  const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

  // 4. 執行 swap
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

  // 5. 等待確認
  const receipt = await swapTx.wait();
  return receipt;
}
```

### 多跳交易與 Path 構造

Uniswap 的 path 參數支持多跳路由，例如 `[USDC, WETH, DAI]` 表示通過 WETH 中轉。前端可以配合 The Graph 子圖查詢最優路徑：

```javascript
// 多跳路徑價格計算
async function getMultiHopAmountOut(router, amountIn, path) {
  const amounts = await router.getAmountsOut(amountIn, path);
  return amounts[amounts.length - 1];
}

// 路徑選擇策略
function findBestPath(amountIn, pairsGraph, tokenIn, tokenOut) {
  // BFS 搜索最多 3 跳的路徑
  const paths = [];
  const queue = [[tokenIn]];

  while (queue.length > 0 && paths.length < 10) {
    const currentPath = queue.shift();
    const lastToken = currentPath[currentPath.length - 1];

    if (lastToken === tokenOut && currentPath.length > 1) {
      paths.push(currentPath);
      continue;
    }

    if (currentPath.length >= 4) continue; // 限制最大跳數

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

## 流動性添加與移除

添加流動性需要同時存入兩種代幣，按當前儲備比例計算。Router 的 `addLiquidity` 方法會自動處理比例差異，退還多餘的部分：

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

  // 授權檢查
  const userAddress = await signer.getAddress();
  for (const [token, amount] of [[tokenAContract, amountADesired], [tokenBContract, amountBDesired]]) {
    const allowance = await token.allowance(userAddress, ROUTER02);
    if (allowance.lt(amount)) {
      const tx = await token.approve(ROUTER02, ethers.constants.MaxUint256);
      await tx.wait();
    }
  }

  // 計算最小接受量（1% 滑點容忍）
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

移除流動性時，前端需要先獲取用戶持有的 LP Token 餘額，然後調用 `removeLiquidity`：

```javascript
async function removeLiquidity(provider, signer, tokenA, tokenB, liquidity) {
  const router = new ethers.Contract(ROUTER02, ROUTER_ABI, signer);
  const factory = new ethers.Contract(UNISWAP_FACTORY, FACTORY_ABI, provider);

  const pairAddress = await factory.getPair(tokenA, tokenB);
  const pair = new ethers.Contract(pairAddress, PAIR_ABI, signer);

  // 授權 Router 使用 LP Token
  const userAddress = await signer.getAddress();
  const allowance = await pair.allowance(userAddress, ROUTER02);
  if (allowance.lt(liquidity)) {
    const approveTx = await pair.approve(ROUTER02, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 計算移除後可獲得的代幣量
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

## 交易失敗常見原因分析

DeFi 前端開發中，交易失敗是最常見的用戶體驗問題。以下是幾種典型場景：

### 1. Slippage 超出容忍範圍

鏈上儲備量在交易提交和打包之間可能發生變化（被搶跑），導致實際輸出低於 `amountOutMin`，交易 revert。解決方案是前端實時刷新價格，並在交易前重新計算 `amountOutMin`。

### 2. 授權額度不足

用戶之前授權的額度已被消耗或授權給了舊版 Router。前端必須每次檢查 `allowance`，並在不足時發起 `approve` 交易。

### 3. Deadline 過期

`deadline` 參數是 Unix 時間戳，如果交易在 deadline 之後才被打包，會自動 revert。網絡擁堵時這個問題尤為突出。建議前端設置至少 20 分鐘的 deadline。

### 4. Gas 估算失敗

當交易註定會 revert 時，節點會拒絕 gas 估算請求，前端收到 `eth_estimateGas` 錯誤。可以捕獲這個錯誤並回退到靜態調用（`eth_call`）來獲取 revert 原因：

```javascript
async function estimateGasWithFallback(contract, method, args, overrides) {
  try {
    return await contract.estimateGas[method](...args, overrides);
  } catch (estimateError) {
    // 回退到 eth_call 獲取 revert 原因
    try {
      await contract.callStatic[method](...args, overrides);
    } catch (callError) {
      if (callError.reason) {
        throw new Error(`交易將失敗: ${callError.reason}`);
      }
      throw callError;
    }
    throw estimateError;
  }
}
```

## 小結

Uniswap V2 的前端開發涵蓋了 DeFi 交互的核心模式：合約數據讀取、價格計算、交易構造、授權管理和狀態同步。這些模式在幾乎所有 DeFi 協議前端中都會複用。

DeFi 前端開發最大的挑戰在於**狀態一致性和用戶體驗的平衡**。鏈上狀態隨時變化，前端必須在實時性和準確性之間做權衡——顯示的價格可能在下一秒就不再有效。合理設置滑點容忍度、deadline 和最小輸出量，是保證交易成功率的三個關鍵參數。同時，交易失敗的診斷和用戶反饋設計同樣重要，一個好的 DeFi 前端應該能在交易失敗時給出清晰的原因，而不是一個含糊的 "Transaction Failed" 彈窗。
