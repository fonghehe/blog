---
title: "React Native のネイティブ機能：API 境界と失敗の意味"
date: 2026-09-21 17:46:21
tags:
  - モバイル
description: "スキャンや生体認証を権限、キャンセル、ライフサイクルまで含めて設計する。"
readingTime: 1
wordCount: 337
---

スキャナーや生体認証を JavaScript へ公開するだけでは足りない。権限ダイアログ、バックグラウンド移行、非対応端末、利用者のキャンセルを業務フローへ反映する必要がある。一律の Promise rejection では画面が適切に案内できない。

## 結果を区別する

`success`、`cancelled`、`permissionDenied`、`unavailable`、`failed` を分ける。キャンセルは異常終了ではなく、権限拒否もスキャン失敗とは違う。ネイティブ側は生データだけ返し、注文の取得や権限確認は業務層が行う。

スキャンは同時に一件だけ許す。画面離脱やバックグラウンド移行時はカメラを解放し、連打は同じ処理にまとめるか実行中と伝える。画面の破棄時にイベント購読も解除する。

## 実機で契約を確認する

初回許可、恒久的な拒否、設定画面での権限取消、スキャン中の切り替え、連打を iOS と Android で試す。インストール済みアプリのネイティブコードは JS 更新だけでは変えられない。

参考：[React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
