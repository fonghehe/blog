---
title: "Vite 5：邁向更純粹的 ESM 未來"
date: 2023-08-25 14:31:25
tags:
  - Vite
readingTime: 2
description: "Vite 5 進入 beta 階段了。這次更新的核心主題是\"清理技術債務\"和\"擁抱現代標準\"。"
wordCount: 351
---

Vite 5 進入 beta 階段了。這次更新的核心主題是"清理技術債務"和"擁抱現代標準"。

## 主要變化

### Node.js 18+ 要求

Vite 5 最低要求 Node.js 18，放棄 14 和 16。這不是激進的選擇——Node 16 已經停止維護，Node 18 是當前 LTS。

這意味著可以使用：
- `fetch`（全域性可用，不需要 polyfill）
- `Web Streams API`
- 更好的 ESM 支援

### 底層引擎升級

Vite 5 使用的 esbuild 版本更新，對 CSS 處理和 ESM 解析做了最佳化。更重要的是，Vite 團隊正在開發 Rolldown（基於 Rust 的 Rollup 替代），Vite 5 是為這個過渡做準備。

```typescript
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Vite 5 對 target 做了更嚴格的處理
    target: "es2020",
    // CSS 程式碼分割改進
    cssCodeSplit: true,
    // 更好的 minify 控製
    minify: "esbuild",
  },
});
```

### CSS 處理改進

```typescript
// Vite 5 對 CSS Modules 的型別支援更好
import styles from "./Button.module.css";

// IDE 可以自動補全 class 名
<button className={styles.primary}>
```

### Environment API

Vite 5 引入了 Environment API 的概念，為 SSR 和 edge runtime 提供更好的支援：

```typescript
// vite.config.ts
export default defineConfig({
  ssr: {
    // 控製 SSR 構建的行為
    noExternal: ["my-lib"],
    // 最佳化 SSR bundle
    target: "node",
  },
});
```

## 外掛 API 變化

```typescript
// Vite 5 外掛 API 更規範
import type { Plugin } from "vite";

function myPlugin(): Plugin {
  return {
    name: "my-plugin",
    // 新增：更精細的熱更新控製
    hotUpdate({ modules, server }) {
      // 隻更新受影響的模組
      return modules.filter((m) => m.url.includes("/src/"));
    },
    // 配置解析更可預測
    configResolved(config) {
      // config 物件更乾淨，不再有執行時混入的欄位
      console.log(config.build.target);
    },
  };
}
```

## 從 Vite 4 遷移

大部分專案無痛升級：

```bash
# 更新依賴
pnpm add -D vite@^5.0.0

# 如果用了 @vitejs/plugin-react 等官方外掛，也一起更新
pnpm add -D @vitejs/plugin-react@^4.2.0

# 檢查 breaking changes
pnpm vite build 2>&1 | grep -i "deprecated\|removed"
```

主要需要注意的 breaking changes：

```typescript
// 1. resolve.extensions 預設值變化
// 去掉了 .mjs 和 .mts，需要的話手動加
export default defineConfig({
  resolve: {
    extensions: [".mjs", ".js", ".mts", ".ts", ".jsx", ".tsx", ".json"],
  },
});

// 2. CSS 中 url() 的處理更嚴格
// 相對路徑必須指向真實存在的檔案

// 3. import.meta.glob 的 Eager 預設值變化
// Vite 5: 預設是 lazy（動態 import）
const modules = import.meta.glob("./dir/*.ts");
// 等價於 Vite 4 的 import.meta.glob("./dir/*.ts", { eager: false })
```

## 效能表現

在中型專案上（~300 個模組）：

```
Vite 4 冷啟動:  1.8s
Vite 5 冷啟動:  1.2s

Vite 4 HMR:     45ms
Vite 5 HMR:     28ms

Vite 4 構建:    28s
Vite 5 構建:    22s
```

提升不算巨大，但在大型專案和 monorepo 中更明顯。

## 小結

- Vite 5 是一次"現代化清理"，去掉了對舊 Node 版本和過時 API 的支援
- 底層引擎升級，為未來的 Rolldown 遷移做準備
- Environment API 為 SSR 和 edge 場景打基礎
- 從 Vite 4 遷移成本低，大部分專案幾小時搞定
- 關注 Rolldown 進展——那才是真正的大版本跳躍