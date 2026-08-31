---
title: "智慧合約前端整合架構：Web3 DApp 的工程實踐"
date: 2026-07-29 20:28:31
tags:
  - Web3
  - 架構
readingTime: 11
description: "Web3 DApp 的前端架構與傳統 Web 應用存在根本差異：去中心化資料來源、錢包身分驗證、非同步交易確認。本文從以太坊互動層封裝、多錢包適配、ABI 型別安全、鏈上資料快取到交易狀態管理，系統梳理 DApp 前端的工程實踐。"
wordCount: 2554
---

Web3 DApp 的前端架構和傳統 Web 應用有著根本性的差異。傳統應用的資料來自中心化 API 伺服器，身分驗證靠 Cookie/Token，請求-回應模型同步且可預測。而 DApp 面對的是去中心化的區塊鏈網路：資料來源是多 RPC 節點，身分驗證依賴錢包簽名，交易提交後需要等待區塊確認——整個過程充滿了非同步性、不確定性和網路延遲。

這些差異意味著，把傳統前端架構直接套用到 DApp 上會處處碰壁。狀態管理需要處理鏈上資料的非同步同步，錯誤處理需要區分使用者拒絕簽名和鏈上交易回滾，效能最佳化需要應對大量 ABI 編解碼帶來的開銷。這篇文章從工程實踐角度，梳理一套可落地的 DApp 前端架構。

## DApp 前端架構的核心差異

先明確 DApp 前端和傳統前端的幾個關鍵區別：

**資料來源**：傳統應用從 REST/GraphQL API 取得資料，DApp 則需要從鏈上（透過 RPC 節點讀取合約狀態）和鏈下（透過 The Graph 等索引服務或後端 API）兩個管道取得資料。鏈上讀取是強一致性的（取決於區塊確認數），但延遲較高。

**身分模型**：傳統應用透過使用者名稱密碼或 OAuth 取得伺服器端簽發的 Token，DApp 的身分是錢包地址本身——使用者透過簽名證明自己擁有該地址的私鑰，不需要任何中心化註冊流程。

**寫操作模型**：傳統應用的寫操作是同步的（POST 請求立即返回結果），DApp 的寫操作是非同步的——提交交易後需要等待區塊打包，可能需要幾秒到幾分鐘，期間交易可能失敗、被替換或回滾。

**不可變性**：鏈上資料不可竄改是優勢，但也意味著前端不能像傳統應用那樣依賴後端「修復資料」。合約部署後邏輯不可更改，前端必須做好版本相容。

這些差異決定了 DApp 前端需要一個專門的架構層來隔離區塊鏈的複雜性。

## 以太坊互動層：ethers.js v7 與 viem 的選型

以太坊前端互動層的主流選擇是 ethers.js v7 和 viem。兩者的設計哲學截然不同。

ethers.js v7 延續了傳統的 OOP 風格，Provider/Signer/Contract 都是類別實例，適合習慣物件導向思維的開發者。它的生態最成熟，文件豐富，但型別推導相對弱——很多操作需要手動型別斷言。

viem 採取了函式式設計，所有操作都是純函式，搭配 TypeScript 提供了極佳的型別推導體驗。它的套件體積更小（Tree-shaking 友善），效能在批次呼叫場景下表現更好。viem 的 Actions 模式讓你可以按需引入功能，而不是引入一個龐大的 Provider 實例。

```typescript
// viem 的函式式風格
import { createPublicClient, http, getContract, parseEther } from 'viem';
import { mainnet } from 'viem/chains';
import { erc20Abi } from 'viem/abis';

const client = createPublicClient({
  chain: mainnet,
  transport: http('https://eth-mainnet.example.com'),
});

// 型別安全：erc20Abi 提供了完整的函式簽名型別推導
const usdc = getContract({
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  abi: erc20Abi,
  client,
});

// 返回值型別自動推導為 bigint，不需要手動斷言
const balance = await usdc.read.balanceOf([
  '0x1234567890123456789012345678901234567890',
]);
console.log(balance); // bigint
```

我的建議是：新專案首選 viem。函式式設計更契合 React Hooks 和 Vue Composition API 的心智模型，型別安全也更上一層樓。但如果專案已有大量 ethers.js 程式碼積累，v7 的遷移成本需要評估——可以先用 `ethers-to-viem` 遷移工具做逐步替換。

## 錢包連接管理：多錢包適配與狀態同步

DApp 的使用者入口是錢包。錢包生態呈現多錢包並立的局面：MetaMask、WalletConnect、Coinbase Wallet、Rabby、Phantom（Solana 生態）各有使用者群體。前端需要一個統一的錢包連接管理層。

