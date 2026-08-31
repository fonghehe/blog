---
title: "Ethers.js vs Web3.js：DApp フロントエンドライブラリの選定"
date: 2020-03-22 18:17:51
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 11
wordCount: 2485
description: "web3.js は Ethereum エコシステム最古の JavaScript SDK で、Ethereum 財団が支援して開発し、2015年の 0.x バージョンから2019年の 1.x 安定版まで進化してきました。web3.js 1.x は DApp フロントエンド開発の基礎的パラダイムを築きました：グローバル P"
---

## 2つのライブラリの背景と設計哲学

web3.js は Ethereum エコシステム最古の JavaScript SDK で、Ethereum 財団が支援して開発し、2015年の 0.x バージョンから2019年の 1.x 安定版まで進化してきました。web3.js 1.x は DApp フロントエンド開発の基礎的パラダイムを築きました：グローバル Provider インスタンス、Contract オブジェクト、イベントサブスクリプション、トランザクション署名。

ethers.js は Richard Moore が開発し、2016年に 1.x バージョンをリリース、2018年に 2.x、2019年末には 3.x まで進化しました。ethers.js は当初から異なる設計理念を採用していました：「読み取り」と「署名」の責任を分離し、Provider/Signer モデルを導入し、読み取り専用操作と秘密鍵が必要な操作が API レベルで明確な境界を持つようにしました。

ethers.js v5 は TypeScript サポート、Tree-shaking、パフォーマンスの面で web3.js との差をさらに広げています。新規に立ち上げる DApp プロジェクトにとって、ライブラリの選択は慎重に評価すべき技術的決断となります。

## Provider/Signer モデル vs グローバル web3 インスタンス

### web3.js の方式

web3.js はグローバルな `web3` インスタンスに依存し、すべての操作をこのインスタンス経由で行います：

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

web3.js の `Contract` オブジェクトは読み取り（`call`）も書き込み（`send`）も担当し、`from` パラメータで送信者を指定します。この設計はシンプルで直接的ですが、根本的な問題があります：**読み取りと書き込みが同じオブジェクトに結合**されており、アーキテクチャレベルで読み取り専用操作とユーザー署名が必要な操作を区別できません。

### ethers.js の方式

ethers.js は責任を Provider（読み取り専用）と Signer（書き込み可能）に分割します：

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

この分離は実際の開発において非常に明確な優位性があります：パブリック RPC ノードで Provider を作成してオンチェーンデータを読み取ることができ（ユーザーのウォレット接続不要）、ユーザーがトランザクションを開始する時にのみ Signer をリクエストします。これは DApp のファーストビューでオンチェーンデータ（トークン価格、流動性プール情報）を表示でき、ユーザーが先にウォレットを接続する必要がないことを意味します。

## コントラクト連携 API の比較

### メソッド呼び出し

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

web3.js のメソッド呼び出しは `contract.methods.methodName(args).call()` または `.send()` で行われ、メソッド名は文字列のためコンパイラがチェックできません。ethers.js はプロパティアクセスで直接メソッドを呼び出し、IDE が自動補完を提供できます。

### トランザクション送信

```javascript
// web3.js
const receipt = await contract.methods
  .transfer(to, amount)
  .send({ from: userAddress, gas: 210000 });

// ethers.js
const tx = await contract.transfer(to, amount);
const receipt = await tx.wait(); // 等待确认
```

ethers.js はトランザクション送信と確定待ちを2ステップに分けています。`contract.transfer()` は `Transaction` オブジェクトを返し、hash、nonce などの情報を含み、`wait()` を呼んでブロック確定を待ちます。この設計によりフロントエンドはトランザクションのブロードキャスト直後にフィードバックでき、確定完了を待つ必要がありません。

### 巨大数の処理

Ethereum の数値は JavaScript の安全な整数範囲（2^53 - 1）を頻繁に超過します。2つのライブラリの処理方式は全く異なります：

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

ethers.js の BigNumber 実装はより軽量で、ライブラリの他のユーティリティ関数と深く統合されています。`parseEther` と `formatEther` のセマンティクスは web3.js の `toWei`/`fromWei` より明確です。

## 型安全性：ethers.js の TypeScript サポート

ethers.js v5 は基盤から TypeScript で書き直され、完全な型定義を提供しています。型拡張により、コンパイル時のコントラクトメソッドチェックが可能です：

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

