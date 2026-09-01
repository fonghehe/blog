---
title: "React Native の復帰時更新：古い一覧を表示しないために"
date: 2026-09-01 19:08:53
tags:
  - モバイル
description: "AppState、リクエスト世代、サーバー側の版情報を使い、復帰後の画面データを検証する。"
readingTime: 2
wordCount: 411
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

参考：[React Native AppState](https://reactnative.dev/docs/appstate)。
