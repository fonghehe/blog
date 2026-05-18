---
title: "前端開發者應該知道的 Web 無障礙（a11y）基礎"
date: 2019-05-26 10:51:45
tags:
  - 前端
readingTime: 6
description: "無障礙（accessibility，縮寫 a11y）在國內前端開發中經常被忽視，但它並不只是\"給盲人用的\"。鍵盤用户、色覺障礙用户、臨時性損傷用户（比如手臂骨折只能單手操作）都是無障礙的受益者。作為前端開發者，掌握基礎的 a11y 知識是專業素養的一部分。"
---

無障礙（accessibility，縮寫 a11y）在國內前端開發中經常被忽視，但它並不只是"給盲人用的"。鍵盤用户、色覺障礙用户、臨時性損傷用户（比如手臂骨折只能單手操作）都是無障礙的受益者。作為前端開發者，掌握基礎的 a11y 知識是專業素養的一部分。

## 為什麼前端要關注無障礙

根據世界衞生組織的數據，全球約有 10 億人有某種形式的殘障。在 Web 開發中：

- 視力障礙用户依賴 **屏幕閲讀器**（如 NVDA、VoiceOver）來"聽"網頁
- 運動障礙用户依賴 **鍵盤導航** 而非鼠標
- 色覺障礙用户無法區分某些顏色組合
- 認知障礙用户需要清晰的結構和提示

做好無障礙不僅能服務這些用户，還能提升整體用户體驗和 SEO。

## 語義化 HTML 是第一道防線

最有效的無障礙手段就是正確使用 HTML 標籤。很多開發者習慣用 `div` 和 `span` 包一切，但語義化標籤自帶無障礙屬性。

```html
<!-- 不好的做法 -->
<div class="header">
  <div class="nav">
    <span class="nav-item" onclick="goHome()">首頁</span>
    <span class="nav-item" onclick="goAbout()">關於</span>
  </div>
</div>
<div class="main">
  <div class="article">
    <span class="title">文章標題</span>
    <div>文章內容...</div>
  </div>
</div>
<div class="footer">版權信息</div>
```

屏幕閲讀器看到的是一堆沒有意義的 `div` 和 `span`。用户不知道哪裏是導航、哪裏是正文、哪裏是頁腳。

```html
<!-- 好的做法 -->
<header>
  <nav aria-label="主導航">
    <ul>
      <li><a href="/">首頁</a></li>
      <li><a href="/about">關於</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h1>文章標題</h1>
    <p>文章內容...</p>
  </article>
</main>
<footer>
  <p>&copy; 2019 我的博客</p>
</footer>
```

屏幕閲讀器可以通過 `<header>`、`<nav>`、`<main>`、`<article>`、`<footer>` 快速定位頁面結構，用户可以用快捷鍵跳轉到不同區域。

### 常用語義化標籤速查

```html
<!-- 頁面結構 -->
<header>    <!-- 頁頭或某個區塊的頭部 -->
<nav>       <!-- 導航區域 -->
<main>      <!-- 頁面主內容（一個頁面只能有一個） -->
<article>   <!-- 獨立的文章/內容塊 -->
<section>   <!-- 有主題的內容分組 -->
<aside>     <!-- 側邊欄或附屬內容 -->
<footer>    <!-- 頁腳 -->

<!-- 文本語義 -->
<strong>    <!-- 重要文本（屏幕閲讀器會加重語氣） -->
<em>        <!-- 強調文本 -->
<mark>      <!-- 高亮/標記文本 -->
<time>      <!-- 時間 -->

<!-- 表單相關 -->
<label>     <!-- 表單標籤，必須與 input 關聯 -->
<fieldset>  <!-- 表單分組 -->
<legend>    <!-- fieldset 的標題 -->
<button>    <!-- 按鈕（不要用 div 模擬） -->

<!-- 列表 -->
<ul>        <!-- 無序列表 -->
<ol>        <!-- 有序列表 -->
<dl>        <!-- 描述列表（術語+定義） -->
```

## ARIA 屬性的正確使用

當語義化 HTML 不足以表達組件的含義時，需要使用 **WAI-ARIA**（Web Accessibility Initiative - Accessible Rich Internet Applications）屬性來補充。

ARIA 屬性的核心原則是：**能用原生 HTML 語義解決的，就不要用 ARIA**。

### ARIA 角色（role）

```html
<!-- 用 role 告訴輔助技術這個元素是什麼 -->
<div role="alert">
  用户名不能為空
</div>

<!-- 自定義 Tabs 組件 -->
<div role="tablist" aria-label="標籤頁">
  <button role="tab" aria-selected="true"  aria-controls="panel-1">選項卡一</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">選項卡二</button>
</div>
<div role="tabpanel" id="panel-1">
  <p>選項卡一的內容</p>
</div>
<div role="tabpanel" id="panel-2" hidden>
  <p>選項卡二的內容</p>
</div>
```

