---
title: "CSS position 定位與層疊上下文：落地路徑與實戰建議"
date: 2018-07-05 10:44:49
tags:
  - CSS
readingTime: 1
description: "`position` 是前端必知必會的屬性，但 `z-index` 失效的問題坑了不少人。"
wordCount: 223
---

`position` 是前端必知必會的屬性，但 `z-index` 失效的問題坑了不少人。

## 五種定位方式

```css
/* static：默認，不參與 z-index 堆積疊 */
position: static;

/* relative：相對自身原始位置偏移，不脱離文檔流 */
position: relative;
top: 10px; /* 向下移 10px，原位置仍佔據空間 */

/* absolute：相對最近的非 static 祖先定位，脱離文檔流 */
position: absolute;
top: 0;
right: 0; /* 右上角 */

/* fixed：相對視口定位，脱離文檔流，滾動不跟隨 */
position: fixed;
bottom: 20px;
right: 20px; /* 固定在右下角 */

/* sticky：滾動到閾值前是 relative，之後變 fixed */
position: sticky;
top: 60px; /* 滾動到距視口頂部 60px 時固定 */
```

## absolute 定位的參照系

找最近的 **非 static** 祖先：

```html
<div class="parent" style="position: relative;">
  <!-- 參照這個 -->
  <div class="child" style="position: absolute; top: 10px; left: 10px;"></div>
</div>
```

如果沒有非 static 祖先，就相對 `<html>` 定位。

## 層疊上下文（Stacking Context）

`z-index` 失效通常是不理解層疊上下文導致的。

創建層疊上下文的條件（常見的）：

- `position: relative/absolute/fixed` + `z-index` 不為 auto
- `opacity < 1`
- `transform: translate/rotate/scale` 等
- `filter` 非 none
- `will-change`

```html
<div style="position: relative; z-index: 1;">
  <!-- 這裏有自己的層疊上下文 -->
  <div style="position: absolute; z-index: 999;">
    <!-- z-index: 999 隻在父級上下文內有效 -->
    <!-- 無法超過兄弟的 z-index: 2 -->
  </div>
</div>
<div style="position: relative; z-index: 2;">
  <!-- 這個在 z-index: 999 的元素之上 -->
</div>
```

**理解關鍵**：子元素的 `z-index` 隻在父層疊上下文內比較，無法跳出。

## 常見陷阱：transform 創建層疊上下文

```css
/* 父元素有 transform，子元素 fixed 失效！ */
.parent {
  transform: translateZ(0); /* 或 will-change: transform */
}
.child {
  position: fixed; /* 變成相對 parent 定位，而非視口 */
}
```

## 實用技巧

```css
/* 垂直水平居中（absolute 經典做法） */
.centered {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

/* 固定底部導航（Safari 安全區域處理） */
.bottom-nav {
  position: fixed;
  bottom: 0;
  bottom: env(safe-area-inset-bottom); /* iOS 劉海屏 */
  width: 100%;
}

/* sticky 表頭 */
thead th {
  position: sticky;
  top: 0;
  background: white; /* 必須有背景色，否則會透明 */
  z-index: 1;
}
```

## 小結

- `absolute` 找最近的非 static 祖先
- 層疊上下文隔離了內部的 `z-index`，這是 z-index 失效的根本原因
- `transform`、`opacity < 1`、`filter` 都會創建層疊上下文
- `sticky` 需要父元素有確定的高度且不能 `overflow: hidden`
