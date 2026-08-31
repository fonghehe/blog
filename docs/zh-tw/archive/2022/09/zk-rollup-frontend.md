---
title: "zkSync 前端集成：零知識證明 Layer2 交互"
date: 2022-09-19 13:53:40
tags:
  - Web3
  - Blockchain
readingTime: 9
description: "zkSync 2.0 (era) 原生支持賬戶抽象和 Paymaster，前端集成方式與 EVM Layer1 有顯著差異。本文覆蓋 zkSync 前端開發的完整鏈路，從 SDK 使用到 Paymaster 集成。"
wordCount: 1214
---

zkSync 2.0（後更名為 zkSync Era）是 Matter Labs 開發的 zkRollup 方案，主網已上線。與 Optimistic Rollup 不同，zkSync 使用零知識證明（具體為 PLONK 證明系統）來保證 L2 狀態的有效性，提款不需要 7 天挑戰期。更重要的是，zkSync 從底層就原生支持賬戶抽象（Account Abstraction）和 Paymaster（Gas 代付），這使得前端交互模型與傳統 EVM 有顯著差異。

## zkSync Era 概述與 zkRollup 原理

### 零知識證明如何保證安全性

zkRollup 的核心思路是：L2 執行所有交易後，生成一個證明（proof），證明這些交易的執行是正確的。L1 只需要驗證這個證明，而不需要重新執行所有交易。

```
L2 批量執行交易 → 生成 ZK Proof → 提交到 L1 → L1 驗證 Proof → 狀態確認
```

與 Optimistic Rollup 的關鍵區別：

- **OR**：假設所有交易有效，除非有人提交欺詐證明（7 天挑戰期）
- **ZKR**：通過數學證明保證交易有效，不需要挑戰期

這意味著 zkSync 的 L2 → L1 提款只需要等待證明被 L1 驗證（通常幾小時），而非 7 天。

### zkSync Era 的 EVM 兼容性

zkSync Era 不是 EVM 等效（EVM-equivalent），而是 EVM 兼容（EVM-compatible）。區別在於：

- **EVM 等效**（如 Optimism Bedrock）：字節碼完全一致，現有合約可以直接部署
- **EVM 兼容**（如 zkSync）：支持 Solidity 語法，但編譯為目標不同的虛擬機（zkEVM）

因此，部分操作碼在 zkSync 上不可用或行為不同（如 `SELFDESTRUCT`、`CALLCODE`），需要特別注意。

## 賬戶抽象在 zkSync 上的原生支持

zkSync Era 原生支持 EIP-4337 風格的賬戶抽象，不需要額外的 EntryPoint 合約。每個賬戶都可以是智能合約錢包，支持自定義簽名驗證和交易執行邏輯。

```typescript
// zkSync 上的賬戶可以是：
// 1. EOAs（外部擁有賬戶）—— 與以太坊一致
// 2. 智能合約賬戶 —— 原生支持，無需 EntryPoint

// 這意味著前端可以支持：
// - 社交登錄錢包（無需助記詞）
// - 多籤錢包（原生支持，非插件式）
// - Session Key（臨時授權密鑰）
// - Gas 代付（通過 Paymaster）
```

## Paymaster：Gas 費代付機制

Paymaster 是 zkSync 上最具特色的功能之一。它允許第三方為用戶支付 Gas 費，用戶可以用 ERC-20 代幣（而非 ETH）支付 Gas，甚至完全免費。

### Paymaster 的工作原理

```
用戶發起交易 → zkSync 協議檢查是否有 Paymaster → Paymaster 支付 Gas
                                                      ↓
                                              用戶按約定補償（可選）
```

### 前端集成 Paymaster

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

