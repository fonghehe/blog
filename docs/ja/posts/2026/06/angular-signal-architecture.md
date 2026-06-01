---
title: "Angular Signal Architecture 2026：状態モデリングから大規模アプリ治理まで"
date: 2026-06-01 09:27:36
tags:
  - Angular
  - アーキテクチャ
readingTime: 8
description: "SignalはAngularの新しい設計で重要な能力になった。ローカル状態、派生状態、モジュール間データフローをSignalでどう表現するか、大規模アプリでの治理提案を整理する。"
wordCount: 1902
---

AngularのSignalは新機能ではなく、アーキテクチャ設計の一部になっている。変わったのは状態更新の書き方だけではない。コンポーネント、サービス、テンプレートのデータ依存がより明確になった。大規模アプリでは、暗黙の購読を減らし、状態変化を追跡しやすくすることがSignalの価値だ。

## ローカル状態から始める

すべての状態をグローバルstoreに入れる必要はない。2026年のベストプラクティスは、状態のライフサイクルとスコープに応じてコンテナを選択することだ：

**コンポーネント内Signal（Component Signals）**
フォーム入力、ダイアログ開閉、現在のtab、ローカルフィルタ条件に適する。ライフサイクルが短く、依存範囲が明確で、コンポーネント内部に置く方が管理しやすい：

```typescript
@Component({
  selector: 'app-product-filter',
  template: `
    <input [ngModel]="searchTerm()" (ngModelChange)="searchTerm.set($event)" />
    <select [ngModel]="selectedCategory()" (ngModelChange)="selectedCategory.set($event)">
      @for (cat of categories(); track cat.id) {
        <option [value]="cat.id">{{ cat.name }}</option>
      }
    </select>
    <p>現在のフィルタ結果：{{ filteredCount() }} 件</p>
  `
})
export class ProductFilterComponent {
  // ローカル状態、コンポーネント破棄時に自動クリーンアップ
  searchTerm = signal('');
  selectedCategory = signal<string | null>(null);

  // 派生状態
  filteredCount = computed(() => {
    let items = this.products();
    const term = this.searchTerm();
    if (term) items = items.filter(p => p.name.includes(term));
    const cat = this.selectedCategory();
    if (cat) items = items.filter(p => p.categoryId === cat);
    return items.length;
  });
}
```

判断基準は明確だ：**状態が現在のコンポーネントとその直接の子コンポーネントだけに使われる場合、それはコンポーネント内に留めるべきだ。**

## サービス層Signal：ドメイン状態の管理

状態が複数のコンポーネントを跨ぐ必要がある場合、サービス層に引き上げる。ただしサービス層Signalの公開方法に注意：

```typescript
@Injectable({ providedIn: 'root' })
export class CartService {
  // 内部書き込み可能
  private items = signal<CartItem[]>([]);

  // 外部読み取り専用——外部からの直接変更を防止
  readonly itemCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0)
  );
  readonly totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0)
  );
  readonly isEmpty = computed(() => this.items().length === 0);

  // コマンドメソッド——唯一の変更エントリポイント
  addItem(product: Product, quantity = 1): void {
    this.items.update(items => {
      const existing = items.find(i => i.productId === product.id);
      if (existing) {
        return items.map(i =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...items, { productId: product.id, quantity, price: product.price }];
    });
  }

  removeItem(productId: string): void {
    this.items.update(items => items.filter(i => i.productId !== productId));
  }

  clearCart(): void {
    this.items.set([]);
  }
}
```

このパターンの重要な設計判断：
- **プライベートSignal + 公開computed**：外部は派生データのみ読み取り可能
- **コマンドメソッドが変更エントリポイント**：すべての変更に明確な呼び出し元があり、追跡とデバッグが容易
- **イミュータブル更新**：`update()`とイミュータブル操作を組み合わせ、Angularの変更検出が正しく動作することを保証

## 派生状態は純粋に保つ

`computed`はSignalシステムで最も乱用されやすい機能の一つだ。重要な原則：

**computedは「データが何であるか」を記述すべきで、「データが変わった時に何をするか」ではない。**

```typescript
// ✅ 正しい：computedは派生関係を記述
readonly canSubmit = computed(() =>
  this.form().valid && !this.submitting() && this.hasChanges()
);

readonly displayPrice = computed(() =>
  this.currency() === 'CNY'
    ? `¥${this.price().toFixed(2)}`
    : `$${(this.price() / this.exchangeRate()).toFixed(2)}`
);

readonly activeFilters = computed(() =>
  Object.entries(this.filters())
    .filter(([_, value]) => value !== null)
    .map(([key]) => key)
);

// ❌ 誤り：computed内で副作用を実行
readonly _badExample = computed(() => {
  analytics.track('price_changed', { price: this.price() }); // 副作用！
  localStorage.setItem('last_price', String(this.price()));   // 副作用！
  return this.price() * 1.1;
});
```

副作用（ネットワークリクエスト、アナリティクス、永続化、DOM操作）は`effect()`または明示的なサービスメソッドに配置すべきだ：

