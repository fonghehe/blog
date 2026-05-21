---
title: "MobX State Management in Practice vs Redux"
date: 2019-08-16 14:59:05
tags:
  - Frontend
readingTime: 4
description: "Redux 在大型 React 项目中几乎是默认选择，但其 boilerplate 多、学习曲线陡峭的问题一直被开发者诟病。MobX 基于响应式编程范式，提供了更直观、更少样板代码的状态管理方案。本文将深入 MobX 的核心概念，并与 Redux 做详细对比，帮助你在技术选型时做出更好的决策。"
wordCount: 558
---

Redux 在大型 React 项目中几乎是默认选择，但其 boilerplate 多、学习曲线陡峭的问题一直被开发者诟病。MobX 基于响应式编程范式，提供了更直观、更少样板代码的状态管理方案。本文将深入 MobX 的核心概念，并与 Redux 做详细对比，帮助你在技术选型时做出更好的决策。

## MobX Core Concepts

MobX 围绕三个核心概念构建：**Observable（可观察状态）**、**Computed（计算值）**、**Action（动作）**。

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

// autorun 自动追踪依赖并执行
autorun(() => {
  console.log(`待办总数: ${store.stats.total}, 已完成: ${store.stats.done}`);
});

store.addTodo('学习 MobX');  // 输出: 待办总数: 1, 已完成: 0
store.toggleTodo(store.todos[0].id); // 输出: 待办总数: 1, 已完成: 1
```

## MobX Without Decorators

如果你不想配置装饰器语法，也可以使用函数式 API：

```js
import { observable, computed, action, makeObservable } from 'mobx';

class CounterStore {
  count = 0;

  constructor() {
    // 在构造函数中声明每个属性的类型
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

## React Integration: mobx-react

```bash
npm install mobx mobx-react
```

### 使用 observer 高阶组件

```jsx
{% raw %}
import React from 'react';
import { observer } from 'mobx-react';
import todoStore from '../stores/TodoStore';

const TodoList = observer(() => {
  return (
    <div>
      <h2>待办列表 ({todoStore.stats.done}/{todoStore.stats.total})</h2>

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
            <button onClick={() => todoStore.removeTodo(todo.id)}>删除</button>
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
        placeholder="添加新的待办..."
      />
      <button type="submit">添加</button>
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

## Async Action Handling

MobX 本身没有内置异步处理方案，但可以通过 `runInAction` 或 `flow` 来处理：

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

      // 异步回调中修改状态需要包裹在 runInAction 中
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
  // flow 生成的函数自动就是 action，不需要 @action 装饰器
}
```

## MobX vs Redux Comparison

### 代码量对比：实现相同的 Todo 功能

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

MobX 代码量约为 Redux 的 1/3。

### 架构对比

| 维度 | Redux | MobX |
|------|-------|------|
| 编程范式 | 函数式 | 面向对象/响应式 |
| 状态结构 | 单一 Store，不可变数据 | 多个 Store，可变数据 |
| 更新方式 | dispatch action → pure reducer | 直接修改 observable |
| 学习曲线 | 陡峭（action、reducer、middleware） | 平缓（observable、computed、action） |
| 调试工具 | Redux DevTools，支持时间旅行 | MobX DevTools，功能稍弱 |
| 不可变性 | 强制不可变（方便追踪变化） | 自动追踪（直接修改） |
| 代码量 | 多（action、reducer、selector） | 少（直接修改属性） |
| 适用场景 | 大型团队，需要严格规范 | 中小型团队，追求开发效率 |

## Using runInAction and Strict Mode

```js
import { configure } from 'mobx';

// 开启严格模式：只允许在 action 中修改状态
configure({ enforceActions: 'always' });

class CounterStore {
  @observable count = 0;

  @action
  increment() {
    this.count++; // OK
  }

  // 如果不在 action 中修改，严格模式下会报错
  badIncrement() {
    // this.count++; // Error: 改变 observable 的值必须在 action 中
  }
}
```

## Summary

- MobX 基于响应式编程，使用 `observable`、`computed`、`action` 三个核心概念管理状态
- 相比 Redux，MobX 代码量更少、学习成本更低、开发体验更流畅
- `observer` 会自动追踪组件中使用的所有 observable，实现精准的细粒度更新
- 异步操作可以使用 `runInAction` 或 `flow` + generator 来处理
- 推荐开启 `enforceActions` 严格模式，保证状态修改的可追溯性
- Redux 适合大型团队需要严格规范的场景，MobX 适合追求开发效率的中小型项目
- MobX 的调试能力相对 Redux 稍弱，时间旅行调试支持有限
