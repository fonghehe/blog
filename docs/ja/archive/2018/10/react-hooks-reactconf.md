---
title: "React Hooks 正式デビュー：React Conf 2018 観戦レポート"
date: 2018-10-29 14:39:19
tags:
  - React
readingTime: 4
description: "2018年10月25〜26日、React Conf 2018 がネバダ州ヘンダーソンで開催されました。Dan Abramov と Ryan Florence が Hooks のライブデモを行い、コミュニティ全体が沸きました。"
wordCount: 850
---

2018年10月25〜26日、React Conf 2018 がネバダ州ヘンダーソンで開催されました。Dan Abramov と Ryan Florence が Hooks のライブデモを行い、コミュニティ全体が沸きました。

## React Conf での Hooks デモ

Dan は複雑なクラスコンポーネントを Hooks を使った関数コンポーネントに書き直す方法を実演しました。特に印象的だったのは、以前は HOC の多重ネストが必要だったコードが、今では数個のカスタム Hook で解決でき、しかもコードがより明確になったことです。

Ryan は render props を Hooks で置き換えるシナリオを実演し、会場では絶え間ない拍手が起きていました。

## Hooks のコアコンセプト（理解の更新）

9月に書いたプレビュー記事と比べて、今は Hooks についてより深く理解できています：

**1. Hooks は関数コンポーネントに状態を追加するだけでなく、ロジックと UI を分離する**

```javascript
// 以前の考え方：コンポーネント = UI + 状態 + ロジック、すべて混在
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

// Hooks の考え方：ロジックを Hook として抽出、コンポーネントは UI のみに集中
function useUser(userId) {
  // 関連するすべてのロジックを一箇所に
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

// コンポーネントは UI のみに集中
function UserPage({ userId }) {
  const { user, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserProfile user={user} />;
}
```

**2. すべての Hook は `useState` と `useEffect` の上に構築されている**

```javascript
// useContext：状態を共有
const theme = useContext(ThemeContext);

// useReducer：複雑な状態管理
const [state, dispatch] = useReducer(reducer, initialState);

// useCallback：関数をメモ化して不要な子コンポーネントの再レンダリングを防ぐ
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// useMemo：計算結果をメモ化
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useRef：レンダリングをトリガーしない永続的な参照
const inputRef = useRef(null);
```

## Hooks のルール

React は2つのルールを要求します：

```javascript
// ルール1：Hook はトップレベルのみで呼び出す（条件分岐やループ内は不可）
function BadExample() {
  if (condition) {
    const [x] = useState(0); // ❌ 誤り！
  }
}

// ルール2：React の関数コンポーネントまたはカスタム Hook 内でのみ呼び出す
function notAComponent() {
  const [x] = useState(0); // ❌ 誤り！
}

// ESLint プラグイン：eslint-plugin-react-hooks がこれらのルールをチェックしてくれる
```

なぜこのルールがあるのか？React は呼び出し順序によって複数の `useState` を区別しています。条件分岐が呼び出し順序を変えてしまうとエラーが発生します。

## Vue 3 の Composition API

Hooks の成功は Vue の設計にも影響を与えました。Vue 3 の Composition API は明らかに React Hooks から着想を得ています：

```javascript
// Vue 3 Composition API（将来の書き方）
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

React Hooks と比べて、Vue の `setup` は一度だけ実行されます（Hooks のように毎回レンダリングで実行されるわけではありません）。これにより依存配列の問題がなくなりますが、一部の柔軟性も失われます。

## いつ安定版がリリースされる？

Dan は Conf で、Hooks はすでに React 16.7 alpha で利用可能だが、API にはまだ小さな調整が入る可能性があると述べました。正式版リリース前に、さらなるフィードバックを集めることが目標です。

小さなプロジェクトで React 16.7 alpha + Hooks を試してみましたが、非常に使いやすかったです。ただし、本番プロジェクトは安定版を待ちましょう。

## まとめ

- React Conf 2018 で Hooks が正式に発表され、コミュニティの反響は大きかった
- Hooks のコアバリュー：ステートフルなロジックを再利用可能なカスタム Hook として抽出する
- 2つのルール：トップレベルのみで呼び出す、関数コンポーネントまたはカスタム Hook 内でのみ呼び出す
- Vue 3 の Composition API も同様の方向に進んでいる
- 本番プロジェクトは Hooks の安定版を待つ、個人プロジェクトは今すぐ試せる
