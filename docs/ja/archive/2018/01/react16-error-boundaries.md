---
title: "React 16 エラーバウンダリ：白画面クラッシュとの決別"
date: 2018-01-09 11:00:56
tags:
  - React
readingTime: 2
description: "React 15 では、コンポーネント内の未処理 JavaScript エラーがアプリケーション全体の状態を壊し、謎のエラーや完全な白画面につながっていました。React 16 では**エラーバウンダリ**を導入し、エラーをコンポーネントのサブツリーに封じ込めることができるようになりました。"
wordCount: 559
---

React 15 では、コンポーネント内の未処理 JavaScript エラーがアプリケーション全体の状態を壊し、謎のエラーや完全な白画面につながっていました。React 16 では**エラーバウンダリ**を導入し、エラーをコンポーネントのサブツリーに封じ込めることができるようになりました。

## React 15 の問題

```javascript
// React 15：このエラーがアプリ全体をクラッシュさせる
function BrokenComponent() {
  throw new Error("何かが間違っています！");
  return <div>これは絶対にレンダリングされない</div>;
}
```

## エラーバウンダリの実装

エラーバウンダリは `componentDidCatch`（または `getDerivedStateFromError`）を実装するクラスコンポーネントです：

```javascript
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("バウンダリでエラーをキャッチ:", error, errorInfo);
    logErrorToService(error, errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>問題が発生しました。</h2>
          <button onClick={() => this.setState({ hasError: false })}>
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

## エラーバウンダリの使用

```jsx
function App() {
  return (
    <ErrorBoundary>
      <Header />
      <ErrorBoundary fallback={<div>ウィジェットの読み込みに失敗</div>}>
        <DangerousWidget />
      </ErrorBoundary>
      <Footer />
    </ErrorBoundary>
  );
}
```

## 粒度の設計

**ページレベル**（粗め）：

```jsx
<ErrorBoundary>
  <UserDashboard />
</ErrorBoundary>
```

**コンポーネントレベル**（細かめ）：

```jsx
<div>
  <ErrorBoundary>
    <RecommendationWidget />
  </ErrorBoundary>
  <ErrorBoundary>
    <CommentSection />
  </ErrorBoundary>
</div>
```

推奨：ページレベルのバウンダリをセーフティネットとして使い、独立してエラーが発生する可能性のあるウィジェットにはコンポーネントレベルのバウンダリを追加する。

## エラーバウンダリがキャッチしないもの

エラーバウンダリは**レンダーメソッドとライフサイクルメソッド**のエラーのみキャッチします。以下はキャッチしません：

- イベントハンドラのエラー（通常の try/catch を使用）
- 非同期エラー（`setTimeout`、Promise）
- サーバーサイドレンダリングのエラー
- エラーバウンダリ自体のエラー

```javascript
// イベントハンドラ：エラーバウンダリではなく try/catch を使用
handleClick = () => {
  try {
    doSomethingRisky();
  } catch (error) {
    this.setState({ error: error.message });
  }
};
```

## React 16 の新しい挙動

React 16 では重要な挙動が変わりました：**エラーがどのエラーバウンダリにもキャッチされない場合、コンポーネントツリー全体がアンマウントされます**。以前の React は壊れた UI をそのまま残していました。

この変更の理由：壊れた UI は空の画面よりも危険です。アンマウントされたツリーはエラーを可視化し、強制的に対処させます。
