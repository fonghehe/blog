---
title: "Angular 22 RC プレビュー：新コンパイラと強化された Zoneless アーキテクチャ"
date: 2026-04-24 14:58:35
tags:
  - Angular
  - CSS
readingTime: 4
description: "Angular 22 Release Candidate が2026年4月末にリリースされました。例年通り、正式版は約3週間後の5月中旬に登場する見込みです。Angular 17 が新しいテンプレート構文を導入して以来、最もインパクトの大きいバージョンです。新世代の Ivy コンパイラ（社内コードネーム「Evergreen」）はビルド時間を大幅に短縮し、Signal モデルに対するより深いコンパイル時最適化を実現します。"
wordCount: 1089
---

Angular 22 Release Candidate が2026年4月末にリリースされました。例年通り、正式版は約3週間後の5月中旬に登場する見込みです。Angular 17 が新しいテンプレート構文を導入して以来、最もインパクトの大きいバージョンです。新世代の Ivy コンパイラ（社内コードネーム「Evergreen」）はビルド時間を大幅に短縮し、Signal モデルに対するより深いコンパイル時最適化を実現します。

## Evergreen コンパイラ：ビルド速度の質的変革

Angular 22 の核心は書き直されたコンパイラです。Ivy と比較して、Evergreen はインクリメンタルコンパイルのシナリオで著しい速度向上を実現します：

| プロジェクト規模                | Ivy コールドスタート | Evergreen コールドスタート | Ivy ホットリロード | Evergreen ホットリロード |
| ------------------------------- | -------------------- | -------------------------- | ------------------ | ------------------------ |
| 小規模（コンポーネント50未満）  | 3.2s                 | 1.8s                       | 280ms              | 120ms                    |
| 中規模（50〜200コンポーネント） | 12s                  | 5.5s                       | 650ms              | 210ms                    |
| 大規模（200+コンポーネント）    | 38s                  | 14s                        | 1.8s               | 480ms                    |

Evergreen の主な最適化：

- **インクリメンタル依存関係分析**：依存関係ツリー全体ではなく、変更の影響を受けたモジュールのサブグラフのみを再分析
- **並列型チェック**：TypeScript の型チェックを複数のワーカーに分散して並列実行
- **Signal 認識 tree-shaking**：コンパイル時に Signal の依存関係を識別し、デッドコードをより積極的に除去

## Signal のコンパイル時最適化

Evergreen コンパイラはコンパイル時に Signal の依存グラフを静的解析し、より効率的な変更検出コードを生成します：

```typescript
@Component({
  template: `
    <h1>{{ title() }}</h1>
    <p>{{ description() }}</p>
    <app-price [value]="price()" />
  `,
})
export class ProductComponent {
  title = signal("产品名称");
  description = signal("产品描述");
  price = signal(0);
}
```

Evergreen は `<h1>` が `title` にのみ依存し、`<p>` が `description` にのみ依存することを解析します。そのため `price` が変化しても `<app-price>` の DOM のみが更新され、コンポーネント全体の再レンダリングは発生しません。Ivy でこれを実現するには手動でコンポーネントを分割する必要がありました。

## Zoneless アーキテクチャの公式推奨化

Angular 22 では Zoneless が「安定」から「**公式推奨**」モードに昇格し、`ng new` で生成される新規プロジェクトはデフォルトで Zoneless 構成になります：

```typescript
// angular.json 新規プロジェクトのデフォルト設定
{
  "projects": {
    "my-app": {
      "architect": {
        "build": {
          "options": {
            "zoneless": true  // v22 からデフォルト値
          }
        }
      }
    }
  }
}
```

```typescript
// main.ts 新規プロジェクトテンプレート
import { bootstrapApplication } from "@angular/platform-browser";
import { provideZonelessChangeDetection } from "@angular/core";
import { AppComponent } from "./app/app.component";

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(), // デフォルトで含まれる
  ],
});
```

## 新機能：宣言的リソースプリフェッチディレクティブ

Angular 22 RC では宣言的なリソースプリフェッチが導入され、`prefetchResource` を手動で呼び出す必要がなくなりました：

```typescript
@Component({
  template: `
    <!-- ホバー時に詳細データをプリフェッチ -->
    <a
      routerLink="/products/{{ id }}"
      ngPrefetch="hover"
      [ngPrefetchData]="productDetailPrefetch"
    >
      查看详情
    </a>
  `,
})
export class ProductListItemComponent {
  id = input.required<number>();

  productDetailPrefetch = httpResource(
    () => null, // 初期ロードしない
    { prefetchOnly: true }, // プリフェッチのみ、現在のビューには影響しない
  );
}
```

## Angular 22 へのマイグレーション

RC フェーズで事前にアップグレードの互換性を検証できます：

```bash
# RC バージョンをインストール
npm install @angular/core@22.0.0-rc.0 @angular/cli@22.0.0-rc.0

# マイグレーション Schematic を実行
ng update @angular/core@22.0.0-rc.0 --migrate-only
```

主な破壊的変更：

1. **`NgModule` の完全オプション化**：v22 以降、新規プロジェクトでは `NgModule` 関連の API は一切登場しません
2. **`ChangeDetectionStrategy.Default` の非推奨化**：既存プロジェクトでは引き続き使用できますが、IDE に非推奨警告が表示されます
3. **`zone.js` がデフォルト依存関係から削除**：自動インストールされなくなりました。zone モードを維持する場合は手動で追加が必要です

## まとめ

Angular 22 RC は、ツールチェーンとアーキテクチャの両面で成熟した Angular の姿を示しています。Evergreen コンパイラは開発体験を大幅に改善し、Zoneless のデフォルト化はフレームワーク全体の技術方針が Signal 駆動へと完全に移行したことを示しています。正式版は5月中旬リリース予定です。今すぐ非クリティカルなプロジェクトでアップグレードの可能性を検証しておく価値があります。
