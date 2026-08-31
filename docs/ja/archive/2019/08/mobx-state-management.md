---
title: "MobX状態管理の実践とReduxとの比較"
date: 2019-08-16 14:59:05
tags:
  - フロントエンド
readingTime: 5
description: "大規模なReactプロジェクトではReduxがほぼデフォルトの選択肢だが、ボイラープレートが多く学習曲線が急という問題は常に開発者を悩ませてきた。MobXはリアクティブプログラミングパラダイムに基づき、より直感的でボイラープレートの少ない状態管理ソリューションを提供する。本記事ではMobXのコアコンセプトを深掘りし、Reduxとの詳細な比較を通じて、技術選定のより良い判断を支援する。"
wordCount: 826
---

大規模なReactプロジェクトではReduxがほぼデフォルトの選択肢だが、ボイラープレートが多く学習曲線が急という問題は常に開発者を悩ませてきた。MobXはリアクティブプログラミングパラダイムに基づき、より直感的でボイラープレートの少ない状態管理ソリューションを提供する。本記事ではMobXのコアコンセプトを深掘りし、Reduxとの詳細な比較を通じて、技術選定のより良い判断を支援する。

## MobXのコアコンセプト

MobXは3つのコアコンセプトを中心に構築されている：**Observable（観察可能な状態）**、**Computed（算出値）**、**Action（アクション）**。

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

// autorunは依存関係を自動追跡して実行する
autorun(() => {
  console.log(`ToDo総数: ${store.stats.total}, 完了: ${store.stats.done}`);
});

store.addTodo('MobXを学ぶ');  // 出力: ToDo総数: 1, 完了: 0
store.toggleTodo(store.todos[0].id); // 出力: ToDo総数: 1, 完了: 1
```

## デコレーターなしのMobX

デコレータ構文の設定が不要なら、関数型APIも使える：

```js
import { observable, computed, action, makeObservable } from 'mobx';

class CounterStore {
  count = 0;

  constructor() {
    // コンストラクタで各プロパティの型を宣言する
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

## Reactとの統合：mobx-react

```bash
npm install mobx mobx-react
```

### observer高階コンポーネントの使用

```jsx
{% raw %}
import React from 'react';
import { observer } from 'mobx-react';
import todoStore from '../stores/TodoStore';

const TodoList = observer(() => {
  return (
    <div>
      <h2>ToDo一覧 ({todoStore.stats.done}/{todoStore.stats.total})</h2>

      <div className="filters">
        <button onClick={() => todoStore.setFilter('all')}>すべて</button>
        <button onClick={() => todoStore.setFilter('pending')}>未完了</button>
        <button onClick={() => todoStore.setFilter('done')}>完了済み</button>
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
            <button onClick={() => todoStore.removeTodo(todo.id)}>削除</button>
          </li>
        ))}
      </ul>
    </div>
  );
});

export default TodoList;
{% endraw %}
```

### injectを使ったStoreの注入

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
        placeholder="新しいToDoを追加..."
      />
      <button type="submit">追加</button>
    </form>
  );
}));

export default TodoForm;
```

```jsx
// Providerでラップ
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

## 非同期アクション処理

MobX自体には非同期処理の仕組みは組み込まれていないが、`runInAction` や `flow` を使って対応できる：

### 方法1：runInAction

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

      // 非同期コールバックでの状態変更はrunInActionで囲む必要がある
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

### 方法2：flow + generator

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
  // flowが生成する関数は自動的にactionになるため、@actionデコレータは不要
}
```

## MobX vs Redux 比較

### コード量の比較：同じToDo機能の実装

**Redux方式：**

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

**MobX方式：**

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

MobXのコード量はReduxの約1/3である。

### アーキテクチャ比較

| 観点 | Redux | MobX |
|------|-------|------|
| プログラミングパラダイム | 関数型 | オブジェクト指向/リアクティブ |
| 状態構造 | 単一Store、不変データ | 複数Store、可変データ |
| 更新方法 | dispatch action → pure reducer | observableを直接変更 |
| 学習曲線 | 急（action、reducer、middleware） | 緩やか（observable、computed、action） |
| デバッグツール | Redux DevTools、タイムトラベル対応 | MobX DevTools、機能はやや弱い |
| 不変性 | 強制不変（変更追跡が容易） | 自動追跡（直接変更） |
| コード量 | 多い（action、reducer、selector） | 少ない（プロパティを直接変更） |
| 適用場面 | 大規模チーム、厳格な規約が必要 | 中小規模チーム、開発効率を重視 |

## runInActionとストリクトモードの使用

```js
import { configure } from 'mobx';

// 厳格モードの有効化：action内でのみ状態変更を許可
configure({ enforceActions: 'always' });

class CounterStore {
  @observable count = 0;

  @action
  increment() {
    this.count++; // OK
  }

  // action外で変更すると、厳格モードではエラーになる
  badIncrement() {
    // this.count++; // Error: observableの値の変更はaction内で行う必要がある
  }
}
```

## まとめ

- MobXはリアクティブプログラミングに基づき、`observable`・`computed`・`action` の3つのコアコンセプトで状態を管理する
- Reduxと比較して、MobXはコード量が少なく、学習コストが低く、開発体験がスムーズである
- `observer` はコンポーネントで使用されるすべてのobservableを自動追跡し、精密な粒度の更新を実現する
- 非同期操作は `runInAction` または `flow` + generator で処理できる
- `enforceActions` 厳格モードの有効化を推奨する。状態変更の追跡可能性を保証できる
- Reduxは大規模チームで厳格な規約が必要な場面に適し、MobXは開発効率を重視する中小規模プロジェクトに適している
- MobXのデバッグ機能はReduxに比べてやや弱く、タイムトラベルデバッグのサポートも限定的である
