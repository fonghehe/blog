---
title: "CSS Flexbox 佈局完全指南：落地路徑與實戰建議"
date: 2018-06-14 17:13:56
tags:
  - CSS
readingTime: 1
description: "Flexbox 是現在最常用的佈局方式，但有些屬性老是記不住。整理一份速查手冊。"
wordCount: 97
---

Flexbox 是現在最常用的佈局方式，但有些屬性老是記不住。整理一份速查手冊。

## 容器屬性

```css
.container {
  display: flex; /* 或 inline-flex */

  /* 主軸方向 */
  flex-direction: row; /* → 默認 */
  flex-direction: row-reverse; /* ← */
  flex-direction: column; /* ↓ */
  flex-direction: column-reverse; /* ↑ */

  /* 換行 */
  flex-wrap: nowrap; /* 不換行（默認） */
  flex-wrap: wrap; /* 換行，向下 */
  flex-wrap: wrap-reverse; /* 換行，向上 */

  /* 主軸對齊（justify-content） */
  justify-content: flex-start; /* 左/上對齊（默認） */
  justify-content: flex-end; /* 右/下對齊 */
  justify-content: center; /* 居中 */
  justify-content: space-between; /* 兩端對齊，間隔相等 */
  justify-content: space-around; /* 每項兩側間隔相等 */
  justify-content: space-evenly; /* 所有間隔相等 */

  /* 交叉軸對齊（align-items） */
  align-items: stretch; /* 拉伸填滿（默認） */
  align-items: flex-start; /* 頂部對齊 */
  align-items: flex-end; /* 底部對齊 */
  align-items: center; /* 居中 */
  align-items: baseline; /* 基線對齊 */

  /* 多行對齊（align-content，隻在換行時有效） */
  align-content: flex-start;
  align-content: space-between;

  /* gap（新屬性，替代 margin 技巧） */
  gap: 16px; /* 行列間距相同 */
  gap: 16px 24px; /* 行間距 列間距 */
}
```

## 子項屬性

```css
.item {
  /* 順序 */
  order: 0; /* 默認 0，越小越靠前 */

  /* 放大比例（有剩餘空間時） */
  flex-grow: 0; /* 默認不放大 */
  flex-grow: 1; /* 佔據所有剩餘空間 */

  /* 縮小比例（空間不足時） */
  flex-shrink: 1; /* 默認按比例縮小 */
  flex-shrink: 0; /* 不縮小 */

  /* 主軸上的初始大小 */
  flex-basis: auto; /* 默認：由內容決定 */
  flex-basis: 200px; /* 指定基礎寬度 */

  /* 簡寫：grow shrink basis */
  flex: 1; /* 1 1 0% */
  flex: auto; /* 1 1 auto */
  flex: none; /* 0 0 auto */
  flex: 0 0 200px; /* 固定 200px，不增不縮 */

  /* 覆蓋容器的 align-items */
  align-self: center;
}
```

## 常用佈局模式

```css
/* 垂直水平居中 */
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 左右佈局，右側固定寬度 */
.layout {
  display: flex;
}
.layout-main {
  flex: 1;
}
.layout-sidebar {
  width: 240px;
  flex-shrink: 0;
}

/* 底部固定的頁腳 */
body {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
main {
  flex: 1;
} /* 撐開，把 footer 推到底部 */

/* 等高列 */
.columns {
  display: flex; /* 子項默認 align-items: stretch，自動等高 */
}

/* 自適應卡片列表（每行 3 列） */
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
.card {
  flex: 0 0 calc(33.33% - 12px); /* 減去 gap */
}
```

## 小結

- `justify-content` 控製主軸，`align-items` 控製交叉軸
- `flex: 1` 是最常用的等分寫法
- `gap` 屬性比用 `margin` 做間距乾淨很多
- `flex-shrink: 0` 防止固定寬度的側邊欄被壓縮
