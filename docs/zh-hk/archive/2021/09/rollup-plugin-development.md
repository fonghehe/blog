---
title: "Rollup 插件開發指南"
date: 2021-09-13 16:06:52
tags:
  - Rollup
readingTime: 2
description: "Vite 底層用 Rollup 做生產構建，理解 Rollup 插件機制對深度使用 Vite 非常重要。今年我們在組件庫構建中開發了幾個自定義 Rollup 插件，總結一下開發經驗。"
wordCount: 229
---

Vite 底層用 Rollup 做生產構建，理解 Rollup 插件機制對深度使用 Vite 非常重要。今年我們在組件庫構建中開發了幾個自定義 Rollup 插件，總結一下開發經驗。

## 插件基本結構

Rollup 插件就是一個返回對象的函數：

```javascript
// rollup-plugin-strip-debug.js
export default function stripDebug(options = {}) {
  return {
    name: 'strip-debug', // 插件名稱，必須

    // 構建開始時調用
    buildStart() {
      console.log('構建開始')
    },

    // 轉換模塊代碼
    transform(code, id) {
      // 移除 console.log 和 debugger
      const result = code
        .replace(/console\.log\(.*?\);?/g, '')
        .replace(/debugger;?/g, '')

      return {
        code: result,
        map: null // source map
      }
    },

    // 構建結束時調用
    buildEnd() {
      console.log('構建結束')
    }
  }
}
```

## 常用 Hook 詳解

```javascript
export default function myPlugin() {
  return {
    name: 'my-plugin',

    // 解析模塊路徑
    resolveId(source, importer) {
      // 將 @ alias 解析為實際路徑
      if (source.startsWith('@/')) {
        return source.replace('@/', '/src/')
      }
      return null // 返回 null 表示不處理
    },

    // 加載模塊內容
    load(id) {
      // 加載虛擬模塊
      if (id === 'virtual:config') {
        return `export default ${JSON.stringify(getConfig())}`
      }
      return null
    },

    // 轉換模塊代碼（最常用的 hook）
    transform(code, id) {
      // 只處理 .vue 文件
      if (!id.endsWith('.vue')) return null

      // 對 Vue SFC 做自定義處理
      const result = processVueFile(code)
      return {
        code: result,
        map: generateSourceMap(result, code)
      }
    },

    // 生成產物時調用
    generateBundle(options, bundle) {
      // 可以修改或刪除產物中的文件
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // 注入版本號
          chunk.code = `/* v1.0.0 */\n${chunk.code}`
        }
      }
    }
  }
}
```

## 實戰：組件自動註冊插件

我們寫了一個插件，自動把組件庫的 `index.ts` 中的手動導出改為自動生成：

```javascript
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

export default function autoExport(options = {}) {
  const { componentDir, outputFile } = options

  return {
    name: 'auto-export',

    buildStart() {
      // 掃描組件目錄
      const components = readdirSync(componentDir)
        .filter(name => {
          const path = join(componentDir, name)
          return statSync(path).isDirectory()
        })

      // 生成導出代碼
      const imports = components.map(name => {
        const pascalName = name
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join('')

        return `export { default as ${pascalName} } from './${name}/index.vue'`
      }).join('\n')

      // 寫入生成的入口文件
      this.emitFile({
        type: 'asset',
        fileName: outputFile,
        source: imports
      })
    }
  }
}

// rollup.config.js 中使用
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

## 和 Vite 的關係

Vite 的插件系統兼容 Rollup 插件 API，但有擴展：

```javascript
// Vite 獨有的 hook
export default function vitePlugin() {
  return {
    name: 'vite-specific',

    // 開發服務器相關 hook（Rollup 沒有）
    configureServer(server) {
      // 添加自定義中間件
      server.middlewares.use('/api', (req, res) => {
        res.json({ version: '1.0.0' })
      })
    },

    // 處理 HTML
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        '<head><meta name="version" content="1.0.0">'
      )
    }
  }
}
```

## 調試技巧

```javascript
export default function debugPlugin() {
  return {
    name: 'debug',

    // 使用 this.warn 和 this.error 報告問題
    transform(code, id) {
      if (code.includes('eval(')) {
        this.warn({
          message: '檢測到 eval 使用，可能存在安全風險',
          id: id
        })
      }

      // 使用 this.info 輸出調試信息
      this.info(`處理模塊: ${id}`)
    }
  }
}
```

## 小結

- Rollup 插件的核心是 transform、resolveId、load 三個 hook
- Vite 兼容 Rollup 插件 API，理解 Rollup 對 Vite 深度使用很重要
- 插件開發中 `this.emitFile`、`this.warn` 等上下文方法很實用
- 組件庫構建是自定義插件的典型應用場景
- 調試時善用 `this.info` 輸出中間狀態