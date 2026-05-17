---
title: "Rollup プラグイン開発ガイド"
date: 2021-09-13 16:06:52
tags:
  - エンジニアリング
  - Vite

readingTime: 2
description: "Vite 底层用 Rollup 做生产构建，理解 Rollup 插件机制对深度使用 Vite 非常重要。今年我们在组件库构建中开发了几个自定义 Rollup 插件，总结一下开发经验。"
---

Vite 底层用 Rollup 做生产构建，理解 Rollup 插件机制对深度使用 Vite 非常重要。今年我们在组件库构建中开发了几个自定义 Rollup 插件，总结一下开发经验。

## プラグインの基本構造

Rollup 插件就是一个返回对象的函数：

```javascript
// rollup-plugin-strip-debug.js
export default function stripDebug(options = {}) {
  return {
    name: 'strip-debug', // 插件名称，必须

    // 构建开始时调用
    buildStart() {
      console.log('构建开始')
    },

    // 转换模块代码
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

    // 构建结束时调用
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

    // 解析模块路径
    resolveId(source, importer) {
      // 将 @ alias 解析为实际路径
      if (source.startsWith('@/')) {
        return source.replace('@/', '/src/')
      }
      return null // 返回 null 表示不处理
    },

    // 加载模块内容
    load(id) {
      // 加载虚拟模块
      if (id === 'virtual:config') {
        return `export default ${JSON.stringify(getConfig())}`
      }
      return null
    },

    // 转换模块代码（最常用的 hook）
    transform(code, id) {
      // 只处理 .vue 文件
      if (!id.endsWith('.vue')) return null

      // 对 Vue SFC 做自定义处理
      const result = processVueFile(code)
      return {
        code: result,
        map: generateSourceMap(result, code)
      }
    },

    // 生成产物时调用
    generateBundle(options, bundle) {
      // 可以修改或删除产物中的文件
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk') {
          // 注入版本号
          chunk.code = `/* v1.0.0 */\n${chunk.code}`
        }
      }
    }
  }
}
```

## 実践：コンポーネント自動登録プラグイン

我们写了一个插件，自动把组件库的 `index.ts` 中的手动导出改为自动生成：

```javascript
import { readdirSync, statSync } from 'fs'
import { join, basename } from 'path'

export default function autoExport(options = {}) {
  const { componentDir, outputFile } = options

  return {
    name: 'auto-export',

    buildStart() {
      // 扫描组件目录
      const components = readdirSync(componentDir)
        .filter(name => {
          const path = join(componentDir, name)
          return statSync(path).isDirectory()
        })

      // 生成导出代码
      const imports = components.map(name => {
        const pascalName = name
          .split('-')
          .map(s => s.charAt(0).toUpperCase() + s.slice(1))
          .join('')

        return `export { default as ${pascalName} } from './${name}/index.vue'`
      }).join('\n')

      // 写入生成的入口文件
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

## Vite との関係

Vite 的插件系统兼容 Rollup 插件 API，但有扩展：

```javascript
// Vite 独有的 hook
export default function vitePlugin() {
  return {
    name: 'vite-specific',

    // 开发服务器相关 hook（Rollup 没有）
    configureServer(server) {
      // 添加自定义中间件
      server.middlewares.use('/api', (req, res) => {
        res.json({ version: '1.0.0' })
      })
    },

    // 处理 HTML
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

    // 使用 this.warn 和 this.error 报告问题
    transform(code, id) {
      if (code.includes('eval(')) {
        this.warn({
          message: '检测到 eval 使用，可能存在安全风险',
          id: id
        })
      }

      // 使用 this.info 输出调试信息
      this.info(`处理模块: ${id}`)
    }
  }
}
```

## まとめ

- Rollup 插件的核心是 transform、resolveId、load 三个 hook
- Vite 兼容 Rollup 插件 API，理解 Rollup 对 Vite 深度使用很重要
- 插件开发中 `this.emitFile`、`this.warn` 等上下文方法很实用
- 组件库构建是自定义插件的典型应用场景
- 调试时善用 `this.info` 输出中间状态