EIP-6963（多注入錢包發現協議）的普及解決了 `window.ethereum` 被最後一個注入的錢包覆蓋的問題。搭配 EIP-1193 標準，我們可以建構一個不依賴特定錢包實作的多錢包適配層。

```typescript
// wallet/connection-manager.ts
import { createStore } from 'zustand/vanilla';

interface WalletState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  address: string | null;
  chainId: number | null;
  provider: EIP1193Provider | null;
  error: Error | null;
}

interface WalletAdapter {
  name: string;
  icon: string;
  rdns: string; // EIP-6963 recommended wallet id
  connect(): Promise<{ address: string; chainId: number; provider: EIP1193Provider }>;
  disconnect(): Promise<void>;
  getProvider(): EIP1193Provider | null;
}

// EIP-6963 錢包發現
function discoverWallets(): WalletAdapter[] {
  const wallets: WalletAdapter[] = [];
  const handlers: ((event: EIP6963AnnounceProviderEvent) => void)[] = [];

  return new Promise((resolve) => {
    let timeoutId: number;

    const handler = (event: EIP6963AnnounceProviderEvent) => {
      wallets.push(createAdapter(event.detail));
    };

    window.addEventListener('eip6963:announceProvider', handler);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    // 給錢包 500ms 回應時間
    timeoutId = window.setTimeout(() => {
      window.removeEventListener('eip6963:announceProvider', handler);
      resolve(wallets);
    }, 500);
  });
}
```

狀態同步是錢包管理中最容易出 Bug 的地方。使用者可能在 DApp 執行期間切換帳戶、切換網路、甚至斷開錢包連接。這些事件需要被正確監聽並同步到應用狀態：

```typescript
// 監聽錢包事件
function setupWalletEventListeners(
  provider: EIP1193Provider,
  store: WalletStore,
) {
  provider.on('accountsChanged', (accounts: string[]) => {
    if (accounts.length === 0) {
      store.setState({ status: 'disconnected', address: null });
    } else {
      store.setState({ address: accounts[0] });
    }
  });

  provider.on('chainChanged', (chainId: string) => {
    // chainChanged 必須觸發頁面重新整理或狀態重置
    // 因為鏈切換後所有合約地址和狀態都變了
    store.setState({ chainId: parseInt(chainId, 16) });
    store.getState().onChainChanged?.();
  });

  provider.on('disconnect', () => {
    store.setState({ status: 'disconnected', address: null, provider: null });
  });
}
```

一個實踐中常見的坑：`chainChanged` 事件在某些錢包中不會自動重新整理頁面。如果你的應用快取了某個鏈上的合約資料，鏈切換後這些資料全部失效，必須強制重新整理或清除快取。

## 智慧合約 ABI 型別安全：TypeScript 型別生成

ABI（Application Binary Interface）是合約與前端互動的契約。手寫 ABI 型別既繁瑣又容易出錯。目前的標準做法是用 `wagmi/cli` 或 `typechain` 從 ABI 自動生成 TypeScript 型別。

```typescript
// wagmi.config.ts - 從 Etherscan / Foundry out 目錄拉取 ABI 並生成型別
import { defineConfig } from '@wagmi/cli';
import { etherscan } from '@wagmi/cli/plugins';

export default defineConfig({
  out: 'src/generated/',
  plugins: [
    etherscan({
      apiKey: process.env.ETHERSCAN_API_KEY!,
      contracts: [
        {
          name: 'VestingVault',
          address: {
            1: '0xabc...', // mainnet
            8453: '0xdef...', // base
          },
        },
      ],
    }),
  ],
});
```

生成的型別讓你在呼叫合約方法時獲得完整的參數和返回值型別推導。這不僅是開發體驗的提升，更是安全保障——如果合約升級後 ABI 變化，前端編譯期就能發現不相容。

## 鏈上資料讀取策略：多 RPC 節點輪詢與快取

RPC 節點是 DApp 的資料生命線。單一節點存在單點故障和速率限制風險。生產環境需要多節點 fallback 和負載平衡。

viem 的 `fallback` transport 提供了開箱即用的多節點支援：

```typescript
import { createPublicClient, fallback, http } from 'viem';
import { mainnet } from 'viem/chains';

const transport = fallback(
  [
    http('https://mainnet.infura.io/v3/xxx', { timeout: 5000 }),
    http('https://eth-mainnet.alchemyapi.io/v2/xxx', { timeout: 5000 }),
    http('https://cloudflare-eth.com', { timeout: 10000 }),
  ],
  {
    rank: true, // 自動按延遲和成功率排序
    retryCount: 2, // 每個節點重試次數
  },
);

const client = createPublicClient({ chain: mainnet, transport });
```

