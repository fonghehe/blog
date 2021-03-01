---
title: "Vue 3 Composition API RFC 解读"
date: 2019-05-10 16:14:05
tags:
  - Vue
---

Vue 团队发布了 Composition API RFC，社区炸了——支持的说好，反对的说像 React Hooks。我仔细读了 RFC，说说我的理解。

## 为什么需要 Composition API

Options API 的问题在大型组件里很明显：

```javascript
// 一个 500 行的 Vue 2 组件
export default {
  data() {
    // 用户相关：name, age, userLoading
    // 搜索相关：query, results, searchLoading
    // 分页相关：page, total, pageSize
  },
  methods: {
    // 用户方法、搜索方法、分页方法混在一起
  },
  computed: {
    // 各种计算属性混在一起
  },
  watch: {
    // 各种 watch 混在一起
  },
};
// 相关逻辑分散在不同选项里，难以维护
```

Composition API 让相关逻辑聚合在一起。

## Composition API 基础

```javascript
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";

export default {
  setup(props, { emit, attrs, slots }) {
    // ref：基本类型的响应式
    const count = ref(0);
    console.log(count.value); // 读取用 .value

    // reactive：对象的响应式
    const user = reactive({
      name: "Alice",
      loading: false,
    });

    // computed
    const doubled = computed(() => count.value * 2);

    // watch
    watch(count, (newVal, oldVal) => {
      console.log(`${oldVal} → ${newVal}`);
    });

    // 生命周期
    onMounted(() => {
      console.log("挂载了");
    });

    onUnmounted(() => {
      console.log("卸载了");
    });

    // 暴露给模板
    return { count, user, doubled };
  },
};
```

## 逻辑复用（Composables）

这是 Composition API 最重要的价值：

```javascript
// composables/useUserSearch.js
import { ref, watch } from "vue";
import { debounce } from "lodash-es";

export function useUserSearch() {
  const query = ref("");
  const results = ref([]);
  const loading = ref(false);

  const search = debounce(async (q) => {
    if (!q) {
      results.value = [];
      return;
    }
    loading.value = true;
    try {
      results.value = await api.searchUsers(q);
    } finally {
      loading.value = false;
    }
  }, 300);

  watch(query, search);

  return { query, results, loading };
}

// composables/usePagination.js
export function usePagination(fetchFn) {
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const data = ref([]);

  async function load() {
    const res = await fetchFn({ page: page.value, pageSize: pageSize.value });
    data.value = res.data;
    total.value = res.total;
  }

  watch([page, pageSize], load);

  return { page, pageSize, total, data, load };
}
```

```javascript
// 组件中使用
export default {
  setup() {
    // 逻辑清晰地组织在一起
    const { query, results, loading: searchLoading } = useUserSearch();
    const { page, total, data: users, load } = usePagination(api.getUsers);

    onMounted(load);

    return { query, results, searchLoading, page, total, users };
  },
};
```

## 对比 Mixin

```javascript
// Mixin 的问题：命名冲突、来源不清
export default {
  mixins: [userMixin, searchMixin, paginationMixin],
  // this.loading 来自哪个 mixin？
  // 如果两个 mixin 都有 loading，怎么办？
};

// Composables 明确来源
const { loading: userLoading } = useUser();
const { loading: searchLoading } = useSearch();
```

## 我的看法

反对声音说"太像 React Hooks 了"，我觉得这不是问题。好的思路就该借鉴。

不同之处：

- Vue Composition API 不需要 dependency array（Proxy 追踪）
- 没有 "Hook 规则"（不是 Hooks 机制，只是普通函数）
- 和 Options API 可以混用（不强制迁移）

RFC 最后大概率会采纳，准备学起来。

## 小结

- Composition API 让逻辑按功能组织，解决大型组件的维护问题
- Composables 替代 Mixin，来源清晰，无命名冲突
- 和 Options API 兼容，不强制迁移
- Vue 3 正式版还要等，但可以用 `@vue/composition-api` 插件在 Vue 2 上试用
