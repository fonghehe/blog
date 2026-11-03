---
title: "輸入法組合態：搜索框為什麼會吞字、誤提交和重複請求"
date: 2026-11-03 10:28:18
tags:
  - JavaScript
  - 工程化
description: "把正在組合的文本與已提交輸入分開，設計中文、日文和快捷鍵的交互邊界。"
readingTime: 4
wordCount: 1145
---

用戶輸入拼音並按回車選擇候選詞，頁面卻把半成品拼音當成搜索提交。另一個輸入框每次變更都格式化並寫回值，候選窗口突然關閉。英文鍵盤測試正常，並不能證明輸入體驗正確，因為組合輸入不是一串普通按鍵。

這裡討論獨立的原生搜索輸入框。框架受控輸入、富文本編輯器和移動端鍵盤還要結合各自事件模型驗證，不能靠一段通用監聽器覆蓋全部環境。

## 組合中的文本不是最終業務值

`compositionstart` 到 `compositionend` 之間，輸入法維護候選與中間文本。用戶可能多次更新、選擇或取消，最終文本未必等於任何中間結果。畫面可以顯示當前值，但自動搜索、長度截斷、持久化和格式化應先決定是否允許處理中間態。

尤其不要在組合過程中把 `value` 強行替換成清洗後的版本。DOM 值、選區和輸入法內部狀態可能失去對應。對於受控組件，可以更新展示用草稿，同時推遲業務提交；不應簡單忽略全部事件，讓下一次渲染又把舊值蓋回輸入框。

## 同時關注事件屬性和組件自己的組合標記

[UI Events](https://w3c.github.io/uievents/#events-compositionevents)定義組合事件，[Input Events](https://www.w3.org/TR/input-events-2/)描述輸入意圖。真實瀏覽器、系統和輸入法的邊界事件順序需要測試。下面監聽原生輸入，組合期間不發佈業務變更，結束後讀取最終 DOM 值，並用最後一次已發佈值去重。

```javascript
export function bindSearch(input, onChange, onSubmit) {
  let composing = false;
  let active = true;
  let last = input.value;
  const publish = () => {
    if (!active || composing || input.value === last) return;
    last = input.value;
    onChange(last);
  };
  const start = () => { composing = true; };
  const end = () => {
    composing = false;
    queueMicrotask(publish);
  };
  const change = event => {
    if (!event.isComposing) publish();
  };
  const key = event => {
    if (event.key !== 'Enter' || composing || event.isComposing) return;
    event.preventDefault();
    publish();
    onSubmit(input.value);
  };
  const listeners = [
    ['compositionstart', start], ['compositionend', end],
    ['input', change], ['keydown', key],
  ];
  for (const [name, fn] of listeners) input.addEventListener(name, fn);
  return () => {
    active = false;
    for (const [name, fn] of listeners) input.removeEventListener(name, fn);
  };
}
```

微任務用於合併當前事件序列中的讀取，不是跨瀏覽器正確性的證明。如果目標輸入法在稍後任務才發出最終 input，後續 input 仍會讀取新值；相同值不會重複通知。對回車的組合標記也必須在目標系統驗證，必要的兼容補丁應綁定具體環境證據，不能堆砌魔法延時。

## 把確認候選與提交搜索作為兩個意圖

第一次回車可能只是確認候選，下一次才是提交。不要在捕獲階段統一攔截所有 Enter，再讓輸入框追著修復。表單默認提交、全局快捷鍵與輸入控件需要約定優先級；示例的獨立輸入框自行處理回車，集成表單時應避免再由 submit 監聽器重複發送。

輸入是否變化與用戶是否顯式提交也不相同。例子對 `onChange` 去重，但允許同一個關鍵詞再次 `onSubmit`，因為用戶可能主動刷新結果。網絡層再根據查詢身份、請求世代和防抖策略處理併發，不應把輸入協議和緩存策略揉成一個函數。

## 校驗要保留可編輯的中間狀態

金額框中的負號、小數點和搜索中的尾隨空格可能暫時不是合法最終值，但仍是自然輸入過程的一部分。可以讓草稿表示中間態，失焦或提交時再轉換為業務值。字符上限也應區分代碼單元和可見字符，不要在組合進行一半時切掉文本。

粘貼、語音輸入、自動填充和撤銷未必產生預想的 keydown 序列，因此業務變更應基於 input 而不是只監聽按鍵。選擇文本後替換、組合取消和焦點切換也要保持光標與草稿一致。若異步建議返回，必須核對當前查詢，避免舊建議覆蓋正在輸入的內容。

## 自動測試只能覆蓋部分真實輸入鏈

單元測試可以驗證標記、去重、銷毀清理和明確給定的事件序列。人為派發 composition 事件並不能證明操作系統候選窗口的真實行為。還應在目標桌面和移動系統，用中文與日文輸入法實際完成候選選擇、取消、回車和連續輸入。

記錄系統、瀏覽器、輸入法名稱及觸發順序。驗收重點是最終文本沒有丟失、候選確認不會提交、一次有效變更沒有重複請求。這樣發現差異時，修補的是可解釋的邊界，而不是到處加一個延時。
