---
title: "React Hooks 正式亮相：React Conf 2018 觀後感"
date: 2018-10-29 14:39:19
tags:
  - React
readingTime: 3
description: "10月25-26日，React Conf 2018 在美國內華達州舉行。Dan Abramov 和 Ryan Florence 現場演示了 Hooks，整個社區都炸了。"
---

10月25-26日，React Conf 2018 在美國內華達州舉行。Dan Abramov 和 Ryan Florence 現場演示了 Hooks，整個社區都炸了。

## React Conf 上的 Hooks 演示

Dan 演示瞭如何把一個複雜的 class 組件改寫成使用 Hooks 的函數組件。最讓我印象深刻的是，之前需要 HOC 層層嵌套的代碼，現在用幾個自定義 Hook 就解決了，而且代碼更清晰。

Ryan 演示了用 Hooks 替換 render props 的場景，現場掌聲不斷。

## Hooks 的核心理念（更新理解）

和 9 月寫的預覽文章比，現在對 Hooks 的理解更深了：

**1. Hooks 不是在函數組件里加了狀態，而是把邏輯和 UI 分離**

```javascript
// 之前的思維方式：組件 = UI + 狀態 + 邏輯，全混在一起
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

// Hooks 的思維方式：邏輯抽離為 Hook，組件只關注 UI
function useUser(userId) {
  // 所有相關邏輯在一處
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

// 組件只關注 UI
function UserPage({ userId }) {
  const { user, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserProfile user={user} />;
}
```

**2. 所有 Hooks 都建立在 useState 和 useEffect 之上**

```javascript
// useContext：共享狀態
const theme = useContext(ThemeContext);

// useReducer：複雜狀態管理
const [state, dispatch] = useReducer(reducer, initialState);

// useCallback：緩存函數，避免子組件不必要重渲染
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// useMemo：緩存計算結果
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useRef：持久化引用，不觸發渲染
const inputRef = useRef(null);
```

## Hooks 的使用規則

React 要求兩條規則：

```javascript
// 規則 1：只在最頂層調用 Hook（不能在條件/循環裏）
function BadExample() {
  if (condition) {
    const [x] = useState(0); // ❌ 錯誤！
  }
}

// 規則 2：只在 React 函數組件或自定義 Hook 裏調用
function notAComponent() {
  const [x] = useState(0); // ❌ 錯誤！
}

// ESLint 插件：eslint-plugin-react-hooks 幫你檢查
```

為什麼有這個規則？React 靠調用順序來區分多個 useState，如果條件判斷改變了調用順序，就會出錯。

## Vue 3 的 Composition API

Hooks 的成功也影響了 Vue 的設計。Vue 3 的 Composition API 明顯受到了 React Hooks 的啓發：

```javascript
// Vue 3 Composition API（將來的寫法）
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

和 React Hooks 相比，Vue 的 `setup` 只執行一次（不像 hooks 每次渲染都執行），沒有依賴數組的問題，但也失去了一些靈活性。

## 什麼時候穩定？

Dan 在 Conf 上説 Hooks 已經在 React 16.7 alpha 中可用，但 API 還可能有小調整。目標是在正式版發佈前徵集更多反饋。

我在一個小項目裏試了一下 React 16.7 alpha + Hooks，感覺非常順手。但生產項目還是等穩定版吧。

## 小結

- React Conf 2018 正式介紹了 Hooks，社區反響熱烈
- Hooks 的核心價值：把有狀態的邏輯抽離到可複用的 Hook
- 兩條規則：只在頂層調用、只在函數組件/自定義 Hook 裏調用
- Vue 3 Composition API 也在朝類似方向發展
- 生產項目等 Hooks 穩定版，個人項目現在就可以玩
