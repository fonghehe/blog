---
title: "大容量ダウンロードのメモリ設計：受信から保存完了まで"
date: 2026-10-22 09:34:27
tags:
  - JavaScript
  - パフォーマンス最適化
description: "ストリーム、キャンセル、進捗の意味を整理し、部分ファイルを成功扱いしない。"
readingTime: 4
wordCount: 1190
---

小さな出力なら Blob と object URL は便利だ。しかしファイルが大きくなると、応答、Blob、通常のアプリ状態が同時に保持され、低メモリ端末から問題が出る。reader に替えても、全チャンクを配列にためれば使用量は減らない。

JavaScript による変換が必要か、対象環境で保存先を選んで書けるか、失敗をどう伝えるかを先に決める。通常のダウンロード応答をブラウザーに任せる方法が最も簡単なことも多い。

## 変換不要なら通常のダウンロードを検討する

認可されたリンクと応答なら、ファイル全体を JavaScript のオブジェクトにせずに済む。クロスオリジン、名前、認証情報の挙動は実環境で確認し、`download` 属性だけを信用しない。署名 URL も期限と範囲を制限し、解析ログに残さない。

検査や変換の必要がある場合だけバイト列を引き受ける。書き込み能力がなければ、サーバーダウンロードや非同期ジョブへ戻す。無制限の Blob はストリームと同じメモリ特性ではない。

## 利用者の操作中に保存先を選ぶ

[File System Access](https://wicg.github.io/file-system-access/) の選択器には実行条件とユーザー操作の要件がある。対応を確認し、長い通信の前にクリック処理から選択する。通信後では操作の有効期間が切れる場合がある。選択のキャンセルと通信失敗も分けて表示する。

例は選択器を注入してテストできるようにし、完全応答だけを扱う。Range 再開は含まない。管道は [Streams](https://streams.spec.whatwg.org/)、書き込みは [File System](https://fs.spec.whatwg.org/) の資料を参照する。

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

`pipeTo` が完了してから保存済みにする。失敗時は書き込み中止を試み、元のエラーを保持する。中止後の実際のファイルは環境で検証し、どんな場合も一時内容が残らないと約束しない。finally で常に close すると部分結果を成功に見せてしまう。

## 進捗は同じ層のバイトを比較する

例は受信量だけを知らせる。Content-Length はないこともあり、圧縮された転送量と JavaScript が読む展開後の量が違う場合もある。安定した総量が必要ならサーバーが明示する。分母がなければ不確定の進捗にし、百パーセントを超える表示を作らない。

受信、変換、保存を区別する。通信が終わってもファイルの終了で失敗し得る。変換器の内部キューも制限し、コールバックが全データを保持する実装を避ける。背圧は管道の参加者間の調整であり、任意の保存を防ぐ仕組みではない。

## 再開には同じリソースである保証が要る

Range を使うなら、版、状態、範囲、総量を確認し、サーバーが範囲を無視して 200 を返す場合も処理する。単純に末尾へ加えると別版同士を結合してしまう。暗号化や圧縮では、位置がどの表現を指すかも必要だ。

回復可能な出力は、サーバーが固定したオブジェクトを作り、ジョブ ID、版、検証情報を返す構成が扱いやすい。seek があるだけでは通信の再開契約を省略できない。

## メモリと失敗後の結果を検証する

大きな応答と遅い書き込み先を使い、全サイズに比例してメモリが増えないことを確認する。開始前と途中のキャンセル、書き込み失敗、本文欠落、エラー応答も試す。端末、サイズ、観測した最大使用量を記録し、未計測の削減率を書かない。

対応環境と代替方法を明記し、保存結果を再度開くか検証する。進捗の終点だけでは、利用者が完全なファイルを得たことを証明できない。
