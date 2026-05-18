---
title: "Webpack 效能預算：用 bundlesize 守住程式碼體積底線"
date: 2019-02-28 10:47:02
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "包體積是前端效能的重要指標。沒有限制的專案往往會漸漸膀起來——加個庫、唐唐就進得 100KB。效能預算的思路是：像財務預算一樣，把體積就是預算，超過就是超支。"
---

包體積是前端效能的重要指標。沒有限制的專案往往會漸漸膀起來——加個庫、唐唐就進得 100KB。效能預算的思路是：像財務預算一樣，把體積就是預算，超過就是超支。

## 包體積對載入效能的影響

| JS 體積 | 3G 下讀取時間 | 解析時間 |
| 
------- | ------------- | -------- |
| 100KB   | ~1s           | ~300ms   |
| 300KB   | ~3s           | ~900ms   |
| 1MB     | ~10s          | ~3s      |

記住：JS 對映到 CPU 時間大約是下載體積的 3x。2G 裝置上 1MB 的 JS 可能需要 30s+ 才能互動。

## Webpack Performance 內建警告

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxEntrypointSize: 250 * 1024, // 入口點不超過 250KB
    maxAssetSize: 100 * 1024, // 單個資源不超過 100KB
    hints: "error", // 超出就報錯，防止構建成功
  },
};
```

## bundlesize：CI 中的效能預算守門人

```bash
npm install --save-dev bundlesize
```

```json
// package.json
{
  "bundlesize": [
    { "path": "./dist/main.*.js", "maxSize": "200 kB" },
    { "path": "./dist/vendor.*.js", "maxSize": "150 kB" },
    { "path": "./dist/*.css", "maxSize": "20 kB" }
  ],
  "scripts": {
    "size": "bundlesize"
  }
}
```

```bash
npm run size
# PASS  ./dist/main.abc123.js: 185.2KB < 200KB gzip
# FAIL  ./dist/vendor.abc123.js: 162.5KB > 150KB gzip
```

## 整合到 CI（GitHub Actions）

```yaml
{% raw %}
# .github/workflows/ci.yml
- name: Check bundle size
  run: npm run build && npm run size
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
{% endraw %}
```

配置 `BUNDLESIZE_GITHUB_TOKEN` 後，bundlesize 會在 PR 中直接評論體積變化情況。

## 分析超出原因

```bash
# webpack-bundle-analyzer 視覺化分析
npx webpack-bundle-analyzer dist/stats.json

# 或者用 source-map-explorer
npx source-map-explorer dist/main.*.js
```

常見的超出原因：

1. `moment.js` 打包了全部 locale（用 `date-fns` 或 `dayjs` 替代）
2. `lodash` 運用了全量引入（詛 `import _ from 'lodash'`）
3. 第三方 CSS 庫進了 index bundle（應動態引入）
4. 圖片/字型進了 JS bundle（應配置單獨輸出）

## 總結

效能預算的核心是建立指標並自動化守護。`webpack performance hints` + `bundlesize` + CI 整合〔—這三層防線能確保包體積不會在不知不覺中腰脰變粗。
