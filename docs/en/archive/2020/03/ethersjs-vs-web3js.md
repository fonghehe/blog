---
title: "Ethers.js vs Web3.js: Choosing a DApp Frontend Library"
date: 2020-03-22 18:17:51
tags:
  - Web3
  - Ethereum
  - DApp
readingTime: 7
wordCount: 937
description: "web3.js is the earliest JavaScript SDK in the Ethereum ecosystem. Developed with support from the Ethereum Foundation, it evolved from the 0.x series in 2015 to"
---

## History and Design Philosophy of Both Libraries

web3.js is the earliest JavaScript SDK in the Ethereum ecosystem. Developed with support from the Ethereum Foundation, it evolved from the 0.x series in 2015 to the stable 1.x release in 2019. web3.js 1.x established the foundational paradigm for DApp frontend development: a global Provider instance, Contract objects, event subscriptions, and transaction signing.

ethers.js was developed by Richard Moore, with its 1.x release in 2016, 2.x in 2018, and 3.x by late 2019. From the beginning, ethers.js adopted a different design philosophy: separating the responsibilities of "reading" and "signing" by introducing the Provider/Signer model, giving read-only operations and operations requiring private keys clear boundaries at the API level.

ethers.js v5 entered beta and widened the gap with web3.js in TypeScript support, tree-shaking, and performance. For new DApp projects, library selection is a technical decision requiring careful evaluation.

## Provider/Signer Model vs. Global web3 Instance

### The web3.js Approach

web3.js relies on a global `web3` instance through which all operations are performed:

```javascript
// web3.js initialization
import Web3 from 'web3';

// Browser-injected provider
if (window.ethereum) {
  window.web3 = new Web3(window.ethereum);
  await window.ethereum.enable();
} else if (window.web3) {
  window.web3 = new Web3(window.web3.currentProvider);
}

// Contract instance
const contract = new web3.eth.Contract(abi, address);

// Read on-chain data
const balance = await contract.methods.balanceOf(userAddress).call();

// Send transaction
await contract.methods.transfer(to, amount).send({ from: userAddress });
```

web3.js's `Contract` object handles both reading (`call`) and writing (`send`), specifying the sender via the `from` parameter. This design is straightforward, but has a fundamental problem: **reading and writing are coupled within the same object**, making it impossible to distinguish at the architectural level between read-only operations and operations requiring user signatures.

### The ethers.js Approach

ethers.js separates responsibilities into Provider (read-only) and Signer (writable):

```javascript
// ethers.js initialization
import { ethers } from 'ethers';

// Provider: read-only operations, no user authorization needed
const provider = new ethers.providers.Web3Provider(window.ethereum);

// Signer: operations requiring user signatures
const signer = provider.getSigner();

// Requires user authorization
await provider.send('eth_requestAccounts', []);

// Contract instance (read-only)
const readOnlyContract = new ethers.Contract(address, abi, provider);

// Contract instance (writable)
const writableContract = new ethers.Contract(address, abi, signer);

// Read data—no Signer needed
const balance = await readOnlyContract.balanceOf(userAddress);

// Send transaction—Signer needed
await writableContract.transfer(to, amount);
```

The advantages of this separation are evident in practice: you can create a Provider using a public RPC node to read on-chain data (without requiring the user to connect their wallet), and only request the Signer when the user initiates a transaction. This means a DApp's initial screen can display on-chain data (token prices, pool information) without the user first connecting their wallet.

## Contract Interaction API Comparison

### Method Calls

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

web3.js method calls are made via `contract.methods.methodName(args).call()` or `.send()`, where method names are strings and cannot be verified by the compiler. ethers.js calls methods through property access, allowing IDE autocompletion.

### Transaction Sending

```javascript
// web3.js
const receipt = await contract.methods
  .transfer(to, amount)
  .send({ from: userAddress, gas: 210000 });

// ethers.js
const tx = await contract.transfer(to, amount);
const receipt = await tx.wait(); // Wait for confirmation
```

ethers.js separates transaction sending from waiting for confirmation. `contract.transfer()` returns a `Transaction` object containing hash, nonce, and other information, and `wait()` blocks until block confirmation. This design allows the frontend to provide immediate feedback after broadcasting a transaction, without having to wait for confirmation.

### Big Number Handling

Ethereum values frequently exceed JavaScript's safe integer range (2^53 - 1). The two libraries handle this differently:

```javascript
// web3.js: Uses BN.js (subset of bignumber.js)
const balance = web3.utils.toBN('1000000000000000000');
const doubled = balance.mul(web3.utils.toBN('2'));
const wei = web3.utils.toWei('1', 'ether'); // Returns string

// ethers.js: Uses custom BigNumber
const balance = ethers.BigNumber.from('1000000000000000000');
const doubled = balance.mul(2);
const wei = ethers.utils.parseEther('1.0');
const ether = ethers.utils.formatEther(wei);
```

ethers.js's BigNumber implementation is more lightweight and deeply integrated with the library's other utility functions. The semantics of `parseEther` and `formatEther` are clearer than web3.js's `toWei`/`fromWei`.

## Type Safety: ethers.js's TypeScript Support

ethers.js v5 was rewritten from the ground up in TypeScript, providing complete type definitions. Through type extension, you get compile-time contract method checking:

```typescript
import { ethers, type ContractTransaction } from 'ethers';

// Define contract interface
interface ERC20 extends ethers.Contract {
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<number>;
  balanceOf(address: string): Promise<ethers.BigNumber>;
  transfer(to: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
  allowance(owner: string, spender: string): Promise<ethers.BigNumber>;
  approve(spender: string, amount: ethers.BigNumber): Promise<ContractTransaction>;
}

// Type-safe contract creation
function createERC20(address: string, signer: ethers.Signer): ERC20 {
  return new ethers.Contract(address, ERC20_ABI, signer) as ERC20;
}

// The IDE provides autocompletion and type checking during use
const token = createERC20(tokenAddress, signer);
const balance = await token.balanceOf(userAddress); // Type: BigNumber
const tx = await token.transfer(to, ethers.utils.parseEther('1.0')); // Type: ContractTransaction
```

While web3.js 1.x also has the `@types/web3` type definition package, its type coverage is incomplete, with many method parameters typed as `any`, unable to provide compile-time safety guarantees.

## Event Handling and Log Decoding

### Event Listening

```javascript
// web3.js
contract.events.Transfer({
  filter: { from: userAddress },
  fromBlock: 'latest',
}, (error, event) => {
  console.log(event.returnValues.from, event.returnValues.to, event.returnValues.value);
});

// Unsubscribing requires managing the subscription
// contract.events.Transfer's return value has no standard unsubscribe method

// ethers.js
const filter = contract.filters.Transfer(userAddress, null);
contract.on(filter, (from, to, value, event) => {
  console.log(from, to, value.toString());
  event.removeListener(); // Optional: remove after listening once
});

// Unsubscribe
contract.off(filter, callback);
// or
contract.removeAllListeners(filter);
```

ethers.js's event filter API is more consistent. `contract.filters.EventName(arg1, arg2)` indexes by positional parameters, with `null` representing a wildcard. This design makes complex event filtering more intuitive.

### Historical Log Queries

```javascript
// web3.js: requires manual topic encoding handling
const events = await contract.getPastEvents('Transfer', {
  filter: { from: userAddress },
  fromBlock: 0,
  toBlock: 'latest',
});

// ethers.js: filter + queryFilter
const filter = contract.filters.Transfer(userAddress, null);
const events = await contract.queryFilter(filter, fromBlock, toBlock);

// Decode event data
events.forEach(event => {
  console.log({
    from: event.args.from,
    to: event.args.to,
    value: event.args.value.toString(),
    blockNumber: event.blockNumber,
  });
});
```

## Transaction Construction and Signing Flow

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

ethers.js's Signer automatically handles nonce management and gas estimation. In most scenarios, developers don't need to manually specify these parameters. web3.js requires developers to handle nonce and gas themselves, which is error-prone.

## Complete Implementation of the Same Feature in Both Libraries

Below is a complete token approval and swap flow, implemented with both libraries:

### web3.js Version