web3.js 1.x にも `@types/web3` 型定義パッケージがありますが、型カバレッジが不完全で、多くのメソッドパラメータが `any` であり、コンパイル時の安全保証を提供できません。

## イベント処理とログ解析

### イベントリスニング

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

ethers.js のイベントフィルター API はより一貫しています。`contract.filters.EventName(arg1, arg2)` は位置引数でインデックスを受け取り、`null` はワイルドカードを意味します。この設計により複雑なイベントフィルタリングがより直感的になります。

### 履歴ログの照会

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

## トランザクション構築と署名フロー

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

ethers.js の Signer は nonce 管理と Gas 見積もりを自動的に処理し、ほとんどの場面で開発者がこれらのパラメータを手動指定する必要がありません。web3.js は開発者が nonce と Gas を自分で処理する必要があり、エラーが発生しやすいです。

## 同一機能の2ライブラリによる全体の実装

以下はトークン許可と取引の全体のフローを2つのライブラリでそれぞれ実装したものです：

### web3.js バージョン

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

### ethers.js バージョン

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

ethers.js バージョンの方がコード行数が少なく、可読性も良いです——`allowance.lt(amountIn)` は `toBN(allowance).lt(toBN(amountIn))` よりずっと自然です。

## web3.js から ethers.js への移行の実践

### ABI フォーマットの違い

web3.js は2種類の ABI フォーマット（human-readable と JSON）を受け付けますが、ethers.js v5 はさらに簡潔な human-readable ABI をサポートしています：

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

Human-readable ABI は開発段階で非常に便利で、Solidity インターフェースから直接コピーでき、ABI 定義の作業量を大幅に削減します。

### 移行の注意事項

1. **数値型の変化**：web3.js が返す数値は文字列または BN の可能性がありますが、ethers.js は BigNumber に統一されます
2. **アドレス検証**：ethers.js はアドレスフォーマットに厳格な EIP-55 検証を行いますが、web3.js はより緩やかです
3. **イベントパラメータ**：web3.js は `event.returnValues.propName` を使いますが、ethers.js は `event.args[index]` を使います
4. **トランザクションレシート**：2つのライブラリの receipt 構造が異なり、適応が必要です
5. **Provider の取得**：web3.js は `window.web3.currentProvider` から取得し、ethers.js は `window.ethereum` から取得します

## パフォーマンス比較：バンドルサイズと実行効率

### バンドルサイズ

| ライブラリ | バージョン | Minified | Gzipped |
|---|---|---|---|
| web3.js | 1.2.6 | ~1.1 MB | ~330 KB |
| ethers.js | 5.0.0 (full) | ~430 KB | ~120 KB |
| ethers.js | 5.0.0 (modular) | ~200 KB | ~65 KB |

ethers.js v5 の Tree-shaking サポートにより、必要な機能のみをインポートしてサイズをさらに削減できます。バンドルサイズに敏感な DApp にとって、この差は非常に顕著です。

### 実行効率

ethers.js v5 は ABI エンコード/デコード、BigNumber 演算の面で大量の最適化を行いました。バッチコントラクト呼び出しの場面（例：100個のトークン残高を照会）では、ethers.js のデコード速度は web3.js の約 1.5-2 倍です。これは主に ethers.js v5 が書き直した ABI Coder がより効率的なバイナリ操作を使用していることに起因します。

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

## まとめ

ethers.js と web3.js はどちらも DApp フロントエンド開発のすべてのニーズを満たせますが、設計理念の違いが開発体験の優劣を決定します。ethers.js の Provider/Signer 分離、TypeScript ネイティブサポート、より小さなバンドルサイズ、よりクリーンな API 設計により、現在において新規プロジェクトのより良い選択となっています。

web3.js にも利点がないわけではありません——より成熟しており、コミュニティドキュメントがより豊富で、Truffle エコシステムとの統合がより緊密です。しかしゼロから DApp フロントエンドを構築する場合、特に TypeScript とモダンなビルドツールを使用するプロジェクトでは、ethers.js v5 がより合理的な選択です。ライブラリの選定は最終的にエンジニアリングの意思決定であり、プロジェクトの技術スタック、チームの習熟度、長期的なメンテナンスコストを総合的に判断すべきであり、単なるコミュニティの人気度に追随すべきではありません。
