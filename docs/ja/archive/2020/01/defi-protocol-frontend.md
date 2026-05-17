---
title: "DeFi プロトコルのフロントエンド開発：Uniswap V2 連携の実践"
date: 2020-01-08 15:14:28
tags:
  - Web3
  - DeFi
  - Ethereum
---

## DeFi エコシステムと Uniswap V2 の台頭

分散型金融（DeFi）エコシステムでは、MakerDAO の DAI ステーブルコイン、Compound の貸借プロトコル、Synthetix の派生アセットなどがインフラストラクチャ層を構成しています。その中でも Uniswap は分散型取引所（DEX）の代表として、シンプルな自動マーケットメーカー（AMM）メカニズムにより、DeFi エコシステムで流動性が最も高い取引プロトコルです。

Uniswap V2 は V1 と比較して、ERC-20/ERC-20 取引ペア（V1 は ETH/ERC-20 のみサポート）、プライスオラクル、フラッシュスワップなどの主要な特徴を導入しました。フロントエンド開発者にとって、Uniswap V2 のコントラクト構造と連携方式を理解することは、DeFi フロントエンドを構築する基礎となります。

## Uniswap V2 コアコントラクトアーキテクチャ

Uniswap V2 のコントラクト体系は3つの核心部分で構成されています：

### Factory コントラクト

Factory コントラクトはすべての取引ペア（Pair）の登録センターです。各 ERC-20/ERC-20 取引ペアは Factory を通じて作成され、グローバルに一意となります：

```solidity
// UniswapV2Factory 核心方法
function createPair(address tokenA, address tokenB) external returns (address pair);
function getPair(address tokenA, address tokenB) external view returns (address pair);
function allPairs(uint) external view returns (address pair);
function allPairsLength() external view returns (uint);
```

フロントエンドは `getPair()` で特定のトークンペアのアドレスを照会します。`address(0)` が返された場合、その取引ペアはまだ作成されていないことを示します。

### Pair コントラクト

Pair コントラクトは実際の流動性プールであり、2種類の ERC-20 トークンのリザーブ量を保持します。各 Pair コントラクト自体も ERC-20 トークン（LP Token）であり、流動性プロバイダーのシェアを表します：

```solidity
// UniswapV2Pair 核心方法
function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
function mint(address to) external returns (uint liquidity);
function burn(address to) external returns (uint amount0, uint amount1);
```

### Router02 コントラクト

Router02 はフロントエンド向けのルーティングコントラクトであり、マルチホップ取引、トークンのラップ/アンラップなどの複雑なロジックをカプセル化しています。ほとんどのフロントエンド連携は Router02 を通じて行われます：

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

## フロントエンドでの流動性プールデータ読み取り

オンチェーンデータの読み取りは DeFi フロントエンドの第一歩です。以下は ethers.js で Pair コントラクトのリザーブ量を読み取る実装です：

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

`getReserves()` が返す `reserve0` と `reserve1` はソート済みです——`token0` はアドレスが小さい方のトークンです。フロントエンドはこの順序問題を処理しなければなりません。そうしないと価格が反転するバグが発生します。

## 恒積公式と価格計算

Uniswap V2 は恒積公式（Constant Product Formula）で価格決定を行います：`x * y = k`。x と y はそれぞれ2種類のトークンのリザーブ量です。取引後のリザーブ量の積は（手数料控除前）不変でなければなりません。

実際の取引では 0.3% の手数料が控除され、入力金額の 99.7% が積計算に参加します：

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

ethers.js の `BigNumber` は浮動小数点演算をサポートしていないため、すべての計算は整数で完結させる必要があります。フロントエンド表示時に wei 単位から可読数量に変換します。

## Swap トランザクションのフロントエンド構築

完全な swap トランザクションのフロントエンドフローには以下のステップが含まれます：

1. トークン許可額の照会
2. 許可が不足している場合、`approve()` を呼び出す
3. Router で swap 関数を呼び出す
4. トランザクション確定を待つ

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

### マルチホップ取引と Path 構築

Uniswap の path パラメータはマルチホップルーティングをサポートしています。例えば `[USDC, WETH, DAI]` は WETH を経由することを示します。フロントエンドは The Graph サブグラフと組み合わせて最適パスを照会できます：

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

## 流動性の追加と削除

流動性の追加は2種類のトークンを同時に預け入れ、現在のリザーブ比率で計算する必要があります。Router の `addLiquidity` メソッドは比率の差異を自動的に処理し、余剰分を返却します：

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

流動性を削除する際、フロントエンドはまずユーザーが保有する LP Token 残高を取得し、その後 `removeLiquidity` を呼び出す必要があります：

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

## トランザクション失敗の一般的な原因分析

DeFi フロントエンド開発において、トランザクション失敗は最も一般的なユーザー体験の問題です。以下は典型的なシナリオです：

### 1. スリッページが許容範囲を超過

オンチェーンのリザーブ量はトランザクション送信とパッキングの間に変化する可能性があり（フロントランニング）、実際の出力が `amountOutMin` を下回り、トランザクションがリバートされます。解決策はフロントエンドでリアルタイムに価格を更新し、トランザクション前に `amountOutMin` を再計算することです。

### 2. 許可額の不足

ユーザーが以前許可した額が消費されているか、旧版の Router に許可されています。フロントエンドは毎回 `allowance` をチェックし、不足時に `approve` トランザクションを発行する必要があります。

### 3. Deadline の期限切れ

`deadline` パラメータは Unix タイムスタンプです。トランザクションが deadline 以降にパッキングされると自動的にリバートされます。ネットワーク混雑時にこの問題が特に顕著になります。フロントエンドは少なくとも20分の deadline を設定することを推奨します。

### 4. Gas 見積もり失敗

トランザクションが必ずリバートする場合、ノードは Gas 見積もりリクエストを拒否し、フロントエンドは `eth_estimateGas` エラーを受け取ります。このエラーをキャプチャし、静的コール（`eth_call`）にフォールバックしてリバート理由を取得できます：

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

## まとめ

Uniswap V2 のフロントエンド開発は DeFi 連携のコアパターンを網羅しています：コントラクトデータの読み取り、価格計算、トランザクション構築、許可管理、状態同期。これらのパターンはほぼすべての DeFi プロトコルフロントエンドで再利用されます。

DeFi フロントエンド開発の最大の課題は**状態的一貫性とユーザー体験のバランス**にあります。オンチェーン状態は常に変化するため、フロントエンドはリアルタイム性と正確性のバランスを取る必要があります——表示された価格は次の瞬間にはもう有効でないかもしれません。スリッページ許容度、deadline、最小出力量を合理的に設定することが、トランザクション成功率を保証する3つの重要なパラメータです。同時に、トランザクション失敗の診断とユーザーフィードバックの設計も同様に重要です。良い DeFi フロントエンドはトランザクション失敗時に明確な理由を提示すべきであり、曖昧な "Transaction Failed" ポップアップであってはなりません。
