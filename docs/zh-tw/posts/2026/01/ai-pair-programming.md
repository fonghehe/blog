---
title: "AI 結對程式設計 2026 工作流"
date: 2026-01-19 13:53:30
tags:
  - 工程化
readingTime: 3
description: "AI 結對程式設計已經超越了\"AI 寫程式碼，人看程式碼\"的簡單模式。2026 年的成熟工作流是分工明確的協作：人負責架構思考和業務邏輯，AI 負責實現細節和模式化程式碼。本文分享我日常使用的 AI 結對程式設計工作流。"
wordCount: 486
---

AI 結對程式設計已經超越了"AI 寫程式碼，人看程式碼"的簡單模式。2026 年的成熟工作流是分工明確的協作：人負責架構思考和業務邏輯，AI 負責實現細節和模式化程式碼。本文分享我日常使用的 AI 結對程式設計工作流。

## 駕駛員與領航員：角色分配

傳統結對程式設計中人和人的角色切換，在人機協作中變成了"什麼時候該讓 AI 上"。我的原則是：探索性編碼由人主導，實現性編碼讓 AI 上。

```typescript
// pair-programming-rules.ts
const workflowRules = {
  humanDrives: [
    '新功能的架構設計和介面定義',
    '複雜業務邏輯的拆解',
    '效能瓶頸的定位',
    '第三方整合的方案選擇',
    '程式碼審查和質量把關',
  ],

  aiDrives: [
    '根據介面定義生成實現程式碼',
    '編寫單元測試和整合測試',
    '型別定義和介面文件生成',
    '重複性重構（重新命名、檔案遷移）',
    'Bug 修復模式程式碼（try-catch、null check）',
  ],

  // 關鍵規則：AI 每次只能在一個模組內工作
  // 跨模組變更必須由人發起
  scopeBoundary: 'single-module',
};
```

## 即時協作：IDE 內的工作流

我使用 VS Code + Claude Code 擴充套件的組合。核心技巧不是"讓 AI 補全"，而是用 structured prompts 引導 AI 理解你想做什麼。

```typescript
// 場景：實現一個複雜的自定義 Hook
// 第一步：人先定義介面（AI 不碰這部分）

// types/use-data-table.ts
export interface DataTableConfig<T> {
  data: T[];
  columns: ColumnDef<T>[];
  pageSize?: number;
  sortable?: boolean;
  filterable?: boolean;
  serverSide?: {
    totalCount: number;
    onPageChange: (page: number) => void;
    onSortChange: (sort: SortState) => void;
    onFilterChange: (filter: FilterState) => void;
  };
}

export interface DataTableResult<T> {
  rows: T[];
  pagination: PaginationState;
  sorting: SortState;
  filters: FilterState;
  selectedRows: Set<string>;
  isLoading: boolean;
  // 操作方法
  selectRow: (id: string) => void;
  selectAll: () => void;
  setPage: (page: number) => void;
  setSort: (column: string, direction: 'asc' | 'desc') => void;
  setFilter: (column: string, value: unknown) => void;
}

// 第二步：告訴 AI "根據上面的介面實現 useDataTable hook"
// AI 負責實現，人負責 review 和調整
```

```tsx
// AI 生成的實現
export function useDataTable<T extends { id: string }>(
  config: DataTableConfig<T>
): DataTableResult<T> {
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortState>({ column: '', direction: 'asc' });
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const pageSize = config.pageSize ?? 20;

  // 客戶端模式：本地排序、過濾、分頁
  const processedData = useMemo(() => {
    let result = [...config.data];

    // 過濾
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== '') {
        result = result.filter((row) =>
          String((row as any)[key]).toLowerCase().includes(String(value).toLowerCase())
        );
      }
    });

    // 排序
    if (sorting.column) {
      result.sort((a, b) => {
        const aVal = (a as any)[sorting.column];
        const bVal = (b as any)[sorting.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sorting.direction === 'desc' ? -cmp : cmp;
      });
    }

    return result;
  }, [config.data, filters, sorting]);

  const rows = config.serverSide
    ? config.data
    : processedData.slice(page * pageSize, (page + 1) * pageSize);

  return {
    rows,
    pagination: {
      page,
      pageSize,
      totalCount: config.serverSide?.serverSide.totalCount ?? processedData.length,
    },
    sorting,
    filters,
    selectedRows,
    isLoading: false,
    selectRow: (id) =>
      setSelectedRows((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    selectAll: () =>
      setSelectedRows((prev) =>
        prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id))
      ),
    setPage,
    setSort: (column, direction) => setSorting({ column, direction }),
    setFilter: (column, value) => setFilters((prev) => ({ ...prev, [column]: value })),
  };
}
```

