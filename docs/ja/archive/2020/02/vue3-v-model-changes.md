---
title: "Vue 3 の v-model 双方向バインディング改善"
date: 2020-02-04 15:38:30
tags:
  - Vue
readingTime: 3
description: "Vue 3 では v-model が大幅に簡素化されました：.sync 修飾子が削除され、modelValue + update:modelValue の標準パターンに統一されました。同時に複数の v-model バインディングをサポートし、Vue 2 におけるコンポーネントの双方向バインディングの多くの問題点を解決しています。"
wordCount: 514
---

Vue 3 は `v-model` を大幅に簡素化しました：`.sync` 修飾子を削除し、`modelValue` + `update:modelValue` の標準パターンに統一しました。同時に複数の `v-model` バインディングをサポートし、Vue 2 におけるコンポーネントの双方向バインディングの多くの問題点を解決しています。

## Vue 2とVue 3の違い

Vue 2 では、子コンポーネントで双方向バインディングを実現するには、`value` prop と `$emit('input')` を使用する必要がありました。さらに `.sync` で他の属性を同期する必要がある場合は、また別のルールが適用されていました。

```vue
<!-- Vue 2 の書き方 -->
<template>
  <!-- 子コンポーネントは value を受け取り、input イベントで更新 -->
  <input :value="value" @input="$emit('input', $event.target.value)" />
</template>

<script>
export default {
  props: ['value'] // 固定で value を使用
}
</script>

<!-- 親コンポーネント -->
<!-- v-model は value + input にバインド -->
<MyInput v-model="name" />
<!-- .sync で他の属性をバインド -->
<MyInput :title.sync="title" />
```

Vue 3 ではルールが統一されました。

```vue
<!-- Vue 3 の書き方 -->
<template>
  <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
</template>

<script>
export default {
  props: ['modelValue'] // 固定で modelValue を使用
}
</script>

<!-- 親コンポーネント -->
<MyInput v-model="name" />
```

## 複数のv-modelバインディング

Vue 3 は `v-model` にパラメータを指定して、1つのコンポーネントで複数の双方向バインディングを実現できます。

```vue
{% raw %}
<!-- 子コンポーネント UserForm.vue -->
<template>
  <div>
    <div class="field">
      <label>ユーザー名</label>
      <input
        :value="username"
        @input="$emit('update:username', $event.target.value)"
      />
    </div>
    <div class="field">
      <label>メールアドレス</label>
      <input
        :value="email"
        @input="$emit('update:email', $event.target.value)"
      />
    </div>
    <div class="field">
      <label>備考</label>
      <textarea
        :value="note"
        @input="$emit('update:note', $event.target.value)"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    username: String,
    email: String,
    note: String
  },
  emits: ['update:username', 'update:email', 'update:note']
}
</script>

<!-- 親コンポーネントでの使用 -->
<template>
  <UserForm
    v-model:username="form.username"
    v-model:email="form.email"
    v-model:note="form.note"
  />
  <pre>{{ form }}</pre>
</template>

<script>
import { reactive } from 'vue'

export default {
  setup() {
    const form = reactive({
      username: '',
      email: '',
      note: ''
    })
    return { form }
  }
}
</script>
{% endraw %}
```

## カスタム v-model 修飾子

Vue 3 では、カスタムコンポーネントの `v-model` に修飾子を渡すことができます。

```vue
{% raw %}
<!-- 子コンポーネント SearchInput.vue -->
<template>
  <input
    :value="modelValue"
    @input="handleInput"
  />
</template>

<script>
export default {
  props: {
    modelValue: String,
    modelModifiers: {
      default: () => ({})
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const handleInput = (e) => {
      let value = e.target.value
      // .trim 修飾子を使用する場合
      if (props.modelModifiers.trim) {
        value = value.trim()
      }
      // .uppercase 修飾子を使用する場合
      if (props.modelModifiers.uppercase) {
        value = value.toUpperCase()
      }
      emit('update:modelValue', value)
    }
    return { handleInput }
  }
}
</script>

<!-- 親コンポーネントでの使用 -->
<template>
  <SearchInput v-model.trim.uppercase="keyword" />
  <p>現在の値: {{ keyword }}</p>
</template>
{% endraw %}
```

## v-model を使ったフォームコンポーネントのカプセル化

実際のプロジェクトで最も一般的なシナリオ：Select、DatePicker などのフォームコンポーネントのカプセル化です。

```vue
{% raw %}
<!-- BaseSelect.vue -->
<template>
  <div class="base-select" ref="selectRef">
    <div class="select-trigger" @click="toggle">
      <span>{{ selectedLabel || placeholder }}</span>
      <i class="arrow-down" />
    </div>
    <div v-show="visible" class="select-dropdown">
      <div
        v-for="option in options"
        :key="option.value"
        class="select-option"
        :class="{ active: option.value === modelValue }"
        @click="select(option)"
      >
        {{ option.label }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue'

export default {
  name: 'BaseSelect',
  props: {
    modelValue: [String, Number],
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: '選択してください' }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const visible = ref(false)
    const toggle = () => { visible.value = !visible.value }

    const selectedLabel = computed(() => {
      const found = props.options.find(o => o.value === props.modelValue)
      return found ? found.label : ''
    })

    const select = (option) => {
      emit('update:modelValue', option.value)
      emit('change', option.value)
      visible.value = false
    }

    return { visible, toggle, selectedLabel, select }
  }
}
</script>

<!-- 使用例 -->
<!-- <BaseSelect v-model="city" :options="cityOptions" /> -->
{% endraw %}
```

## まとめ

- Vue 3 では `modelValue` + `update:modelValue` に統一され、Vue 2 の `value` + `input` を置き換えました
- `.sync` 修飾子は削除され、`v-model:propName` でより直感的に複数属性の双方向バインディングを実現できます
- カスタム修飾子は `modelModifiers` prop で受け取り、柔軟に動作を拡張できます
- フォームコンポーネントをカプセル化する際は、常に props 宣言 + emits 宣言の規則に従ってください
