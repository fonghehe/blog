---
title: "Immer.js：用 Proxy 简化 React 不可变状态更新"
date: 2020-09-05 10:00:18
tags:
  - 前端
readingTime: 2
description: "React 的状态更新要求不可变（immutable）——不能直接修改 state，而是要返回新对象。对于嵌套较深的数据结构，这会带来大量样板代码。Immer 通过 Proxy 魔法让你\"直接修改\"数据，背后帮你生成不可变的新对象。"
wordCount: 277
---

React 的状态更新要求不可变（immutable）——不能直接修改 state，而是要返回新对象。对于嵌套较深的数据结构，这会带来大量样板代码。Immer 通过 Proxy 魔法让你"直接修改"数据，背后帮你生成不可变的新对象。

## 没有 Immer 的痛苦

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

## 有了 Immer

```javascript
import produce from "immer";

const nextState = produce(state, (draft) => {
  const user = draft.users.find((u) => u.id === targetId);
  user.profile.address.city = "Beijing"; // 直接赋值！
});
```

`produce` 接收当前 state 和一个"recipe 函数"，recipe 里的 `draft` 是 state 的 Proxy，对 draft 的修改会被 Immer 记录并生成新的不可变对象。原始 state 不会被改变。

## 在 React useState 中使用

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

Redux Toolkit 内置了 Immer，`createSlice` 里可以直接"修改"state：

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

## 性能注意事项

Immer 使用 Proxy，在现代 JS 引擎上性能已经非常好，但有几点需要注意：

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

## 总结

Immer 是 React 状态管理中性价比最高的工具之一：学习成本极低（就是"在 recipe 里随便改"），却能把复杂嵌套状态的更新代码简化 70% 以上。Redux Toolkit 已内置 Immer，说明这个思路已经被 Redux 官方认可。
