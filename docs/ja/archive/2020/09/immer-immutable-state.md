---
title: "Immer.js：ProxyでReactの不変状態更新を簡略化"
date: 2020-09-05 10:00:18
tags:
  - フロントエンド
readingTime: 2
description: "React 的状态更新要求不可变（immutable）——不能直接修改 state，而是要返回新对象。对于嵌套较深的数据结构，这会带来大量样板代码。Immer 通过 Proxy 魔法让你\"直接修改\"数据，背后帮你生成不可变的新对象。"
wordCount: 448
---

React の状態更新は不変（immutable）であることを求められます。state を直接書き換えるのではなく、新しいオブジェクトを返す必要があります。入れ子の深いデータ構造では、これが大量のボイラープレートを生みます。Immer は Proxy の魔法でデータを「直接変更」したように見せつつ、裏で不変な新オブジェクトを生成します。

## Immer を使わない場合の苦労

```javascript
// 更新深层嵌套状态
const nextState = {
  ...state,
  users: state.users.map((user) =>
    user.id === targetId
      ? {
          ...user,
          profile: {
            ...user.profile,
            address: {
              ...user.profile.address,
              city: "Beijing",
            },
          },
        }
      : user,
  ),
};
```

## Immer を使う場合

```javascript
import produce from "immer";

const nextState = produce(state, (draft) => {
  const user = draft.users.find((u) => u.id === targetId);
  user.profile.address.city = "Beijing"; // 直接赋值！
});
```

`produce` は現在の state と「recipe 関数」を受け取ります。recipe 内の `draft` は state の Proxy であり、draft への変更は Immer に記録され、新しい不変オブジェクトとして生成されます。元の state は変更されません。

## React の useState で使う

```javascript
import produce from "immer";

function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: "学习 Immer", done: false },
    { id: 2, text: "写博客", done: false },
  ]);

  const toggleTodo = (id) => {
    setTodos(
      produce((draft) => {
        const todo = draft.find((t) => t.id === id);
        todo.done = !todo.done;
      }),
    );
  };

  const addTodo = (text) => {
    setTodos(
      produce((draft) => {
        draft.push({ id: Date.now(), text, done: false });
      }),
    );
  };

  const deleteTodo = (id) => {
    setTodos(
      produce((draft) => {
        const index = draft.findIndex((t) => t.id === id);
        draft.splice(index, 1);
      }),
    );
  };
}
```

## useReducer で使う

```javascript
const reducer = produce((draft, action) => {
  switch (action.type) {
    case "INCREMENT":
      draft.count++;
      break;
    case "ADD_ITEM":
      draft.items.push(action.payload);
      break;
    case "UPDATE_ITEM":
      const item = draft.items.find((i) => i.id === action.payload.id);
      Object.assign(item, action.payload);
      break;
  }
  // 注意：使用 Immer 的 reducer 不需要 return state
});

const [state, dispatch] = useReducer(reducer, initialState);
```

## Redux で使う（RTK と組み合わせ）

Redux Toolkit には Immer が組み込まれており、`createSlice` 内で state を直接「変更」できます：

```javascript
import { createSlice } from "@reduxjs/toolkit";

const todosSlice = createSlice({
  name: "todos",
  initialState: [],
  reducers: {
    addTodo: (state, action) => {
      state.push(action.payload); // 直接 push！RTK 内置 Immer
    },
    toggleTodo: (state, action) => {
      const todo = state.find((t) => t.id === action.payload);
      todo.done = !todo.done;
    },
  },
});
```

## パフォーマンス上の注意点

Immer は Proxy を使っており、モダンな JS エンジンではすでに十分な性能ですが、いくつか注意点があります：

```javascript
// ✅ 正常使用
produce(state, (draft) => {
  draft.items.push(newItem);
});

// ❌ 不要在 produce 外部使用 draft
let leaked;
produce(state, (draft) => {
  leaked = draft; // draft 在 recipe 执行完后会被撤销
});
leaked.items; // 已经失效！

// ⚠️ 大数组（万级）场景下，考虑用 enableMapSet 插件
import { enableMapSet } from "immer";
enableMapSet(); // 支持 Map 和 Set
```

## まとめ

Immer は React の状態管理の中で費用対効果が最も高いツールの一つです。学習コストは極めて低く（recipe 内で好きに変更するだけ）、複雑な入れ子状態の更新コードを 70% 以上削減できます。Redux Toolkit に Immer が組み込まれていることは、このアプローチが Redux 公式にも認められている証拠です。
