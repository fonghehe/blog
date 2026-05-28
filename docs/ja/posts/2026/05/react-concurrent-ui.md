---
title: "React 2026 Concurrent UI実践：レンダリング優先度から操作安定性まで"
date: 2026-05-28 18:36:28
tags:
  - React
  - パフォーマンス
readingTime: 8
description: "ReactのConcurrent機能は日常的な開発実践に入っている。タスク優先度、Suspense境界、transition更新、性能診断から安定した複雑UIを作る方法を整理する。"
wordCount: 2312
---

ReactのConcurrent機能は、もはや内部実装の話ではない。検索、フィルタ、ドラッグ、複雑なフォーム、データパネルは同時に多くの更新を発生させる。チームは、どの更新をすぐに完了させ、どの更新を後回しにできるかを設計する必要がある。2026年、Concurrentモードは「オプションの実験機能」からReactアプリケーションのデフォルト動作になった。

## レンダリング優先度はユーザー意図に合わせる

Concurrent UIの目的は、すべてのレンダリングを速くすることではない。重要な操作を安定して感じさせることだ。Reactのスケジューリングモデルは更新を優先度別に分類する：

**緊急更新（Urgent Updates）**
ユーザー操作に即座に応答する必要がある更新。典型的なシナリオ：
- 入力フィールドのタイピングフィードバック
- ボタンのクリック状態変化
- フォーカス切り替えとキーボードナビゲーション
- ドラッグ操作のリアルタイム位置更新

これらの更新はデフォルトの同期レンダリングを使用し、`useTransition`や`useDeferredValue`でラップすべきではない。

**トランジション更新（Transition Updates）**
遅延可能だが一貫性を保つ必要がある更新。React 18で導入された`useTransition`と`startTransition`が中核ツール：
- 検索結果リストのレンダリング
- フィルタ条件変更後のリスト再配置
- タブ切り替え後のコンテンツ領域更新
- チャートやグラフの再計算

重いレンダリングをtransitionとしてマークすると、Reactは緊急更新の処理が完了した後に実行し、その間に新しいユーザー操作があれば現在のtransitionを自動的に中断する。

**遅延更新（Deferred Updates）**
さらに遅延可能で、次のフレームまで待てる更新。`useDeferredValue`が適する：
- 大量データのリストレンダリング（仮想リスト以外のシナリオ）
- 重要でないデータパネル更新
- バックグラウンド統計データ更新

実用的なルール：**更新を遅延すべきか迷ったら、まず`startTransition`でラップし、React DevTools Profilerでユーザー操作をブロックしているか観察せよ。**

## Suspense境界のアート

Suspenseはローディング状態をより制御可能にするが、境界の配置が直接ユーザー体験に影響する。

**境界は細かすぎてはいけない：**
各小さなコンポーネントが独立したSuspense境界だと、ページに多数の局所的なローディングアニメーション（スピナー）が現れる。ユーザーは待機中に断片のちらつきを見ることになり、一度に全体をロードするよりも不快だ。

**境界は粗すぎてもいけない：**
ページ全体に一つのSuspense境界しかないと、遅いコンポーネントが速いコンポーネントをブロックし、一つのデータが遅いだけでページ全体がローディングになる。

**推奨境界戦略：ユーザータスクで分割**

- **ページスケルトン層**：最も外側のSuspenseでルートページ全体をラップし、全体的なローディングに使用。fallbackはページスケルトンスクリーンを表示。
- **機能領域層**：独立したユーザータスク領域ごとにSuspenseを設定。例えばDashboardページでは、「フィルタパネル」「データテーブル」「チャート領域」「おすすめサイドバー」がそれぞれ独立したSuspense境界——ユーザーは先にフィルタ条件を設定し、データのロードを待てる。
- **コンポーネントレベル**：本当に必要な場合のみ使用。参考基準：コンポーネントのロード時間が2秒を超え、ユーザーがロード中に他の領域を操作する可能性がある場合、専用のSuspense境界を設定する価値がある。

見落としがちな詳細：`Suspense`の`fallback`デザイン。良いfallbackは領域の構造的プレースホルダーであるべきで、回転するスピナーではない。スピナーの代わりにスケルトンスクリーンを使うことで、ユーザーの待機不安を大幅に軽減できる。