async function sendTransactionWithPaymaster(
  wallet: Wallet,
  to: string,
  data: string,
  paymasterAddress: string
) {
  // 構建交易
  const tx = {
    to,
    data,
    from: wallet.address,
    // 指定 Paymaster
    customData: {
      paymasterParams: {
        paymaster: paymasterAddress,
        paymasterInput: '0x', // Paymaster 特定的輸入
      },
      // 如果用 ERC-20 支付 Gas，還需要指定 gasPerPubdata
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  // 估算 gas（包含 Paymaster 邏輯）
  const gasEstimate = await wallet.estimateGas(tx)

  // 發送交易
  const txHash = await wallet.sendTransaction({
    ...tx,
    gasLimit: gasEstimate,
  })

  return txHash
}

// 使用 ERC-20 代幣支付 Gas 的 Paymaster
async function payGasWithToken(
  wallet: Wallet,
  tokenAddress: string,
  paymasterAddress: string
) {
  const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
    type: 'ERC20',
    token: tokenAddress,
    // Paymaster 允許的最低匯率
    minAllowance: ethers.BigNumber.from('100'),
  })

  const tx = {
    to: wallet.address,
    value: 0,
    customData: {
      paymasterParams,
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  }

  const gasEstimate = await wallet.estimateGas(tx)
  return wallet.sendTransaction({ ...tx, gasLimit: gasEstimate })
}
```

## zksync-web3 SDK 使用

`zksync-web3` 是 zkSync 官方的 JavaScript SDK，API 設計與 ethers.js 高度兼容，但增加了 zkSync 特有的功能。

### 基礎使用

```typescript
import { Wallet, Provider, utils } from 'zksync-web3'
import { ethers } from 'ethers'

// 初始化 Provider
const zkSyncProvider = new Provider('https://zksync-era-mainnet.chainstacklabs.com')
const ethereumProvider = new ethers.providers.JsonRpcProvider(
  'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY'
)

// 從以太坊錢包創建 zkSync 錢包
const ethWallet = new ethers.Wallet(PRIVATE_KEY, ethereumProvider)
const zkSyncWallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethWallet)

// 查詢餘額
const ethBalance = await zkSyncWallet.getBalance()
const tokenBalances = await zkSyncWallet.getBalances()

// L1 -> L2 充值
async function depositETH(amount: string) {
  const tx = await zkSyncWallet.deposit({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
    // 可選：refundRecipient
  })

  // 等待 L1 交易確認
  await tx.wait()

  // 等待 L2 上反映（通常需要幾分鐘）
  await tx.waitFinalize()

  return tx
}

// L2 轉賬
async function transfer(token: string, to: string, amount: string) {
  const tx = await zkSyncWallet.transfer({
    to,
    token,
    amount: ethers.utils.parseEther(amount),
  })

  await tx.wait()
  return tx
}

// L2 -> L1 提款
async function withdrawETH(amount: string) {
  const tx = await zkSyncWallet.withdraw({
    token: utils.ETH_ADDRESS,
    amount: ethers.utils.parseEther(amount),
    to: zkSyncWallet.address,
  })

  // L2 交易確認（通常幾秒）
  await tx.wait()

  // 注意：雖然不需要 7 天挑戰期
  // 但仍需等待 ZK Proof 被驗證（幾小時）
  // 用戶不需要手動 finalize！
  return tx
}
```

### ethers v6 adapter

對於需要使用 ethers v6 的項目，zkSync 提供了適配器：

```typescript
import { ethers } from 'ethers'
import { ZkSyncEthersAdapter } from 'zksync-web3'

const adapter = new ZkSyncEthersAdapter({
  zkSyncProvider,
  ethProvider,
})

// 通過 adapter 使用 ethers v6 的 Contract
const contract = adapter.getContract(
  contractAddress,
  abi,
  zkSyncWallet
)

// 調用合約方法與 ethers v6 一致
const tx = await contract.transfer(recipient, amount)
await tx.wait()
```

## 合約部署到 zkSync

### 編譯器差異

zkSync 使用自己的編譯器 `zksolc`，而非標準的 `solc`。`zksolc` 接受 `solc` 的輸出作為輸入，然後編譯為 zkEVM 字節碼。

```bash
# 安裝 zksolc
npm install -g @matterlabs/zksolc-bin

