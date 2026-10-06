---
title: "Unicode 文本偏移契約：為什麼一個表情能把高亮和字數限制弄錯"
date: 2026-10-06 11:29:53
tags:
  - JavaScript
  - 工程化
description: "區分 UTF-16、碼點與字素簇，統一截斷、選區和後端標注的坐標系統。"
readingTime: 4
wordCount: 1106
---

備注框允許輸入 20 個字符，卻在粘貼家庭表情後提前報超長；另一處搜索高亮把重音拆開，只標中了半個可見字符。這兩類問題往往來自同一個假設：字符串長度、用戶看到的字符數量和接口偏移是一回事。

處理輸入限制、字幕、標注或編輯器時，需要先定義文本坐標，而不是到處補一個表情正則。這裡討論普通文本，不嘗試用一個小函數實現完整的富文本編輯模型。

## 三種長度回答三種問題

JavaScript 的 `length` 計算 UTF-16 代碼單元。遍歷字符串得到碼點，但一個用戶感知的字符仍可能由多個碼點組成：組合重音、膚色修飾符、旗幟和零寬連接序列都需要考慮。字素簇是更適合界面截斷的近似單位，它仍然不等於像素寬度。

因此數據庫字節限制、協議偏移和界面計數應分別命名。比如 `maxUtf8Bytes`、`startUtf16`、`graphemeCount`，比一個沒有單位的 `length` 更能阻止誤用。後端用字節偏移而前端用 UTF-16 時，ASCII 樣例會全部通過，直到真實姓名或表情出現才暴露錯誤。

## 用分段器截斷可見字符

[Unicode 文本分段規則](https://unicode.org/reports/tr29/)描述字素邊界；JavaScript 提供 [Intl.Segmenter](https://tc39.es/ecma402/#segmenter-objects)。以下函數按字素簇截斷，不會在示例家庭表情的中間切開。它只返回截斷文本，是否添加省略號由調用者決定，省略號自身是否佔額度也必須約定。

```javascript
export function truncateGraphemes(text, limit, locale = 'en') {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('invalid limit');
  }
  const segmenter = new Intl.Segmenter(locale, {
    granularity: 'grapheme',
  });
  let result = '';
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (count === limit) break;
    result += segment;
    count++;
  }
  return result;
}

const text = 'A👨‍👩‍👧‍👦e\u0301';
console.assert(text.length > 3);
console.assert(truncateGraphemes(text, 2) === 'A👨‍👩‍👧‍👦');
```

代碼依賴 `Intl.Segmenter`。部署前檢查目標運行環境；缺少能力時使用經過維護的分段實現，而不是退回 `Array.from(text)` 後繼續宣稱按可見字符計數。不同運行時攜帶的 Unicode 數據版本也可能不同，服務端若要求嚴格一致，應固定規則和測試語料。

## 偏移只對某一版原文有效

假設接口返回 `[start, end)` 區間，必須說明它是 UTF-16、UTF-8 字節還是碼點。半開區間可以自然表示空選區與相鄰區間，但不能消除單位差異。最好同時返回文檔版本和片段校驗信息；原文發生修改後，舊區間就不應直接繼續應用。

對於純文本框，`selectionStart` 等位置使用 UTF-16 偏移。若標注服務輸出碼點偏移，建立碼點邊界到 UTF-16 位置的映射即可；富文本 DOM Range 則還涉及文本節點及其邊界，不能拿整篇字符串的偏移直接充當節點內偏移。展示層的坐標轉換應集中在適配層。

## 規範化會改變坐標，不只是改變外觀

`é` 可以是一個預組字符，也可以是 `e` 加組合重音。兩者顯示相似，原始長度卻不同。NFC 適合某些比較和索引流程，但不能在獲得選區之後悄悄規範化再沿用舊偏移。搜索側如果做了規範化，必須保留到原文位置的映射，或者明確使用規範化後的文檔版本。

不要把 NFKC 當成免費的清洗步驟，它可能改變兼容字符的表達。標識符比較、法律文檔和用戶原文留存的目標不同。保存原文、生成搜索表示和展示截斷最好是三個明確步驟，而不是共同修改同一個字符串。

## 字數限制也需要產品語義

一個標籤的上限到底是 20 個字素、40 字節還是一行寬度？視覺上限應通過佈局判斷，存儲上限則按實際編碼驗證。界面可以同時提示可見字符計數與剩餘字節，但不應該把後端拒絕籠統描述成“你輸入的字太多”。組合輸入尚未完成時也別立即截斷，否則候選文本可能被破壞。

建立包含中文、日文、組合重音、旗幟、膚色表情和家庭序列的固定語料，驗證截斷、複製、刪除與高亮往返。最有價值的斷言是“這個坐標切出來的仍是預期原文”，而不是只比較一個數字。
