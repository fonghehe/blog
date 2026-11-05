---
title: "カメラの資源リース：画面を閉じた後に許可が戻る場合"
date: 2026-11-05 14:40:22
tags:
  - JavaScript
  - エンジニアリング
description: "要求世代とトラック解放で、プレビュー終了と機器解放を一致させる。"
readingTime: 4
wordCount: 1058
---

読み取りダイアログを開き、許可待ちで閉じた後に許可すると、カメラ表示灯だけが点く。コンポーネントの破棄では未完了の機器要求を取り消せない。遅れて戻る MediaStream を受け止めて解放する必要がある。

読み取りや撮影には明確な所有者が要る。ここではローカル取得を開始と終了のあるリースとして扱い、録画、送信、通話は含めない。

## 許可と機器と再生を区別する

許可されても、機器がない、使用中、制約を満たさない場合がある。動画の再生も別に失敗する。全部を許可エラーにすると、利用者は無関係な設定を繰り返す。

例外に応じて再試行や機器選択を提供し、許可を繰り返し要求しない。[Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)を参照し、安全な実行環境、埋め込みポリシー、対象ブラウザーを実際の配備先で確認する。

## 古い要求は世代で識別する

getUserMedia には Fetch と同じ一般的な AbortSignal 引数はない。閉じるとき世代を進め、古い結果が成功しても全トラックを止める。前後カメラの切り替えでも同じ手法で遅い結果の上書きを防ぐ。

```javascript
export function cameraSession(mediaDevices, video) {
  let generation = 0;
  let current = null;
  function stop() {
    generation++;
    if (current) {
      if (video.srcObject === current) video.srcObject = null;
      current.getTracks().forEach(track => track.stop());
      current = null;
    }
  }
  async function start(constraints = { video: true, audio: false }) {
    stop();
    const own = generation;
    let candidate;
    try {
      candidate = await mediaDevices.getUserMedia(constraints);
      if (own !== generation) {
        candidate.getTracks().forEach(track => track.stop());
        return false;
      }
      current = candidate;
      video.srcObject = candidate;
      await video.play();
      return own === generation;
    } catch (error) {
      if (own === generation) {
        stop();
        throw error;
      }
      candidate?.getTracks().forEach(track => track.stop());
      return false;
    }
  }
  return { start, stop };
}
```

この関数が取得した流れはこの関数が所有する。外部とトラックを共有するなら別の所有契約が必要だ。play の失敗も解放する。再生待ち中に再開始されれば旧流れは stop で停止済みになる。呼び出し側も戻り値を確認し、Promise が終わっただけで有効なプレビューとしない。

## 表示を外すだけでは取得は止まらない

非表示や srcObject の解除は表示の関連を切るだけだ。所有する全トラックへ stop を呼ぶ。音声を忘れるとマイクが残るため、不要なら最初から要求しない。

enabled を false にすることは出力の一時停止に近く、機器解放ではない。一時停止は別状態にし、読み取り終了、経路離脱、破棄は解放へ接続する。外部から終わったトラックも観測し、失効した画面を有効と表示し続けない。

## 寿命方針を明示する

背景で停止するかは業務と機種による。停止するなら、利用者の再開操作や許される認可済み経路から再取得し、失敗を扱う。可視状態の変化ごとに無条件で要求しない。

複数部品が共有する場合は管理器が所有し、利用者のリースや参照数で解放する。各部品が同じトラックを止めると互いに壊す。退出し忘れた利用者が永久保持しないよう、所有者と解放経路も観測可能にする。

## 制約と検証を分ける

必須と希望の条件を区別する。非対応の必須寸法は失敗し、ideal なら交渉できるが、必要な画質は実設定を読んで確認する。希望した向きが得られたと無条件に報告しない。

遅延許可後の閉鎖、連続切り替え、拒否、機器欠落、再生失敗、破棄、古い要求の遅延完了を試す。制御した Promise で解放を検証できるが、表示灯、許可窓、機器は実ブラウザーで確認する。

各ストリームに主人を決め、すべての終了経路で解放する。消えた画面のために機器が動き続けないことが受け入れ条件になる。