# 編譯合約
zksolc --combined-json bin,abi contracts/MyContract.sol
```

### 使用 Hardhat 插件部署

```typescript
// hardhat.config.ts
import '@matterlabs/hardhat-zksync-deploy'
import '@matterlabs/hardhat-zksync-solc'

export default {
  solidity: {
    version: '0.8.17',
  },
  zksolc: {
    version: '1.3.1',
    compilerSource: 'binary',
    settings: {
      optimizer: {
        enabled: true,
        mode: 'z',
      },
    },
  },
  networks: {
    zkSyncTestnet: {
      url: 'https://zksync2-testnet.zksync.dev',
      ethNetwork: 'goerli',
      zksync: true,
    },
    zkSyncMainnet: {
      url: 'https://zksync2-mainnet.zksync.io',
      ethNetwork: 'mainnet',
      zksync: true,
    },
  },
}
```

```typescript
// deploy/deploy.ts
import { Wallet, utils, ContractFactory } from 'zksync-web3'
import * as ethers from 'ethers'
import { readFileSync } from 'fs'

async function deploy() {
  const wallet = new Wallet(PRIVATE_KEY, zkSyncProvider, ethProvider)

  // 讀取編譯後的 ABI 和字節碼
  const artifact = JSON.parse(
    readFileSync('./artifacts/MyContract.json', 'utf8')
  )

  const factory = new ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  )

  // 部署合約
  const contract = await factory.deploy(
    constructorArg1,
    constructorArg2
  )

  await contract.deployed()
  console.log('Contract deployed to:', contract.address)
}

deploy()
```

## 前端網絡配置與 MetaMask 集成

### MetaMask 添加 zkSync 網絡

```typescript
// lib/network.ts
export const ZK_SYNC_MAINNET = {
  chainId: '0x144', // 324
  chainName: 'zkSync Era Mainnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-mainnet.zksync.io'],
  blockExplorerUrls: ['https://explorer.zksync.io'],
}

export const ZK_SYNC_TESTNET = {
  chainId: '0x118', // 280
  chainName: 'zkSync Era Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://zksync2-testnet.zksync.dev'],
  blockExplorerUrls: ['https://goerli.explorer.zksync.io'],
}

export async function switchToZkSync(
  provider: ethers.providers.Web3Provider
) {
  try {
    await provider.send('wallet_switchEthereumChain', [
      { chainId: ZK_SYNC_MAINNET.chainId },
    ])
  } catch (switchError: any) {
    // 鏈尚未添加到 MetaMask
    if (switchError.code === 4902) {
      await provider.send('wallet_addEthereumChain', [ZK_SYNC_MAINNET])
    } else {
      throw switchError
    }
  }
}
```

### 前端連接 zkSync 錢包

```typescript
// hooks/useZkSyncWallet.ts
import { useState, useEffect } from 'react'
import { Provider, Wallet } from 'zksync-web3'
import { ethers } from 'ethers'

