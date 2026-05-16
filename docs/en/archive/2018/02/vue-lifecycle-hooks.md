---
title: "Vue Lifecycle Hooks In Depth"
date: 2018-02-04 09:32:40
tags:
  - Vue
readingTime: 1
description: "Vue's lifecycle is a common interview topic and the key to truly understanding how Vue components work. Here's a clear breakdown of when to use each hook, groun"
---

Vue's lifecycle is a common interview topic and the key to truly understanding how Vue components work. Here's a clear breakdown of when to use each hook, grounded in real project scenarios.

## Lifecycle Diagram

```
beforeCreate → created → beforeMount → mounted
                                          ↓
                                    (data changes)
                                    beforeUpdate → updated
                                          ↓
                                    (component destroyed)
                                    beforeDestroy → destroyed
```

## Each Hook Explained

### beforeCreate

```javascript
export default {
  beforeCreate() {
    // data, methods, computed are not yet initialized
    // this.message is undefined
    // Rarely used, except when plugins (e.g. Vuex) inject global methods
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
    // data is initialized, this.xxx is accessible
    // DOM is not mounted yet — don't access the DOM here
    // Most common use: fire initial data requests
    this.userInfo = await fetchUserInfo();
  },
};
```

### mounted

```javascript
export default {
  mounted() {
    // DOM is fully mounted
    // this.$el and this.$refs are accessible
    // Good for: initializing third-party libraries (echarts, swiper, etc.)
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
    // Clean up before the component is destroyed
    // Not cleaning up causes memory leaks
    clearInterval(this.timer);
    window.removeEventListener("resize", this.handleResize);
    if (this.chart) {
      this.chart.dispose();
    }
  },
};
```

## created vs mounted: Where to Put API Calls

This is the most common question. **In most cases put it in created; put it in mounted only when you need DOM dimensions.**

```javascript
export default {
  async created() {
    // ✅ Fires earlier, doesn't wait for the DOM
    this.list = await fetchList();
  },

  async mounted() {
    // ✅ Must be in mounted when you need the container's size
    const { width } = this.$el.getBoundingClientRect();
    this.chart = initChart(this.$refs.el, width);
  },
};
```

## Parent-Child Lifecycle Order

```
parent beforeCreate
parent created
parent beforeMount
  child beforeCreate
  child created
  child beforeMount
  child mounted
parent mounted
```

**Destroy order:**

```
parent beforeDestroy
  child beforeDestroy
  child destroyed
parent destroyed
```

Practical implication: if a parent component needs child component data in `mounted`, the child has already finished mounting by then.

## Summary

- `created`: fetch data (no DOM needed)
- `mounted`: manipulate DOM, initialize third-party libraries
- `beforeDestroy`: clean up timers, event listeners, third-party instances
- Parent-child order: parent beforeMount → all children complete → parent mounted
