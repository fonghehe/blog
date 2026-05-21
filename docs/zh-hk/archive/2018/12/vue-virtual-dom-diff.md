---
title: "Vue 虛擬 DOM 和 diff 算法"
date: 2018-12-01 10:43:17
tags:
  - Vue
readingTime: 1
description: "面試常被問到\"Vue 的 diff 算法是怎麼工作的\"，網上的文章大多説得很抽象。這裏用實際例子説清楚。"
wordCount: 264
---

面試常被問到"Vue 的 diff 算法是怎麼工作的"，網上的文章大多説得很抽象。這裏用實際例子説清楚。

## 為什麼要有虛擬 DOM

操作真實 DOM 很慢，因為每次操作都可能觸發瀏覽器的重排（layout）和重繪（paint）。

```javascript
// 如果需要更新一個列表，最暴力的方式：
container.innerHTML = items.map((item) => `<li>${item.name}</li>`).join("");
// 問題：銷燬了所有 DOM 節點，再創建新的，損失了 DOM 狀態（如焦點、滾動位置）

// 理想方式：只更新變化的部分
// 虛擬 DOM 就是用 JS 對象模擬 DOM，通過對比新舊虛擬 DOM 找出最小差異
```

## 虛擬 DOM 的結構

```javascript
// 真實 DOM
// <div class="container">
//   <ul>
//     <li>Item 1</li>
//   </ul>
// </div>

// 對應的虛擬 DOM（簡化）
const vnode = {
  tag: "div",
  data: { class: "container" },
  children: [
    {
      tag: "ul",
      children: [{ tag: "li", children: [{ text: "Item 1" }] }],
    },
  ],
};
```

## diff 算法的核心思路

Vue 的 diff 算法做了幾個關鍵假設（來自 React 的 diff）：

```
1. 只比較同層節點（不跨層比較）
   → 如果節點從 div A 移到 div B，視為刪除後新增
   → 現實中 DOM 跨層移動非常少見，這個假設通常正確

2. 不同類型的節點，直接替換（不深入比較）
   → <div> 變成 <p>，直接替換整棵子樹

3. 相同類型的節點，通過 key 判斷是否是同一個節點
   → 沒有 key：按位置比較
   → 有 key：匹配相同 key 的節點，實現重排
```

## 列表 diff：雙端比較

Vue 2 的列表 diff 用**雙端比較**：同時從新舊列表的兩端開始比較：

```
舊: [A, B, C, D]
新: [D, A, B, C]

步驟：
1. 新頭(D) vs 舊頭(A) → 不同
2. 新尾(C) vs 舊尾(D) → 不同
3. 新頭(D) vs 舊尾(D) → 相同！把 D 移到前面
   舊: [A, B, C]（D 已處理）
   新: [A, B, C]
4. 剩餘：A=A, B=B, C=C → 都相同，不需要移動

結果：只需要移動 D，不需要重建整個列表
```

## key 的重要性

```html
{% raw %}
<!-- ❌ 沒有 key：按位置 diff，可能造成不必要的更新 -->
<li v-for="item in list">{{ item.name }}</li>

<!-- 假設 list 從 [A, B, C] 變成 [B, C]（刪除了 A）
Vue 會更新 li[0] 的內容（A→B），更新 li[1] 的內容（B→C），刪除 li[2]
做了 2 次更新 + 1 次刪除 -->

<!-- ✅ 有 key：精確匹配，只刪除對應節點 -->
<li v-for="item in list" :key="item.id">{{ item.name }}</li>
<!-- Vue 發現 B 和 C 沒變，只刪除 A
做了 1 次刪除 -->
{% endraw %}
```

**key 的另一個作用**：強制重新創建組件（用於清除狀態）：

```html
<!-- 切換用户時，強制重新創建 UserProfile 組件，清除舊用户的狀態 -->
<UserProfile :key="userId" :userId="userId" />
```

## 小結

- 虛擬 DOM 是 JS 對象模擬的 DOM，通過 diff 找最小變化，減少真實 DOM 操作
- diff 的三個假設：同層比較、不同類型直接替換、用 key 匹配
- Vue 2 的列表 diff 用雙端比較，效率較高
- 列表渲染務必加 `:key`，用穩定的唯一 id，不要用 index（除非列表不會變化）
