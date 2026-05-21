---
title: "useEffect 完全指南：依賴陣列是個坑"
date: 2019-03-10 10:47:44
tags:
  - 前端
readingTime: 2
description: "React Hooks 用了一個月，發現 `useEffect` 是最容易踩坑的地方。尤其是依賴陣列，不理解原理就會寫出 bug。"
wordCount: 197
---

React Hooks 用了一個月，發現 `useEffect` 是最容易踩坑的地方。尤其是依賴陣列，不理解原理就會寫出 bug。

## 從原理開始

`useEffect` 本質是"同步"——讓副作用與 React 渲染同步。

```javascript
// 心智模型：
// 每次渲染後，React 檢查依賴是否變化
// 如果變化了，先執行上次的清理函式，再執行新的 effect

function MyComponent({ id }) {
  useEffect(() => {
    console.log("effect 執行，id =", id);
    return () => {
      console.log("清理，id =", id); // 上次的 id
    };
  }, [id]);
}

// 渲染 id=1 → effect 執行（id=1）
// 渲染 id=2 → 清理（id=1）→ effect 執行（id=2）
// 解除安裝    → 清理（id=2）
```

## 常見錯誤 1：遺漏依賴

```javascript
// ❌ 錯的：遺漏了 userId 依賴
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser);
  }, []); // [] 表示只執行一次，但 userId 變化時不會重新獲取！

  return <div>{user?.name}</div>;
}

// ✅ 對的：宣告所有依賴
useEffect(() => {
  fetchUser(userId).then(setUser);
}, [userId]); // userId 變化時重新獲取
```

安裝 `eslint-plugin-react-hooks` 後，`exhaustive-deps` 規則會自動提示遺漏的依賴。

## 常見錯誤 2：無限迴圈

```javascript
// ❌ 在 effect 裡修改了依賴的狀態
function ProblematicComponent() {
  const [data, setData] = useState([]);

  useEffect(() => {
    processData(data); // 讀取 data
    setData([...data, newItem]); // 修改 data
  }, [data]); // data 變了 → 重新執行 → data 又變了 → 無限迴圈！
}

// ✅ 用 ref 或函式式更新
function FixedComponent() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCount((c) => c + 1); // 函式式更新，不需要依賴 count
    }, 1000);
    return () => clearInterval(timer);
  }, []); // [] 合法，因為不再依賴 count
}
```

## useCallback 和 useMemo

當 effect 依賴函式時，容易出現問題：

```javascript
// ❌ 每次渲染都建立新的 fetchUser 函式引用
function Parent({ userId }) {
  const fetchUser = () => fetch(`/api/user/${userId}`); // 每次新建

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // 每次都執行！
}

// ✅ useCallback 快取函式引用
function Parent({ userId }) {
  const fetchUser = useCallback(() => {
    return fetch(`/api/user/${userId}`);
  }, [userId]); // 只有 userId 變化才建立新函式

  useEffect(() => {
    fetchUser();
  }, [fetchUser]); // fetchUser 穩定，不會無限執行
}
```

```javascript
// useMemo：快取計算結果（避免每次渲染重算）
function ProductList({ products, category }) {
  // 只有 products 或 category 變化時才重新過濾
  const filtered = useMemo(
    () => products.filter((p) => p.category === category),
    [products, category],
  );

  return (
    <ul>
      {filtered.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

## 競態條件（Race Condition）

```javascript
// ❌ 如果快速切換 userId，可能後發的請求先返回
function UserProfile({ userId }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser(userId).then(setUser); // 競態！
  }, [userId]);
}

// ✅ 用 cleanup 函式取消過期請求
useEffect(() => {
  let cancelled = false;

  fetchUser(userId).then((user) => {
    if (!cancelled) setUser(user); // 只有當前 effect 還有效才更新
  });

  return () => {
    cancelled = true;
  };
}, [userId]);

// 或者用 AbortController
useEffect(() => {
  const controller = new AbortController();

  fetch(`/api/user/${userId}`, { signal: controller.signal })
    .then((r) => r.json())
    .then(setUser)
    .catch((e) => {
      if (e.name !== "AbortError") throw e;
    });

  return () => controller.abort();
}, [userId]);
```

## 小結

- 依賴陣列要誠實：用到的變數都要宣告（用 eslint 檢查）
- 函式式更新 `setState(prev => ...)` 可以減少對 state 的依賴
- `useCallback`/`useMemo` 穩定函式/物件引用，避免不必要的 effect 觸發
- 非同步 effect 要處理競態條件，用 cancelled flag 或 AbortController