## useTransitionとuseDeferredValueの選択

この二つのHookは似ているが、適したシナリオが異なる：

**ユーザー操作で更新がトリガーされる場合は`useTransition`：**
```jsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  const handleInput = (e) => {
    // 高優先度：入力値を即座に更新
    setQuery(e.target.value);
    // 低優先度：検索結果は待てる
    startTransition(() => {
      setSearchResults(searchData(e.target.value));
    });
  };

  return (
    <>
      <input value={query} onChange={handleInput} />
      {isPending && <SmallSpinner />}
      <SearchResults results={searchResults} />
    </>
  );
}
```

**外部データソースから更新が来る場合は`useDeferredValue`：**
```jsx
function Dashboard({ serverData }) {
  // serverDataが変化した時、古いページのレンダリングを遅延できる
  const deferredData = useDeferredValue(serverData);

  return (
    <div style={{ opacity: serverData !== deferredData ? 0.5 : 1 }}>
      <HeavyChart data={deferredData} />
    </div>
  );
}
```

重要な違い：`useTransition`は`isPending`フラグを提供し（待機中かどうかがわかる）、`useDeferredValue`は新旧の値の比較を提供する（古いデータを表示しつつ、新しいデータをstaleとしてマークできる）。

## Concurrentモードでのパフォーマンス診断

React 2026のパフォーマンス診断は「レンダリング回数を見る」から「操作チェーンを見る」へ進化した。三つのツールがそれぞれの役割を果たす：

**React DevTools Profiler：**
- コンポーネントがなぜレンダリングされたかを見る（props変更、state変更、context変更、hooks変更）
- 各commitの所要時間を見る
- 不要な再レンダリングを特定

**Chrome Performanceパネル：**
- メインスレッドのロングタスク分布を見る
- Reactスケジューラの動作モードを見る（タイムスライシングが正しく機能しているか）
- 操作イベントの応答遅延を見る（ユーザークリックからブラウザ処理まで）

**RUMデータ（Web Vitals）：**
- INP（Interaction to Next Paint）：2026年最も重要な操作指標、FIDを代替
- ページ、デバイス、地域別にグループ化されたP75およびP95データ
- リリース前後の比較データ

これら三つのデータソースは一緒に見る必要がある：Profilerは「このコンポーネントが5回レンダリングされた」と教え、Performanceパネルは「その5回のレンダリングが200msのメインスレッドを占有した」と教え、RUMは「このページのP95 INPは180msだ」と教える。三者を組み合わせて初めて、最適化が価値あるものかを判断できる。

## よくあるアンチパターン

**アンチパターン1：すべてをtransitionに包む**
すべての非緊急更新にtransitionが必要なわけではない。更新の計算量が非常に小さい場合（ブール値の切り替えなど）、transitionに入れることはかえって複雑さを増す。

**アンチパターン2：transition内で副作用を実行**
`startTransition`は状態更新のみを含むべきだ。ネットワークリクエストを発行したり、localStorageに書き込んだり、アナリティクスをトリガーしたりすると、Reactがtransitionを中断した時に状態はロールバックされるが副作用はすでに実行されている——奇妙なバグを生み出す。

**アンチパターン3：useMemo/useCallbackでConcurrent機能を代替**
Concurrentモードは「レンダリングがいつ発生するか」の問題を解決し、メモ化は「何をレンダリングするか」の問題を解決する。両者は補完的であり、互換的ではない。

## まとめ

React 2026のConcurrent実践は、本質的に複雑なインターフェースで計算リソースを再配分することだ。高優先度の操作（ユーザーが操作している内容）を保護し、低優先度のレンダリング（ユーザーが待てる内容）をブラウザのアイドル時間にスケジュールする。鍵は三つのツールの役割分担を理解すること：`useTransition`はユーザートリガーの遅延更新に、`useDeferredValue`は外部データ駆動の遅延レンダリングに、`Suspense`はユーザータスク単位でのローディング境界分割に。この三つをマスターすれば、複雑なReactアプリケーションの操作体験を一新できる。
