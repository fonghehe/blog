---
title: "React Native の長い一覧が重いとき：FlatList を調整する前に測る"
date: 2026-09-07 19:14:42
tags:
  - モバイル
description: "本番に近いビルドで JS、レイアウト、画像の負荷を切り分ける。"
readingTime: 1
wordCount: 378
---

一覧のカクつきは `FlatList` のウィンドウサイズだけが原因とは限らない。行での高コスト計算、画像のデコード、画面全体の再描画も同じ症状になる。まず本番に近いビルドで再現する。

## どの処理が重いか確認する

端末、件数、画像サイズ、操作手順を記録し、JS と UI スレッドのフレーム時間を比べる。JS 側が忙しければ行の依存状態や描画中の計算を見直す。UI 側なら画像、レイアウト、ネイティブ View を調べる。デバッグビルドだけで結論を出さない。

## 根拠のある設定だけ変更する

行の高さが本当に固定なら `getItemLayout` で位置計測を省ける。キーには安定した業務 ID を使う。ページング要求は重複させず、検索条件が変わった後に古い応答を反映しない。ウィンドウやバッチの値は低性能端末でメモリと空白表示を測って決める。

```tsx
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={renderItem}
  getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
  onEndReached={loadNextPage}
/>
```

翻訳や文字サイズ拡大で行高が変わるなら固定高さの前提は崩れる。高速スクロール、未キャッシュ画像、条件変更、大きな文字で検証する。参考：[React Native パフォーマンス](https://reactnative.dev/docs/performance)。