```typescript
constructor() {
  // effectは副作用用——「すべきこと」を明示的にマーク
  effect(() => {
    const price = this.price();
    if (price > 0) {
      analytics.track('price_updated', { price });
    }
  });
}
```

## linkedSignal：2026年の新たな利器

Angularは2026年に`linkedSignal`を導入し、「ソースSignalが変化した時に派生Signalを自動リセットする」という一般的なニーズを解決した。典型的なシナリオ：

```typescript
@Component({...})
export class ProductListComponent {
  categoryId = input.required<string>();

  // linkedSignal: categoryIdが変化した時、自動的にページ番号を1にリセット
  currentPage = linkedSignal({
    source: this.categoryId,
    computation: () => 1  // categoryIdが変わった → 最初のページに戻る
  });

  constructor() {
    effect(() => {
      console.log(`現在のカテゴリ: ${this.categoryId()}, ページ: ${this.currentPage()}`);
    });
  }

  goToPage(page: number) {
    this.currentPage.set(page);
  }
}
```

`linkedSignal`が登場する前は、このパターンは手動で`effect`内で`categoryId`の変化を監視してページ番号をリセットする必要があった——見落としやすく保守が困難だった。`linkedSignal`は「Aが変わればBがリセットされる」という関係を明示化し、コードの意図がはるかに明確になる。

## SignalとRxJSの協業

よくある誤解は「Signalを使えばRxJSは不要」というものだ。2026年の実際のベストプラクティスは：**SignalとRxJSはそれぞれ役割があり、併用が最適解である。**

| シナリオ | 推奨ツール | 理由 |
|---------|-----------|------|
| 同期状態管理 | Signal | 構文が簡潔、テンプレート親和性が高い、自動クリーンアップ |
| フォーム状態 | Signal | Angular FormsがSignalをネイティブサポート |
| 複雑な非同期ストリーム | RxJS | debounce、switchMap、combineLatestなどのオペレータは代替不能 |
| WebSocketリアルタイムデータ | RxJS → Signal | RxJSがストリームを処理し、`toSignal()`で変換してコンポーネントに提供 |
| 多ソースデータ集約 | RxJS | `combineLatest`の依存追跡がより柔軟 |
| 単純なHTTPリクエスト | `httpResource` | Angular 21+の新API、Signalネイティブサポート |

相互変換の二つのキーAPI：

```typescript
// RxJS Observable → Signal
const data = toSignal(this.dataService.getData$(), { initialValue: [] });

// Signal → RxJS Observable
const data$ = toObservable(this.mySignal);
```

推奨アーキテクチャパターン：**サービス層はRxJSで複雑な非同期オーケストレーションを処理し、コンポーネント層はSignalで消費——`toSignal()`が両者の橋渡しをする。** これは哲学的な好みではなく、純粋な工学的合理性だ：各層が最も適したツールを使用する。

## 大規模アプリでのSignal治理

プロジェクトが大規模になると、ルールのないSignalは新たな混沌の源泉になる。いくつかの実用的な治理原則：

**原則1：所有権を明確に**
- コンポーネントはUI状態Signalを所有（フォーム値、展開/折畳み、現在の選択項目）
- ドメインサービスは業務状態Signalを所有（ショッピングカート、ユーザー権限、現在の注文）
- インフラサービスは状態を所有せず、メソッドとObservableのみを公開

**原則2：書き込みエントリポイントを制御**
どのコンポーネントも共有Signalを直接変更できるようにしない。CQRSの考え方に従う：
- 読み取りは`computed`または読み取り専用Signalで公開
- 変更は明示的に命名されたメソッド（`addItem`、`removeItem`、`updateQuantity`）で実行
- ログとアナリティクスはメソッド内で集中処理

**原則3：Signalデバッグ戦略**
大規模アプリでSignalの依存チェーンを追跡するのは課題だ。推奨デバッグ方法：
- `computed`と`effect`でAngular DevToolsのSignalデバッグパネルを使用
- 重要なSignalに`effect`ログを追加（開発環境のみ）
- Angular ESLintプラグインでcomputed内の副作用実行を禁止

**原則4：Signal地獄を避ける**
Signalが便利だからといってすべてのデータをSignalにしてはいけない。静的設定データ（国リスト、省市データなど）は通常の定数の方が良い。一箇所でしか使わない派生データは、単純な関数計算の方が`computed`よりシンプルかもしれない。

## まとめ

Angular Signal Architectureの本質は、RxJSをすべて置き換えることではない。異なるタイプのリアクティブ問題を適切な場所に配置することだ。Signalは明確な同期状態とシンプルな派生関係を担当し、RxJSは複雑な非同期ストリームとリアルタイムデータオーケストレーションを継続して処理する。`linkedSignal`は「ソース-ターゲットリセット」パターンをより安全にする。大規模アプリにとってSignal治理の核心は：所有権の明確化、書き込みエントリポイントの制御、派生の純粋性維持——これらの原則は大規模ソフトウェア工学の基本原則と完全に一致する。2026年のAngularデベロッパーはSignalとRxJSの両方を習得し、どのシーンでどちらを使うかを知ることが、真の工学的成熟度である。
