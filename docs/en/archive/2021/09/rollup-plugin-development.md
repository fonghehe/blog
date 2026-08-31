---
title: "Rollup Plugin Development Guide"
date: 2021-09-13 16:06:52
tags:
  - Engineering
  - Vite

readingTime: 2
description: "Vite uses Rollup for production builds under the hood, so understanding Rollup's plugin mechanism matters if you use Vite deeply. This year we wrote several custom Rollup plugins for our component library build — here's what we learned."
wordCount: 164
---

Vite uses Rollup under the hood for production builds, so understanding the Rollup plugin mechanism is essential for using Vite in depth. This year we built a few custom Rollup plugins for our component-library build, and here are some lessons from that work.

## Plugin Basic Structure

A Rollup plugin is simply a function that returns an object:

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

## Common Hooks Explained

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

## Practice: Auto Component Registration Plugin

We wrote a plugin that replaces the manual exports in the component library's `index.ts` with auto-generated ones:

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

## Relationship with Vite

Vite's plugin system is compatible with the Rollup plugin API, but extends it:

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

## Debugging Tips

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

## Summary

- The core of a Rollup plugin is the transform, resolveId, and load hooks.
- Vite is compatible with the Rollup plugin API, so understanding Rollup matters for using Vite in depth.
- Context methods like `this.emitFile` and `this.warn` are very handy when developing plugins.
- Component-library builds are a typical use case for custom plugins.
- When debugging, make good use of `this.info` to print intermediate state.