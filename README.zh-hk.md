# 前端成長記錄

[中文](./README.md) | [English](./README.en.md) | [日本語](./README.ja.md) | [繁體中文（台灣）](./README.zh-tw.md)

一名前端工程師由 2018 年開始嘅學習同成長記錄。

**線上閱讀**: https://fonghehe.github.io/blog/zh-hk/

## 📖 部落格內容

- **📅 最新文章**: [2026 年技術文章](https://fonghehe.github.io/blog/zh-hk/posts/) - 前端最新動態同深度解析
- **📚 文章歸檔**: [2018-2025](https://fonghehe.github.io/blog/zh-hk/archive/) - 歷年技術沉澱同總結

## 🌐 多語言支援

| 語言             | 連結                                   |
| ---------------- | -------------------------------------- |
| 中文 (預設)      | https://fonghehe.github.io/blog/       |
| English          | https://fonghehe.github.io/blog/en/    |
| 日本語           | https://fonghehe.github.io/blog/ja/    |
| 繁體中文（台灣） | https://fonghehe.github.io/blog/zh-tw/ |
| 繁體中文（香港） | https://fonghehe.github.io/blog/zh-hk/ |

## 技術棧

- **框架**: VitePress 1.6.4
- **語言**: Markdown + Vue 3 + TypeScript
- **部署**: GitHub Pages + GitHub Actions
- **套件管理**: pnpm
- **主題**: 自訂深色/淺色主題

## 🚀 本地執行

```bash
pnpm install
pnpm docs:dev
```

## 🏗️ 建置

```bash
pnpm docs:build
```

## 👁️ 預覽建置結果

```bash
pnpm docs:preview
```

## 📝 文章統計

- 2018-2025 年: 1,383 篇文章 (歸檔)
- 2026 年: 139 篇最新文章
- 總計: 1,522 篇深度技術文章

## 🎯 主要分類

- Vue 生態發展
- React 最新動向
- Angular 框架進展
- 工程化與建置工具
- 效能優化
- 安全最佳實踐
- TypeScript 實戰
- Node.js 開發
- 測試與品質
- CSS 新特性
- 移動端與跨平台開發

## 📄 License

MIT

## 內容維護與品質檢查

使用 Node.js 22.18+ 及 `packageManager` 指定的 pnpm。

```bash
pnpm check
pnpm content:report
pnpm docs:build
```

新增[閱讀路線](docs/zh-hk/guides.md)、[內容說明](docs/zh-hk/about.md)及[品質報告](maintenance/content-quality-report.md)。文章支援 `updated`、`lastVerified`、`version`、`series`；驗證日期只在實際確認後填寫。搜尋條件與頁碼保存在 URL 中，CI 檢查全部語言並阻止新增問題。

完整建置合併兩組語言、網站地圖及五語 RSS，再生成最終離線快取。離線模式保存首頁資源及已瀏覽頁面，不會預先下載整個歸檔。機械清理不代表所有文章已驗證。
