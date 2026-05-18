---
readingTime: 7
wordCount: 1514
title: "Ethers.js vs Web3.js：DApp 前端庫選型"
date: 2020-03-22 18:17:51
tags:
  - Web3
  - Ethereum
  - DApp
---

## 兩個庫的歷史與設計哲學

web3.js 是以太坊生態最早的 JavaScript SDK，由以太坊基金會支持開發，從 2015 年的 0.x 版本一路演進到 2019 年的 1.x 穩定版。web3.js 1.x 奠定了 DApp 前端開發的基礎範式：全局 Provider 實例、Contract 對象、事件訂閲、交易簽名。

ethers.js 由 Richard Moore 開發，2016 年發佈 1.x 版本，2018 年發佈 2.x，到 2019 年底演進到 3.x。ethers.js 從一開始就採用了不同的設計理念：將"讀取"和"簽名"職責分離，引入 Provider/Signer 模型，使得只讀操作和需要私鑰的操作在 API 層面有了明確邊界。

ethers.js v5 進入 beta 階段後，在 TypeScript 支持、Tree-shaking 和性能方面進一步拉開了與 web3.js 的差距。對於新啓動的 DApp 項目，庫的選擇成為一個需要認真評估的技術決策。

## Provider/Signer 模型 vs 全局 web3 實例

### web3.js 的方式

web3.js 依賴一個全局的 `web3` 實例，所有操作都通過這個實例完成：

```javascript
// web3.js 初始化
import Web3 from 'web3';

// 瀏覽器注入的 provider
if (window.ethereum) {
  window.web3 = new Web3(window.ethereum);
  await window.ethereum.enable();
} else if (window.web3) {
  window.web3 = new Web3(window.web3.currentProvider);
}

// 合約實例
const contract = new web3.eth.Contract(abi, address);

// 讀取鏈上數據
const balance = await contract.methods.balanceOf(userAddress).call();

// 發送交易
await contract.methods.transfer(to, amount).send({ from: userAddress });
```

web3.js 的 `Contract` 對象既負責讀取（`call`）又負責寫（`send`），通過 `from` 參數指定發送者。這種設計簡單直接，但存在一個根本問題：**讀取和寫入耦合在同一個對象上**，無法在架構層面區分只讀操作和需要用户簽名的操作。

### ethers.js 的方式

ethers.js 將職責拆分為 Provider（只讀）和 Signer（可寫）：

```javascript
// ethers.js 初始化
import { ethers } from 'ethers';

// Provider：只讀操作，無需用户授權
const provider = new ethers.providers.Web3Provider(window.ethereum);

// Signer：需要用户簽名的操作
const signer = provider.getSigner();

// 需要用户授權
await provider.send('eth_requestAccounts', []);

// 合約實例（只讀）
const readOnlyContract = new ethers.Contract(address, abi, provider);

// 合約實例（可寫）
const writableContract = new ethers.Contract(address, abi, signer);

// 讀取數據——不需要 Signer
const balance = await readOnlyContract.balanceOf(userAddress);

// 發送交易——需要 Signer
await writableContract.transfer(to, amount);
```

這種分離在實際開發中的優勢非常明顯：你可以用一個公共 RPC 節點創建 Provider 來讀取鏈上數據（不需要用户連接錢包），只在用户發起交易時才請求 Signer。這意味着 DApp 首屏可以展示鏈上數據（代幣價格、流動性池信息），而無需用户先連接錢包。

## 合約交互 API 對比

### 方法調用

```javascript
// web3.js
const balance = await contract.methods.balanceOf(address).call();
const decimals = await contract.methods.decimals().call();
const readableBalance = balance / Math.pow(10, decimals);

// ethers.js
const balance = await contract.balanceOf(address);
const decimals = await contract.decimals();
const readableBalance = ethers.utils.formatUnits(balance, decimals);
```

web3.js 的方法調用通過 `contract.methods.methodName(args).call()` 或 `.send()` 完成，方法名是字符串，編譯器無法檢查。ethers.js 直接通過屬性訪問調用方法，IDE 可以提供自動補全。

### 交易發送

```javascript
// web3.js
const receipt = await contract.methods
  .transfer(to, amount)
  .send({ from: userAddress, gas: 210000 });

// ethers.js
const tx = await contract.transfer(to, amount);
const receipt = await tx.wait(); // 等待確認
```

ethers.js 將交易發送和等待確認分為兩步。`contract.transfer()` 返回一個 `Transaction` 對象，包含 hash、nonce 等信息，調用 `wait()` 才阻塞等待區塊確認。這種設計使得前端可以在交易廣播後立即反饋，而不必等到確認完成。

### 大數處理

以太坊的數值經常超過 JavaScript 的安全整數範圍（2^53 - 1）。兩個庫的處理方式截然不同：