```html
<!-- 自定義 Modal 彈窗 -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">確認刪除</h2>
  <p id="dialog-desc">刪除後不可恢復，確定要刪除這條記錄嗎？</p>
  <button>確認刪除</button>
  <button>取消</button>
</div>
```

### ARIA 狀態屬性

```html
<!-- aria-hidden：對輔助技術隱藏元素 -->
<div aria-hidden="true">
  <!-- 裝飾性圖標，屏幕閲讀器跳過 -->
  <span class="icon-star"></span>
</div>

<!-- aria-expanded：展開/收起狀態 -->
<button aria-expanded="false" aria-controls="dropdown-menu">
  更多選項
  <span class="arrow-down"></span>
</button>
<ul id="dropdown-menu" hidden>
  <li><a href="#">選項一</a></li>
  <li><a href="#">選項二</a></li>
</ul>

<!-- aria-disabled：禁用狀態（比 disabled 屬性更靈活，仍可被聚焦） -->
<button aria-disabled="true">提交（表單未完成）</button>

<!-- aria-live：動態內容區域 -->
<div aria-live="polite" aria-atomic="true">
  <!-- 當內容變化時，屏幕閲讀器會自動朗讀 -->
  <p>已加載 3 條新消息</p>
</div>
```

`aria-live` 的取值：
- `polite`：等當前內容讀完再播報（大多數情況用這個）
- `assertive`：立即打斷當前內容播報（用於錯誤提示等緊急信息）
- `off`：不播報

## 表單無障礙

表單是最容易出現無障礙問題的地方。

```html
<!-- 錯誤做法：input 沒有關聯 label -->
<input type="text" placeholder="請輸入郵箱">
<span>請輸入郵箱</span>
<!-- 問題：屏幕閲讀器無法知道這個 input 的用途 -->
<!-- placeholder 不是 label 的替代品，它消失後用户就忘了要填什麼 -->
```

```html
<!-- 正確做法：用 for/id 關聯 label 和 input -->
<label for="email">郵箱地址</label>
<input type="email" id="email" name="email"
       aria-required="true"
       aria-describedby="email-hint email-error">
<span id="email-hint">用於接收通知郵件</span>
<span id="email-error" role="alert" aria-live="assertive"></span>
```

### 表單驗證與錯誤提示

```html
<!-- 完整的表單驗證示例 -->
<form>
  <div class="form-group">
    <label for="username">用户名 <span aria-hidden="true">*</span></label>
    <input
      type="text"
      id="username"
      name="username"
      aria-required="true"
      aria-invalid="false"
      aria-describedby="username-error"
    >
    <span id="username-error" class="error" role="alert" hidden>
      用户名必須包含 3-20 個字符
    </span>
  </div>

  <div class="form-group">
    <label for="password">密碼 <span aria-hidden="true">*</span></label>
    <input
      type="password"
      id="password"
      name="password"
      aria-required="true"
      aria-invalid="false"
      aria-describedby="password-error"
    >
    <span id="password-error" class="error" role="alert" hidden>
      密碼至少 8 位，需包含字母和數字
    </span>
  </div>

  <button type="submit">註冊</button>
</form>
```

```javascript
// JavaScript 驗證時更新 ARIA 狀態
function validateField(input, errorEl, isValid) {
  if (isValid) {
    input.setAttribute('aria-invalid', 'false');
    errorEl.hidden = true;
  } else {
    input.setAttribute('aria-invalid', 'true');
    errorEl.hidden = false;
    // 把焦點移到第一個錯誤字段
    input.focus();
  }
}
```

## 鍵盤導航

很多用户完全依賴鍵盤操作網頁。確保所有交互元素都可以通過鍵盤訪問。

### Tab 焦點管理

```html
<!-- tabindex 的用法 -->
<!-- tabindex="0"：按 DOM 順序參與 Tab 導航 -->
<div tabindex="0" role="button">自定義按鈕</div>

<!-- tabindex="-1"：可以通過 JS 聚焦，但不參與 Tab 導航 -->
<div tabindex="-1" id="modal-content">彈窗內容</div>

<!-- tabindex="正數"：儘量不要用，會打亂自然的 Tab 順序 -->
<!-- 有害做法 -->
<a href="/" tabindex="1">首頁</a>
<a href="/about" tabindex="3">關於</a>
<a href="/contact" tabindex="2">聯繫</a>
<!-- Tab 順序變成了：首頁 → 聯繫 → 關於，違反直覺 -->
```

### 自定義組件的鍵盤交互

```javascript
// 自定義下拉菜單的鍵盤處理
class Dropdown {
  constructor(el) {
    this.el = el;
    this.trigger = el.querySelector('[role="button"]');
    this.menu = el.querySelector('[role="menu"]');
    this.items = Array.from(el.querySelectorAll('[role="menuitem"]'));
    this.currentIndex = -1;

    this.trigger.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.open();
          this.focusItem(0);
          break;
        case 'Escape':
          this.close();
          break;
      }
    });

    this.menu.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.focusItem(this.currentIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.focusItem(this.currentIndex - 1);
          break;
        case 'Home':
          e.preventDefault();
          this.focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          this.focusItem(this.items.length - 1);
          break;
        case 'Escape':
          this.close();
          this.trigger.focus();
          break;
      }
    });
  }

  focusItem(index) {
    // 循環導航
    if (index < 0) index = this.items.length - 1;
    if (index >= this.items.length) index = 0;
    this.currentIndex = index;
    this.items[index].focus();
  }

  open() {
    this.menu.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.currentIndex = -1;
  }
}
```

