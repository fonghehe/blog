---
title: "MobX 狀態管理實踐與 Redux 對比"
date: 2019-08-16 14:59:05
tags:
  - 前端
readingTime: 4
description: "Redux 在大型 React 專案中幾乎是預設選擇，但其 boilerplate 多、學習曲線陡峭的問題一直被開發者詬病。MobX 基於響應式程式設計範式，提供了更直觀、更少樣板程式碼的狀態管理方案。本文將深入 MobX 的核心概念，並與 Redux 做詳細對比，幫助你在技術選型時做出更好的決策。"
---

Redux 在大型 React 專案中幾乎是預設選擇，但其 boilerplate 多、學習曲線陡峭的問題一直被開發者詬病。MobX 基於響應式程式設計範式，提供了更直觀、更少樣板程式碼的狀態管理方案。本文將深入 MobX 的核心概念，並與 Redux 做詳細對比，幫助你在技術選型時做出更好的決策。

## MobX 核心概念

MobX 圍繞三個核心概念構建：**Observable（可觀察狀態）**、**Computed（計算值）**、**Action（動作）**。

```js
import { observable, computed, action, autorun } from 'mobx';

class TodoStore {
  @observable todos = [];
  @observable filter = 'all';

  @computed
  get filteredTodos() {
    switch (this.filter) {
      case 'done':
        return this.todos.filter(t => t.done);
      case 'pending':
        return this.todos.filter(t => !t.done);
      default:
        return this.todos;
    }
  }

  @computed
  get stats() {
    return {
      total: this.todos.length,
      done: this.todos.filter(t => t.done).length,
      pending: this.todos.filter(t => !t.done).length,
    };
  }

  @action
  addTodo(title) {
    this.todos.push({
      id: Date.now(),
      title,
      done: false,
    });
  }

  @action
  toggleTodo(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) {
      todo.done = !todo.done;
    }
  }

  @action
  removeTodo(id) {
    const index = this.todos.findIndex(t => t.id === id);
    if (index > -1) {
      this.todos.splice(index, 1);
    }
  }

  @action
  setFilter(filter) {
    this.filter = filter;
  }
}

const store = new TodoStore();

// autorun 自動追蹤依賴並執行
autorun(() => {
  console.log(`待辦總數: ${store.stats.total}, 已完成: ${store.stats.done}`);
});

store.addTodo('學習 MobX');  // 輸出: 待辦總數: 1, 已完成: 0
store.toggleTodo(store.todos[0].id); // 輸出: 待辦總數: 1, 已完成: 1
```

## MobX 不使用裝飾器的寫法

如果你不想配置裝飾器語法，也可以使用函式式 API：

```js
import { observable, computed, action, makeObservable } from 'mobx';

class CounterStore {
  count = 0;

  constructor() {
    // 在建構函式中宣告每個屬性的型別
    makeObservable(this, {
      count: observable,
      doubled: computed,
      increment: action,
      decrement: action,
    });
  }

  get doubled() {
    return this.count * 2;
  }

  increment() {
    this.count++;
  }

  decrement() {
    this.count--;
  }
}
```

## 與 React 整合：mobx-react

```bash
npm install mobx mobx-react
```

### 使用 observer 高階元件

```jsx
{% raw %}
import React from 'react';
import { observer } from 'mobx-react';
import todoStore from '../stores/TodoStore';

const TodoList = observer(() => {
  return (
    <div>
      <h2>待辦列表 ({todoStore.stats.done}/{todoStore.stats.total})</h2>

      <div className="filters">
        <button onClick={() => todoStore.setFilter('all')}>全部</button>
        <button onClick={() => todoStore.setFilter('pending')}>未完成</button>
        <button onClick={() => todoStore.setFilter('done')}>已完成</button>
      </div>

      <ul>
        {todoStore.filteredTodos.map(todo => (
          <li key={todo.id}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => todoStore.toggleTodo(todo.id)}
            />
            <span style={{ textDecoration: todo.done ? 'line-through' : 'none' }}>
              {todo.title}
            </span>
            <button onClick={() => todoStore.removeTodo(todo.id)}>刪除</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default TodoList;
{% endraw %}
```

### 使用 inject 注入 Store

```jsx
import React from 'react';
import { observer, inject } from 'mobx-react';

const TodoForm = inject('todoStore')(observer(({ todoStore }) => {
  const [input, setInput] = React.useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      todoStore.addTodo(input.trim());
      setInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        placeholder="新增新的待辦..."
      />
      <button type="submit">新增</button>
    </form>
  );
}));

export default TodoForm;
```

```jsx
// Provider 包裹
import { Provider } from 'mobx-react';
import TodoList from './TodoList';
import TodoForm from './TodoForm';
import todoStore from '../stores/TodoStore';

function App() {
  return (
    <Provider todoStore={todoStore}>
      <TodoForm />
      <TodoList />
    </Provider>
  );
}
```