```javascript
// web3.js：使用 BN.js（bignumber.js 的子集）
const balance = web3.utils.toBN('1000000000000000000');
const doubled = balance.mul(web3.utils.toBN('2'));
const wei = web3.utils.toWei('1', 'ether'); // 字符串

// ethers.js：使用自定義 BigNumber
const balance = ethers.BigNumber.from('1000000000000000000');
const doubled = balance.mul(2);
const wei = ethers.utils.parseEther('1.0');
const ether = ethers.utils.formatEther(wei);
```

ethers.js 的 BigNumber 實現更輕量，且與庫的其他工具函數深度集成。`parseEther` 和 `formatEther` 的語義比 web3.js 的 `toWei`/`fromWei` 更清晰。

## 類型安全：ethers.js 的 TypeScript 支持

ethers.js v5 從底層用 TypeScript 重寫，提供了完整的類型定義。通過類型擴展，可以獲得編譯時的合約方法檢查：

```typescript
import { ethers, type ContractTransaction } from 'ethers';

// 定義合約接口
interface ERC20 extends ethers.Contract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  balanceOf(address: string): Promise<ethers.BigNumber>;
  transfer(to: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
  allowance(owner: string, spender: string): Promise<ethers.BigNumber>;
  approve(spender: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
}

// 類型安全的合約創建
function createERC20(address: string, signer: ethers.Signer): ERC20 {
  return new ethers.Contract(address, ERC20_ABI, signer) as ERC20;
}

// 使用時 IDE 提供自動補全和類型檢查
const token = createERC20(tokenAddress, signer);
const balance = await token.balanceOf(userAddress); // 類型: BigNumber
const tx = await token.transfer(to, ethers.utils.parseEther('1.0')); // 類型: ContractTransaction
```

web3.js 1.x 雖然也有 `@types/web3` 類型定義包，但類型覆蓋不完整，很多方法參數是 `any`，無法提供編譯時安全保障。

## 事件處理與日誌解析

### 事件監聽

```javascript
// web3.js
contract.events.Transfer({
  filter: { from: userAddress },
  fromBlock: 'latest',
}, (error, event) => {
  console.log(event.returnValues.from, event.returnValues.to, event.returnValues.value);
});

// 取消監聽需要管理 subscription
// contract.events.Transfer 的返回值沒有標準的 unsubscribe 方法

// ethers.js
const filter = contract.filters.Transfer(userAddress, null);
contract.on(filter, (from, to, value, event) => {
  console.log(from, to, value.toString());
  event.removeListener(); // 可選：監聽一次後移除
});

// 取消監聽
contract.off(filter, callback);
// 或
contract.removeAllListeners(filter);
```

ethers.js 的事件過濾器 API 更加一致。`contract.filters.EventName(arg1, arg2)` 接受按位置參數索引，`null` 表示通配符。這種設計使得複雜的事件過濾更加直觀。

### 歷史日誌查詢

```javascript
// web3.js：需要手動處理 topics 編碼
const events = await contract.getPastEvents('Transfer', {
  filter: { from: userAddress },
  fromBlock: 0,
  toBlock: 'latest',
});

// ethers.js：過濾器 + queryFilter
const filter = contract.filters.Transfer(userAddress, null);
const events = await contract.queryFilter(filter, fromBlock, toBlock);

// 解碼事件數據
events.forEach(event => {
  console.log({
    from: event.args.from,
    to: event.args.to,
    value: event.args.value.toString(),
    blockNumber: event.blockNumber,
  });
});
```

## 交易構建與簽名流程

```javascript
// web3.js
const tx = {
  from: userAddress,
  to: contractAddress,
  data: contract.methods.transfer(to, amount).encodeABI(),
  gas: await web3.eth.estimateGas({
    from: userAddress,
    to: contractAddress,
    data: contract.methods.transfer(to, amount).encodeABI(),
  }),
  gasPrice: await web3.eth.getGasPrice(),
  nonce: await web3.eth.getTransactionCount(userAddress),
};
const signedTx = await web3.eth.accounts.signTransaction(tx, privateKey);
const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);

// ethers.js
const tx = await signer.sendTransaction({
  to: contractAddress,
  data: contract.interface.encodeFunctionData('transfer', [to, amount]),
  gasLimit: 210000,
});
const receipt = await tx.wait();
```

ethers.js 的 Signer 自動處理 nonce 管理和 gas 估算，大部分場景下開發者不需要手動指定這些參數。web3.js 需要開發者自行處理 nonce 和 gas，容易出錯。

## 同一功能兩個庫的完整實現

以下是一個代幣授權並交易的完整流程，分別用兩個庫實現：

### web3.js 版本

