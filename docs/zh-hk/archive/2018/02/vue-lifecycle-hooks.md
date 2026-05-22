---
title: "Vue 生命週期鈎子詳解：落地路徑與實戰建議"
date: 2018-02-04 09:32:40
tags:
  - Vue
readingTime: 1
description: "Vue 的生命週期是面試必考題，也是真正理解 Vue 組件運行機製的關鍵。今天結合實際項目場景，把每個鈎子的使用時機説清楚。"
wordCount: 212
---

Vue 的生命週期是面試必考題，也是真正理解 Vue 組件運行機製的關鍵。今天結合實際項目場景，把每個鈎子的使用時機説清楚。

## 生命週期圖

```
beforeCreate → created → beforeMount → mounted
                                          ↓
                                    (數據變化)
                                    beforeUpdate → updated
                                          ↓
                                    (組件銷燬)
                                    beforeDestroy → destroyed
```

## 各鈎子詳解

### beforeCreate

```javascript
export default {
  beforeCreate() {
    // data、methods、computed 都還沒初始化
    // this.message 是 undefined
    // 幾乎用不到，除非用插件（如 vuex）注入全局方法
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
    // data 已經初始化，可以訪問 this.xxx
    // DOM 還沒掛載，不能操作 DOM
    // 最常用：發起初始數據請求
    this.userInfo = await fetchUserInfo();
  },
};
```

### mounted

```javascript
export default {
  mounted() {
    // DOM 已經掛載完成
    // 可以訪問 this.$el、this.$refs
    // 適合：初始化第三方庫（如 echarts、swiper）
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
    // 組件銷燬前清理
    // 不清理會導致內存泄漏
    clearInterval(this.timer);
    window.removeEventListener("resize", this.handleResize);
    if (this.chart) {
      this.chart.dispose();
    }
  },
};
```

## created vs mounted：介面請求放哪裏

這是最常見的困惑。結論：**大部分情況放 created，需要 DOM 尺寸信息的放 mounted**。

```javascript
export default {
  async created() {
    // ✅ 更早發起請求，不需要等 DOM
    this.list = await fetchList();
  },

  async mounted() {
    // ✅ 需要容器寬高時，必須在 mounted
    const { width } = this.$el.getBoundingClientRect();
    this.chart = initChart(this.$refs.el, width);
  },
};
```

## 父子組件生命週期順序

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

**銷燬順序：**

```
父 beforeDestroy
  子 beforeDestroy
  子 destroyed
父 destroyed
```

實際意義：如果父組件在 mounted 裏需要用到子組件的數據，可以放心，子組件此時已經 mounted 完成。

## 小結

- `created`：請求數據（不需要 DOM）
- `mounted`：操作 DOM、初始化第三方庫
- `beforeDestroy`：清理定時器、事件監聽、第三方實例
- 父子順序：父 beforeMount → 子全部完成 → 父 mounted