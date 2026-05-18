---
title: "前端代碼審查指南"
date: 2018-05-22 11:15:39
tags:
  - 前端
readingTime: 2
description: "代碼審查（Code Review）是提升團隊代碼質量最有效的手段之一。但很多團隊要麼不做，要麼做了流於形式。這篇文章分享我們團隊的實踐經驗。"
---

代碼審查（Code Review）是提升團隊代碼質量最有效的手段之一。但很多團隊要麼不做，要麼做了流於形式。這篇文章分享我們團隊的實踐經驗。

## 為什麼 Code Review 值得投入

- 發現 bug：比測試發現的成本低 10 倍
- 傳播知識：新人能快速學習團隊最佳實踐
- 統一風格：減少"個人風格"代碼
- 設計把關：在代碼合併前發現架構問題
- 分散知識：避免只有一個人懂某塊代碼

## 提交 PR 的規範

好的 PR 讓審查者輕鬆，差的 PR 讓人不知從何看起。

**PR 大小**：單個 PR 不超過 400 行改動（不含自動生成的文件）。大需求拆分成多個 PR。

**PR 描述模板**：

```markdown
## 做了什麼

用户現在可以在個人設置裏上傳頭像。

## 改動説明

- 新增 `AvatarUpload` 組件，支持裁剪
- `userStore` 新增 `updateAvatar` action
- 上傳限制：5MB，支持 jpg/png/gif

## 測試驗證

- [x] 正常上傳流程
- [x] 文件大小超限提示
- [x] 文件類型不支持提示
- [x] 上傳失敗重試

## 相關截圖

[上傳頭像截圖]
```

## 審查者應該關注什麼

### 必須檢查

**正確性**

```javascript
// ❌ 邏輯錯誤：應該用 || 而不是 &&
if (!isAdmin && !hasPermission) {
  // 實際上：管理員 OR 有權限 其中一個滿足就放行
}

// ✅ 修正
if (!isAdmin && !hasPermission) {  // 兩個都沒有才拒絕
```

**安全性**

```javascript
// ❌ 直接把用户輸入插入 HTML
element.innerHTML = userInput;

// ❌ 把敏感信息輸出到日誌
console.log("Token:", userToken);
```

**邊界情況**

```javascript
// ❌ 沒有處理數組為空的情況
const firstItem = list[0].name; // list 為空時 crash

// ✅
const firstItem = list[0]?.name || "未知";
```

### 重點關注

**可維護性**：函數太長？邏輯太複雜？變量名不清晰？

```javascript
// ❌ 難以理解
function p(d, t) {
  return d.filter((i) => i.s === t).map((i) => i.v);
}

// ✅ 清晰
function filterValuesByStatus(data, targetStatus) {
  return data
    .filter((item) => item.status === targetStatus)
    .map((item) => item.value);
}
```

**重複代碼**：相同邏輯出現多次，是否應該抽取？

**性能問題**：

```javascript
// ❌ 在渲染循環裏做昂貴計算
// Vue 模板裏
<li v-for="item in list" :class="{ active: expensiveCompute(item) }">

// ✅ 預計算
computed: {
  processedList() {
    return this.list.map(item => ({
      ...item,
      isActive: this.expensiveCompute(item)
    }))
  }
}
```

### 可以不要求的

- 代碼風格（ESLint 會處理）
- 小的命名偏好（只要不影響可讀性）
- 實現方式（只要正確且可維護）

## 給出好的反饋

**不好的審查意見**：

```
這代碼寫得太爛了，重新寫。
這個函數太長。
```

**好的審查意見**：

```
這裏的 for 循環可以用 Array.reduce 簡化，
而且當前實現時間複雜度是 O(n²)，數據量大時會有性能問題。
參考：[鏈接]

考慮提取成獨立函數，比如 calculateTotalPrice(items)，
這樣在其他地方也能複用，測試也更容易寫。

可選建議：這裏可以加一個邊界檢查，list 為空時
直接返回 []，避免後續處理出現異常。（不是必須改）
```

## 審查的節奏

- 不要一次 review 超過 500 行
- 複雜 PR 安排專門時間，不要在碎片時間審查
- 給出 comment 後等作者修改，不要批了又發現新問題（應該第一次就看全）
- PR 不是作業，是協作工具，避免權威式審查

## 不要在 PR 裏爭架構

如果發現架構層面的問題，**應該先溝通，不是拒絕 PR**：

1. 標記為 `需要討論`，線下或者 issue 裏討論
2. 如果是小項目且影響不大，先合併，後續重構
3. 如果確實需要改，給出具體建議而不是"重寫"

## 小結

- PR 小而聚焦，附上清晰的描述
- 審查聚焦正確性、安全性、可維護性
- 反饋具體、建設性，區分"必須改"和"建議"
- Code Review 是合作，不是審判
