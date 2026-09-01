---
title: "React Native の復帰時更新：古い一覧を表示しないために"
date: 2026-09-01 19:08:53
tags:
  - モバイル
description: "AppState、リクエスト世代、サーバー側の版情報を使い、復帰後の画面データを検証する。"
readingTime: 4
wordCount: 950
---

アプリがバックグラウンドから戻っても、画面はメモリに残っている。ところが注文、価格、ログイン状態はその間に変わり得る。`active` のたびに無条件で取得すると、短時間の切り替えで通信が重なり、古いレスポンスが後から画面を上書きする。

## 更新条件を決める

最後に同期できた時刻とアカウント ID を保存する。非アクティブ状態から `active` に戻り、許容する鮮度を超えた場合に更新する。アカウント変更時は前の利用者のキャッシュを直ちに破棄する。通信が戻ったことと API が利用可能なことも同一視しない。

`AppState` の購読は復帰イベントの検出だけを担当させる。データ層では古いリクエストを中断するか、世代番号が一致しない結果を捨てる。サーバーの版番号や更新時刻も比較し、リクエストの完了順をデータの新しさと誤認しない。

```tsx
import { AppState, type AppStateStatus } from 'react-native';
import { useEffect, useRef } from 'react';

export function useResumeRefresh(refresh: () => Promise<void>) {
  const previous = useRef<AppStateStatus>(AppState.currentState);
  const generation = useRef(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      const resumed = previous.current !== 'active' && next === 'active';
      previous.current = next;
      if (!resumed) return;
      const request = ++generation.current;
      void refresh().catch(error => {
        if (request === generation.current) console.warn('Refresh failed', error);
      });
    });
    return () => { generation.current++; subscription.remove(); };
  }, [refresh]);
}
```

## 確認するケース

短いアプリ切り替えで一覧が消えないこと、アカウント A の遅い応答が B のキャッシュに入らないこと、オフライン復帰時に最後の確かなデータと同期時刻が見えることを確認する。

## 注文一覧で復帰処理を追う

注文一覧から決済アプリへ移動し、2 分後に戻る場面を考える。メモリには 10 件残っていても、別端末で 1 件が取り消されたかもしれない。前回**確認済み**の一覧と同期時刻を表示したまま小さな更新表示を出す。取得に失敗したら一覧を消さず、古い可能性を伝える。空状態はサーバーが正常に空配列を返した場合だけにする。通信障害は注文が存在しない証拠ではない。

`AppState` は更新のきっかけであり、整合性を保証する仕組みではない。上の Hook の `generation` はエラーログしか守らず、`refresh()` が古い結果を書き込むことは防げない。世代の検査はデータ層の書き込み直前に置く。開始時の `accountId` と増加する `requestId` を保持し、反映前に両方を比較する。アカウント切替時には、そのアカウントに属するキャッシュを消し、保留中の要求を無効化する。サーバーに単調増加する版があれば、現在の版より古い応答を捨てる。

```ts
// 疑似コード：検査と書き込みを同じ更新経路で行う
const ticket = { accountId: session.accountId, requestId: ++latestRequestId };
const result = await api.listOrders(ticket.accountId);
if (ticket.accountId !== session.accountId || ticket.requestId !== latestRequestId) return;
if (result.version < store.version) return;
store.replace({ items: result.items, version: result.version, syncedAt: Date.now() });
```

## 競合を受け入れテストにする

制御可能な Promise を使って 2 件の応答を逆順に完了させ、古い応答が新しい一覧を上書きしないことを確認する。A の要求中に B へ切り替え、A の行が B のキャッシュに入らないことも確認する。短時間のアプリ切替、オフライン復帰、期限切れトークン、サーバーが返す本当の空配列も試す。更新理由、所要時間、破棄した応答数を記録すれば、復帰イベントの欠落と、正しく破棄された古い要求を区別できる。

参考：[React Native AppState](https://reactnative.dev/docs/appstate)。