export function useZkSyncWallet() {
  const [account, setAccount] = useState<string | null>(null)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [l1Provider, setL1Provider] =
    useState<ethers.providers.Web3Provider | null>(null)

  useEffect(() => {
    if (typeof window.ethereum === 'undefined') return

    const ethProvider = new ethers.providers.Web3Provider(
      window.ethereum
    )
    const zkProvider = new Provider(
      'https://zksync2-mainnet.zksync.io'
    )

    setL1Provider(ethProvider)
    setProvider(zkProvider)

    // 檢查已連接的賬戶
    ethProvider.listAccounts().then((accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0])
      }
    })

    // 監聽賬戶切換
    window.ethereum.on('accountsChanged', (accounts: string[]) => {
      setAccount(accounts[0] || null)
    })

    // 監聽鏈切換
    window.ethereum.on('chainChanged', () => {
      window.location.reload()
    })
  }, [])

  const connect = async () => {
    if (!l1Provider) return
    const accounts = await l1Provider.send('eth_requestAccounts', [])
    setAccount(accounts[0])
  }

  return { account, provider, l1Provider, connect }
}
```

## L1 <-> L2 消息傳遞

zkSync 支持 L1 和 L2 之間的雙向消息傳遞。與 Optimistic Rollup 不同，L2 → L1 的消息不需要 7 天挑戰期，但需要等待 ZK Proof 驗證。

### L1 → L2 消息

```typescript
// 從 L1 向 L2 發送消息（不僅僅是存款）
async function sendL1ToL2Message(
  l1Wallet: ethers.Wallet,
  zkSyncProvider: Provider,
  l2ContractAddress: string,
  calldata: string
) {
  // 使用 zkSync 的 Mailbox 合約
  const mailboxAddress = '0x...'
  const mailbox = new ethers.Contract(
    mailboxAddress,
    [
      'function requestL2Transaction(address _contract, uint256 _l2Value, bytes _calldata, uint256 _l2GasLimit, uint256 _l2GasPerPubdataByteLimit, bytes[] _factoryDeps, address _refundRecipient) external payable',
    ],
    l1Wallet
  )

  const tx = await mailbox.requestL2Transaction(
    l2ContractAddress,
    0, // L2 value
    calldata,
    1_000_000, // L2 gas limit
    800, // gas per pubdata byte
    [], // factory deps
    l1Wallet.address // refund recipient
  )

  await tx.wait()

  // 等待 L2 上執行
  const l2TxHash = await zkSyncProvider.getL2TxHashFromPriorityOp(tx)
  await zkSyncProvider.wait(l2TxHash)

  return { l1TxHash: tx.hash, l2TxHash }
}
```

### L2 → L1 消息

```typescript
// 從 L2 向 L1 發送消息
async function sendL2ToL1Message(
  zkSyncWallet: Wallet,
  l1ContractAddress: string,
  calldata: string
) {
  const tx = await zkSyncWallet.sendTransaction({
    to: l1ContractAddress,
    data: calldata,
    // L1 gas limit
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    },
  })

  await tx.wait()
  return tx.hash
}
```

## zkSync DApp 前端完整模塊

```typescript
// lib/zkSyncDApp.ts
import { Provider, Wallet, utils, types } from 'zksync-web3'
import { ethers, BigNumber } from 'ethers'

export class ZkSyncDApp {
  private provider: Provider
  private l1Provider: ethers.providers.JsonRpcProvider
  private wallet: Wallet | null = null

  constructor(
    zkSyncRpcUrl: string,
    l1RpcUrl: string
  ) {
    this.provider = new Provider(zkSyncRpcUrl)
    this.l1Provider = new ethers.providers.JsonRpcProvider(l1RpcUrl)
  }

  // 連接錢包
  connect(privateKey: string) {
    this.wallet = new Wallet(
      privateKey,
      this.provider,
      new ethers.Wallet(privateKey, this.l1Provider)
    )
  }

  // 獲取餘額（ETH + ERC-20）
  async getAllBalances(address: string) {
    const balances = await this.provider.getAllBalances(address)
    return balances
  }

