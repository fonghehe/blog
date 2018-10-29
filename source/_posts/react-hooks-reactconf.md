---
title: "React Hooks 正式亮相：React Conf 2018 观后感"
date: 2018-10-29 14:39:19
tags:
  - React
---

10月25-26日，React Conf 2018 在美国内华达州举行。Dan Abramov 和 Ryan Florence 现场演示了 Hooks，整个社区都炸了。

## React Conf 上的 Hooks 演示

Dan 演示了如何把一个复杂的 class 组件改写成使用 Hooks 的函数组件。最让我印象深刻的是，之前需要 HOC 层层嵌套的代码，现在用几个自定义 Hook 就解决了，而且代码更清晰。

Ryan 演示了用 Hooks 替换 render props 的场景，现场掌声不断。

## Hooks 的核心理念（更新理解）

和 9 月写的预览文章比，现在对 Hooks 的理解更深了：

**1. Hooks 不是在函数组件里加了状态，而是把逻辑和 UI 分离**

```javascript
// 之前的思维方式：组件 = UI + 状态 + 逻辑，全混在一起
class UserPage extends React.Component {
  state = { user: null, loading: true, error: null };

  componentDidMount() {
    this.fetchUser();
  }
  componentDidUpdate(prevProps) {
    if (prevProps.userId !== this.props.userId) this.fetchUser();
  }

  fetchUser() {
    /* ... */
  }

  render() {
    /* UI */
  }
}

// Hooks 的思维方式：逻辑抽离为 Hook，组件只关注 UI
function useUser(userId) {
  // 所有相关逻辑在一处
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}

// 组件只关注 UI
function UserPage({ userId }) {
  const { user, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserProfile user={user} />;
}
```

**2. 所有 Hooks 都建立在 useState 和 useEffect 之上**

```javascript
// useContext：共享状态
const theme = useContext(ThemeContext);

// useReducer：复杂状态管理
const [state, dispatch] = useReducer(reducer, initialState);

// useCallback：缓存函数，避免子组件不必要重渲染
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// useMemo：缓存计算结果
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useRef：持久化引用，不触发渲染
const inputRef = useRef(null);
```

## Hooks 的使用规则

React 要求两条规则：

```javascript
// 规则 1：只在最顶层调用 Hook（不能在条件/循环里）
function BadExample() {
  if (condition) {
    const [x] = useState(0); // ❌ 错误！
  }
}

// 规则 2：只在 React 函数组件或自定义 Hook 里调用
function notAComponent() {
  const [x] = useState(0); // ❌ 错误！
}

// ESLint 插件：eslint-plugin-react-hooks 帮你检查
```

为什么有这个规则？React 靠调用顺序来区分多个 useState，如果条件判断改变了调用顺序，就会出错。

## Vue 3 的 Composition API

Hooks 的成功也影响了 Vue 的设计。Vue 3 的 Composition API 明显受到了 React Hooks 的启发：

```javascript
// Vue 3 Composition API（将来的写法）
export default {
  setup(props) {
    const count = ref(0);
    const doubled = computed(() => count.value * 2);

    function increment() {
      count.value++;
    }

    onMounted(() => {
      console.log("mounted");
    });

    return { count, doubled, increment };
  },
};
```

和 React Hooks 相比，Vue 的 `setup` 只执行一次（不像 hooks 每次渲染都执行），没有依赖数组的问题，但也失去了一些灵活性。

## 什么时候稳定？

Dan 在 Conf 上说 Hooks 已经在 React 16.7 alpha 中可用，但 API 还可能有小调整。目标是在正式版发布前征集更多反馈。

我在一个小项目里试了一下 React 16.7 alpha + Hooks，感觉非常顺手。但生产项目还是等稳定版吧。

## 小结

- React Conf 2018 正式介绍了 Hooks，社区反响热烈
- Hooks 的核心价值：把有状态的逻辑抽离到可复用的 Hook
- 两条规则：只在顶层调用、只在函数组件/自定义 Hook 里调用
- Vue 3 Composition API 也在朝类似方向发展
- 生产项目等 Hooks 稳定版，个人项目现在就可以玩
