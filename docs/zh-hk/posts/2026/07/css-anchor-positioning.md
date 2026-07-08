---
title: "CSS Anchor Positioning 實戰：聲明式定位的新範式"
date: 2026-07-08 14:50:02
tags:
  - CSS
readingTime: 6
description: "CSS Anchor Positioning API 讓浮動元素的定位從 JavaScript 回歸 CSS。本文詳解 anchor-name、position-anchor、position-try 等核心屬性，通過 Tooltip、Popover、Dropdown 的純 CSS 實現展示聲明式定位的實踐。"
wordCount: 2600
---

前端開發中，浮動元素的定位一直是個讓人頭疼的問題。Tooltip、Popover、Dropdown 這些組件的核心需求很簡單——"貼着某個元素顯示"，但實現起來卻需要處理邊界檢測、翻轉、偏移、滾動跟隨等一整套邏輯。Floating UI、Popper.js 等庫的存在本身就說明了這個問題的複雜度。CSS Anchor Positioning API 的出現，讓這一切回歸到 CSS 的聲明式範式。

## 核心概念與瀏覽器支持

Anchor Positioning 的核心思想是：一個元素可以聲明"我要錨定到另一個元素"，然後通過 CSS 屬性描述相對於錨點的位置關係。瀏覽器負責處理邊界檢測和翻轉。

截至 2026 年 7 月，Anchor Positioning 的瀏覽器支持情況：

| 瀏覽器 | 版本 | 支持狀態 |
|--------|------|----------|
| Chrome | 125+ | 完整支持 |
| Edge | 125+ | 完整支持 |
| Safari | 26+ | 完整支持 |
| Firefox | 138+ | 完整支持 |
| Safari iOS | 26+ | 完整支持 |

Chrome 125 在 2024 年 5 月率先支持，到 2026 年主流瀏覽器已全部跟上。這意味着在生產環境中使用 Anchor Positioning 已經是可行方案，但仍需提供 fallback。

## anchor-name 與 position-anchor

兩個核心屬性構成 Anchor Positioning 的基礎：

```css
/* 錨點元素：聲明自己的錨點名稱 */
.anchor-button {
  anchor-name: --tooltip-anchor;
}

/* 浮動元素：聲明自己錨定到誰 */
.tooltip {
  position: fixed;
  position-anchor: --tooltip-anchor;
  /* 相對於錨點定位 */
  top: anchor(bottom);
  left: anchor(center);
  /* 水平居中對齊錨點 */
  translate: -50% 0;
}
```

`anchor-name` 在錨點元素上定義一個自定義標識符（必須以 `--` 開頭）。`position-anchor` 在浮動元素上引用這個標識符，建立錨定關係。

`anchor()` 函數是定位的核心，它接受一個方向參數：

- `anchor(top)` — 錨點元素的上邊緣
- `anchor(bottom)` — 錨點元素的下邊緣
- `anchor(left)` — 錨點元素的左邊緣
- `anchor(right)` — 錨點元素的右邊緣
- `anchor(center)` — 錨點元素的水平中心
- `anchor(center, 50%)` — 垂直中心（第二個參數指定百分比）

## 完整 Tooltip 實現

結合 `popover` API 實現一個純 CSS 的 Tooltip：

```html
<style>
  .tooltip-trigger {
    anchor-name: --trigger-anchor;
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
  }

  .tooltip {
    popover: auto;
    position: fixed;
    position-anchor: --trigger-anchor;
    /* 定位到錨點上方 */
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    /* 間距 */
    margin-bottom: 8px;

    background: #1f2937;
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;

    /* 入場動畫 */
    transition: opacity 0.2s, transform 0.2s;
    transform-origin: bottom center;
  }

  .tooltip:popover-open {
    opacity: 1;
  }

  .tooltip::backdrop {
    background: transparent;
  }
</style>

<button class="tooltip-trigger" popovertarget="my-tooltip">
  懸停查看提示
</button>

<div class="tooltip" id="my-tooltip" role="tooltip">
  這是一個純 CSS Tooltip
</div>
```

不需要一行 JavaScript。`popover` API 處理顯示/隱藏，`position-anchor` 處理定位。

## position-try Fallback 策略

Tooltip 在視口邊緣會被截斷。`position-try` 讓瀏覽器自動嘗試其他位置：