```javascript
async function approveAndSwapWeb3(web3, tokenIn, tokenOut, amountIn, routerAddress) {
  const accounts = await web3.eth.getAccounts();
  const account = accounts[0];

  const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenIn);
  const routerContract = new web3.eth.Contract(ROUTER_ABI, routerAddress);

  // Approval check
  const allowance = await tokenContract.methods.allowance(account, routerAddress).call();
  if (web3.utils.toBN(allowance).lt(web3.utils.toBN(amountIn))) {
    await tokenContract.methods.approve(routerAddress, web3.utils.toBN('2').pow(web3.utils.toBN('256')).sub(web3.utils.toBN('1')))
      .send({ from: account });
  }

  // Swap
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

### ethers.js Version

```javascript
async function approveAndSwapEthers(provider, tokenIn, tokenOut, amountIn, routerAddress) {
  const signer = provider.getSigner();
  const account = await signer.getAddress();

  const token = new ethers.Contract(tokenIn, ERC20_ABI, signer);
  const router = new ethers.Contract(routerAddress, ROUTER_ABI, signer);

  // Approval check
  const allowance = await token.allowance(account, routerAddress);
  if (allowance.lt(amountIn)) {
    const approveTx = await token.approve(routerAddress, ethers.constants.MaxUint256);
    await approveTx.wait();
  }

  // Swap
  const path = [tokenIn, tokenOut];
  const amounts = await router.getAmountsOut(amountIn, path);
  const amountOutMin = amounts[1].mul(995).div(1000);
  const deadline = Math.floor(Date.now() / 1000) + 1200;

  const tx = await router.swapExactTokensForTokens(amountIn, amountOutMin, path, account, deadline);
  const receipt = await tx.wait();

  return receipt;
}
```

The ethers.js version has fewer lines of code and is more readable—`allowance.lt(amountIn)` is much more natural than `toBN(allowance).lt(toBN(amountIn))`.

## Practical Migration from web3.js to ethers.js

### ABI Format Differences

web3.js accepts two ABI formats (human-readable and JSON), while ethers.js v5 additionally supports a more concise human-readable ABI:

```javascript
// JSON ABI, supported by both libraries
const ABI = [
  { "constant": true, "inputs": [{"name": "owner", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function" },
];

// ethers.js-exclusive human-readable ABI (v5)
const ABI_HUMAN = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];
```

Human-readable ABI is very convenient during development—you can copy it directly from Solidity interfaces, significantly reducing ABI definition effort.

### Migration Considerations

1. **Value type changes**: web3.js may return numeric values as strings or BN; ethers.js uniformly returns BigNumber
2. **Address validation**: ethers.js strictly enforces EIP-55 address checksumming; web3.js is more lenient
3. **Event parameters**: web3.js uses `event.returnValues.propName`; ethers.js uses `event.args[index]`
4. **Transaction receipts**: The receipt structures differ between the two libraries and need adaptation
5. **Provider retrieval**: web3.js reads from `window.web3.currentProvider`; ethers.js reads from `window.ethereum`

## Performance Comparison: Bundle Size and Execution Efficiency

### Bundle Size

| Library | Version | Minified | Gzipped |
|---|---|---|---|
| web3.js | 1.2.6 | ~1.1 MB | ~330 KB |
| ethers.js | 5.0.0 (full) | ~430 KB | ~120 KB |
| ethers.js | 5.0.0 (modular) | ~200 KB | ~65 KB |

ethers.js v5's tree-shaking support means you can further reduce the bundle size by importing only the features you need. For DApps sensitive to bundle size, this gap is significant.

### Execution Efficiency

ethers.js v5 has made substantial optimizations in ABI encoding/decoding and BigNumber arithmetic. In batch contract call scenarios (e.g., querying balances for 100 tokens), ethers.js's decoding speed is roughly 1.5-2x that of web3.js. This is primarily because ethers.js v5's rewritten ABI Coder uses more efficient binary operations.

```javascript
// Batch balance query performance comparison
async function batchBalanceCheck(provider, tokenAddress, addresses) {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // Concurrent queries
  const promises = addresses.map(addr => contract.balanceOf(addr));
  const balances = await Promise.all(promises);

  return balances;
}
```

## Summary

Both ethers.js and web3.js can fulfill all the requirements of DApp frontend development, but differences in design philosophy determine the quality of the development experience. ethers.js's Provider/Signer separation, native TypeScript support, smaller bundle size, and cleaner API design make it the better choice for new projects.

web3.js is not without its advantages—it is more mature, has more community documentation, and is more tightly integrated with the Truffle ecosystem. But if you are building a DApp frontend from scratch, especially one using TypeScript and modern build tools, ethers.js v5 is the more reasonable choice. Library selection is ultimately an engineering decision that should be based on the project's tech stack, team familiarity, and long-term maintenance costs, rather than simply following community trends.
