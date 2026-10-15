---
title: "Fetch 讀取 SSE：網絡分塊不是消息邊界"
date: 2026-10-15 09:06:03
tags:
  - JavaScript
  - 工程化
description: "為流式響應設計增量解碼、事件分幀、取消與業務完成標記。"
readingTime: 4
wordCount: 1076
---

服務端每次發送完整 JSON，前端卻偶爾報解析失敗。抓包看不出壞數據，重試又好了。常見原因是把 `reader.read()` 返回的一塊字節直接交給 `JSON.parse`：網絡可以拆開一個字符，也可以把兩個事件合成一塊。

流式接口至少存在字節、文本、事件和業務狀態四層邊界。先把它們分開，才能判斷一個空白屏幕是解碼錯誤、分幀錯誤，還是業務根本沒有發出完成消息。

## 解碼器必須跨分塊保留狀態

UTF-8 中文可能在字節中途被切開。對每個 chunk 新建 `TextDecoder` 會失去未完成字節；正確方法是持續解碼並在結束時刷新，或者使用 `TextDecoderStream`。字符解碼不負責找到 JSON 邊界，輸出的字符串仍然可能包含半個事件。

隨後才輪到 SSE 行與空行分隔。通用 SSE 還包含 `event`、`id`、重連和其他語義，優先使用原生 `EventSource` 或成熟實現。原生接口不能直接滿足所有帶自定義請求頭或請求體的需求；選擇 Fetch 時，要明確自己承擔了哪些協議能力。規則見 [HTML 事件流](https://html.spec.whatwg.org/multipage/server-sent-events.html)與[編碼標準](https://encoding.spec.whatwg.org/#interface-textdecoder)。

## 示例故意限定為 data-only 子協議

下面的生成器只適用於服務端明確約定的 LF 或 CRLF、`data:` 字段子集。它不支持單獨 CR 行尾、不解釋事件 ID、類型和重連指令，不能當成完整 EventSource 替代品。多行 data 合併後才交給業務層。緩衝上限以 JavaScript 字符串代碼單元計數，並不是嚴格的字節內存配額。

```javascript
export async function* readDataEvents(body, maxChars = 65536) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  let data = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        if (line === '') {
          if (data.length) yield data.join('\n');
          data = [];
          size = 0;
        } else if (line.startsWith('data:')) {
          const part = line.slice(5).replace(/^ /, '');
          size += part.length + 1;
          if (size > maxChars) throw new Error('event too large');
          data.push(part);
        }
        if (line.length > maxChars) throw new Error('line too large');
      }
      if (pending.length + size > maxChars) throw new Error('buffer too large');
    }
    if (pending || data.length) throw new Error('incomplete application event');
  } finally {
    try { await reader.cancel(); }
    finally { reader.releaseLock(); }
  }
}
```

連接結束還有殘留時，這個應用子協議選擇報錯；通用 SSE 的末尾未完成事件處理不能由此推斷。空 data 也可以組成事件，注釋和非 data 字段在這個子集中被忽略。調用方還應檢查 HTTP 狀態與響應類型，防止把代理返回的 HTML 錯誤頁讀成沈默的事件流。

## JSON 解析與流完成是兩個決定

每次 yield 是一個完整事件的 data 文本，此時才解析 JSON，並通過業務 schema 校驗字段。不要假設每個事件都等價於一個 token；它也可能是進度、錯誤或業務完成。業務消息最好帶請求 ID 和單調序號，讓重複事件和舊請求消息可以被識別。

傳輸 EOF 不代表生成成功。設計一個明確的完成事件，攜帶最終狀態或輸出校驗信息。斷線前收到大量文本但沒有完成標記時，界面應保留部分結果並顯示“中斷”，而不是裝作成功。若允許恢復，需要服務端事件日誌、游標和重複處理規則；不能只在前端從頭重連再拼接。

## 取消必須穿過整個消費鏈

用戶切換問題時取消 Fetch，同時停止消費者和後續渲染。生成器的 `finally` 負責釋放讀取器；調用方提前退出迭代也應到達清理邏輯。已經入隊的 UI 更新仍要檢查請求身份，避免舊內容在取消後閃回。

渲染速度也可能慢於接收速度。按幀批量更新文本，限制保留事件和歷史字符數；不要為每個字符重排整頁。背壓能協調消費速度，但不能讓代理、服務端和全部中間緩衝自動消失。超時應區分長時間無數據和總任務過長，心跳也不能偽裝成業務進展。

## 用任意切塊測試協議，而不是只測示例字符串

將同一串事件在每一個字節位置切開，驗證重組結果一致；再用一字節一塊、多事件一塊、CRLF 跨塊和中文跨塊的輸入。加入超限行、殘缺事件、業務完成缺失和消費中取消。測試解析器的同時測試頁面狀態，才能確認“讀到了內容”與“完成了任務”不會混為一談。
