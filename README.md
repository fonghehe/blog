# 前端成长记录

[English](./README.en.md) | [日本語](./README.ja.md) | [繁體中文（台灣）](./README.zh-tw.md) | [繁體中文（香港）](./README.zh-hk.md)

一个前端工程师从 2018 年开始的学习与成长记录。

**在线阅读**: https://fonghehe.github.io/blog/

## 📖 博客内容

- **📅 最新文章**: [2026 年技术文章](https://fonghehe.github.io/blog/posts/) - 前端最新动态与深度解析
- **📚 文章归档**: [2018-2025](https://fonghehe.github.io/blog/archive/) - 往年技术沉淀与总结

## 🌐 多语言支持

| 语言             | 链接                                   |
| ---------------- | -------------------------------------- |
| 中文 (默认)      | https://fonghehe.github.io/blog/       |
| English          | https://fonghehe.github.io/blog/en/    |
| 日本語           | https://fonghehe.github.io/blog/ja/    |
| 繁體中文（台灣） | https://fonghehe.github.io/blog/zh-tw/ |
| 繁體中文（香港） | https://fonghehe.github.io/blog/zh-hk/ |

## 技术栈

- **框架**: VitePress 1.6.4
- **语言**: Markdown + Vue 3 + TypeScript
- **部署**: GitHub Pages + GitHub Actions
- **包管理**: pnpm
- **主题**: 自定义深色/浅色主题

## 🚀 本地运行

```bash
pnpm install
pnpm docs:dev
```

## 🏗️ 构建

```bash
pnpm docs:build
```

## 👁️ 预览构建结果

```bash
pnpm docs:preview
```

## 📝 文章统计

- 2018-2025 年: 1,383 篇文章 (归档)
- 2026 年: 144 篇最新文章
- 总计: 1,527 篇深度技术文章

## 🎯 主要分类

- Vue 生态发展
- React 最新动向
- Angular 框架进展
- 工程化与构建工具
- 性能优化
- 安全最佳实践
- TypeScript 实战
- Node.js 开发
- 测试与质量
- CSS 新特性
- 移动端与跨端开发

## 📄 License

MIT

## 内容维护与质量检查

使用 Node.js 22.18+ 和仓库指定的 pnpm 版本（见 `packageManager`）。

```bash
pnpm check            # 回归测试、文章统计、五种语言的内容与链接检查
pnpm content:report   # 更新内容质量报告
pnpm docs:build       # 两组构建、合并 sitemap、生成五语言 RSS 和最终离线缓存
```

新增 [阅读路线](docs/guides.md) 与 [关于及内容说明](docs/about.md)。文章可使用 `updated`、`lastVerified`、`version`、`series` 字段；仅在真实核验后填写 `lastVerified`。搜索支持标题、摘要、标签，筛选与页码保存在 URL 中。

历史待复核内容见 [质量报告](maintenance/content-quality-report.md)。已清理固定套用的生产声明并修正明确误标的 CSS 代码块；这不代表全部正文已验证。`maintenance/content-baseline.json` 记录剩余问题，CI 阻止新增问题；不要通过重新生成基线掩盖回归。

离线模式缓存首页所需资源及访问过的页面，未访问页面需要联网；不会预下载全部文章。最终发布产物必须在两组构建合并后重新生成 Service Worker。

时间字段约定：无时区的历史 YAML 时间按 UTC 解释，与 VitePress 解析结果保持一致；需要表达中国标准时间时使用显式的 `+08:00` 偏移。日期、修订日期与实际验证日期分别记录。