```css
.tooltip {
  position: fixed;
  position-anchor: --trigger-anchor;

  /* 默認位置：上方 */
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;

  /* Fallback：如果上方空間不夠，按順序嘗試其他位置 */
  position-try: flip-block flip-inline;
}

/* 也可以顯式定義 fallback 列表 */
.tooltip-explicit {
  position: fixed;
  position-anchor: --trigger-anchor;
  bottom: anchor(top);
  left: anchor(center);

  /* 顯式列出所有備選位置 */
  position-try-options: --top, --bottom, --left, --right;
}

@position-try --top {
  bottom: anchor(top);
  left: anchor(center);
  transform: translateX(-50%);
  margin-bottom: 8px;
}

@position-try --bottom {
  top: anchor(bottom);
  left: anchor(center);
  transform: translateX(-50%);
  margin-top: 8px;
}

@position-try --left {
  right: anchor(left);
  top: anchor(center);
  transform: translateY(-50%);
  margin-right: 8px;
}

@position-try --right {
  left: anchor(right);
  top: anchor(center);
  transform: translateY(-50%);
  margin-left: 8px;
}
```

`position-try: flip-block` 的行爲：當默認位置空間不夠時，瀏覽器自動翻轉——上方變下方，下方變上方。`flip-inline` 則左右翻轉。組合使用 `flip-block flip-inline` 可以覆蓋四個方向。

`@position-try` 規則則提供了完全自定義的能力。瀏覽器按 `position-try-options` 列出的順序逐個嘗試，直到找到能完整顯示的位置。

### position-try-fallbacks 優先級控制

```css
.dropdown {
  position: fixed;
  position-anchor: --dropdown-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  /* 策略 1：先嘗試翻轉，再嘗試移動 */
  position-try: flip-block;

  /* 策略 2：允許溢出但不改變尺寸 */
  position-try: flip-block allow-overflow;

  /* 策略 3：翻轉後如果還放不下，改變對齊方式 */
  position-try: flip-block shift-inline;
}
```

`allow-overflow` 允許浮動元素溢出視口而非翻轉，適用於內容不可裁剪的場景。`shift-inline` 在翻轉後仍放不下時，沿水平方向滑動而非保持居中對齊。

## Dropdown 實現與交互樣式

```css
.dropdown-menu {
  popover: auto;
  position: fixed;
  position-anchor: --menu-trigger;
  top: anchor(bottom);
  left: anchor(left);
  margin-top: 4px;

  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  min-width: 200px;
  padding: 4px;

  position-try: flip-block;

  /* 入場動畫 */
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top;
}

.dropdown-menu:popover-open {
  opacity: 1;
  transform: scaleY(1);
}

.dropdown-menu:not(:popover-open) {
  opacity: 0;
  transform: scaleY(0.9);
}

.dropdown-item {
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.dropdown-item:hover {
  background: #f3f4f6;
}
```

```html
<button class="menu-trigger" popovertarget="menu" style="anchor-name: --menu-trigger">
  菜單
  <svg width="12" height="12"><!-- arrow icon --></svg>
</button>

<div class="dropdown-menu" id="menu" role="menu">
  <div class="dropdown-item" role="menuitem">編輯</div>
  <div class="dropdown-item" role="menuitem">複製</div>
  <div class="dropdown-item" role="menuitem">刪除</div>
</div>
```

## 與 JavaScript 定位方案的對比

以 Floating UI 爲例，實現同等功能需要的代碼量：

```typescript
// Floating UI 實現
import { computePosition, flip, shift, offset, autoUpdate } from '@floating-ui/dom'

const trigger = document.querySelector('.trigger')
const tooltip = document.querySelector('.tooltip')

function update() {
  computePosition(trigger, tooltip, {
    placement: 'top',
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  }).then(({ x, y }) => {
    Object.assign(tooltip.style, {
      left: `${x}px`,
      top: `${y}px`,
    })
  })
}

autoUpdate(trigger, tooltip, update)

// 還需要手動處理顯示/隱藏
trigger.addEventListener('mouseenter', () => {
  tooltip.style.display = 'block'
  update()
})
trigger.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none'
})
```

| 維度 | CSS Anchor Positioning | Floating UI / Popper.js |
|------|----------------------|------------------------|
| 代碼量 | ~20 行 CSS | ~30 行 JS + 依賴包 |
| 運行時性能 | 瀏覽器原生，零開銷 | ResizeObserver + scroll 監聽 |
| 包體積 | 0 KB | 3-15 KB（gzip） |
| SSR 友好 | 是（純 CSS） | 否（需要客戶端 hydration） |
| 靈活性 | 有限的 fallback 策略 | 完全可編程的 middleware |
| 瀏覽器兼容 | 2026 主流全覆蓋 | 全兼容（IE11+） |
| 動態內容 | 自動跟隨 | 需要手動調用 update |

Anchor Positioning 在簡單場景下幾乎可以完全替代 JS 方案。但在需要複雜邏輯（如 sticky 定位、虛擬化列表內的 tooltip、跨 iframe 定位）時，Floating UI 仍然更合適。

## 無障礙（a11y）考慮

Popover API 的 `popover` 屬性自帶部分無障礙特性：

- `popover="auto"` 會自動處理焦點陷阱（focus trap）
- 按 Escape 自動關閉
- 點擊外部自動關閉
- `aria-expanded` 需要手動管理