鏈上資料讀取的效能瓶頸在於大量 `eth_call` 請求。對於高頻讀取的資料（如代幣餘額、價格資訊），需要在前端做快取層。但快取鏈上資料有一個微妙的問題：如何知道快取過期？

區塊鏈的「快取失效」依賴於新區塊的產生。以太坊平均每 12 秒出一個區塊，所以快取的 TTL 可以設為 12 秒（一個區塊週期）。更精確的做法是訂閱 `blockNumber` 事件，新區塊到來時清除相關快取。

```typescript
// 基於區塊號的快取層
class BlockBasedCache {
  private cache = new Map<string, { value: unknown; blockNumber: bigint }>();
  private currentBlock: bigint = 0n;

  constructor(client: PublicClient) {
    // 監聽新區塊
    client.watchBlockNumber({
      onBlockNumber: (blockNumber) => {
        this.currentBlock = blockNumber;
        // 清除超過 3 個區塊的快取
        for (const [key, entry] of this.cache) {
          if (this.currentBlock - entry.blockNumber > 3n) {
            this.cache.delete(key);
          }
        }
      },
      poll: true,
      pollingInterval: 4000,
    });
  }

  async read<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && this.currentBlock - cached.blockNumber < 3n) {
      return cached.value as T;
    }
    const value = await fetcher();
    this.cache.set(key, { value, blockNumber: this.currentBlock });
    return value;
  }
}
```

對於更複雜的資料查詢（如歷史事件、聚合統計），直接 RPC 呼叫效率很低。這時應該引入 The Graph 等 Subgraph 索引服務，把鏈上事件索引成可查詢的 GraphQL API。

## 交易狀態管理與使用者回饋

交易是 DApp 中最需要精心設計使用者體驗的環節。一筆交易的完整生命週期包括：建構交易 → 估算 Gas → 發起簽名 → 等待打包 → 確認成功/失敗。整個過程可能持續數十秒，使用者需要持續的狀態回饋。

```typescript
// 交易狀態機
type TransactionStatus =
  | { stage: 'idle' }
  | { stage: 'preparing' }
  | { stage: 'estimating_gas'; estimatedGas?: bigint }
  | { stage: 'awaiting_signature' }
  | { stage: 'submitted'; hash: string }
  | { stage: 'confirming'; hash: string; confirmations: number }
  | { stage: 'success'; hash: string; receipt: TransactionReceipt }
  | { stage: 'failed'; hash: string; error: TransactionError }
  | { stage: 'rejected'; error: UserRejectedError };

async function executeTransaction(
  walletClient: WalletClient,
  params: WriteContractParameters,
  onStatusChange: (status: TransactionStatus) => void,
): Promise<TransactionStatus> {
  try {
    onStatusChange({ stage: 'preparing' });

    // Gas 估算
    onStatusChange({ stage: 'estimating_gas' });
    const gasEstimate = await walletClient.estimateGas(params);
    // 加 20% buffer，防止鏈上狀態變化導致 Gas 不足
    const gas = (gasEstimate * 120n) / 100n;
    onStatusChange({ stage: 'estimating_gas', estimatedGas: gas });

    // 請求使用者簽名
    onStatusChange({ stage: 'awaiting_signature' });
    const hash = await walletClient.writeContract({ ...params, gas });

    // 等待打包
    onStatusChange({ stage: 'submitted', hash });
    const receipt = await waitForTransactionReceipt(walletClient, { hash });

    if (receipt.status === 'success') {
      onStatusChange({ stage: 'success', hash, receipt });
      return { stage: 'success', hash, receipt };
    } else {
      onStatusChange({ stage: 'failed', hash, error: { code: 'REVERTED' } });
      return { stage: 'failed', hash, error: { code: 'REVERTED' } };
    }
  } catch (error) {
    if (isUserRejectedError(error)) {
      onStatusChange({ stage: 'rejected', error });
      return { stage: 'rejected', error };
    }
    throw error;
  }
}
```

UI 層需要根據交易狀態顯示不同的回饋：`awaiting_signature` 時提示「請在錢包中確認」，`submitted` 時顯示交易雜湊和區塊瀏覽器連結，`confirming` 時顯示確認進度。這些狀態回饋不是可選項——沒有它們，使用者會以為 DApp 卡死了。

## Gas 費估算與最佳化

Gas 費是 DApp 使用者體驗的痛點之一。前端能做的最佳化包括：

