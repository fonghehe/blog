---
title: "Immer.js：用 Proxy 簡化 React 不可變狀態更新"
date: 2020-09-05 10:00:18
tags:
  - 前端
readingTime: 2
description: "React 的狀態更新要求不可變（immutable）——不能直接修改 state，而是要返回新對象。對於嵌套較深的數據結構，這會帶來大量樣板代碼。Immer 通過 Proxy 魔法讓你\"直接修改\"數據，背後幫你生成不可變的新對象。"
wordCount: 277
---

React 的狀態更新要求不可變（immutable）——不能直接修改 state，而是要返回新對象。對於嵌套較深的數據結構，這會帶來大量樣板代碼。Immer 通過 Proxy 魔法讓你"直接修改"數據，背後幫你生成不可變的新對象。

## 沒有 Immer 的痛苦

```javascript
// 更新深層嵌套狀態
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

## 有了 Immer

```javascript
import produce from "immer";

const nextState = produce(state, (draft) => {
  const user = draft.users.find((u) => u.id === targetId);
  user.profile.address.city = "Beijing"; // 直接賦值！
});
```

`produce` 接收當前 state 和一個"recipe 函數"，recipe 裏的 `draft` 是 state 的 Proxy，對 draft 的修改會被 Immer 記錄並生成新的不可變對象。原始 state 不會被改變。

## 在 React useState 中使用

```javascript
import produce from "immer";

function TodoList() {
  const [todos, setTodos] = useState([
    { id: 1, text: "學習 Immer", done: false },
    { id: 2, text: "寫博客", done: false },
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

## 在 useReducer 中使用

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

## 在 Redux 中使用（配合 RTK）

Redux Toolkit 內置了 Immer，`createSlice` 裏可以直接"修改"state：

```javascript
import { createSlice } from "@reduxjs/toolkit";

const todosSlice = createSlice({
  name: "todos",
  initialState: [],
  reducers: {
    addTodo: (state, action) => {
      state.push(action.payload); // 直接 push！RTK 內置 Immer
    },
    toggleTodo: (state, action) => {
      const todo = state.find((t) => t.id === action.payload);
      todo.done = !todo.done;
    },
  },
});
```

## 性能注意事項

Immer 使用 Proxy，在現代 JS 引擎上性能已經非常好，但有幾點需要注意：

```javascript
// ✅ 正常使用
produce(state, (draft) => {
  draft.items.push(newItem);
});

// ❌ 不要在 produce 外部使用 draft
let leaked;
produce(state, (draft) => {
  leaked = draft; // draft 在 recipe 執行完後會被撤銷
});
leaked.items; // 已經失效！

// ⚠️ 大數組（萬級）場景下，考慮用 enableMapSet 插件
import { enableMapSet } from "immer";
enableMapSet(); // 支持 Map 和 Set
```

## 總結

Immer 是 React 狀態管理中性價比最高的工具之一：學習成本極低（就是"在 recipe 裏隨便改"），卻能把複雜嵌套狀態的更新代碼簡化 70% 以上。Redux Toolkit 已內置 Immer，説明這個思路已經被 Redux 官方認可。
