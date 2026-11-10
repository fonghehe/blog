---
title: "用 ETag 處理併發編輯：別讓後保存的人無聲覆蓋前一個人"
date: 2026-11-10 11:31:22
tags:
  - JavaScript
  - 工程化
description: "把條件寫入、草稿保留和三方比較連接起來，建立可解釋的衝突恢復流程。"
readingTime: 4
wordCount: 1151
---

兩個人打開同一份配置，甲改標題並保存，乙稍後改備注並保存。界面都提示成功，但甲的標題消失了。前端禁用重複點擊只能約束本頁面，不能防止別的標籤、用戶或後台任務同時修改數據。

併發編輯需要接口證明“這次修改是基於哪一版”。本文討論整份文檔 PUT 的樂觀併發控制，不把它擴展成自動協同編輯，也不假設瀏覽器緩存本身會保護業務寫入。

## 讀取時保存內容和驗證器

讀取文檔時同時取得表示及其 ETag，並在草稿旁保存這一基線。保存時帶 `If-Match`，讓服務端只在當前表示仍匹配時執行。條件不滿足時返回 412，前端進入衝突狀態。HTTP 條件請求與強比較的規則見 [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)。

用於寫入的驗證器需要符合強比較語義。不要去掉 `W/` 前綴就把弱驗證器偽裝成強驗證器，也不要自行猜測服務器的 ETag 算法。跨域接口還要暴露響應 ETag，並允許需要的條件請求頭，否則代碼可能拿不到服務端已經發送的信息。

## 檢查和更新必須是一次原子操作

下面前端函數在 412 時返回明確衝突，不自動覆蓋。服務端 SQL 示例展示版本條件；事務內還要處理權限、業務校驗及對應的 HTTP 映射。它不規定 ETag 必須直接等於數據庫版本，驗證器到當前表示的映射仍由服務端負責。

```javascript
export async function saveDraft(url, draft, etag, signal) {
  if (!etag || etag.startsWith('W/')) {
    throw new Error('a strong revision validator is required');
  }
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(draft),
    signal,
  });
  if (response.status === 412) return { kind: 'conflict', draft };
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return {
    kind: 'saved',
    etag: response.headers.get('ETag'),
  };
}
```

```sql
-- Execute atomically; zero updated rows means the expected version lost.
UPDATE documents
SET body = $1, version = version + 1
WHERE id = $2 AND tenant_id = $3 AND version = $4
RETURNING version;
```

先讀取版本、在應用里比較、最後無條件更新，會在比較與寫入之間再開一個競態窗口。應使用帶版本條件的更新或等效原子機制。零行更新還可能意味著資源刪除或權限條件不成立，服務端需要按授權策略區分，不能把敏感資源存在性隨意洩露。

## 衝突時保留三份信息

界面需要基線、當前本地草稿和最新遠端文檔。三方比較可以發現甲乙是否改了不同字段，但自動合併仍要按業務語義判斷。標題與標題可能衝突，金額與幣種即使是不同字段也未必能獨立合併，數組順序更不能按索引機械合併。

顯示可理解的差異，讓用戶選擇保留本地、接受遠端或手工調整。若用戶決定基於最新版本再提交，應更新基線並再次帶條件；衝突處理完成前不能偷偷發送一個沒有條件的 PUT。自動重試 412 只會把被保護的覆蓋重新變成最後寫入獲勝。

## 保存成功也要對應發出的那份草稿

用戶在保存 A 期間繼續輸入 B，A 成功後不能把 B 全部標成已保存。保存請求應攜帶本地修訂身份，成功後只推進對應基線，並保留較新的編輯。新的 ETag 屬於服務端確認的結果，而不是隨便綁定到當前輸入框內容。

示例允許成功響應沒有 ETag；這種情況下 UI 可以說明已保存，但再次安全寫入前應重新獲取驗證器，不能繼續用舊值。若接口會規範化內容，例如整理空白或補默認值，還要約定成功後返回表示或要求重新讀取，防止本地基線與實際存儲分歧。

## 超時與衝突是不同的恢復問題

412 表示條件沒有滿足；網絡超時則可能是寫入成功但響應丟失。後者不要直接顯示“肯定沒保存”。可以重新讀取並比較業務修訂，或使用服務端支持的請求身份查詢結果。冪等語義和併發驗證分別解決重複執行與丟失更新，不能相互代替。

測試兩個客戶端讀取同一基線後依次保存、保存中繼續編輯、刪除後保存、跨域頭缺失、響應丟失以及服務端規範化。斷言不僅是狀態碼，還包括本地草稿沒有丟失、下一次保存使用正確基線。能夠解釋並恢復的衝突，遠比兩個虛假的“保存成功”可靠。
