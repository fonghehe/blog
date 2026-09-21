---
title: "React Native のネイティブ機能：API 境界と失敗の意味"
date: 2026-09-21 17:46:21
tags:
  - モバイル
description: "スキャンや生体認証を権限、キャンセル、ライフサイクルまで含めて設計する。"
readingTime: 3
wordCount: 901
---

スキャナーや生体認証を JavaScript へ公開するだけでは足りない。権限ダイアログ、バックグラウンド移行、非対応端末、利用者のキャンセルを業務フローへ反映する必要がある。一律の Promise rejection では画面が適切に案内できない。

## 結果を区別する

`success`、`cancelled`、`permissionDenied`、`unavailable`、`failed` を分ける。キャンセルは異常終了ではなく、権限拒否もスキャン失敗とは違う。ネイティブ側は生データだけ返し、注文の取得や権限確認は業務層が行う。

スキャンは同時に一件だけ許す。画面離脱やバックグラウンド移行時はカメラを解放し、連打は同じ処理にまとめるか実行中と伝える。画面の破棄時にイベント購読も解除する。

## 実機で契約を確認する

初回許可、恒久的な拒否、設定画面での権限取消、スキャン中の切り替え、連打を iOS と Android で試す。インストール済みアプリのネイティブコードは JS 更新だけでは変えられない。

## スキャン機能で境界を定義する

業務画面が必要とするのは「QR コードを読み、文字列を得る」ことであり、Android の権限コールバック、iOS のカメラ中断、ネイティブライブラリの内部イベントではない。JS に公開する契約は `scan(options): Promise<ScanResult>` に絞り、結果には正規化した文字列と取得元を含める。キャンセル、権限拒否、機器不可は安定したエラーコードにする。許可を求めるタイミングは業務フローで決めるが、権限と機器の実際の状態は OS が持つ。ネイティブ例外の文面をそのまま画面へ渡さない。

スキャン中に画面を離れたり、アプリが背景へ移ったり、React Native インスタンスが破棄されたりする。ネイティブ側は各呼び出しを一度だけ完了または取消し、カメラと購読を解放し、二重スキャンを拒否するか明示的に並べる。JS 側も結果を画面インスタンスと結び付け、古い Promise が新しい画面を遷移させないようにする。大きな画像では base64 を何度も JS 境界に渡すより、制御されたファイル参照が適切な場合があり、一時ファイルの削除責任も決める。

```ts
type ScanResult = { text: string; source: 'camera' | 'image' };
type ScanErrorCode = 'CANCELLED' | 'PERMISSION_DENIED' | 'UNAVAILABLE';
interface Scanner { scan(options: { formats: string[] }): Promise<ScanResult> }
```

## OS をまたいで契約を試す

JS テストでは成功、取消し、権限拒否、画面離脱、連打を再現する。ネイティブ統合テストでは資源解放、前景と背景の切替、設定画面での権限取消しを調べる。iOS と Android の実機で同じコードを読み、正規化結果を比べる。新アーキテクチャやライブラリを入れ替えても、契約が保たれれば業務画面を一緒に書き直す必要はない。参考：[React Native ネイティブモジュールの生存期間](https://reactnative.dev/docs/the-new-architecture/native-modules-lifecycle)。

参考：[React Native Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
