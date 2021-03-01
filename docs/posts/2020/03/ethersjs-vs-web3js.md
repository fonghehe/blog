---
title: "Ethers.js vs Web3.js：DApp 前端库选型"
date: 2020-03-22 18:17:51
tags:
  - Web3
  - Ethereum
  - DApp
---

## 两个库的历史与设计哲学

web3.js 是以太坊生态最早的 JavaScript SDK，由以太坊基金会支持开发，从 2015 年的 0.x 版本一路演进到 2019 年的 1.x 稳定版。web3.js 1.x 奠定了 DApp 前端开发的基础范式：全局 Provider 实例、Contract 对象、事件订阅、交易签名。

ethers.js 由 Richard Moore 开发，2016 年发布 1.x 版本，2018 年发布 2.x，到 2019 年底演进到 3.x。ethers.js 从一开始就采用了不同的设计理念：将"读取"和"签名"职责分离，引入 Provider/Signer 模型，使得只读操作和需要私钥的操作在 API 层面有了明确边界。

2020 年初，ethers.js v5 进入 beta 阶段，在 TypeScript 支持、Tree-shaking 和性能方面进一步拉开了与 web3.js 的差距。对于新启动的 DApp 项目，库的选择成为一个需要认真评估的技术决策。

## Provider/Signer 模型 vs 全局 web3 实例

### web3.js 的方式

web3.js 依赖一个全局的 `web3` 实例，所有操作都通过这个实例完成：

```javascript
// web3.js 初始化
import Web3 from 'web3';

// 浏览器注入的 provider
if (window.ethereum) {
  window.web3 = new Web3(window.ethereum);
  await window.ethereum.enable();
} else if (window.web3) {
  window.web3 = new Web3(window.web3.currentProvider);
}

// 合约实例
const contract = new web3.eth.Contract(abi, address);

// 读取链上数据
const balance = await contract.methods.balanceOf(userAddress).call();

// 发送交易
await contract.methods.transfer(to, amount).send({ from: userAddress });
```

web3.js 的 `Contract` 对象既负责读取（`call`）又负责写（`send`），通过 `from` 参数指定发送者。这种设计简单直接，但存在一个根本问题：**读取和写入耦合在同一个对象上**，无法在架构层面区分只读操作和需要用户签名的操作。

### ethers.js 的方式

ethers.js 将职责拆分为 Provider（只读）和 Signer（可写）：

```javascript
// ethers.js 初始化
import { ethers } from 'ethers';

// Provider：只读操作，无需用户授权
const provider = new ethers.providers.Web3Provider(window.ethereum);

// Signer：需要用户签名的操作
const signer = provider.getSigner();

// 需要用户授权
await provider.send('eth_requestAccounts', []);

// 合约实例（只读）
const readOnlyContract = new ethers.Contract(address, abi, provider);

// 合约实例（可写）
const writableContract = new ethers.Contract(address, abi, signer);

// 读取数据——不需要 Signer
const balance = await readOnlyContract.balanceOf(userAddress);

// 发送交易——需要 Signer
await writableContract.transfer(to, amount);
```

这种分离在实际开发中的优势非常明显：你可以用一个公共 RPC 节点创建 Provider 来读取链上数据（不需要用户连接钱包），只在用户发起交易时才请求 Signer。这意味着 DApp 首屏可以展示链上数据（代币价格、流动性池信息），而无需用户先连接钱包。

## 合约交互 API 对比

### 方法调用

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

web3.js 的方法调用通过 `contract.methods.methodName(args).call()` 或 `.send()` 完成，方法名是字符串，编译器无法检查。ethers.js 直接通过属性访问调用方法，IDE 可以提供自动补全。

### 交易发送

```javascript
// web3.js
const receipt = await contract.methods
  .transfer(to, amount)
  .send({ from: userAddress, gas: 210000 });

// ethers.js
const tx = await contract.transfer(to, amount);
const receipt = await tx.wait(); // 等待确认
```

