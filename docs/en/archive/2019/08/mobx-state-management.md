---
title: "MobX State Management in Practice vs Redux"
date: 2019-08-16 14:59:05
tags:
  - Frontend
readingTime: 4
description: "Redux is almost the default choice for large React projects, but developers have long complained about its heavy boilerplate and steep learning curve. MobX is built on the reactive programming paradigm and offers a more intuitive, less boilerplate-heavy approach to state management. This article digs into MobX's core concepts and compares it in detail with Redux, to help you make a better choice when picking your stack."
wordCount: 351
---

Redux is almost the default choice for large React projects, but developers have long complained about its heavy boilerplate and steep learning curve. MobX is built on the reactive programming paradigm and offers a more intuitive, less boilerplate-heavy approach to state management. This article digs into MobX's core concepts and compares it in detail with Redux, to help you make a better choice when picking your stack.

## MobX Core Concepts

MobX is built around three core concepts: **Observable** (observable state), **Computed** (derived values), and **Action** (mutations).

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

If you'd rather not configure decorator syntax, you can use the functional API:

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

### Using the observer Higher-Order Component

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

### Injecting the Store with inject

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

MobX doesn't ship a built-in async solution, but you can handle async work with `runInAction` or `flow`:

### Approach 1: runInAction

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

### Approach 2: flow + generator

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

### Comparing Code Volume: Implementing the Same Todo Feature

**Redux approach:**

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

**MobX approach:**

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

MobX takes roughly one-third of the code Redux needs.

### Architecture Comparison

| Dimension | Redux | MobX |
|------|-------|------|
| Programming paradigm | Functional | OOP / Reactive |
| State structure | Single store, immutable data | Multiple stores, mutable data |
| Update mechanism | dispatch action → pure reducer | Directly mutate observables |
| Learning curve | Steep (actions, reducers, middleware) | Gentle (observable, computed, action) |
| Dev tools | Redux DevTools, time-travel support | MobX DevTools, slightly weaker |
| Immutability | Enforced (easy to track changes) | Auto-tracking (direct mutation) |
| Code volume | More (actions, reducers, selectors) | Less (direct property mutation) |
| Best for | Large teams needing strict conventions | Small/mid teams prioritizing dev efficiency |

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

- MobX is based on reactive programming and manages state with three core concepts: `observable`, `computed`, and `action`.
- Compared with Redux, MobX has less code, a lower learning curve, and a smoother dev experience.
- `observer` automatically tracks every observable used in a component, enabling precise, fine-grained updates.
- Async operations can be handled with `runInAction` or `flow` + generators.
- Enable `enforceActions` strict mode to keep state mutations traceable.
- Redux suits large teams that need strict conventions; MobX suits small/mid projects that prioritize dev efficiency.
- MobX's debugging capabilities are a bit weaker than Redux's, with limited time-travel support.
