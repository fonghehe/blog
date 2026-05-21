---
title: "AIペアプログラミング 2026 ワークフロー"
date: 2026-01-19 10:00:00
tags:
  - エンジニアリング
readingTime: 4
description: "AIペアプログラミングは、「AIがコードを書いて人間が確認する」というシンプルなモデルを超えました。2026年の成熟したワークフローは、明確な役割分担による協業です。人間はアーキテクチャの思考とビジネスロジックを担当し、AIは実装の詳細とボイラープレートコードを担当します。本記事では、私が日常で使っているAIペアプログ"
wordCount: 790
---

AIペアプログラミングは、「AIがコードを書いて人間が確認する」というシンプルなモデルを超えました。2026年の成熟したワークフローは、明確な役割分担による協業です。人間はアーキテクチャの思考とビジネスロジックを担当し、AIは実装の詳細とボイラープレートコードを担当します。本記事では、私が日常で使っているAIペアプログラミングのワークフローをご紹介します。

## ドライバーとナビゲーター：役割分担

従来のペアプログラミングでの人と人の役割交代は、人機協業では「いつAIに任せるか」という判断になります。私の原則は：探索的なコーディングは人間主導、実装コーディングはAIに任せる、です。

```typescript
// pair-programming-rules.ts
const workflowRules = {
  humanDrives: [
    "新機能のアーキテクチャ設計とインターフェース定義",
    "複雑なビジネスロジックの分解",
    "パフォーマンスボトルネックの特定",
    "サードパーティ統合の方針選択",
    "コードレビューと品質管理",
  ],

  aiDrives: [
    "インターフェース定義から実装コードを生成",
    "単体テストと統合テストの作成",
    "型定義とインターフェースドキュメントの生成",
    "反復的なリファクタリング（リネーム、ファイル移動）",
    "バグ修正のボイラープレート（try-catch、nullチェック）",
  ],

  // 重要なルール：AIは一度に一つのモジュール内でのみ作業する
  // モジュールをまたぐ変更は必ず人間が開始する
  scopeBoundary: "single-module",
};
```

## リアルタイム協業：IDE内のワークフロー

私はVS Code + Claude Code拡張機能の組み合わせを使っています。核心的なテクニックは「AIに補完させる」ことではなく、構造化されたプロンプトでAIが何をしたいかを理解するよう導くことです。

```typescript
// シナリオ：複雑なカスタムHookの実装
// ステップ1：まず人間がインターフェースを定義する（AIはこの部分に触れない）

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
  // 操作メソッド
  selectRow: (id: string) => void;
  selectAll: () => void;
  setPage: (page: number) => void;
  setSort: (column: string, direction: "asc" | "desc") => void;
  setFilter: (column: string, value: unknown) => void;
}

// ステップ2：「上記のインターフェースに基づいてuseDataTableフックを実装して」とAIに伝える
// AIが実装を担当し、人間がレビューと調整を行う
```

```tsx
// AI生成の実装
export function useDataTable<T extends { id: string }>(
  config: DataTableConfig<T>,
): DataTableResult<T> {
  const [page, setPage] = useState(0);
  const [sorting, setSorting] = useState<SortState>({
    column: "",
    direction: "asc",
  });
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const pageSize = config.pageSize ?? 20;

  // クライアントサイドモード：ローカルソート、フィルタリング、ページネーション
  const processedData = useMemo(() => {
    let result = [...config.data];

    // フィルタリング
    Object.entries(filters).forEach(([key, value]) => {
      if (value != null && value !== "") {
        result = result.filter((row) =>
          String((row as any)[key])
            .toLowerCase()
            .includes(String(value).toLowerCase()),
        );
      }
    });

    // ソート
    if (sorting.column) {
      result.sort((a, b) => {
        const aVal = (a as any)[sorting.column];
        const bVal = (b as any)[sorting.column];
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sorting.direction === "desc" ? -cmp : cmp;
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
      totalCount:
        config.serverSide?.serverSide.totalCount ?? processedData.length,
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
        prev.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)),
      ),
    setPage,
    setSort: (column, direction) => setSorting({ column, direction }),
    setFilter: (column, value) =>
      setFilters((prev) => ({ ...prev, [column]: value })),
  };
}
```

