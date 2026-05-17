---
title: "Vue 3 Composition API RFC解読"
date: 2019-05-10 16:14:05
tags:
  - Vue
readingTime: 1
description: "Vueチームが Composition API RFCを公開し、コミュニティが沸きました——支持者は「素晴らしい」と言い、反対者は「React Hooksみたい」と言います。RFCを丁寧に読んだ私の理解を共有します。"
---

Vueチームが Composition API RFCを公開し、コミュニティが沸きました——支持者は「素晴らしい」と言い、反対者は「React Hooksみたい」と言います。RFCを丁寧に読んだ私の理解を共有します。

## なぜComposition APIが必要か

Options APIの問題は大型コンポーネントで明らかになります：

```javascript
// 500行のVue 2コンポーネント
export default {
  data() {
    // ユーザー関連：name, age, userLoading
    // 検索関連：query, results, searchLoading
    // ページネーション関連：page, total, pageSize
  },
  methods: {
    // ユーザーメソッド、検索メソッド、ページネーションメソッドが混在
  },
  computed: {
    // すべての算出プロパティが混在
  },
  watch: {
    // すべてのウォッチャーが混在
  },
};
// 関連ロジックが異なるオプションに散らばり、保守が困難
```

Composition APIにより、関連ロジックをまとめることができます。

## Composition APIの基礎

```javascript
import { ref, reactive, computed, watch, onMounted, onUnmounted } from "vue";

export default {
  setup(props, { emit, attrs, slots }) {
    // ref：基本型のリアクティブ
    const count = ref(0);
    console.log(count.value); // .valueでアクセス

    // reactive：オブジェクトのリアクティブ
    const user = reactive({
      name: "アリス",
      loading: false,
    });

    // computed
    const doubled = computed(() => count.value * 2);

    // watch
    watch(count, (newVal, oldVal) => {
      console.log(`${oldVal} → ${newVal}`);
    });

    // ライフサイクルフック
    onMounted(() => {
      console.log("マウントされました");
    });

    onUnmounted(() => {
      console.log("アンマウントされました");
    });

    // テンプレートに公開
    return { count, user, doubled };
  },
};
```

## Composablesによるロジックの再利用

これがComposition APIの最も重要な価値です：

```javascript
// useMousePosition.js
import { ref, onMounted, onUnmounted } from "vue";

export function useMousePosition() {
  const x = ref(0);
  const y = ref(0);

  function update(event) {
    x.value = event.pageX;
    y.value = event.pageY;
  }

  onMounted(() => window.addEventListener("mousemove", update));
  onUnmounted(() => window.removeEventListener("mousemove", update));

  return { x, y };
}

// 任意のコンポーネントで使用
export default {
  setup() {
    const { x, y } = useMousePosition();
    return { x, y };
  },
};
```

Mixinと比べて、Composablesは明示的なデータフローを持ちます——`x`と`y`がどこから来るかが明確に分かります。これがVueコミュニティが最終的にComposition APIを受け入れた理由です。
