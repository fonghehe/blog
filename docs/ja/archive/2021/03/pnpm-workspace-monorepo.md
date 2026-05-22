---
title: "pnpm workspace で Monorepo を構築する"
date: 2021-03-08 15:28:40
tags:
  - エンジニアリング

readingTime: 4
description: "2年間 Lerna + Yarn workspace を使ってきた後、今年は pnpm workspace を試し始めました。pnpm のハードリンク機構は Monorepo に自然に適合しており、依存関係が重複インストールされず、ディスク使用量が大幅に削減されます。比較してみると、pnpm workspace は現時点で最もエレガントな Monorepo ソリューションかもしれません。"
wordCount: 859
---

2年間 Lerna + Yarn workspace を使ってきた後、今年は pnpm workspace を試し始めました。pnpm のハードリンク機構は Monorepo に自然に適合しており、依存関係が重複インストールされず、ディスク使用量が大幅に削減されます。比較してみると、pnpm workspace は現時点で最もエレガントな Monorepo ソリューションかもしれません。

## なぜ pnpm を選ぶか

pnpm の核となる利点は Monorepo のシナリオで特に顕著です：

1. **ハードリンクストレージ**：グローバルストア + ハードリンクにより、10 のサブプロジェクトで同じ依存関係を共有し、Yarn v1 のように各プロジェクトに個別にインストールされることはありません
2. **厳格な依存関係管理**：ファントム依存関係の問題が完全に解決され、package.json で宣言されていない依存関係は使用できません
3. **ネイティブ workspace サポート**：Lerna のような上位ツールは不要で、pnpm 単体で処理できます

```bash
# インストール速度比較（同一 Monorepo、30 サブプロジェクト）
# npm:     ~120s
# yarn v1: ~85s
# pnpm:    ~15s

# ディスク使用量比較
# npm:     ~2.1GB
# yarn v1: ~1.8GB
# pnpm:    ~600MB（ハードリンクによる重複排除）
```

## プロジェクト構成のセットアップ

```bash
# プロジェクトの初期化
mkdir my-monorepo && cd my-monorepo
pnpm init

# ディレクトリ構造の作成
mkdir -p packages/{shared,components,utils}
mkdir -p apps/{admin,portal}
```

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── packages/
│   ├── shared/          # 共有ビジネスロジック
│   │   ├── package.json
│   │   └── src/
│   ├── components/      # コンポーネントライブラリ
│   │   ├── package.json
│   │   └── src/
│   └── utils/           # ユーティリティ関数
│       ├── package.json
│       └── src/
├── apps/
│   ├── admin/           # 管理画面
│   │   ├── package.json
│   │   └── src/
│   └── portal/          # ポータルサイト
│       ├── package.json
│       └── src/
└── tools/
    └── eslint-config/   # 共有 ESLint 設定
```

## コア設定

**pnpm-workspace.yaml**：

```yaml
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
```

**ルート package.json**：

```json
{
  "name": "my-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter admin dev",
    "dev:portal": "pnpm --filter portal dev",
    "build": "pnpm -r --filter './packages/*' build",
    "build:all": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^4.3.0",
    "vite": "^2.5.0",
    "@vitejs/plugin-vue": "^1.6.0"
  }
}
```

**サブパッケージ package.json**（utils を例に）：

```json
{
  "name": "@my-monorepo/utils",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "vite build",
    "dev": "vite build --watch"
  },
  "dependencies": {
    "dayjs": "^1.10.0"
  }
}
```

## パッケージ間の相互参照

Monorepo では、サブパッケージ間の相互参照に `workspace:` プロトコルを使用します：

```json
{
  "name": "@my-monorepo/components",
  "dependencies": {
    "@my-monorepo/utils": "workspace:*",
    "@my-monorepo/shared": "workspace:*"
  }
}
```

公開時に pnpm は自動的に `workspace:*` を実際のバージョン番号に置き換えます。

```typescript
// packages/components/src/Button.vue
<script setup>
import { formatCurrency } from '@my-monorepo/utils'
import { useUserStore } from '@my-monorepo/shared'

const props = defineProps<{ amount: number }>()
const formatted = computed(() => formatCurrency(props.amount))
</script>
```

## pnpm --filter コマンド

`--filter` は pnpm workspace の最も強力な機能で、コマンドの適用範囲を正確に制御できます：

```bash
# admin アプリにのみ lodash をインストール
pnpm --filter admin add lodash

# admin のみにインストールするが、依存するパッケージを先にビルド
pnpm --filter admin... build

# packages/ 配下のすべてのパッケージで test を実行
pnpm --filter './packages/*' test

# utils と utils に依存するパッケージのみビルド
pnpm --filter '@my-monorepo/utils...' build

# admin で dev を実行し、依存するローカルパッケージをウォッチ
pnpm --filter admin dev

# すべての packages の build を実行（トポロジカルソート順）
pnpm -r --filter './packages/*' build
```

## Vite ビルド設定

サブパッケージの Vite 設定、ライブラリモードで出力：

```typescript
// packages/utils/vite.config.ts
import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true
    })
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'MyUtils',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'cjs'}`
    },
    rollupOptions: {
      external: ['dayjs'] // 依存関係をバンドルしない
    }
  }
})
```

## よくある問題

**ファントム依存関係問題（Phantom Dependencies）**：

```typescript
// ❌ npm/yarn の node_modules フラット構造では、
// 依存関係の依存関係を直接 import できる（ファントム依存関係）
import something from 'transitive-dependency'

// ✅ pnpm の厳格な構造ではこれが許可されない
// package.json で明示的に宣言する必要がある
// エラー：Module not found
```

これは pnpm の設計上の決定であり、正しい依存関係の宣言を強制します。

**`.npmrc` 設定**：

```ini
# どうしても宣言されていない依存関係にアクセスする必要がある場合（推奨しません）
shamefully-hoist=true

# 特定のパッケージのみを除外することも可能
public-hoist-pattern[]=*eslint*
```

## Lerna との比較

| 観点 | Lerna + Yarn v1 | pnpm workspace |
|------|----------------|----------------|
| 依存関係管理 | フラット構造、ファントム依存関係あり | 厳格な分離 |
| ディスク使用量 | 高い（重複インストール） | 低い（ハードリンク） |
| インストール速度 | 遅い | 速い |
| 追加ツールの必要性 | Lerna が必要 | 不要 |
| バージョン公開 | Lerna publish | changesets |
| 学習曲線 | 中程度 | 低い |

チームがまだ Lerna を使っている場合、移行コストは高くなく、メリットは明らかです。

## まとめ

- pnpm workspace は現時点で最も軽量な Monorepo ソリューションであり、Lerna は不要です
- `workspace:*` プロトコルでサブパッケージ間の依存関係を処理し、`--filter` でコマンド範囲を正確に制御
- ハードリンクストレージ + 厳格な依存関係管理が pnpm の核となる利点
- Vite と組み合わせてサブパッケージをビルドすると、開発体験が非常にスムーズ
- バージョン管理は Lerna publish の代わりに changesets を推奨
