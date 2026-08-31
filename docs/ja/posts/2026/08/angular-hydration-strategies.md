---
title: "Angular 23 Hydration 上級：インクリメンタルハイドレーションと Zoneless 実践"
date: 2026-08-27 16:48:05
tags:
  - Angular
readingTime: 13
description: "Angular 23 の hydration はもはや全量アクティベーションだけではない。本記事では @defer hydrate トリガー、選択的ハイドレーション境界、zoneless との連携、TBT/INP 測定、コンテンツページとダッシュボードの異なる戦略について、マーケティングサイトの移行における実データと落とし穴の経験を記録する。"
wordCount: 3537
---

Angular 17 は SSR hydration を導入し、長年の re-render flicker 問題を解決した。しかしデフォルトの全量ハイドレーションはコンテンツ型ページには重すぎる――マーケティングランディングページに 20 個のコンポーネントがあり、ユーザーの可視領域はファーストビューの 3 個だけで、残り 17 個はバックグラウンドでメインスレッドを消費して hydration を行い、TBT と INP を引きずり下ろす。Angular 23 の incremental hydration はこれに精密な制御をもたらした。

我々はつい先日、日間 PV 50 万のマーケティングサイトを Angular 21 の全量ハイドレーションから 23 のインクリメンタルハイドレーション + zoneless に移行した。本記事はその過程での意思決定、データ、踏んだ落とし穴を記録する。

## Incremental Hydration のコアメカニズム

Angular 23 は `@defer` と hydration を接続した。以前は `@defer` はクライアント側のレンダリングタイミングのみを制御（lazy load）しており、サーバー側レンダリング時はすべての defer ブロックが完全な HTML を出力していた。現在は defer ブロックの hydration トリガー条件を指定できる：

```html
<!-- 可視になったときにハイドレーション -->
@defer (hydrate on visible) {
  <product-recommendations />
}

<!-- ユーザーインタラクション時にハイドレーション -->
@defer (hydrate on interaction) {
  <comment-section />
}

<!-- アイドル時にハイドレーション -->
@defer (hydrate on idle) {
  <related-articles />
}

<!-- カスタム条件 -->
@defer (hydrate when shouldHydrateMap()) {
  <interactive-map [data]="mapData()" />
}
```

決定的な違いは：`hydrate` を記述しない `@defer` ブロックはサーバー側レンダリング時に **HTML を出力しない**（純粋なクライアント側遅延読み込み）のに対し、`hydrate on ...` を記述したブロックはサーバー側で完全な HTML をレンダリングするが、クライアント側ではトリガー条件を満たした後でのみイベントバインドと変更検知を有効化する。つまりユーザーはコンテンツを即座に見ることができるが、不可視領域のインタラクション能力のために JS 実行コストを支払う必要がない。

4 種類のトリガーの適用シーン：

| トリガー | サーバー側 HTML 出力 | クライアント側有効化タイミング | 典型的コンポーネント |
|--------|---------------|--------------|---------|
| `on visible` | はい | ビューポート進入時 | おすすめリスト、FAQ、フッター |
| `on interaction` | はい | click/focus/touch | コメント欄、フォーム、折りたたみパネル |
| `on idle` | はい | requestIdleCallback | 非クリティカル分析コンポーネント、ソーシャルシェア |
| `when condition()` | はい | signal が true | プログラミングによる制御が必要な場面 |

## 選択的ハイドレーション境界の划分原則

すべてのコンポーネントが遅延ハイドレーションに適しているわけではない。我々の划分基準：

**即時ハイドレーション必須**：ナビゲーションバー、検索ボックス、ショッピングカート入口、ログイン状態インジケーター。これらのコンポーネントはファーストビューにあり即時のインタラクション応答が必要で、遅延ハイドレーションはユーザーのクリック無反応を引き起こす。

**遅延ハイドレーション可能**：商品詳細下部のおすすめモジュール、ユーザーレビューエリア、SEO ロングテキストブロック、サードパーティ埋め込み（マップ、動画）。これらはファーストビューにないか、即時インタラクションを必要としない。

**ハイドレーション不要**：純粋に表示するだけで永遠にインタラクションを必要としないコンテンツ。`ngNonBindable` やプレーン HTML を直接使用し、Angular コンポーネントすら被せない。

