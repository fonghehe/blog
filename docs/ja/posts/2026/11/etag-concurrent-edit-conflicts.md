---
title: "ETag で同時編集を守る：後の保存で前の変更を消さない"
date: 2026-11-10 11:31:22
tags:
  - JavaScript
  - エンジニアリング
description: "条件付き更新、下書き保持、三者比較をつなぎ、競合から回復できる画面を作る。"
readingTime: 4
wordCount: 1066
---

二人が設定を開き、一人が題名、もう一人が後でメモを保存すると、題名が消える。どちらも成功表示だ。ボタン無効化は一画面の連打しか防げず、別タブや別利用者を調整できない。

更新の基になった版を API で示す必要がある。ここでは文書全体の PUT による楽観的制御を扱い、共同編集やブラウザーキャッシュだけの保護は想定しない。

## 内容と検証子を基準として保存する

読み取り時の表現と ETag を下書きの基準にする。保存では If-Match を送り、現在の表現が一致する場合だけ更新する。不一致は 412 と競合状態にする。[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)が条件と強比較を定義する。

弱い検証子の W/ を削って強いものと扱わない。ETag はサーバーが定義する不透明な値だ。別オリジンでは応答ヘッダーの公開と要求ヘッダーの許可も必要で、実際に送られていてもブラウザーが読めない場合がある。

## 比較と更新を原子的に行う

例は 412 で上書きせず競合を返す。SQL は版条件の考え方であり、認可、業務検証、HTTP への対応付けはサーバーで行う。ETag が DB の版と直接同じである必要はなく、対応はサーバーが管理する。

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

版を読んでアプリで比較してから無条件更新すると、その間に競合する。条件付き更新などを使う。更新ゼロ件は削除や認可条件の失敗でも起こるため、保護した資源の存在を漏らさない方針で分類する。

## 競合では三つの情報を保持する

元の基準、ローカル下書き、最新の遠隔文書が必要だ。別項目の変更を三者比較で発見できても、自動統合には業務上の意味がある。金額と通貨は別項目でも連動し、配列を添字だけで結合できない。

差分を示し、遠隔採用、ローカル意図の保持、手動修正を選べるようにする。再送は最新基準に対する条件付き更新にする。無条件 PUT へ黙って切り替えたり、412 を新しい検証子で自動再試行したりすれば、結局後勝ちに戻る。

## 成功は送った版に属する

A を保存中に B へ入力したら、A の成功で B 全体を保存済みにしない。ローカル修訂と要求を結び、対応した基準だけ進める。ETag は確認された結果に属し、応答時の入力値へ適当に付けてはいけない。

成功で ETag がない場合、保存成功は示せても次の保護された更新前に取り直す。サーバーが空白や既定値を正規化するなら、保存後の表現を返すか再読込し、基準を実保存内容とそろえる。

## 時間切れと競合を混同しない

412 は条件不成立だが、通信時間切れでは保存後の応答だけ失われたかもしれない。未保存と断言せず、業務修訂を読み直すか要求 ID を問い合わせる。冪等性は再実行、版検証は更新消失を扱う別の仕組みだ。

同じ基準からの二人の保存、保存中入力、削除、クロスオリジン設定欠落、応答喪失、正規化を試す。状態コードだけでなく下書きの保持と次回基準を検証する。偽の成功より、回復できる競合の方が信頼できる。
