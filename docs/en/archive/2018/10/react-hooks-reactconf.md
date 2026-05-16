---
title: "React Hooks Make Their Debut: React Conf 2018 Impressions"
date: 2018-10-29 14:39:19
tags:
  - React
readingTime: 2
description: "React Conf 2018 was held in Henderson, Nevada on October 25–26. Dan Abramov and Ryan Florence gave live demos of Hooks, and the community exploded."
---

React Conf 2018 was held in Henderson, Nevada on October 25–26. Dan Abramov and Ryan Florence gave live demos of Hooks, and the community exploded.

## The Hooks Demo at React Conf

Dan showed how to rewrite a complex class component using Hooks. What impressed me most was how code that previously required layers of HOC nesting could now be solved with a few custom Hooks — and the result was far clearer.

Ryan demonstrated replacing render props with Hooks, earning sustained applause from the audience.

## The Core Philosophy of Hooks (Updated Understanding)

Compared with my preview article from September, my understanding of Hooks is now deeper:

**1. Hooks don't just add state to function components — they separate logic from UI**

```javascript
// Old mental model: component = UI + state + logic, all mixed together
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

// Hooks mental model: extract logic into a Hook; the component only handles UI
function useUser(userId) {
  // All related logic in one place
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

// Component only handles UI
function UserPage({ userId }) {
  const { user, loading, error } = useUser(userId);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserProfile user={user} />;
}
```

**2. All Hooks are built on top of `useState` and `useEffect`**

```javascript
// useContext: share state
const theme = useContext(ThemeContext);

// useReducer: complex state management
const [state, dispatch] = useReducer(reducer, initialState);

// useCallback: memoize functions to avoid unnecessary child re-renders
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// useMemo: memoize computed values
const sortedList = useMemo(() => {
  return items.sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useRef: persistent reference that doesn't trigger re-renders
const inputRef = useRef(null);
```

## Rules of Hooks

React enforces two rules:

```javascript
// Rule 1: Only call Hooks at the top level (not inside conditions or loops)
function BadExample() {
  if (condition) {
    const [x] = useState(0); // ❌ Wrong!
  }
}

// Rule 2: Only call Hooks inside React function components or custom Hooks
function notAComponent() {
  const [x] = useState(0); // ❌ Wrong!
}

// ESLint plugin: eslint-plugin-react-hooks checks these rules for you
```

Why the rule? React distinguishes multiple `useState` calls by their call order. If a conditional changes the call order, things break.

## Vue 3's Composition API

The success of Hooks has influenced Vue's design as well. Vue 3's Composition API is clearly inspired by React Hooks:

```javascript
// Vue 3 Composition API (future syntax)
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

Compared with React Hooks, Vue's `setup` runs only once (unlike hooks that run on every render), which eliminates dependency array concerns — but also loses some flexibility.

## When Will It Stabilize?

Dan said at the Conf that Hooks are already available in the React 16.7 alpha, but the API may still see minor adjustments before an official release. The goal is to gather more community feedback.

I tried React 16.7 alpha + Hooks in a small side project and it felt great. But for production projects, I'll wait for the stable release.

## Summary

- React Conf 2018 formally introduced Hooks to great community enthusiasm
- The core value of Hooks: extract stateful logic into reusable custom Hooks
- Two rules: only call at the top level; only call in function components or custom Hooks
- Vue 3's Composition API is also moving in a similar direction
- Wait for the stable Hooks release for production; experiment with personal projects today
