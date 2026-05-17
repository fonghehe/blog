---
title: "React Contextのパフォーマンス最適化ガイド"
date: 2019-05-13 10:48:53
tags:
  - React
readingTime: 2
description: "React 16.3で新しいContext APIが導入され、16.8のHooksによってさらに使いやすくなりました。しかし実際のプロジェクトでは、Contextを使うとコンポーネントが頻繁に再レンダリングされ、パフォーマンスが低下するという問題がよく発生します。本記事ではContextのレンダリングメカニズムと最適化"
---

React 16.3で新しいContext APIが導入され、16.8のHooksによってさらに使いやすくなりました。しかし実際のプロジェクトでは、Contextを使うとコンポーネントが頻繁に再レンダリングされ、パフォーマンスが低下するという問題がよく発生します。本記事ではContextのレンダリングメカニズムと最適化戦略を深く分析します。

## Contextによる再レンダリング問題

典型的な「落とし穴にはまる」ケースを見てみましょう：

```jsx
{% raw %}
import React, { createContext, useState } from 'react'

const UserContext = createContext()

function App() {
  const [user, setUser] = useState({ name: 'アリス', age: 25 })
  const [theme, setTheme] = useState('light')

  console.log('App render')

  return (
    <UserContext.Provider value={{ user, setUser, theme, setTheme }}>
      <UserProfile />
      <ThemeSwitcher />
    </UserContext.Provider>
  )
}

function UserProfile() {
  console.log('UserProfile render')
  const { user } = useContext(UserContext)
  return <div>ユーザー名: {user.name}</div>
}

function ThemeSwitcher() {
  console.log('ThemeSwitcher render')
  const { theme, setTheme } = useContext(UserContext)
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      現在のテーマ: {theme}
    </button>
  )
}
{% endraw %}
```

問題：テーマ切り替えボタンをクリックすると、`UserProfile`も再レンダリングされます（`user`しか使っていないにも関わらず）。`ThemeSwitcher`が`setTheme`を呼ぶと`value`オブジェクトが変わり、`useContext(UserContext)`を使うすべてのコンポーネントが再レンダリングされます。

**コア原則：Context.Providerのvalueが変わると、そのContextを使うすべてのコンポーネントが再レンダリングされます——実際にvalueのどのフィールドを使っているかに関わらず。**

## 解決策1：Contextを分割する

最も直接的なアプローチ：異なる関心事を別々のContextに分ける。

```jsx
import React, { createContext, useState, useContext } from "react";

// 関心事ごとに分割
const UserContext = createContext();
const ThemeContext = createContext();

function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "アリス", age: 25 });
  const [theme, setTheme] = useState("light");

  const userValue = { user, setUser };
  const themeValue = { theme, setTheme };

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

## 解決策2：useMemoでメモ化する

```jsx
function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "アリス", age: 25 });
  const [theme, setTheme] = useState("light");

  // valueオブジェクトをメモ化して実際のデータが変わった時だけ変わるようにする
  const userValue = useMemo(() => ({ user, setUser }), [user]);
  const themeValue = useMemo(() => ({ theme, setTheme }), [theme]);

  return (
    <UserContext.Provider value={userValue}>
      <ThemeContext.Provider value={themeValue}>
        {children}
      </ThemeContext.Provider>
    </UserContext.Provider>
  );
}
```

関心事ごとにContextを分割するのが最も効果的な戦略です——コードをよりモジュラーで保守しやすくする効果もあります。