実際の操作でやりがちなミスは、あまりにも多くのコンポーネントを `on interaction` に設定してしまうことだ。ユーザーがファーストビューで本来 `on visible` でハイドレーションすべきコンポーネントをクリックした場合、「クリックできそうだがクリックしても反応しない」段階を経てから有効化される。これは UX へのダメージが数十ミリ秒の全量ハイドレーションよりも大きい。

## Zoneless Change Detection との連携

Zoneless モードでは Zone.js の monkey-patching がなく、変更検知は完全に signals と明示的な `markForCheck` によって駆動される。これはインクリメンタルハイドレーションと自然に適合する――各 defer ブロックはハイドレーション時に自身の signal subscription を確立するだけでよく、グローバル Zone が非同期操作を追跡する必要がない。

```typescript
// zoneless アプリ設定
bootstrapApplication(AppComponent, {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideClientHydration(withIncrementalHydration()),
  ],
});
```

`withIncrementalHydration()` という provider に注意。これがないと、テンプレートに `hydrate on ...` と書いていても Angular は全量ハイドレーションにフォールバックする。これは 23.0 の見落とされやすい設定項目だ。

Zoneless + インクリメンタルハイドレーションの組み合わせ効果は二重だ：一方ではハイドレーションが必要なコンポーネント数を削減し、他方ではハイドレーションされる各コンポーネントも Zone.js のランタイムオーバーヘッドを運ばなくなる。我々のテストでは、両者を組み合わせた収益はそれぞれ単独で使用した場合の和を上回った。

## Hydration コストの測定：TBT と INP の前後比較

移行前後で Lighthouse CI + Web Vitals API を用いた継続モニタリングを行った。データは同一 URL セット（マーケティングページ 20 + 機能ページ 5）から 1 週間サンプリングした p75 値：

| 指標 | 全量ハイドレーション (v21+Zone.js) | インクリメンタルハイドレーション (v23+Zoneless) | 変化 |
|------|----------------------|------------------------|------|
| TBT (p75) | 380ms | 140ms | -63% |
| INP (p75) | 290ms | 110ms | -62% |
| LCP (p75) | 2.1s | 1.9s | -10% |
| CLS (p75) | 0.02 | 0.01 | -50% |
| JS Bundle (ファーストビュー) | 420KB | 285KB | -32% |

TBT と INP の改善が最も大きい。大量の非ファーストビューコンポーネントのハイドレーション作業が遅延または排除されたからだ。LCP の改善は限定的で、LCP は主に画像とフォントの読み込みに依存し、hydration の直接的な影響は小さい。CLS の改善は `@defer` ブロックのプレースホルダー（`placeholder`）の適切な使用に起因する。

JS Bundle の縮小は zoneless による Zone.js の除去（~40KB gzip）に加え、一部の defer ブロックのコードが lazy chunk に分割されたことによる。

測定時の注意点：Lighthouse lab data のみを見てはいけない。Lab 環境はシミュレートデバイス上で動作するため、hydration の時間割合が過大評価される。Field data（実ユーザーデータ）こそが最終的な判定基準だ。我々は field data で INP good rate が 78% から 94% に向上したことを確認した。

## コンテンツページ vs ダッシュボード：異なる戦略

マーケティングコンテンツページと機能ダッシュボードではハイドレーション戦略を全く異ならせるべきだ。

**コンテンツページ（マーケティングサイト）**：閲覧が主体で、インタラクションは少数のコンポーネントに集中する（CTA ボタン、フォーム、検索）。戦略は積極的に遅延ハイドレーションを行うこと――ファーストビュー以上の CTA は即時ハイドレーションし、残りはすべて `on visible` または `on interaction` とする。目標は JS の読み込みが完了していなくても読者がスムーズにスクロールして読めることだ。

```html
<!-- マーケティングページの典型構造 -->
<header>
  <navbar /> <!-- 即時ハイドレーション -->
</header>

<main>
  <hero-section /> <!-- 即時ハイドレーション、CTA を含む -->

  @defer (hydrate on visible) {
    <feature-highlights />
  }

  @defer (hydrate on visible) {
    <testimonial-carousel />
  }

  @defer (hydrate on interaction) {
    <pricing-calculator />
  }

  @defer (hydrate on idle) {
    <seo-long-form-content />
  }
</main>

<footer>
  @defer (hydrate on visible) {
    <site-footer />
  }
</footer>
```