**EIP-1559 的 Gas 預估**：不再使用 `gasPrice`，而是用 `maxFeePerGas` 和 `maxPriorityFeePerGas`。viem 的 `estimateFeesPerGas` 會返回當前網路的建議費率。

**批次交易**：如果一筆操作涉及多次合約呼叫，考慮使用 multicall 合約（如 Multicall3）把多次呼叫合併為一筆交易，分攤 Gas 成本。

**L2 優先**：對於高頻互動場景，優先部署到 Layer 2（Base、Arbitrum、Optimism），Gas 費可以降低一到兩個數量級。前端需要優雅地提示使用者切換到正確的鏈。

## 完整的合約互動封裝層

把前面的各個部分組合起來，一個完整的合約互動封裝層如下：

```typescript
// lib/contract-manager.ts
import {
  createPublicClient,
  createWalletClient,
  custom,
  fallback,
  http,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { mainnet, base } from 'viem/chains';
import { getContract } from 'viem';
import type { Abi } from 'viem';

interface ContractManagerConfig {
  abi: Abi;
  address: Record<number, `0x${string}`>;
  chains?: typeof mainnet[];
}

export function createContractManager<TAbi extends Abi>(
  config: ContractManagerConfig,
) {
  const chains = config.chains ?? [mainnet, base];
  const clients = new Map<number, { public: PublicClient; wallet: WalletClient | null }>();

  // 為每條鏈建立 public client
  for (const chain of chains) {
    const transport = fallback([
      http(`https://${chain.id}.example-rpc.com`),
      http(`https://${chain.id}.fallback-rpc.com`),
    ]);
    clients.set(chain.id, {
      public: createPublicClient({ chain, transport }),
      wallet: null,
    });
  }

  function getContractForChain(chainId: number, walletClient?: WalletClient) {
    const entry = clients.get(chainId);
    if (!entry) throw new Error(`Unsupported chain: ${chainId}`);
    const address = config.address[chainId];
    if (!address) throw new Error(`No contract address for chain ${chainId}`);

    return getContract({
      address,
      abi: config.abi,
      client: {
        public: entry.public,
        wallet: walletClient ?? entry.wallet ?? undefined,
      },
    });
  }

  return { getContractForChain, clients };
}
```

## DApp 前端效能挑戰

DApp 前端的效能瓶頸和傳統應用不同：

**Bundle 體積**：viem/ethers.js 本身不小，加上多鏈設定和 ABI 檔案，首屏 JS 容易膨脹。解決方案是按鏈 lazy load——使用者連接前只載入錢包發現邏輯，連接後再按需載入對應鏈的設定。

**大量 `eth_call` 的並行控制**：如果一個頁面需要讀取 20 個合約的狀態，20 個並行 RPC 請求會觸發節點速率限制。用 Multicall3 合約把多次 `eth_call` 合併成一次。

**WebSocket vs HTTP 輪詢**：即時監聽鏈上事件可以用 WebSocket（更及時）或 HTTP 輪詢（更穩定）。生產環境建議用 HTTP 輪詢為主、WebSocket 為輔——WebSocket 在網路不穩定時頻繁斷開重連，維護成本高於輪詢。

## 優缺點分析與實踐建議

這套架構的優勢在於：關注點分離清晰（互動層、錢包層、狀態層各司其職），型別安全貫穿全鏈路，多鏈和多錢包支援可擴展。代價是初始搭建成本較高——對於簡單的單鏈 DApp 可能過度設計。

幾個實踐建議：

1. **不要在業務元件中直接呼叫 viem/ethers.js**，統一透過封裝層存取，方便後續替換底層套件庫
2. **交易狀態必須對使用者可見**，每一階段都要有 UI 回饋
3. **RPC 節點至少設定 3 個來源**，分屬不同服務商
4. **ABI 型別生成納入 CI**，合約升級後自動檢測 ABI 變更
5. **錯誤資訊要區分使用者可操作的（如餘額不足）和系統級的（如 RPC 節點故障）**

## 小結

Web3 DApp 的前端架構核心挑戰在於：處理區塊鏈網路的非同步性和不確定性、適配多錢包多鏈生態、保證合約互動的型別安全。選擇 viem 作為互動層、用 EIP-6963 做錢包發現、用自動生成的 ABI 型別保證型別安全、用基於區塊號的快取最佳化讀取效能、用狀態機管理交易生命週期——這些組合在一起，構成了一套可落地的 DApp 前端工程方案。DApp 前端不需要重新發明輪子，但需要把傳統前端的每個環節都重新審視一遍，因為底層假設已經完全不同了。
