---
title: "Vue 生命周期钩子详解"
date: 2018-02-04 09:32:40
tags:
  - Vue
readingTime: 1
description: "Vue 的生命周期是面试必考题，也是真正理解 Vue 组件运行机制的关键。今天结合实际项目场景，把每个钩子的使用时机说清楚。"
---

Vue 的生命周期是面试必考题，也是真正理解 Vue 组件运行机制的关键。今天结合实际项目场景，把每个钩子的使用时机说清楚。

## 生命周期图

```
beforeCreate → created → beforeMount → mounted
                                          ↓
                                    (数据变化)
                                    beforeUpdate → updated
                                          ↓
                                    (组件销毁)
                                    beforeDestroy → destroyed
```

## 各钩子详解

### beforeCreate

```javascript
export default {
  beforeCreate() {
    // data、methods、computed 都还没初始化
    // this.message 是 undefined
    // 几乎用不到，除非用插件（如 vuex）注入全局方法
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
    // data 已经初始化，可以访问 this.xxx
    // DOM 还没挂载，不能操作 DOM
    // 最常用：发起初始数据请求
    this.userInfo = await fetchUserInfo();
  },
};
```

### mounted

```javascript
export default {
  mounted() {
    // DOM 已经挂载完成
    // 可以访问 this.$el、this.$refs
    // 适合：初始化第三方库（如 echarts、swiper）
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
    // 组件销毁前清理
    // 不清理会导致内存泄漏
    clearInterval(this.timer);
    window.removeEventListener("resize", this.handleResize);
    if (this.chart) {
      this.chart.dispose();
    }
  },
};
```

## created vs mounted：接口请求放哪里

这是最常见的困惑。结论：**大部分情况放 created，需要 DOM 尺寸信息的放 mounted**。

```javascript
export default {
  async created() {
    // ✅ 更早发起请求，不需要等 DOM
    this.list = await fetchList();
  },

  async mounted() {
    // ✅ 需要容器宽高时，必须在 mounted
    const { width } = this.$el.getBoundingClientRect();
    this.chart = initChart(this.$refs.el, width);
  },
};
```

## 父子组件生命周期顺序

```
父 beforeCreate
父 created
父 beforeMount
  子 beforeCreate
  子 created
  子 beforeMount
  子 mounted
父 mounted
```

**销毁顺序：**

```
父 beforeDestroy
  子 beforeDestroy
  子 destroyed
父 destroyed
```

实际意义：如果父组件在 mounted 里需要用到子组件的数据，可以放心，子组件此时已经 mounted 完成。

## 小结

- `created`：请求数据（不需要 DOM）
- `mounted`：操作 DOM、初始化第三方库
- `beforeDestroy`：清理定时器、事件监听、第三方实例
- 父子顺序：父 beforeMount → 子全部完成 → 父 mounted