**ダッシュボード**：ほぼすべてのコンポーネントが即時インタラクションを必要とする。戦略は遅延ハイドレーションを最小限にすること――明確にファーストビュー外かつ読み込みコストが高いコンポーネントにのみ `on visible` を使用し、残りは即時ハイドレーションを維持する。目標はファーストビュー内で完全なインタラクション能力を提供することだ。

```html
<!-- ダッシュボードの典型構造 -->
<dashboard-layout>
  <sidebar-nav /> <!-- 即時ハイドレーション -->
  <top-bar /> <!-- 即時ハイドレーション -->

  <main-content>
    <kpi-cards /> <!-- 即時ハイドレーション -->
    <chart-panel /> <!-- 即時ハイドレーション -->

    @defer (hydrate on visible) {
      <detailed-data-table /> <!-- テーブルが長く、折りたたみ領域は遅延 -->
    }

    @defer (hydrate on interaction) {
      <export-dialog /> <!-- ダイアログ、クリック時のみ必要 -->
    }
  </main-content>
</dashboard-layout>
```

## 落とし穴記録

**Event Replay Flicker**。Angular はハイドレーション完了前にユーザーイベントを録画し、完了後に再生する。ユーザーがハイドレーション中に `on interaction` のボタンを素早くクリックした場合、イベント再生時に視覚的なちらつきが発生することがある――ボタンがまず非アクティブ状態を表示し、再生後にアクティブ状態にジャンプする。解決策はこの種のコンポーネントに CSS transition を追加してスムーズな遷移を行うか、極端なケースでは `on visible` に変更して早期ハイドレーションを行うことだ。

**SEO と Deferred Content**。検索エンジンはサーバー側レンダリングされた HTML をクロールできるが、`@defer` ブロックの動作はトリガーに依存する。`on visible` と `on idle` のコンテンツは HTML 内に存在するため、クローラーが見ることができる。`on interaction` のコンテンツも初期 HTML に存在する（これがインクリメンタルハイドレーションの前提）。ただし `hydrate` を付けない純粋な `@defer` を誤って使用した場合、そのブロックはサーバー側でレンダリングされず、SEO コンテンツが失われる。コードレビューのたびに defer ブロックに `hydrate` が付いているかを確認すること。

**Signal 初期化のタイミング**。Zoneless モードでは、defer ブロック内の signal はコンポーネントインスタンス化時に初めて作成される。親コンポーネントが input signal を通じて遅延ハイドレーションの子コンポーネントにデータを渡す場合、子コンポーネントのハイドレーション時に signal がすでに値を持っていることを確認する必要がある。さもないと一時的な空状態のちらつきが発生する。`@if (data())` でラップするか、signal にデフォルト値を設定することで回避できる。

**テストの複雑さ増加**。単体テストでは `@defer (hydrate on visible)` のコンポーネントはデフォルトでレンダリングされない。TestBed で `deferBlockBehavior: DeferBlockBehavior.Playthrough` を設定して全 defer ブロックを強制レンダリングするか、個別に手動トリガーする必要がある。これはテスト設定の負担を増やす。

**サードパーティライブラリの互換性**。一部の UI ライブラリの内部コンポーネントは即時ハイドレーション環境を前提としている。例えばある carousel ライブラリはハイドレーション前に slide 幅を計算し、結果として 0 を取得してしまう。この場合は PR を出して修正するか、当該コンポーネントを即時ハイドレーションに変更する。

## まとめ

Angular 23 のインクリメンタルハイドレーションは、hydration をグローバルスイッチからコンポーネントごとに調節可能なダイヤルに変えた。zoneless と併用するとパフォーマンス収益は顕著だ――我々のマーケティングサイトで TBT が 63% 低下し、INP good rate が 78% から 94% に向上した。しかし精密な制御は新たな意思決定の負担ももたらす：各コンポーネントにどのトリガーを使うべきか判断する必要があり、間違えると UX や SEO を損なう可能性がある。コンテンツ型ページから試みを始め、経験を積んでからインタラクティブアプリケーションに展開することを推奨する。測定時は field data を基準とし、lab data は参考とする。
