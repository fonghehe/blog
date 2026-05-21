---
title: "Webpack 性能预算：用 bundlesize 守住代码体积底线"
date: 2019-02-28 10:47:02
tags:
  - Webpack
  - 工程化
readingTime: 1
description: "包体积是前端性能的重要指标。没有限制的项目往往会渐渐膀起来——加个库、唐唐就进得 100KB。性能预算的思路是：像财务预算一样，把体积就是预算，超过就是超支。"
wordCount: 303
---

包体积是前端性能的重要指标。没有限制的项目往往会渐渐膀起来——加个库、唐唐就进得 100KB。性能预算的思路是：像财务预算一样，把体积就是预算，超过就是超支。

## 包体积对加载性能的影响

| JS 体积 | 3G 下读取时间 | 解析时间 |
| 
------- | ------------- | -------- |
| 100KB   | ~1s           | ~300ms   |
| 300KB   | ~3s           | ~900ms   |
| 1MB     | ~10s          | ~3s      |

记住：JS 映射到 CPU 时间大约是下载体积的 3x。2G 设备上 1MB 的 JS 可能需要 30s+ 才能交互。

## Webpack Performance 内置警告

```javascript
// webpack.config.js
module.exports = {
  performance: {
    maxEntrypointSize: 250 * 1024, // 入口点不超过 250KB
    maxAssetSize: 100 * 1024, // 单个资源不超过 100KB
    hints: "error", // 超出就报错，防止构建成功
  },
};
```

## bundlesize：CI 中的性能预算守门人

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

## 集成到 CI（GitHub Actions）

```yaml
{% raw %}
# .github/workflows/ci.yml
- name: Check bundle size
  run: npm run build && npm run size
  env:
    BUNDLESIZE_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
{% endraw %}
```

配置 `BUNDLESIZE_GITHUB_TOKEN` 后，bundlesize 会在 PR 中直接评论体积变化情况。

## 分析超出原因

```bash
# webpack-bundle-analyzer 可视化分析
npx webpack-bundle-analyzer dist/stats.json

# 或者用 source-map-explorer
npx source-map-explorer dist/main.*.js
```

常见的超出原因：

1. `moment.js` 打包了全部 locale（用 `date-fns` 或 `dayjs` 替代）
2. `lodash` 运用了全量引入（诅 `import _ from 'lodash'`）
3. 第三方 CSS 库进了 index bundle（应动态引入）
4. 图片/字体进了 JS bundle（应配置单独输出）

## 总结

性能预算的核心是建立指标并自动化守护。`webpack performance hints` + `bundlesize` + CI 集成〔—这三层防线能确保包体积不会在不知不觉中腰脰变粗。
