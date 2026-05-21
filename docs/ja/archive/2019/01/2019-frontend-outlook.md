---
title: "2019年フロントエンド技術展望：エンジニアリングからフレームワーク進化まで"
date: 2019-01-06 16:46:29
tags:
  - フロントエンド
readingTime: 3
description: "2018年は充実した年だった。React HooksがReact Confでデビューし、Vue 3 RFCが公開レビューを開始し、TypeScriptの大規模プロジェクトへの浸透率は上昇し続けた。2019年を展望すると、特に注目すべきいくつかの方向性がある。"
wordCount: 837
---

2018年は充実した年だった。React HooksがReact Confでデビューし、Vue 3 RFCが公開レビューを開始し、TypeScriptの大規模プロジェクトへの浸透率は上昇し続けた。2019年を展望すると、特に注目すべきいくつかの方向性がある。

## React Hooksが書き方を変える

React 16.8は2019年Q1にHooksを正式リリースする予定だ。これは小さな変化ではなく、Reactエコシステム全体のパラダイムに影響を与えるだろう。

```jsx
// 以前：クラスコンポーネント
class Counter extends Component {
  state = { count: 0 };
  increment = () => this.setState({ count: this.state.count + 1 });
  render() {
    return <button onClick={this.increment}>{this.state.count}</button>;
  }
}

// 2019：関数コンポーネント + Hooks
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

予測：年末までに、新しく書かれるReactコンポーネントのほとんどが関数 + Hooksを使用するようになる。

## Vue 3 Composition APIが正式導入

Vue 3のComposition API RFCは2018年末に公開され、2019年はアルファ段階に入ると予想される。コアアイデアはオプションオブジェクトを関数ベースのコンポジションに置き換えることで、大規模プロジェクトにおけるロジック再利用の問題を解決する。

## TypeScriptが普及する

2018年のState of JS調査でTypeScriptの満足度は過去最高を記録した。Vue CLI 3はTypeScriptをファーストクラスオプションとし、Create React AppもTypeScriptテンプレートを内蔵している。アップグレードは「使うべきか？」という問いではなく、「いつ移行するか？」という問いになった。

## WebAssemblyが実用段階へ

FigmaはWebAssemblyを使ってブラウザ内の高性能レンダリングを実現した。ほとんどのフロントエンドエンジニアはWasmを直接書かないが、そのユースケース（動画エンコード、CADレンダリング、暗号化ライブラリ）を理解することがますます重要になっている。

## エンジニアリング：目標は設定を排除すること

Create React App、Vue CLI 3、Angular CLIはすべて同じ目標を目指している：開発者がwebpackを手動で設定する必要をなくすこと。高品質なフレームワークの抽象化 = より速いプロジェクト立ち上げ + より一貫したチーム設定。

## 2019年ロードマップ

| 方向             | 推奨アクション                                         |
| ---------------- | ------------------------------------------------------ |
| React            | Hooksを学び、既存コンポーネントを段階的に移行          |
| Vue              | Vue 3 RFCをフォローし、Composition APIの思想に親しむ   |
| TypeScript       | 新プロジェクトで強制適用。Generics、Mapped Typesを学ぶ |
| エンジニアリング | webpackパフォーマンス分析ツールをマスターする          |
| パフォーマンス   | Core Web Vitalsの指標を理解する                        |

## まとめ

2019年のテーマは「より良い開発体験」だ：Hooksによりレアクトコンポーネントがよりシンプルになり、Composition APIによりVueのロジックが明確になり、TypeScriptによりリファクタリングがより安全になる。展望は展望に過ぎない——まず2018年の知識を真の実力に転化させることが重要だ。
