---
title: "AI 结对编程 2026 工作流"
date: 2026-01-19 10:00:00
tags:
  - 工程化
readingTime: 3
description: "AI 结对编程已经超越了\"AI 写代码，人看代码\"的简单模式。2026 年的成熟工作流是分工明确的协作：人负责架构思考和业务逻辑，AI 负责实现细节和模式化代码。本文分享我日常使用的 AI 结对编程工作流。"
wordCount: 470
---

AI 结对编程已经超越了"AI 写代码，人看代码"的简单模式。2026 年的成熟工作流是分工明确的协作：人负责架构思考和业务逻辑，AI 负责实现细节和模式化代码。本文分享我日常使用的 AI 结对编程工作流。

## 驾驶员与领航员：角色分配

传统结对编程中人和人的角色切换，在人机协作中变成了"什么时候该让 AI 上"。我的原则是：探索性编码由人主导，实现性编码让 AI 上。

```typescript
// pair-programming-rules.ts
const workflowRules = {
  humanDrives: [
    '新功能的架构设计和接口定义',
    '复杂业务逻辑的拆解',
    '性能瓶颈的定位',
    '第三方集成的方案选择',
    '代码审查和质量把关',
  ],

  aiDrives: [
    '根据接口定义生成实现代码',
    '编写单元测试和集成测试',
    '类型定义和接口文档生成',
    '重复性重构（重命名、文件迁移）',
    'Bug 修复模式代码（try-catch、null check）',
  ],

  // 关键规则：AI 每次只能在一个模块内工作
  // 跨模块变更必须由人发起
  scopeBoundary: 'single-module',
};
```

## 实时协作：IDE 内的工作流

我使用 VS Code + Claude Code 扩展的组合。核心技巧不是"让 AI 补全"，而是用 structured prompts 引导 AI 理解你想做什么。

```typescript
// 场景：实现一个复杂的自定义 Hook
// 第一步：人先定义接口（AI 不碰这部分）

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

// 第二步：告诉 AI "根据上面的接口实现 useDataTable hook"
// AI 负责实现，人负责 review 和调整
```

```tsx
// AI 生成的实现
export function useDataTable<T extends { id: string }>(
  config: DataTableConfig<T>
): DataTableResult<T> {
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortState>({ column: '', direction: 'asc' });
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const pageSize = config.pageSize ?? 20;

  // 客户端模式：本地排序、过滤、分页
  const processedData = useMemo(() => {
    let result = [...config.data];

    // 过滤
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

## 代码探索与逆向理解

AI 结对的隐藏价值是帮你理解你不熟悉的代码。面对一个 3 万行的遗留系统，让 AI 帮你画出调用链和数据流。

```typescript
// 实际用法：在终端中对遗留代码提问
// $ claude "src/legacy/order-processor.ts 中的 processOrder 函数
//   的完整调用链是什么？有哪些外部依赖？哪些分支有副作用？"

// AI 的输出示例：
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
  // AI 标出的风险点
  risks: [
    '支付和库存更新不在同一个事务中，存在超卖风险',
    '支付网关调用没有重试机制和超时控制',
    '定价缓存写入失败不会中断流程，可能导致价格不一致',
  ],
};
```

## 避免 AI 结对的效率陷阱

AI 最大的效率陷阱是"过度对话"。和 AI 聊了 20 轮还没开始写代码，不如自己 10 分钟写完。我的经验是：如果 3 轮对话内 AI 还没给出可用的方案，就换一个方式——要么给更精确的 prompt，要么自己先动手。

```typescript
// 效率检查规则
const efficiencyRules = {
  // 对话轮次上限
  maxRoundsBeforeAction: 3,

  // 如果 AI 给的方案不满意，不要继续追问
  // 而是拆分问题，或者自己先写核心逻辑让 AI 补全
  onStuck: [
    '拆分任务，每次只让 AI 做一件事',
    '自己先写核心代码，让 AI 做周边工作',
    '切换模型（有时 Opus 和 Sonnet 擅长的事情不同）',
  ],

  // 记录 AI 的效率指标
  metrics: {
    'ai-suggestions-accepted': '接受的建议数 / 总建议数',
    'ai-time-to-first-usable': '从提问到获得可用代码的时间',
    'ai-vs-manual-speedup': 'AI 协助 vs 纯手动编码的时间比',
  },
};
```

## 小结

- AI 结对不是让 AI 替你思考，而是让 AI 做你不想做的重复工作
- 人定接口和架构，AI 做实现和测试，这是最高效的角色分配
- 用 AI 理解遗留代码的价值被严重低估，这是 AI 结对的隐藏杀器
- 警惕"过度对话"陷阱，3 轮没结果就换策略
- 记录效率指标，用数据驱动 AI 协作方式的优化
