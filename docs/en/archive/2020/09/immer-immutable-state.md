---
title: "Immer.js: Simplifying React Immutable State Updates with Proxy"
date: 2020-09-05 10:00:18
tags:
  - Frontend
readingTime: 2
description: "React state updates must be immutable — you never mutate state directly, you return a new object. With deeply nested data, that means a lot of boilerplate. Immer's Proxy magic lets you 'mutate' the data directly while it produces the new immutable object for you behind the scenes."
wordCount: 212
---

React requires state updates to be immutable — you can't mutate state directly; you have to return a new object. For deeply nested data structures this generates a lot of boilerplate. Immer uses Proxy magic to let you "mutate" the data directly, while it generates the new immutable object for you behind the scenes.

## The Pain Without Immer

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

## With Immer

```javascript
import produce from "immer";

const nextState = produce(state, (draft) => {
  const user = draft.users.find((u) => u.id === targetId);
  user.profile.address.city = "Beijing"; // 直接赋值！
});
```

`produce` takes the current state and a "recipe function". The `draft` inside the recipe is a Proxy of the state; any changes you make to `draft` are recorded by Immer and used to produce a new immutable object. The original state is never changed.

## Using It with React useState

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

## Using It with useReducer

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

## Using It with Redux (with RTK)

Redux Toolkit has Immer built in, so you can "mutate" state directly inside `createSlice`:

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

## Performance Notes

Immer uses Proxy, and its performance on modern JS engines is already very good, but there are a few things to keep in mind:

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

## Summary

Immer is one of the highest-leverage tools in React state management: the learning cost is minimal (literally "just mutate inside the recipe"), yet it can cut the code for updating complex nested state by over 70%. Redux Toolkit already bundles Immer, which shows this approach has been endorsed by the Redux team.
