---
title: "金額輸入與捨入契約：顯示兩位小數不等於計算準確"
date: 2026-11-12 15:33:05
tags:
  - JavaScript
  - 工程化
description: "用十進制字符串、最小單位整數和明確捨入規則處理金額，保持分攤總和一致。"
readingTime: 4
wordCount: 1225
---

頁面顯示 `0.10 + 0.20 = 0.30`，不代表底層金額模型正確。把結果 `toFixed(2)` 只是格式化，無法說明中間計算、負數退款和多行分攤採用了什麼規則。真正容易出問題的地方，往往是前後端都說“保留兩位”，卻各自選擇了不同的時機和方式。

本文討論軟件中的金額表示與輸入校驗，不提供財務或稅務規則。示例只支持恰好約定為兩位小數的業務貨幣；其他貨幣或高精度資產必須使用自己的精度契約。

## 原始輸入、業務金額和展示分別保存

輸入框暫時出現 `-` 或 `1.` 是正常編輯過程，不能因為尚未形成最終金額就每次重置。草稿可以保存原始字符串，提交時用嚴格語法解析成業務值。展示則用本地化格式化，不把千分位和貨幣符號重新送進計算。

JavaScript Number 使用二進制浮點，相關語義見 [ECMAScript Number](https://tc39.es/ecma262/#sec-number-objects)。可以選十進制庫或最小單位整數，但必須規定範圍、精度與乘除法規則。簡單寫 `Math.round(Number(text) * 100)` 仍先經歷二進制轉換，不是一個通用十進制解析器。

## 從十進制文本直接生成最小單位整數

下面只接受無分組符、無指數、最多兩位小數的有界字符串，直接組成 BigInt 分。它拒絕 `.5`、`1.`、多餘精度和前導零形式，界面可在提交前給明確提示。是否允許這些寫法是產品選擇，前後端應使用同一契約。

```javascript
export function parseCents(text) {
  if (typeof text !== 'string' || text.length > 128) {
    throw new TypeError('bounded decimal text required');
  }
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('invalid two-decimal amount');
  const magnitude = BigInt(match[2]) * 100n +
    BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -magnitude : magnitude;
}

export function roundRatioHalfAway(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError('positive denominator required');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

console.assert(parseCents('0.10') + parseCents('0.20') === 30n);
console.assert(roundRatioHalfAway(-5n, 2n) === -3n);
```

BigInt 避免這裡的整數加減溢出 Number 安全範圍，但不意味著可以接受無限長度輸入，代碼對長度做了限制。JSON 不直接序列化 BigInt，接口可以發送十進制整數字符串，並明確單位與幣種。服務端仍要獨立校驗範圍，不能相信前端已經解析過。

## 捨入必須說清方向和發生位置

示例的比例函數採用正負數都在中點遠離零的規則，所以 -2.5 變為 -3。這只是選定的算法，不代表所有業務都該這樣處理。向偶數捨入、向下取整以及按現金面額捨入會給出不同結果，需要業務確認。

還要約定在單行、分類小計還是最終總額捨入。三行各自計算再取整，與合計後取整可能相差最小單位。稅率和折扣率可以用有理數分子分母或十進制庫表達，不應該每一步都變成經過格式化的字符串再轉回數字。

## 分攤不是把同一個小數四捨五入三次

把 100 分分給三項，逐項取 33 分只得到 99 分。可以先取整得到每份 33 分，再按穩定順序分配剩餘一分，結果為 34、33、33；不等權分攤還要規定余數排序與相同余數的決勝規則。穩定 ID 比當前畫面順序更容易重現。

退款時應盡量引用原始分攤記錄，而不是按今天的排序重新計算。否則用戶排序一次，退款就落到另一行。系統需要保存採用的規則與最終分配結果，保證追查時能解釋總額和各行如何對應。

## 本地化只負責展示，不替你定義輸入語法

[Intl.NumberFormat](https://tc39.es/ecma402/#numberformat-objects)用於格式化，不是通用的本地化金額解析器。逗號可能表示分組或小數點，空格也可能是地區分隔符。若支持多種輸入形式，需要明確地區來源和解析策略，不要簡單刪除所有逗號。

特別大的最小單位整數不要為了調用格式化函數又強轉 Number。可以在業務範圍內安全轉換，或使用能保持精度的十進制展示路徑。界面還要避免把負零顯示成有意義的退款；示例的 BigInt 模型會把負零歸一為零。

## 用不變量驗收金額流程

固定測試最小單位、最大範圍、非法指數、超長輸入、多餘小數、負數中點，以及分攤後求和等於原總額。對序列化再解析做往返，確認單位和幣種沒有丟。前後端用同一組樣例比對，而不是只看兩個界面都顯示兩位小數。

把“輸入允許什麼、內部存什麼、何時捨入、如何分配余數”寫進接口契約。金額正確性應當能由這些規則推導出來，而不是靠最後一層格式化碰巧顯得正常。
