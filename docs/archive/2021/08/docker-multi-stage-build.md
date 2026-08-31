---
title: "Docker 多阶段构建前端应用"
date: 2021-08-12 16:06:56
tags:
  - Docker
  - 工程化
readingTime: 2
description: "在日常开发中，Docker 多阶段构建前端应用的使用频率越来越高。本文系统地讲解其用法、原理和优化策略。"
wordCount: 279
---

Docker 多阶段构建在前端项目里用得越来越多，本文系统讲解它的用法、原理和优化策略。

## 快速上手

下面看一个完整示例：

```dockerfile
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

边界条件一定要处理好，生产环境里这点很关键。

## 内部原理

关键在于吃透它的核心逻辑：

```dockerfile
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

性能优化要看场景，不必处处都做过度优化。

## 业务实战

看看可以从哪些角度改进：

```dockerfile
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

这套方案已在线上稳定运行半年多，经过了实战检验。

## 性能对比

先看一下基本实现：

```dockerfile
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

上面是基本用法，真实项目还得补上错误处理和边界情况。

## 问题排查

在此基础上还能进一步优化：

```dockerfile
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  server: {
    port: 3000,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          utils: ['lodash-es', 'dayjs']
        }
      }
    }
  }
})

```

这种模式在大型项目里很实用，能明显降低维护成本。

## 小结

- 不要为了用新技术而用新技术
- 代码示例仅供参考，要按业务场景调整
- Docker 多阶段构建不是银弹，得按项目规模和技术栈来选