### 焦點陷阱（Focus Trap）

彈窗打開時，焦點應該限制在彈窗內，不能 Tab 到彈窗背後的內容。

```javascript
// Modal 的焦點陷阱實現
function trapFocus(element) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const focusableElements = element.querySelectorAll(
    focusableSelectors.join(', ')
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });

  // 打開彈窗時把焦點移到第一個可聚焦元素
  firstFocusable.focus();
}
```

## 顏色與視覺設計

### 顏色對比度

WCAG 2.0 要求文字和背景的對比度至少達到 **4.5:1**（普通文本）或 **3:1**（大文本，18px 以上或 14px 加粗）。

```css
/* 不好的對比度 - 淺灰字白底 */
.bad-example {
  color: #999;
  background: #fff;
  /* 對比度約 2.8:1，不達標 */
}

/* 好的對比度 */
.good-example {
  color: #595959;
  background: #fff;
  /* 對比度約 7:1，達標 */
}

/* 錯誤提示不要只靠顏色 */
.error-field {
  border-color: red;
  /* 色盲用户看不到紅色邊框的區別 */
}

/* 正確做法：顏色 + 圖標 + 文字 */
.error-field {
  border-color: #d32f2f;
  border-width: 2px;
}
/* 配合 HTML */
/* <span class="error-icon" aria-hidden="true">!</span>
   <span class="error-text">此字段必填</span> */
```

### 焦點樣式

```css
/* 不要隨便移除 outline！ */
/* 很多人這樣做 ↓ */
*:focus {
  outline: none;  /* 破壞了鍵盤可訪問性 */
}

/* 正確做法：提供清晰的自定義焦點樣式 */
:focus {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

/* 如果一定要去掉默認 outline，必須提供替代樣式 */
button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.4);
}

/* 對鼠標用户不需要焦點環，對鍵盤用户需要 */
/* 注意：focus-visible 在 2019 年還是較新的提案，瀏覽器支持有限 */
:focus:not(:focus-visible) {
  outline: none;
}
:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}
```

## 圖片的 alt 文本

```html
<!-- 信息性圖片：描述圖片內容 -->
<img src="chart.png" alt="2019年Q1銷售額同比增長25%，從120萬增至150萬">

<!-- 裝飾性圖片：空 alt，屏幕閲讀器跳過 -->
<img src="divider.png" alt="" role="presentation">

<!-- 鏈接中的圖片：描述鏈接目標 -->
<a href="/products">
  <img src="product-thumb.jpg" alt="查看產品詳情">
</a>

<!-- SVG 的無障礙處理 -->
<svg role="img" aria-labelledby="svg-title svg-desc">
  <title id="svg-title">銷售趨勢圖</title>
  <desc id="svg-desc">折線圖顯示過去12個月的銷售趨勢，整體呈上升趨勢</desc>
  <!-- SVG 內容 -->
</svg>
```

## 使用屏幕閲讀器測試

光寫代碼不夠，需要實際測試。macOS 自帶 VoiceOver：

```bash
# macOS 開啓 VoiceOver
# 快捷鍵：Cmd + F5（或 Touch ID 連按三次）

# Windows 免費屏幕閲讀器
# 下載 NVDA：https://www.nvaccess.org/
```

基本的 VoiceOver 導航快捷鍵：

```
VO = Control + Option

VO + A：從頭開始朗讀
VO + →/←：逐個元素導航
VO + U：打開轉子（Rotor），查看標題/鏈接/地標列表
VO + Space：激活當前元素
Tab：在可交互元素間跳轉
```

測試時檢查：
1. 能否只用鍵盤完成所有操作
2. 屏幕閲讀器能否正確讀出每個元素的含義
3. 動態內容變化時是否會被播報
4. 焦點順序是否符合邏輯
5. 圖片是否有正確的 alt 文本

## 小結

- 語義化 HTML 是無障礙的基礎，儘量用原生標籤而不是 div + ARIA
- ARIA 屬性是補充手段，遵循"能用原生 HTML 就不用 ARIA"的原則
- 表單必須有關聯的 label，錯誤提示要使用 `aria-invalid` 和 `role="alert"`
- 鍵盤導航是核心需求：所有交互元素必須可以通過 Tab 聚焦，用 Enter/Space 激活
- 顏色對比度要達標，不要只靠顏色傳遞信息
- 彈窗需要焦點陷阱，關閉後焦點回到觸發元素
- 務必用屏幕閲讀器實際測試，不要只在開發者工具裏檢查
