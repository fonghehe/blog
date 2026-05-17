---
title: "Vue ライフサイクルフック詳解"
date: 2018-02-04 09:32:40
tags:
  - Vue
readingTime: 2
description: "Vue のライフサイクルはよく出る面接の質問であり、Vue コンポーネントの動作メカニズムを本当に理解するための鍵です。実際のプロジェクトシナリオに基づいて、各フックの使いどころを明確にします。"
---

Vue のライフサイクルはよく出る面接の質問であり、Vue コンポーネントの動作メカニズムを本当に理解するための鍵です。実際のプロジェクトシナリオに基づいて、各フックの使いどころを明確にします。

## ライフサイクル図

```
beforeCreate → created → beforeMount → mounted
                                          ↓
                                    （データ変更）
                                    beforeUpdate → updated
                                          ↓
                                    （コンポーネント破棄）
                                    beforeDestroy → destroyed
```

## 各フックの解説

### beforeCreate

```javascript
export default {
  beforeCreate() {
    // data、methods、computed はまだ初期化されていない
    // this.message は undefined
    // ほとんど使わない（プラグイン（例：Vuex）がグローバルメソッドを注入する場合を除く）
    console.log(this.$data); // undefined
  },
};
```

### created

```javascript
export default {
  data() {
    return { userInfo: null };
  },
  async created() {
    // data は初期化済み、this.xxx にアクセス可能
    // DOM はまだマウントされていない — ここで DOM を操作しない
    // 最もよく使う：初期データのリクエストを発行する
    this.userInfo = await fetchUserInfo();
  },
};
```

### mounted

```javascript
export default {
  mounted() {
    // DOM のマウントが完了している
    // this.$el と this.$refs にアクセス可能
    // 適した用途：サードパーティライブラリの初期化（echarts、swiper など）
    this.chart = echarts.init(this.$refs.chartEl);
    this.chart.setOption(this.chartOptions);
  },
};
```

### beforeDestroy

```javascript
export default {
  mounted() {
    this.timer = setInterval(this.fetchLatestData, 5000);
    window.addEventListener("resize", this.handleResize);
  },
  beforeDestroy() {
    // コンポーネントが破棄される前にクリーンアップ
    // クリーンアップしないとメモリリークになる
    clearInterval(this.timer);
    window.removeEventListener("resize", this.handleResize);
    if (this.chart) {
      this.chart.dispose();
    }
  },
};
```

## created vs mounted：API リクエストをどちらに置くか

これが最も多い疑問です。**ほとんどの場合は created に置き、DOM のサイズ情報が必要な場合のみ mounted に置く。**

```javascript
export default {
  async created() {
    // ✅ より早く発火し、DOM を待たない
    this.list = await fetchList();
  },

  async mounted() {
    // ✅ コンテナのサイズが必要な場合は mounted が必須
    const { width } = this.$el.getBoundingClientRect();
    this.chart = initChart(this.$refs.el, width);
  },
};
```

## 親子コンポーネントのライフサイクル順序

```
親 beforeCreate
親 created
親 beforeMount
  子 beforeCreate
  子 created
  子 beforeMount
  子 mounted
親 mounted
```

**破棄順序：**

```
親 beforeDestroy
  子 beforeDestroy
  子 destroyed
親 destroyed
```

実際の意味：親コンポーネントが `mounted` で子コンポーネントのデータを使う必要がある場合、子コンポーネントはその時点ですでにマウント完了しています。

## まとめ

- `created`：データの取得（DOM 不要）
- `mounted`：DOM の操作、サードパーティライブラリの初期化
- `beforeDestroy`：タイマー、イベントリスナー、サードパーティインスタンスのクリーンアップ
- 親子の順序：親 beforeMount → すべての子が完了 → 親 mounted
