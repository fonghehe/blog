---
title: "Angular 19.1：インクリメンタルハイドレーションの安定化とlinkedSignalの進展"
date: 2025-01-02 16:56:33
tags:
  - Angular
readingTime: 3
description: "Angular 19.1は2025年1月にリリースされたAngular 19シリーズの最初のマイナーバージョンです。重点は、Angular 19で導入された実験的な機能を安定化へと推進することにあります。インクリメンタルハイドレーション（Incremental Hydration）が開発者プレビューの安定版に昇格し、`"
wordCount: 575
---

Angular 19.1は2025年1月にリリースされたAngular 19シリーズの最初のマイナーバージョンです。重点は、Angular 19で導入された実験的な機能を安定化へと推進することにあります。インクリメンタルハイドレーション（Incremental Hydration）が開発者プレビューの安定版に昇格し、`linkedSignal()`のAPIがフィードバックをもとに修正され、Zonelessモードも引き続き磨き上げられています。

## インクリメンタルハイドレーション：実験的から開発者プレビューへ

Angular 19.0のインクリメンタルハイドレーションは実験的とマークされていました。Angular 19.1はコミュニティのフィードバックをもとに改善を行い、開発者プレビュー（Developer Preview）に昇格させました。

```typescript
// 19.1 以降の推奨方法（19.0 と同じ API だが安定性が向上）
import {
  provideClientHydration,
  withIncrementalHydration,
} from "@angular/platform-browser";

export const appConfig: ApplicationConfig = {
  providers: [provideClientHydration(withIncrementalHydration())],
};
```

19.1で修正された主な問題：

```html
<!-- 19.0 の既知の問題：@defer ブロックがネストされた際のハイドレーション順序が不安定 -->
<!-- 19.1 修正：ネストされた @defer のハイドレーション順序が正確になった -->
@defer (hydrate on viewport) {
<outer-component>
  @defer (hydrate on interaction) {
  <inner-component />
  <!-- 19.0 では outer より先にハイドレーションされることがあった。19.1 で修正済み -->
  }
</outer-component>
}
```

## linkedSignal：APIの簡素化とドキュメントの充実

コミュニティのトライアルを経て、Angularチームは`linkedSignal()`に細かな調整を加えました。

```typescript
// 19.0 の2つの書き方はどちらも維持（短縮形とオブジェクト形式）
import { linkedSignal } from "@angular/core";

// 短縮形（最も一般的）：ソースが変わると再計算
const selectedItem = linkedSignal(() => items()[0] ?? null);

// オブジェクト形式（前の値にアクセスする必要がある場合）：
const currentPage = linkedSignal<number>({
  source: () => ({ query: searchQuery(), pageSize: pageSize() }),
  computation: (source, previous) => {
    // クエリが変わったら1ページ目にリセット、そうでなければ現在のページを維持
    if (!previous || previous.source.query !== source.query) return 1;
    return Math.min(previous.value, Math.ceil(totalItems() / source.pageSize));
  },
});

// 19.1 新機能：linkedSignal が初期値引数を受け取れるようになった（source 関数に頼らず）
const count = linkedSignal({
  source: externalCount, // Signal<number>
  computation: (val) => val * 2,
});
```

## Signal Effectのクリーンアップ機構の改善

Angular 19.1は`effect()`のリソースクリーンアップAPIを改善しました。

```typescript
import { effect, inject, DestroyRef } from '@angular/core';

@Component({ standalone: true, ... })
export class DataStreamComponent {
  private ws: WebSocket | null = null;

  constructor() {
    const destroyRef = inject(DestroyRef);

    effect((onCleanup) => {
      const url = this.wsUrl();
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.onmessage = (evt) => this.messages.update(m => [...m, evt.data]);

      // 19.1 改善：onCleanup の型がより正確になり、async クリーンアップ関数をサポート
      onCleanup(() => {
        ws.close();
        this.ws = null;
      });
    });
  }

  messages = signal<string[]>([]);
  wsUrl = input.required<string>();
}
```

## テンプレートの型チェック強化

Angular 19.1はSignal式の型チェックを強化しました。

```typescript
@Component({
  standalone: true,
  template: `
    <!-- 19.1 以前：コンパイラが Signal のネストアクセスの型を正確にチェックできなかった -->
    <!-- 19.1 以降：user()?.profile?.avatar の型を正確に推論 -->
    <img [src]="user()?.profile?.avatar ?? defaultAvatar" />

    <!-- @for track 式の型も改善 -->
    @for (item of items(); track item.id) {
      {{ item.name }}
    }
  `,
})
export class UserCardComponent {
  user = input<User | null>(null);
  items = input.required<{ id: string; name: string }[]>();
  defaultAvatar = "/assets/default-avatar.png";
}
```

## 19.1へのアップグレード

```bash
ng update @angular/core@19.1 @angular/cli@19.1

# 変更ログを確認
npx ng-update --list
```

Angular 19.xシリーズは月次ペースでマイナーバージョンをリリースし（19.1 → 19.2 → 19.3）、各バージョンでAngular 20（2025年5月予定）に向けた安定性を積み重ねています。

## まとめ

Angular 19.1は「固めの」バージョンです——インクリメンタルハイドレーションが開発者プレビューに昇格したことで、プリプロダクション環境での検証が開始できます。`linkedSignal`のAPIもより洗練されました。Angular 19.0で実験的なラベルのためにインクリメンタルハイドレーションを様子見していたなら、19.1は評価を始める良いタイミングです。