## 非同步 Action 處理

MobX 本身沒有內建非同步處理方案，但可以通過 `runInAction` 或 `flow` 來處理：

### 方式一：runInAction

```js
import { observable, action, runInAction } from 'mobx';

class UserStore {
  @observable users = [];
  @observable loading = false;
  @observable error = null;

  @action
  async fetchUsers() {
    this.loading = true;
    this.error = null;

    try {
      const response = await fetch('/api/users');
      const data = await response.json();

      // 非同步回撥中修改狀態需要包裹在 runInAction 中
      runInAction(() => {
        this.users = data;
        this.loading = false;
      });
    } catch (err) {
      runInAction(() => {
        this.error = err.message;
        this.loading = false;
      });
    }
  }
}
```

### 方式二：flow + generator

```js
import { observable, action, flow } from 'mobx';

class UserStore {
  @observable users = [];
  @observable loading = false;

  fetchUsers = flow(function* () {
    this.loading = true;
    try {
      const response = yield fetch('/api/users');
      const data = yield response.json();
      this.users = data;
    } catch (err) {
      console.error(err);
    } finally {
      this.loading = false;
    }
  });
  // flow 生成的函式自動就是 action，不需要 @action 裝飾器
}
```

## MobX vs Redux 對比

### 程式碼量對比：實現相同的 Todo 功能

**Redux 方式：**

```js
// actions.js
const ADD_TODO = 'ADD_TODO';
const TOGGLE_TODO = 'TOGGLE_TODO';

const addTodo = (title) => ({ type: ADD_TODO, payload: { title } });
const toggleTodo = (id) => ({ type: TOGGLE_TODO, payload: { id } });

// reducer.js
const initialState = { todos: [] };

function todoReducer(state = initialState, action) {
  switch (action.type) {
    case ADD_TODO:
      return {
        ...state,
        todos: [...state.todos, {
          id: Date.now(),
          title: action.payload.title,
          done: false,
        }],
      };
    case TOGGLE_TODO:
      return {
        ...state,
        todos: state.todos.map(todo =>
          todo.id === action.payload.id
            ? { ...todo, done: !todo.done }
            : todo
        ),
      };
    default:
      return state;
  }
}

// TodoList.jsx
import { useSelector, useDispatch } from 'react-redux';

function TodoList() {
  const todos = useSelector(state => state.todos);
  const dispatch = useDispatch();
  // ...
}
```

**MobX 方式：**

```js
class TodoStore {
  @observable todos = [];

  @action
  addTodo(title) {
    this.todos.push({ id: Date.now(), title, done: false });
  }

  @action
  toggleTodo(id) {
    const todo = this.todos.find(t => t.id === id);
    if (todo) todo.done = !todo.done;
  }
}
```

MobX 程式碼量約為 Redux 的 1/3。

### 架構對比

| 維度 | Redux | MobX |
|
------|-------|------|
| 程式設計範式 | 函式式 | 面向物件/響應式 |
| 狀態結構 | 單一 Store，不可變資料 | 多個 Store，可變資料 |
| 更新方式 | dispatch action → pure reducer | 直接修改 observable |
| 學習曲線 | 陡峭（action、reducer、middleware） | 平緩（observable、computed、action） |
| 除錯工具 | Redux DevTools，支援時間旅行 | MobX DevTools，功能稍弱 |
| 不可變性 | 強制不可變（方便追蹤變化） | 自動追蹤（直接修改） |
| 程式碼量 | 多（action、reducer、selector） | 少（直接修改屬性） |
| 適用場景 | 大型團隊，需要嚴格規範 | 中小型團隊，追求開發效率 |

## 使用 runInAction 和嚴格模式

```js
import { configure } from 'mobx';

// 開啟嚴格模式：只允許在 action 中修改狀態
configure({ enforceActions: 'always' });

class CounterStore {
  @observable count = 0;

  @action
  increment() {
    this.count++; // OK
  }

  // 如果不在 action 中修改，嚴格模式下會報錯
  badIncrement() {
    // this.count++; // Error: 改變 observable 的值必須在 action 中
  }
}
```

## 小結

- MobX 基於響應式程式設計，使用 `observable`、`computed`、`action` 三個核心概念管理狀態
- 相比 Redux，MobX 程式碼量更少、學習成本更低、開發體驗更流暢
- `observer` 會自動追蹤元件中使用的所有 observable，實現精準的細粒度更新
- 非同步操作可以使用 `runInAction` 或 `flow` + generator 來處理
- 推薦開啟 `enforceActions` 嚴格模式，保證狀態修改的可追溯性
- Redux 適合大型團隊需要嚴格規範的場景，MobX 適合追求開發效率的中小型專案
- MobX 的除錯能力相對 Redux 稍弱，時間旅行除錯支援有限
