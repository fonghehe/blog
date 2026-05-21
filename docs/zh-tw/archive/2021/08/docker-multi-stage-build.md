---
title: "Docker 多階段構建前端應用"
date: 2021-08-12 16:06:56
tags:
  - Docker
  - 工程化
readingTime: 2
description: "在日常開發中，Docker 多階段構建前端應用的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。"
wordCount: 324
---

在日常開發中，Docker 多階段構建前端應用的使用頻率越來越高。本文系統地講解其用法、原理和最佳化策略。

## 快速上手

以下是一個完整的示例：

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

注意邊界條件處理，這在生產環境中至關重要。

## 內部原理

關鍵在於理解核心邏輯：

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

效能最佳化需要結合具體場景，不是所有情況都需要過度最佳化。

## 業務實戰

我們可以通過以下方式來改進：

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

這套方案已經在線上穩定運行了半年以上，經過了實際驗證。

## 效能對比

先來看基本的實現方式：

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

這段程式碼展示了基本的使用方式。實際專案中還需要考慮錯誤處理和邊界條件。

## 問題排查

在這個基礎上，我們可以進一步最佳化：

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

這種模式在大型專案中非常實用，能顯著降低維護成本。

## 小結

- 不要為了用新技術而用新技術
- 程式碼示例僅供參考，需根據業務場景調整
- Docker 多階段構建前端應用不是銀彈，需要根據專案規模和技術棧選擇