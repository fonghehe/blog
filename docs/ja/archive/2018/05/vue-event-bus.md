---
title: "Vueイベントバス：コンポーネント間通信"
date: 2018-05-19 10:45:27
tags:
  - Vue
readingTime: 2
description: "Vueのコンポーネント通信には親子通信（props/emit）とVuex（グローバル状態）という2つの主要な方法に加えて、軽量な方法としてイベントバス（Event Bus）があります。兄弟コンポーネント間や階層をまたいだシンプルな通信に適しています。"
wordCount: 313
---

Vueのコンポーネント通信には親子通信（props/emit）とVuex（グローバル状態）という2つの主要な方法に加えて、軽量な方法としてイベントバス（Event Bus）があります。兄弟コンポーネント間や階層をまたいだシンプルな通信に適しています。

## イベントバスの作成

```javascript
// src/utils/eventBus.js
import Vue from "vue";
export const EventBus = new Vue();
```

またはVueのプロトタイプに付ける方法もあります：

```javascript
// main.js
import Vue from "vue";
Vue.prototype.$bus = new Vue();
```

## 基本的な使い方

```javascript
// コンポーネントA：イベントを送信
import { EventBus } from '@/utils/eventBus'

export default {
  methods: {
    handleLogin(user) {
      EventBus.$emit('user:login', user)
    }
  }
}

// コンポーネントB：イベントを監視
import { EventBus } from '@/utils/eventBus'

export default {
  created() {
    EventBus.$on('user:login', this.handleUserLogin)
  },
  beforeDestroy() {
    // ⚠️ 破棄前に必ずリスナーを解除！解除しないとメモリリーク
    EventBus.$off('user:login', this.handleUserLogin)
  },
  methods: {
    handleUserLogin(user) {
      console.log('ユーザーがログインしました：', user.name)
    }
  }
}
```

## Vue.prototype.$busを使う場合

```javascript
// コンポーネントA
this.$bus.$emit("refresh-list");

// コンポーネントB
export default {
  created() {
    this.$bus.$on("refresh-list", this.loadList);
  },
  beforeDestroy() {
    this.$bus.$off("refresh-list", this.loadList);
  },
};
```

## 注意事項

**必ずbeforeDestroyで$offを呼ぶこと：**

```javascript
// ❌ $onのみで$offなし：コンポーネント破棄後もリスナーが残る
// そのコンポーネントに再入すると2つ目のリスナーが登録され、2回発火する
// 何度も行き来すると何度も発火し、メモリリークにもなる

// ✅ セットで使う
created() {
  this.$bus.$on('event', this.handler)
},
beforeDestroy() {
  this.$bus.$off('event', this.handler)
  // 注意：関数の参照を渡す必要がある。無名関数は使えない
  // 下記は$offが効かない：
  // this.$bus.$off('event', () => this.handler()) ← 同じ関数ではない
}
```

## イベントバスとVuexの選択

```
イベントバスが適している場合：
  - 2〜3コンポーネント間のシンプルな通信
  - 永続化不要の1回限りの通知
  - 素早いプロトタイプ開発

Vuexが適している場合：
  - 複数コンポーネントで共有する状態
  - タイムトラベルデバッグが必要
  - 状態の永続化が必要
  - チーム開発で明確なデータフローが必要
```

イベントバスを通るイベントがどんどん増えていくなら、Vuexへの移行を検討する時期です。

## まとめ

- イベントバスは本質的に空のVueインスタンスで、イベントのパブリッシュ/サブスクライブに使用
- `$emit`で送信、`$on`で監視、`$off`で解除
- コンポーネント破棄時は必ず`$off`を呼ぶ。呼ばないとメモリリーク
- シンプルなコンポーネント間通信に適している。複雑なケースはVuexを使用