ethers.js 将交易发送和等待确认分为两步。`contract.transfer()` 返回一个 `Transaction` 对象，包含 hash、nonce 等信息，调用 `wait()` 才阻塞等待区块确认。这种设计使得前端可以在交易广播后立即反馈，而不必等到确认完成。

### 大数处理

以太坊的数值经常超过 JavaScript 的安全整数范围（2^53 - 1）。两个库的处理方式截然不同：

```javascript
// web3.js：使用 BN.js（bignumber.js 的子集）
const balance = web3.utils.toBN('1000000000000000000');
const doubled = balance.mul(web3.utils.toBN('2'));
const wei = web3.utils.toWei('1', 'ether'); // 字符串

// ethers.js：使用自定义 BigNumber
const balance = ethers.BigNumber.from('1000000000000000000');
const doubled = balance.mul(2);
const wei = ethers.utils.parseEther('1.0');
const ether = ethers.utils.formatEther(wei);
```

ethers.js 的 BigNumber 实现更轻量，且与库的其他工具函数深度集成。`parseEther` 和 `formatEther` 的语义比 web3.js 的 `toWei`/`fromWei` 更清晰。

## 类型安全：ethers.js 的 TypeScript 支持

ethers.js v5 从底层用 TypeScript 重写，提供了完整的类型定义。通过类型扩展，可以获得编译时的合约方法检查：

```typescript
import { ethers, type ContractTransaction } from 'ethers';

// 定义合约接口
interface ERC20 extends ethers.Contract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  balanceOf(address: string): Promise<ethers.BigNumber>;
  transfer(to: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
  allowance(owner: string, spender: string): Promise<ethers.BigNumber>;
  approve(spender: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
}

// 类型安全的合约创建
function createERC20(address: string, signer: ethers.Signer): ERC20 {
  return new ethers.Contract(address, ERC20_ABI, signer) as ERC20;
}

// 使用时 IDE 提供自动补全和类型检查
const token = createERC20(tokenAddress, signer);
const balance = await token.balanceOf(userAddress); // 类型: BigNumber
const tx = await token.transfer(to, ethers.utils.parseEther('1.0')); // 类型: ContractTransaction
```

web3.js 1.x 虽然也有 `@types/web3` 类型定义包，但类型覆盖不完整，很多方法参数是 `any`，无法提供编译时安全保障。

## 事件处理与日志解析

### 事件监听

```javascript
// web3.js
contract.events.Transfer({
  filter: { from: userAddress },
  fromBlock: 'latest',
}, (error, event) => {
  console.log(event.returnValues.from, event.returnValues.to, event.returnValues.value);
});

// 取消监听需要管理 subscription
// contract.events.Transfer 的返回值没有标准的 unsubscribe 方法

// ethers.js
const filter = contract.filters.Transfer(userAddress, null);
contract.on(filter, (from, to, value, event) => {
  console.log(from, to, value.toString());
  event.removeListener(); // 可选：监听一次后移除
});

// 取消监听
contract.off(filter, callback);
// 或
contract.removeAllListeners(filter);
```

ethers.js 的事件过滤器 API 更加一致。`contract.filters.EventName(arg1, arg2)` 接受按位置参数索引，`null` 表示通配符。这种设计使得复杂的事件过滤更加直观。

### 历史日志查询

```javascript
// web3.js：需要手动处理 topics 编码
const events = await contract.getPastEvents('Transfer', {
  filter: { from: userAddress },
  fromBlock: 0,
  toBlock: 'latest',
});

// ethers.js：过滤器 + queryFilter
const filter = contract.filters.Transfer(userAddress, null);
const events = await contract.queryFilter(filter, fromBlock, toBlock);

// 解码事件数据
events.forEach(event => {
  console.log({
    from: event.args.from,
    to: event.args.to,
    value: event.args.value.toString(),
    blockNumber: event.blockNumber,
  });
});
```

## 交易构建与签名流程

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

