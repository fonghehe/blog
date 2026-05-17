---
title: "ReactのRef転送と使用シナリオ"
date: 2019-05-16 17:14:10
tags:
  - React
readingTime: 1
description: "最近プロジェクトでReactのRef転送を使い、思ったより複雑でした。実践で得られた経験をまとめます。"
---

最近プロジェクトでReactのRef転送を使い、思ったより複雑でした。実践で得られた経験をまとめます。

## コア原則

`useRef`はコンポーネントのライフタイムを通じて持続するミュータブルな`current`プロパティを持つオブジェクトを返します。stateとは異なり、`current`の更新は再レンダリングをトリガーしません。

```javascript
import React, { useRef, useEffect } from "react";

function TextInput() {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current.focus();
  }, []);

  return <input ref={inputRef} type="text" />;
}
```

## forwardRefを使ったRef転送

コンポーネントを通じて内部のDOMノードにrefを渡す必要がある場合：

```javascript
const FancyInput = React.forwardRef((props, ref) => (
  <input ref={ref} className="fancy-input" {...props} />
));

// 親コンポーネント
function Parent() {
  const inputRef = useRef(null);

  const handleClick = () => {
    inputRef.current.focus();
  };

  return (
    <>
      <FancyInput ref={inputRef} placeholder="ボタンをクリックしてフォーカス" />
      <button onClick={handleClick}>フォーカス</button>
    </>
  );
}
```

## useImperativeHandle：カスタムAPIの公開

親コンポーネントが特定のメソッドだけにアクセスできるようにする場合：

```javascript
const CustomInput = React.forwardRef((props, ref) => {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current.focus(),
    clear: () => {
      inputRef.current.value = "";
    },
    getValue: () => inputRef.current.value,
    // DOMノード全体ではなく特定のメソッドのみ公開
  }));

  return <input ref={inputRef} {...props} />;
});

// 親はfocus、clear、getValueのみ呼べる
function Parent() {
  const inputRef = useRef(null);
  return (
    <>
      <CustomInput ref={inputRef} />
      <button onClick={() => inputRef.current.clear()}>クリア</button>
    </>
  );
}
```

Ref転送は主に次の用途に使われます：フォームライブラリでのinputへのフォーカス、サードパーティの命令型APIとの統合、DOMメソッドを公開する再利用可能なコンポーネントライブラリの構築。