```javascript
async function approveAndSwapWeb3(web3, tokenIn, tokenOut, amountIn, routerAddress) {
  const accounts = await web3.eth.getAccounts();
  const account = accounts[0];

  const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenIn);
  const routerContract = new web3.eth.Contract(ROUTER_ABI, routerAddress);

  // 授權檢查
  const allowance = await tokenContract.methods.allowance(account, routerAddress).call();
  if (web3.utils.toBN(allowance).lt(web3.utils.toBN(amountIn))) {
    await tokenContract.methods.approve(routerAddress, web3.utils.toBN('2').pow(web3.utils.toBN('256')).sub(web3.utils.toBN('1')))
      .send({ from: account });
  }

  // 交易
  const path = [tokenIn, tokenOut];
  const amounts = await routerContract.methods.getAmountsOut(amountIn, path).call();
  const amountOutMin = web3.utils.toBN(amounts[1]).mul(web3.utils.toBN('995')).div(web3.utils.toBN('1000'));
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const receipt = await routerContract.methods.swapExactTokensForTokens(
    amountIn, amountOutMin, path, account, deadline
  ).send({ from: account });

  return receipt;
}
```

### ethers.js 版本

```javascript
async function approveAndSwapEthers(provider, tokenIn, tokenOut, amountIn, routerAddress) {
  const signer = provider.getSigner();
  const account = await signer.getAddress();

  const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);

  // 授權檢查
  const allowance = await token.allowance(account, routerAddress);
  if (allowance.lt(amountIn)) {
    const approveTx = await token.approve(routerAddress, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // 交易
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amountIn, path);
  const amountOutMin = amounts[1].mul(995).div(1000);
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, account, deadline);
  const receipt = await tx.wait();

  return receipt;
}
```

ethers.js 版本的代碼行數更少，可讀性也更好——`allowance.lt(amountIn)` 比 `toBN(allowance).lt(toBN(amountIn))` 自然得多。

## 從 web3.js 遷移到 ethers.js 的實踐

### ABI 格式差異

web3.js 接受兩種 ABI 格式（human-readable 和 JSON），而 ethers.js v5 額外支持更簡潔的 human-readable ABI：

```javascript
// 兩個庫都支持的 JSON ABI
const ABI = [
  { "constant": true, "inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
];

// ethers.js 獨有的 human-readable ABI（v5）
const ABI_HUMAN = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
```

Human-readable ABI 在開發階段非常方便，可以直接從 Solidity 接口複製，大幅減少 ABI 定義的工作量。

### 遷移注意事項

1. **數值類型變化**：web3.js 返回的數值可能是字符串或 BN，ethers.js 統一返回 BigNumber
2. **地址校驗**：ethers.js 對地址格式有嚴格的 EIP-55 校驗，web3.js 更寬鬆
3. **事件參數**：web3.js 用 `event.returnValues.propName`，ethers.js 用 `event.args[index]`
4. **交易收據**：兩個庫的 receipt 結構不同，需要適配
5. **Provider 獲取**：web3.js 從 `window.web3.currentProvider` 獲取，ethers.js 從 `window.ethereum` 獲取

## 性能對比：Bundle Size 和執行效率

### Bundle Size

| 庫 | 版本 | Minified | Gzipped |
|---|---|---|---|
| web3.js | 1.2.6 | ~1.1 MB | ~330 KB |
| ethers.js | 5.0.0 (full) | ~430 KB | ~120 KB |
| ethers.js | 5.0.0 (modular) | ~200 KB | ~65 KB |

ethers.js v5 的 Tree-shaking 支持意味着只引入需要的功能可以進一步減小體積。對於 bundle size 敏感的 DApp，這個差距非常顯著。

### 執行效率

ethers.js v5 在 ABI 編碼/解碼、BigNumber 運算方面做了大量優化。在批量合約調用場景下（如查詢 100 個代幣餘額），ethers.js 的解碼速度約為 web3.js 的 1.5-2 倍。這主要得益於 ethers.js v5 重寫的 ABI Coder 使用了更高效的二進制操作。

```javascript
// 批量餘額查詢性能對比
async function batchBalanceCheck(provider, tokenAddress, addresses) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // 併發查詢
  const promises = addresses.map(addr => contract.balanceOf(addr));
  const balances = await Promise.all(promises);

  return balances;
}
```

## 小結

ethers.js 和 web3.js 都能完成 DApp 前端開發的所有需求，但設計理念上的差異決定了開發體驗的優劣。ethers.js 的 Provider/Signer 分離、TypeScript 原生支持、更小的 bundle size 和更清晰的 API 設計，使其成為新項目的更優選擇。

web3.js 並非沒有優勢——它更成熟、社區文檔更多、與 Truffle 生態集成更緊密。但如果你從零開始構建一個 DApp 前端，尤其是一個使用 TypeScript + 現代構建工具的項目，ethers.js v5 是更合理的選擇。庫的選型最終是一個工程決策，應該基於項目的技術棧、團隊熟悉度和長期維護成本來綜合判斷，而非單純跟隨社區熱度。