ethers.js 的 Signer 自动处理 nonce 管理和 gas 估算，大部分场景下开发者不需要手动指定这些参数。web3.js 需要开发者自行处理 nonce 和 gas，容易出错。

## 同一功能两个库的完整实现

以下是一个代币授权并交易的完整流程，分别用两个库实现：

### web3.js 版本

```javascript
async function approveAndSwapWeb3(web3, tokenIn, tokenOut, amountIn, routerAddress) {
  const accounts = await web3.eth.getAccounts();
  const account = accounts[0];

  const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenIn);
  const routerContract = new web3.eth.Contract(ROUTER_ABI, routerAddress);

  // 授权检查
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

  // 授权检查
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

ethers.js 版本的代码行数更少，可读性也更好——`allowance.lt(amountIn)` 比 `toBN(allowance).lt(toBN(amountIn))` 自然得多。

## 从 web3.js 迁移到 ethers.js 的实践

### ABI 格式差异

web3.js 接受两种 ABI 格式（human-readable 和 JSON），而 ethers.js v5 额外支持更简洁的 human-readable ABI：

```javascript
// 两个库都支持的 JSON ABI
const ABI = [
  { "constant": true, "inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
];

// ethers.js 独有的 human-readable ABI（v5）
const ABI_HUMAN = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
```

Human-readable ABI 在开发阶段非常方便，可以直接从 Solidity 接口复制，大幅减少 ABI 定义的工作量。

### 迁移注意事项

1. **数值类型变化**：web3.js 返回的数值可能是字符串或 BN，ethers.js 统一返回 BigNumber
2. **地址校验**：ethers.js 对地址格式有严格的 EIP-55 校验，web3.js 更宽松
3. **事件参数**：web3.js 用 `event.returnValues.propName`，ethers.js 用 `event.args[index]`
4. **交易收据**：两个库的 receipt 结构不同，需要适配
5. **Provider 获取**：web3.js 从 `window.web3.currentProvider` 获取，ethers.js 从 `window.ethereum` 获取

## 性能对比：Bundle Size 和执行效率

### Bundle Size

| 库 | 版本 | Minified | Gzipped |
|---|---|---|---|
| web3.js | 1.2.6 | ~1.1 MB | ~330 KB |
| ethers.js | 5.0.0 (full) | ~430 KB | ~120 KB |
| ethers.js | 5.0.0 (modular) | ~200 KB | ~65 KB |

ethers.js v5 的 Tree-shaking 支持意味着只引入需要的功能可以进一步减小体积。对于 bundle size 敏感的 DApp，这个差距非常显著。

### 执行效率

ethers.js v5 在 ABI 编码/解码、BigNumber 运算方面做了大量优化。在批量合约调用场景下（如查询 100 个代币余额），ethers.js 的解码速度约为 web3.js 的 1.5-2 倍。这主要得益于 ethers.js v5 重写的 ABI Coder 使用了更高效的二进制操作。

```javascript
// 批量余额查询性能对比
async function batchBalanceCheck(provider, tokenAddress, addresses) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // 并发查询
  const promises = addresses.map(addr => contract.balanceOf(addr));
  const balances = await Promise.all(promises);

  return balances;
}
```

## 小结

ethers.js 和 web3.js 都能完成 DApp 前端开发的所有需求，但设计理念上的差异决定了开发体验的优劣。ethers.js 的 Provider/Signer 分离、TypeScript 原生支持、更小的 bundle size 和更清晰的 API 设计，使其在 2020 年成为新项目的更优选择。

web3.js 并非没有优势——它更成熟、社区文档更多、与 Truffle 生态集成更紧密。但如果你从零开始构建一个 DApp 前端，尤其是一个使用 TypeScript + 现代构建工具的项目，ethers.js v5 是更合理的选择。库的选型最终是一个工程决策，应该基于项目的技术栈、团队熟悉度和长期维护成本来综合判断，而非单纯跟随社区热度。