## コード探索とリバース理解

AIペアプログラミングの隠れた価値は、不慣れなコードの理解を助けることです。3万行のレガシーシステムに直面したとき、AIにコールチェーンとデータフローをマッピングしてもらいましょう。

```typescript
// 実際の使用例：ターミナルでレガシーコードについて質問する
// $ claude "src/legacy/order-processor.ts の processOrder 関数の
//   完全なコールチェーンは何ですか？
//   外部依存関係は何ですか？副作用がある分岐はどれですか？"

// AIの出力例：
const callChainAnalysis = {
  entry: "processOrder(order: Order)",
  callChain: [
    {
      fn: "validateInventory(order.items)",
      sideEffects: "none",
      external: "Redis (在庫チェック)",
    },
    {
      fn: "calculatePricing(order)",
      sideEffects: "価格キャッシュへの書き込み",
      external: "pricing-service via gRPC",
    },
    {
      fn: "applyDiscounts(order, user)",
      sideEffects: "クーポン使用回数の読み取り、インクリメントの可能性あり",
      external: "PostgreSQL",
    },
    {
      fn: "submitToPaymentGateway(payment)",
      sideEffects: "支払いインテントの作成",
      external: "Stripe API",
      risk: "ネットワーク呼び出し、リトライロジックなし",
    },
    {
      fn: "updateInventory(order.items)",
      sideEffects: "在庫の減算",
      external: "Redis + PostgreSQL",
      risk: "支払いと同一トランザクション内にない",
    },
  ],
  // AIが指摘したリスクポイント
  risks: [
    "支払いと在庫更新が同一トランザクション内にない——在庫超過リスク",
    "決済ゲートウェイ呼び出しにリトライ機構とタイムアウト制御がない",
    "価格キャッシュ書き込み失敗がフローを中断しない——価格不整合の可能性",
  ],
};
```

## AIペアプログラミングの効率性の落とし穴を避ける

AIの最大の効率上の落とし穴は「会話のしすぎ」です。AIと20回やり取りしてもコードを書き始めないより、自分で10分で書く方がましです。私の経験則：3回のやり取りでAIが使えるソリューションを出せなければ、方法を変える——より精確なプロンプトを書くか、自分でコアロジックを書き始めるかです。

```typescript
// 効率チェックルール
const efficiencyRules = {
  // 行動を起こす前の最大対話回数
  maxRoundsBeforeAction: 3,

  // AIの案が使えない場合は追加質問を続けない
  // タスクを分割するか、自分でコアロジックを書いてAIに周辺部分を補完させる
  onStuck: [
    "タスクを分割し、一度にAIに一つのことだけをさせる",
    "自分でコアコードを書き、AIに周辺作業をさせる",
    "モデルを切り替える（OpusとSonnetが得意なことは異なる場合がある）",
  ],

  // AI効率指標の記録
  metrics: {
    "ai-suggestions-accepted": "採用した提案数 / 総提案数",
    "ai-time-to-first-usable": "質問から使えるコード取得までの時間",
    "ai-vs-manual-speedup": "AIアシストと純手動コーディングの時間比",
  },
};
```

## まとめ

- AIペアプログラミングはAIに代わりに考えさせることではなく、やりたくない繰り返し作業をさせること
- 人間がインターフェースとアーキテクチャを決め、AIが実装とテストを行う——これが最も効率的な役割分担
- レガシーコード理解にAIを使う価値は過小評価されている——これはAIペアプログラミングの隠れた切り札
- 「会話のしすぎ」の落とし穴に注意——3回で結果が出なければ戦略を変える
- 効率指標を記録し、データを基にAI協業スタイルを改善する
