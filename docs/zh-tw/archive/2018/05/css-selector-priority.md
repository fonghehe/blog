---
title: "CSS 選擇器優先順序"
date: 2018-05-06 14:48:34
tags:
  - CSS
readingTime: 1
description: "CSS 樣式不生效，大機率是優先順序問題。這篇文章把優先順序規則說清楚。"
wordCount: 235
---

CSS 樣式不生效，大機率是優先順序問題。這篇文章把優先順序規則說清楚。

## 優先順序權重

| 選擇器型別   | 權重             | 示例                                 |
| 
------------ | ---------------- | ------------------------------------ |
| !important   | 最高（覆蓋一切） | `color: red !important`              |
| 內聯樣式     | 1000             | `style="color: red"`                 |
| ID 選擇器    | 100              | `#header`                            |
| 類/屬性/偽類 | 10               | `.active`, `[type="text"]`, `:hover` |
| 元素/偽元素  | 1                | `div`, `p`, `::before`               |
| 萬用字元       | 0                | `*`                                  |

## 計算方法

權重是三位數分別計數（不是相加成十進位制）：

```
格式：(內聯, ID, 類/屬性/偽類, 元素)

a { color: red }                    → (0, 0, 0, 1)
.nav a { color: red }               → (0, 0, 1, 1)
#header .nav a { color: red }       → (0, 1, 1, 1)
```

比較時從高位開始，高位大的優先：

```css
/* 哪個會生效？ */
#header a {
  color: blue;
} /* (0, 1, 0, 1) */
.nav .link a {
  color: red;
} /* (0, 0, 2, 1) */

/* 結果：#header a 生效，因為 ID 位 1 > 0 */
```

## 同等優先順序：後寫的覆蓋前寫的

```css
.btn {
  color: red;
}
.btn {
  color: blue;
} /* 後寫的生效，按鈕是藍色 */
```

## 實際場景

```css
/* 場景：元件庫的樣式被業務樣式覆蓋 */

/* Element UI 裡的按鈕 */
.el-button {
  color: #409eff;
}

/* 你的覆蓋 */
.el-button {
  color: red;
} /* 不生效！因為 css 引入順序，元件庫可能在後面 */

/* 強制覆蓋（不推薦，但有時不得不用）*/
.el-button {
  color: red !important;
}

/* 更好的方式：增加特異性 */
.my-page .el-button {
  color: red;
} /* 加父級選擇器提高權重 */
```

## !important 的使用原則

```css
/* ❌ 濫用 !important 的惡性迴圈 */
.btn {
  color: red !important;
}
.special-btn {
  color: blue !important;
}
/* 都加了 !important，又回到後寫覆蓋前寫的問題 */

/* ✅ !important 的正當用途 */
/* 工具類：明確就是要強制覆蓋 */
.text-center {
  text-align: center !important;
}
.hidden {
  display: none !important;
}
```

## 常見誤區

```css
/* 誤區：以為層級越多權重越高 */
div div div div {
  color: red;
} /* (0, 0, 0, 4) */
.active {
  color: blue;
} /* (0, 0, 1, 0) */

/* 結果：.active 生效，類選擇器 > 元素選擇器 */

/* 誤區：偽元素 ::before 和偽類 :hover 權重 */
a::before {
} /* 權重 1（偽元素） */
a:hover {
} /* 權重 10（偽類） */
```

## 開發建議

```
1. 不要輕易用 !important，它會導致維護困難
2. 用 BEM 命名，降低巢狀深度，減少優先順序衝突
3. 碰到不生效，先用 DevTools 檢視哪條規則被覆蓋了
4. 元件庫樣式覆蓋，用加父級選擇器代替 !important
```

## 小結

- 權重從高到低：!important > 內聯 > ID(100) > 類/屬性/偽類(10) > 元素(1)
- 相同權重：後寫的覆蓋前寫的
- 權重比較是按位比較，不是簡單相加
- `!important` 能不用就不用，遇到問題先提高特異性