## 程式碼探索與逆向理解

AI 結對的隱藏價值是幫你理解你不熟悉的程式碼。面對一個 3 萬行的遺留系統，讓 AI 幫你畫出呼叫鏈和資料流。

```typescript
// 實際用法：在終端中對遺留程式碼提問
// $ claude "src/legacy/order-processor.ts 中的 processOrder 函式
//   的完整呼叫鏈是什麼？有哪些外部依賴？哪些分支有副作用？"

// AI 的輸出示例：
const callChainAnalysis = {
  entry: 'processOrder(order: Order)',
  callChain: [
    {
      fn: 'validateInventory(order.items)',
      sideEffects: 'none',
      external: 'Redis (stock check)',
    },
    {
      fn: 'calculatePricing(order)',
      sideEffects: 'writes to pricing cache',
      external: 'pricing-service via gRPC',
    },
    {
      fn: 'applyDiscounts(order, user)',
      sideEffects: 'reads coupon usage count, may increment it',
      external: 'PostgreSQL',
    },
    {
      fn: 'submitToPaymentGateway(payment)',
      sideEffects: 'creates payment intent',
      external: 'Stripe API',
      risk: 'network call, no retry logic',
    },
    {
      fn: 'updateInventory(order.items)',
      sideEffects: 'decrements stock',
      external: 'Redis + PostgreSQL',
      risk: 'not wrapped in transaction with payment',
    },
  ],
  // AI 標出的風險點
  risks: [
    '支付和庫存更新不在同一個事務中，存在超賣風險',
    '支付閘道器呼叫沒有重試機制和超時控制',
    '定價快取寫入失敗不會中斷流程，可能導致價格不一致',
  ],
};
```

## 避免 AI 結對的效率陷阱

AI 最大的效率陷阱是"過度對話"。和 AI 聊了 20 輪還沒開始寫程式碼，不如自己 10 分鐘寫完。我的經驗是：如果 3 輪對話內 AI 還沒給出可用的方案，就換一個方式——要麼給更精確的 prompt，要麼自己先動手。

```typescript
// 效率檢查規則
const efficiencyRules = {
  // 對話輪次上限
  maxRoundsBeforeAction: 3,

  // 如果 AI 給的方案不滿意，不要繼續追問
  // 而是拆分問題，或者自己先寫核心邏輯讓 AI 補全
  onStuck: [
    '拆分任務，每次只讓 AI 做一件事',
    '自己先寫核心程式碼，讓 AI 做周邊工作',
    '切換模型（有時 Opus 和 Sonnet 擅長的事情不同）',
  ],

  // 記錄 AI 的效率指標
  metrics: {
    'ai-suggestions-accepted': '接受的建議數 / 總建議數',
    'ai-time-to-first-usable': '從提問到獲得可用程式碼的時間',
    'ai-vs-manual-speedup': 'AI 協助 vs 純手動編碼的時間比',
  },
};
```

## 小結

- AI 結對不是讓 AI 替你思考，而是讓 AI 做你不想做的重複工作
- 人定介面和架構，AI 做實現和測試，這是最高效的角色分配
- 用 AI 理解遺留程式碼的價值被嚴重低估，這是 AI 結對的隱藏殺器
- 警惕"過度對話"陷阱，3 輪沒結果就換策略
- 記錄效率指標，用資料驅動 AI 協作方式的最佳化