```html
<button
  class="tooltip-trigger"
  popovertarget="my-tooltip"
  aria-describedby="my-tooltip"
  style="anchor-name: --trigger-anchor"
>
  操作按鈕
</button>

<div
  class="tooltip"
  id="my-tooltip"
  role="tooltip"
  popover="auto"
>
  點擊此按鈕執行操作
</div>
```

`role="tooltip"` 配合 `aria-describedby` 確保屏幕閱讀器能正確關聯提示信息。對於 Dropdown 類組件，需要手動實現鍵盤導航：

```javascript
// 最小化的鍵盤導航補充
const menu = document.querySelector('#menu')
const trigger = document.querySelector('[popovertarget="menu"]')

trigger.addEventListener('click', () => {
  if (menu.matches(':popover-open')) {
    const firstItem = menu.querySelector('[role="menuitem"]')
    firstItem?.focus()
  }
})

menu.addEventListener('keydown', (e) => {
  const items = [...menu.querySelectorAll('[role="menuitem"]')]
  const currentIndex = items.indexOf(document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[(currentIndex + 1) % items.length]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[(currentIndex - 1 + items.length) % items.length]?.focus()
  } else if (e.key === 'Escape') {
    trigger.focus()
  }
})
```

## 瀏覽器兼容性處理

使用 `@supports` 檢測並提供 fallback：

```css
/* Fallback: 不支持 Anchor Positioning 時使用絕對定位 */
.tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 8px;
}

@supports (anchor-name: --x) {
  .tooltip {
    position: fixed;
    position-anchor: --trigger-anchor;
    bottom: anchor(top);
    left: anchor(center);
    transform: translateX(-50%);
    margin-top: 0;
    margin-bottom: 8px;
  }
}
```

對於需要完整 fallback 的項目，可以使用 `@floating-ui/dom` 作爲 polyfill：

```javascript
// 檢測是否支持 Anchor Positioning
const supportsAnchor = CSS.supports('anchor-name: --x')

if (!supportsAnchor) {
  // 降級到 Floating UI
  const { autoUpdate, computePosition, offset, flip, shift } = await import(
    '@floating-ui/dom'
  )
  // 初始化所有 .tooltip 元素
}
```

漸進增強策略：現代瀏覽器獲得原生體驗，舊瀏覽器使用 JS fallback，兩種方案通過 `@supports` 切換。

## 優缺點分析

**優點：**

- 零 JavaScript 運行時開銷，定位計算由瀏覽器原生完成
- 與 Popover API 深度整合，顯示/隱藏/定位一體化
- 聲明式語法比命令式 JS 更易維護
- 自動處理滾動、resize 等邊界場景
- SSR 友好，不依賴客戶端 JS

**缺點：**

- Fallback 策略不如 Floating UI 靈活，複雜場景受限
- 動態錨點（如列表項的 tooltip）需要動態設置 `anchor-name`，仍需少量 JS
- 動畫控制受限於 CSS transition，無法實現基於物理的彈性動畫
- 跨容器定位（如 modal 內的 tooltip）存在 stacking context 問題
- 調試工具不完善，Chrome DevTools 對 anchor 關係的可視化仍需改進

## 未來展望

CSS Anchor Positioning Level 2 正在討論以下擴展：

- `anchor-scroll` — 支持錨點在滾動容器內的定位
- `anchor-pos` — 更精細的位置控制，支持百分比和計算
- 與 View Transitions API 的集成 — 定位變化時的平滑過渡
- `anchor-match` — 基於錨點狀態的條件樣式

這些擴展將進一步縮小與 JS 方案的能力差距。

## 個人觀點

Anchor Positioning 是 CSS 回歸聲明式本質的又一個裏程碑。從 Flexbox 到 Grid 到 Container Queries 再到 Anchor Positioning，CSS 正在逐步收回被 JavaScript 佔據的領域。對於絕大多數 Tooltip 和 Dropdown 場景，純 CSS 方案已經足夠，而且性能更好、代碼更少。

但我不建議在生產環境中完全拋棄 Floating UI。原因有兩點：一是兼容性過渡期需要 polyfill，二是複雜場景（如富文本編輯器內的浮動菜單）仍然需要 JS 的精確控制。務實的做法是：簡單場景用 CSS，複雜場景用 JS，通過 `@supports` 讓兩者共存。

## 小結

CSS Anchor Positioning 通過 `anchor-name`、`position-anchor` 和 `anchor()` 函數實現了聲明式定位，`position-try` 處理邊界翻轉。配合 Popover API，可以在純 CSS 中實現完整的 Tooltip、Dropdown 組件。與 Floating UI 相比，它零運行時開銷、SSR 友好，但靈活性有限。在 2026 年的瀏覽器環境下，Anchor Positioning 已具備生產可用性，建議採用漸進增強策略：原生優先，JS fallback 兜底。