  // 充值（L1 -> L2）
  async deposit(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.deposit({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L1 確認
    await tx.waitFinalize() // L2 確認

    return tx
  }

  // L2 轉賬
  async transfer(token: string, to: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.transfer({
      to,
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    return tx.wait()
  }

  // 提款（L2 -> L1）
  async withdraw(token: string, amount: string) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const tx = await this.wallet.withdraw({
      token: token === 'ETH' ? utils.ETH_ADDRESS : token,
      amount: ethers.utils.parseEther(amount),
    })

    await tx.wait() // L2 確認
    // 不需要手動 finalize！ZK Proof 驗證後自動到賬

    return tx
  }

  // 使用 Paymaster 發送交易（ERC-20 支付 Gas）
  async sendWithPaymaster(
    to: string,
    data: string,
    paymasterAddress: string,
    gasToken: string
  ) {
    if (!this.wallet) throw new Error('Wallet not connected')

    const paymasterParams = utils.getPaymasterParams(paymasterAddress, {
      type: 'ERC20',
      token: gasToken,
      minAllowance: BigNumber.from('0'),
    })

    const gasEstimate = await this.wallet.estimateGas({
      to,
      data,
      from: this.wallet.address,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    const tx = await this.wallet.sendTransaction({
      to,
      data,
      gasLimit: gasEstimate,
      customData: {
        paymasterParams,
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
      },
    })

    return tx.wait()
  }

  // 獲取交易狀態
  async getTransactionStatus(txHash: string) {
    const receipt = await this.provider.getTransactionReceipt(txHash)
    if (!receipt) return null

    return {
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      transactionIndex: receipt.transactionIndex,
      gasUsed: receipt.gasUsed.toString(),
      // zkSync 特有：公數據字節 gas
      gasPerPubdataUsed: receipt.gasPerPubdataUsed?.toString(),
    }
  }
}
```

## Gas 估算與交易確認特點

zkSync 的 Gas 模型與 L1 有顯著差異，引入了"公數據"（pubdata）的概念：

```typescript
// zkSync Gas 模型
// 總 Gas = L2 Gas + L1 Gas（用於發佈 pubdata）

// pubdata 是發佈到 L1 的數據，決定了成本
// 每筆交易有一個 gasPerPubdata 參數

async function estimateGas(
  wallet: Wallet,
  tx: types.TransactionRequest
) {
  // zkSync 特有的 Gas 估算
  const gasEstimate = await wallet.estimateGas(tx)

  // 還需要估算 pubdata gas
  const pubdataGas = await wallet.estimateGasL1ToL2(tx)

  return {
    l2Gas: gasEstimate,
    pubdataGas,
    total: gasEstimate.add(pubdataGas),
  }
}
```

交易確認特點：

- **L2 交易**：通常 1-2 秒確認（即時）
- **L1 → L2 充值**：需要 L1 確認 + L2 最終確認（幾分鐘）
- **L2 → L1 提款**：需要 ZK Proof 驗證（幾小時），但無需用戶手動 finalize

## 與 Optimistic Rollup 的前端適配差異

| 維度 | Optimistic Rollup | zkSync Era |
|------|------------------|------------|
| 提款時間 | ~7 天 | 幾小時 |
| 提款操作 | 需要手動 finalize | 自動完成 |
| Gas 支付 | 僅 ETH | ETH + ERC-20（Paymaster） |
| 賬戶模型 | EOA + 智能合約 | 原生賬戶抽象 |
| SDK | ethers.js 兼容 | zksync-web3（ethers 衍生） |
| 合約部署 | 直接部署 | 需要 zksolc 編譯 |
| 狀態輪詢 | 複雜（跨鏈） | 簡單（自動確認） |

## 小結

zkSync Era 的前端開發在許多方面比 Optimistic Rollup 簡單——提款不需要手動 finalize、不需要管理 7 天等待期的狀態機。但 zkSync 引入了新的概念：Paymaster、賬戶抽象、pubdata Gas 模型，這些都需要前端開發者學習新的交互模式。

Paymaster 是 zkSync 最具創新性的功能。它讓 DApp 可以補貼用戶的 Gas 費，或者讓用戶用穩定幣支付 Gas，這對降低用戶門檻有巨大價值。在傳統 EVM 上實現 Gas 代付需要複雜的 relayer 基礎設施，而在 zkSync 上是原生支持的能力。

SDK 的選擇上，`zksync-web3` 與 ethers v5 高度兼容，遷移成本較低。但需要注意 zkSync 特有的 `customData` 字段和 Gas 估算方式。對於已有 EVM DApp，遷移到 zkSync 的主要工作量在於：調整合約編譯流程（使用 zksolc）、適配 Paymaster、以及測試 zkEVM 兼容性（某些操作碼不可用）。

隨著 zkRollup 生態的快速發展和零知識證明技術的成熟，zkSync 代表了 Layer 2 擴容的一個重要方向。前端開發者應該熟悉這種交互模型。
