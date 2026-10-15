---
title: "Fetch で SSE を読む：通信チャンクはメッセージの境界ではない"
date: 2026-10-15 09:06:03
tags:
  - JavaScript
  - エンジニアリング
description: "増分デコード、イベント分割、キャンセル、業務上の完了を分けて実装する。"
readingTime: 4
wordCount: 1171
---

サーバーは完全な JSON を送るのに、画面では時々解析に失敗し、再試行すると成功する。`reader.read()` の一回分を JSON とみなすと、この症状が起きる。通信は一文字を分割することも、複数イベントを一塊にすることもできる。

バイト、文字列、イベント、業務状態の四層を分ける。そうすれば、デコード失敗とイベント分割の失敗、完了通知の欠落を別々に調べられる。

## デコーダーの状態をチャンク間で保つ

UTF-8 の漢字は途中のバイトで切られ得る。毎回新しいデコーダーを作らず、ストリームとして継続して最後にフラッシュするか、`TextDecoderStream` を使う。ただし文字に戻しても、JSON やイベントが完成しているとは限らない。

その後で行と空行の境界を読む。一般の SSE には種類、ID、再接続もあるため、原則は `EventSource` か保守された実装を使う。独自ヘッダーや本文付きリクエストの要件から Fetch を使うなら、引き受ける機能を明記する。[HTML のイベントストリーム](https://html.spec.whatwg.org/multipage/server-sent-events.html)と[符号化標準](https://encoding.spec.whatwg.org/#interface-textdecoder)が参照資料になる。

## 例は data-only の限定契約

次の生成器は、LF または CRLF の行末と `data:` をサーバーが保証する場合だけを対象とする。単独 CR、イベント ID、種類、再接続指示には対応せず、EventSource の完全な代替ではない。複数の data 行を結合してから渡す。上限は JavaScript の文字列単位であり、厳密なバイト数のメモリ制限ではない。

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

このアプリ固有の契約では、終端に未完成データがあればエラーにする。一般の SSE の EOF 処理をこの方針から推測しない。空の data 行もイベントになり、コメントなどはこの実装では無視する。呼び出し側では HTTP 状態と応答型を確認し、プロキシの HTML エラーを無言のストリームとして処理しない。

## JSON と業務完了を分ける

yield された data が一イベント分になってから JSON を解析し、スキーマを検証する。一イベントはトークンだけでなく進捗、失敗、完了かもしれない。リクエスト ID と単調な連番があれば、重複や古い処理の応答を見分けられる。

EOF は成功通知ではない。最終状態や検証情報を持つ完了イベントを設計する。途中の文章が大量にあっても完了通知がなければ、一部を保持して中断と表示する。再開にはサーバー側のイベント保存、カーソル、再配信時の扱いが必要で、最初から再接続して連結するだけでは不十分だ。

## キャンセルを表示処理まで通す

利用者が別の質問へ移ったら Fetch と消費処理を止める。生成器の `finally` で reader を解放し、反復の途中終了も清掃に到達させる。既に予約した UI 更新もリクエスト識別を確認し、古い内容を復活させない。

受信より描画が遅い場合は、フレーム単位でまとめて更新し、保持するイベントと文字数を制限する。背圧があってもサーバーやプロキシの全バッファーが消えるわけではない。無通信の時間制限と総処理時間を分け、ハートビートを業務進捗と扱わない。

## どこで切れても同じ結果になるか試す

符号化した同じデータを全バイト位置で分割し、復元結果を比較する。一バイトずつ、複数イベント一括、CRLF の途中、漢字の途中も試す。長すぎる行、未完成イベント、完了欠落、消費中のキャンセルも必要だ。解析結果と画面状態の両方を確認する。
