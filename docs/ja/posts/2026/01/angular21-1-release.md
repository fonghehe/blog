---
title: "Angular 21.1 正式リリース：httpResourceの安定化とSignalエコシステムの全面展開"
date: 2026-01-03 19:37:14
tags:
  - Angular
readingTime: 3
description: "Angular 21は2025年11月にSignal化移行のマイルストーンを達成し、最初のマイナーバージョンである21.1は2026年1月に大量のエコシステム安定化作業をもたらしました。最も注目されるのは`httpResource`が安定版APIに正式昇格したことと、`linkedSignal`が複雑な状態管理に深く統"
wordCount: 760
---

Angular 21は2025年11月にSignal化移行のマイルストーンを達成し、最初のマイナーバージョンである21.1は2026年1月に大量のエコシステム安定化作業をもたらしました。最も注目されるのは`httpResource`が安定版APIに正式昇格したことと、`linkedSignal`が複雑な状態管理に深く統合されたことです。

## httpResourceの全面安定化

`httpResource`はAngular 20で開発者プレビューとして登場し、2つのメジャーバージョンを経て磨き上げられた結果、21.1で安定版としてマークされました。HTTPリクエストとSignalのリアクティブシステムをシームレスに融合させます：

```typescript
import { httpResource } from "@angular/common/http";
import { computed, signal } from "@angular/core";

@Component({
  selector: "app-user-profile",
  template: `
    @if (userResource.isLoading()) {
      <app-skeleton />
    } @else if (userResource.error()) {
      <p class="error">{{ userResource.error()?.message }}</p>
    } @else {
      <app-user-card [user]="userResource.value()!" />
    }
  `,
})
export class UserProfileComponent {
  userId = signal<number>(1);

  userResource = httpResource<User>(() => ({
    url: `/api/users/${this.userId()}`,
    method: "GET",
  }));

  // userId Signalに依存し、変更時に自動的に再リクエストする
  displayName = computed(() => userResource.value()?.name ?? "読み込み中...");
}
```

21.1ではリクエスト重複排除（deduplication）とキャッシュ戦略の設定が追加されました：

```typescript
userResource = httpResource<User>(() => `/api/users/${this.userId()}`, {
  // 同じURLへの並行リクエストを自動的にマージする
  deduplicate: true,
  // 30秒キャッシュする
  cache: { ttl: 30_000 },
  // 失敗時は2回まで自動リトライする
  retry: { count: 2, delay: 1000 },
});
```

## linkedSignalの複雑なシナリオへの応用

`linkedSignal`は古典的な問題を解決します：ソースSignalが変わったとき、派生Signalはリセットが必要でありながら、ユーザーのローカル変更も保持する必要がある場合です。

```typescript
@Component({ template: `...` })
export class PaginatedListComponent {
  pageSize = signal(10);
  currentPage = signal(1);

  // pageSizeが変わったとき自動的に1ページ目にリセットする
  // しかしユーザーが手動でページ移動したときはpageSizeの影響を受けない
  page = linkedSignal({
    source: this.pageSize,
    computation: () => 1, // pageSize変更時に1にリセット
  });

  items = httpResource(() => ({
    url: "/api/items",
    params: { page: this.page(), size: this.pageSize() },
  }));

  goToPage(n: number) {
    this.page.set(n); // ユーザー操作、リセットをトリガーしない
  }

  changePageSize(size: number) {
    this.pageSize.set(size); // pageを1にリセットするトリガー
  }
}
```

## Signal DevToolsの強化

Angular DevToolsは21.1でSignalデバッグに関する大幅なアップグレードを行いました：

- **Signal依存グラフの可視化**：DevToolsパネルで各Signalの依存関係を直感的に確認できる
- **タイムトラベルデバッグ**：Signalの状態変化履歴を記録し、任意のスナップショットへのロールバックをサポート
- **パフォーマンスホットスポット検出**：頻繁にトリガーされるcomputedとeffectをマークし、過剰計算の特定を支援

```typescript
// 開発モードでは、このコードはDevToolsに完全なコールスタックを表示する
const total = computed(
  () => {
    // DevToolsはこのcomputedのすべての依存関係を追跡する
    return items().reduce((sum, item) => sum + item.price, 0);
  },
  { debugName: "cartTotal" },
); // 21.1で追加されたdebugNameオプション
```

## 移行ガイド：21.0から21.1へのアップグレード

```bash
ng update @angular/core@21.1 @angular/cli@21.1
```

21.1は完全な後方互換性を保ちます。主な変更点：

1. `httpClient.get()`などの従来のメソッドは引き続き使用可能ですが、IDEに「httpResourceへの移行を推薦」のヒントが表示されます
2. `resource()` APIの`loader`関数が`AbortSignal`をサポートするようになり、リクエストのキャンセルがよりエレガントになりました
3. `effect()`のスケジューリング戦略に`microtask`オプションが追加され、同期的な感知が必要なシナリオに適しています

## まとめ

Angular 21.1は`httpResource`とSignalツールチェーンを安定化させ、2025年の多くの「開発者プレビュー」機能をプロダクション利用可能な状態に引き上げました。強化されたDevToolsと合わせて、2026年のAngular開発体験はこれまで以上にスムーズになっています。次のバージョン21.2はSignal Formsのプロダクション実践改善に焦点を当てる予定で、注目に値します。
