---
title: "大檔案下載的記憶體預算：從 response.blob 到可取消的寫入流水線"
date: 2026-10-22 09:34:27
tags:
  - JavaScript
  - 性能优化
description: "設計流式落盤、進度含義和失敗清理，避免把下載進度誤當成檔案已經保存。"
readingTime: 4
wordCount: 1211
---

導出檔案只有幾十兆時，`fetch → blob → object URL` 很方便。檔案增長到數百兆以後，瀏覽器可能同時保留響應、Blob 與其他業務對象，低記憶體設備首先出現問題。把程式碼換成讀取流還不夠：如果最終仍把所有 chunk 收集到數組里，記憶體曲線沒有改變。

下載方案應先回答三個問題：是否需要前端處理檔案、目標瀏覽器是否允許直接寫入使用者選擇的位置，以及失敗後使用者應該看到什麼。最便宜的方案往往是讓伺服器提供正常下載響應，交給瀏覽器管理。

## 不需要轉換內容時，先考慮瀏覽器下載

普通下載鏈接配合伺服器端的授權和下載響應，可以避免前端為整個檔案建立記憶體對象。跨域鏈接、檔案名和憑證規則要按真實部署驗證，不能假設 `download` 屬性在所有情況下都生效。短期簽名地址還需限制有效期和資料範圍，避免在分析系統里記錄敏感 URL。

只有必須變換、檢查或逐塊處理內容時，才讓 JavaScript 接管位元組流。對於不支持檔案選擇寫入能力的瀏覽器，可以回退伺服器端下載或非同步導出任務，而不是用無限大的 Blob 假裝具有相同記憶體特徵。

## 選擇檔案發生在使用者操作鏈中

[File System Access](https://wicg.github.io/file-system-access/)的選擇器有上下文和使用者激活要求，能力支持需要檢測。應先在點擊處理里請求保存位置，再發起長時間網絡操作；等下載完成後再彈選擇器，可能早已失去使用者激活。取消選擇檔案與網絡失敗要顯示不同狀態。

以下函數把選擇器作為參數注入，便於測試。它只實現完整響應下載，不實現 Range 續傳。流的管道與關閉行為參考 [Streams 標準](https://streams.spec.whatwg.org/)，寫入介面見 [File System 標準](https://fs.spec.whatwg.org/)。

```javascript
export async function saveResponse(url, chooseFile, signal, onBytes = () => {}) {
  const handle = await chooseFile();
  const writable = await handle.createWritable();
  try {
    const response = await fetch(url, { signal });
    if (response.status !== 200 || !response.body) {
      throw new Error(`download rejected: ${response.status}`);
    }
    let received = 0;
    const meter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        onBytes(received);
        controller.enqueue(chunk);
      },
    });
    await response.body.pipeThrough(meter).pipeTo(writable, { signal });
    return received;
  } catch (error) {
    try { await writable.abort(error); } catch { /* preserve original error */ }
    throw error;
  }
}

// Invoke directly from a click handler in a supported secure context:
// saveResponse(url, () => window.showSaveFilePicker(), signal, renderBytes);
```

`pipeTo` 完成後才把 UI 標為已保存。出錯時主動嘗試中止寫入，並保留原始錯誤。檔案系統與瀏覽器對中止的表現仍需驗證，不能向使用者承諾任何情況下都絕不會留下臨時內容。不要在 finally 中無條件 close，把部分檔案包裝成一次成功保存。

## 進度的分母必須和分子屬於同一種位元組

示例只報告收到的響應體位元組，不貿然顯示百分比。`Content-Length` 可能缺失，經過內容編碼時還可能與解碼後讀取的長度不一致。若伺服器端提供穩定的邏輯總量，就給它明確欄位；否則顯示已接收位元組和不確定進度，比一個超過 100% 的進度條更可信。

同時區分下載、轉換和保存三個階段。網絡已結束但檔案尚未關閉時，仍可能出現磁盤或權限錯誤。對大檔案還應限制轉換器內部佇列；流式 API 只能協調參與管道的步驟，不能防止業務回呼自己快取全部資料。

## 續傳需要資源身份，而不只是記住偏移

若要加入 Range，使用者端必須確認前後是同一資源版本，檢查狀態、範圍和總大小，並處理伺服器忽略範圍返回 200 的情況。直接在原檔案末尾拼接新響應，可能把兩個版本合成損壞檔案。涉及加密或壓縮時，偏移還必須對應正確的表示層。

可恢復導出通常更適合伺服器端生成穩定對象，返回任務 ID、版本與可驗證元信息，前端只管理恢復流程。不要因為有 `seek` 方法，就把網絡續傳的協議設計省略掉。

## 驗證峰值記憶體和失敗後的檔案

用受控的大響應和慢寫入端，確認記憶體不會隨整個檔案線性增長；同時測試開始前取消、傳輸中取消、磁盤寫入失敗、缺失響應體和錯誤狀態。瀏覽器實測應記錄設備、檔案大小和峰值記憶體，而不是直接給出未經測量的節省比例。

交付時明確支持列表與回退路徑。使用者關心的是拿到完整可打開的檔案，所以最終驗收要重新打開保存結果或校驗摘要，而不只是看進度條走到終點。
