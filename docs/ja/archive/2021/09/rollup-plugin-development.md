---
title: "Rollup プラグイン開発ガイド"
date: 2021-09-13 16:06:52
tags:
  - エンジニアリング
  - Vite

readingTime: 3
description: "Vite は内部で Rollup を使用してプロダクションビルドを行っており、Rollup のプラグイン機構を理解することは Vite を深く使いこなす上で非常に重要です。今年、コンポーネントライブラリのビルドでカスタム Rollup プラグインをいくつか開発した経験をまとめます。"
wordCount: 403
---

Vite は内部で Rollup を使用してプロダクションビルドを行っており、Rollup のプラグイン機構を理解することは Vite を深く使いこなす上で非常に重要です。今年、コンポーネントライブラリのビルドでカスタム Rollup プラグインをいくつか開発した経験をまとめます。

## プラグインの基本構造

Rollup プラグインは、オブジェクトを返す関数です：

```javascript
// rollup-plugin-strip-debug.js
export default function stripDebug(options = {}) {
  return {
    name: 'strip-debug', // プラグイン名（必須）

    // ビルド開始時に呼ばれる
    buildStart() {
      console.log('构建开始')
    },

    // モジュールコードを変換
    transform(code, id) {
      // console.log と debugger を削除
      const result = code
        .replace(/console\.log\(.*?\);?/g, '')
        .replace(/debugger;?/g, '')

      return {
        code: result,
        map: null // ソースマップ
      }
    },

    // ビルド終了時に呼ばれる
    buildEnd() {
      console.log('构建结束')
    }
  }
}
```

## よく使うHookの解説

```javascript
export default function myPlugin() {
  return {
    name: 'my-plugin',

    // モジュールパスを解決
    resolveId(source, importer) {
      // @ alias を実際のパスに解決
      if (source.startsWith('@/')) {
        return source.replace('@/', '/src/')
      }
      return null // null を返すと処理しないことを示す
    },

    // モジュール内容をロード
    load(id) {
      // 仮想モジュールをロード
      if (id === 'virtual:config') {
        return `export default ${JSON.stringify(getConfig())}`
      }
      return null
    },

    // モジュールコードを変換（最もよく使う hook）
    transform(code, id) {
      // .vue ファイルのみ処理
      if (!id.endsWith('.vue')) return null

      // Vue SFC にカスタム処理を行う
      const result = processVueFile(code)
      return {
        code: result,
        map: generateSourceMap(result, code)
      }
    },

    // 出力生成時に呼ばれる
    generateBundle(options, bundle) {
      // 出力ファイルを修正または削除できる
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // バージョン番号を注入
          chunk.code = `/* v1.0.0 */\n${chunk.code}`
        }
      }
    }
  }
}
```

## 実践：コンポーネント自動登録プラグイン

コンポーネントライブラリの `index.ts` における手動エクスポートを自動生成に置き換えるプラグインを作成しました：

```javascript
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

export default function autoExport(options = {}) {
  const { componentDir, outputFile } = options

  return {
    name: 'auto-export',

    buildStart() {
      // コンポーネントディレクトリをスキャン
      const components = readdirSync(componentDir)
        .filter(name => {
          const path = join(componentDir, name)
          return statSync(path).isDirectory()
        })

      // エクスポートコードを生成
      const imports = components.map(name => {
        const pascalName = name
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join('')

        return `export { default as ${pascalName} } from './${name}/index.vue'`
      }).join('\n')

      // 生成したエントリーファイルを書き込む
      this.emitFile({
        type: 'asset',
        fileName: outputFile,
        source: imports
      })
    }
  }
}

// rollup.config.js で使用
import autoExport from './rollup-plugin-auto-export'

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.esm.js', format: 'es' },
    { file: 'dist/index.cjs.js', format: 'cjs' }
  ],
  plugins: [
    autoExport({
      componentDir: 'src/components',
      outputFile: 'index.ts'
    })
  ]
}
```

## Vite との関係

Vite のプラグインシステムは Rollup プラグイン API と互換性がありますが、拡張があります：

```javascript
// Vite 固有の hook
export default function vitePlugin() {
  return {
    name: 'vite-specific',

    // 開発サーバー関連の hook（Rollup にはない）
    configureServer(server) {
      // カスタムミドルウェアを追加
      server.middlewares.use('/api', (req, res) => {
        res.json({ version: '1.0.0' })
      })
    },

    // HTML を処理
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        '<head><meta name="version" content="1.0.0">'
      )
    }
  }
}
```

## デバッグテクニック

```javascript
export default function debugPlugin() {
  return {
    name: 'debug',

    // this.warn と this.error を使用して問題を報告
    transform(code, id) {
      if (code.includes('eval(')) {
        this.warn({
          message: 'eval の使用を検出しました。セキュリティリスクの可能性があります',
          id: id
        })
      }

      // this.info を使用してデバッグ情報を出力
      this.info(`モジュール処理中: ${id}`)
    }
  }
}
```

## まとめ

- Rollup プラグインの核心は transform、resolveId、load の 3 つの hook
- Vite は Rollup プラグイン API と互換性があり、Rollup の理解は Vite の深い活用に重要
- プラグイン開発では `this.emitFile`、`this.warn` などのコンテキストメソッドが便利
- コンポーネントライブラリのビルドはカスタムプラグインの典型的なユースケース
- デバッグ時には `this.info` を活用して中間状態を出力する