---
title: "ECharts 在中後台系統中的實踐"
date: 2018-04-21 15:51:59
tags:
  - TypeScript
readingTime: 2
description: "數據可視化是中後台系統的常見需求，ECharts 是國內最主流的圖表庫。記錄一下常見場景的實踐經驗。"
---

數據可視化是中後台系統的常見需求，ECharts 是國內最主流的圖表庫。記錄一下常見場景的實踐經驗。

## Vue 中封裝 ECharts 組件

直接在每個頁面寫 ECharts 初始化代碼很重複，封裝成組件：

```vue
<!-- components/EChart/index.vue -->
<template>
  <div ref="chartRef" :style="{ width, height }"></div>
</template>

<script>
import echarts from "echarts";
import { debounce } from "lodash";

export default {
  props: {
    option: {
      type: Object,
      required: true,
    },
    width: {
      type: String,
      default: "100%",
    },
    height: {
      type: String,
      default: "300px",
    },
  },
  data() {
    return { chart: null };
  },
  watch: {
    option: {
      handler(newOption) {
        if (this.chart) {
          this.chart.setOption(newOption, true); // true = 清空後重新渲染
        }
      },
      deep: true,
    },
  },
  mounted() {
    this.initChart();
    this.resizeHandler = debounce(() => {
      this.chart?.resize();
    }, 100);
    window.addEventListener("resize", this.resizeHandler);
  },
  beforeDestroy() {
    window.removeEventListener("resize", this.resizeHandler);
    this.chart?.dispose();
    this.chart = null;
  },
  methods: {
    initChart() {
      this.chart = echarts.init(this.$refs.chartRef);
      this.chart.setOption(this.option);
    },
  },
};
</script>
```

使用：

```vue
<EChart :option="chartOption" height="350px" />
```

## 常見圖表配置

### 折線圖（趨勢）

```javascript
const lineOption = {
  tooltip: { trigger: "axis" },
  legend: { data: ["訪問量", "註冊量"] },
  xAxis: {
    type: "category",
    data: ["1月", "2月", "3月", "4月", "5月", "6月"],
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "訪問量",
      type: "line",
      smooth: true,
      data: [820, 932, 901, 934, 1290, 1330],
      areaStyle: { opacity: 0.3 }, // 面積圖
    },
    {
      name: "註冊量",
      type: "line",
      smooth: true,
      data: [120, 182, 191, 234, 290, 330],
    },
  ],
};
```

### 柱狀圖（對比）

```javascript
const barOption = {
  tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
  grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
  xAxis: {
    type: "value",
    boundaryGap: [0, 0.01],
  },
  yAxis: {
    type: "category",
    data: ["前端", "後端", "運維", "UI設計", "產品", "測試"],
  },
  series: [
    {
      type: "bar",
      data: [18203, 23489, 29034, 104970, 131744, 90040],
      itemStyle: {
        color: "#409eff",
      },
    },
  ],
};
```

### 餅圖（佔比）

```javascript
const pieOption = {
  tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
  legend: { orient: "vertical", left: "left" },
  series: [
    {
      name: "流量來源",
      type: "pie",
      radius: ["40%", "70%"], // 環形圖
      avoidLabelOverlap: false,
      label: { show: false, position: "center" },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: "bold" },
      },
      data: [
        { value: 335, name: "直接訪問" },
        { value: 310, name: "郵件營銷" },
        { value: 234, name: "聯盟廣告" },
        { value: 135, name: "視頻廣告" },
        { value: 1548, name: "搜索引擎" },
      ],
    },
  ],
};
```

## 按需加載 ECharts

ECharts 全量引入約 800KB，按需加載減小體積：

```javascript
// 只引入需要的模塊
import echarts from "echarts/lib/echarts";
import "echarts/lib/chart/line";
import "echarts/lib/chart/bar";
import "echarts/lib/chart/pie";
import "echarts/lib/component/tooltip";
import "echarts/lib/component/legend";
import "echarts/lib/component/grid";
```

## 處理容器大小變化

側邊欄摺疊/展開時，圖表需要 resize：

```javascript
// 監聽 Vuex 裏的側邊欄狀態變化
watch: {
  '$store.state.sidebar.collapsed'() {
    this.$nextTick(() => {
      this.chart?.resize()
    })
  }
}
```

## 圖表的 Loading 狀態

```javascript
methods: {
  async loadChartData() {
    this.chart.showLoading()  // 顯示 loading
    try {
      const data = await fetchChartData()
      this.chart.setOption(this.buildOption(data))
    } finally {
      this.chart.hideLoading()
    }
  }
}
```

## 小結

- 封裝通用 EChart 組件，統一處理 init、resize、dispose
- `beforeDestroy` 裏必須 `dispose()`，否則內存泄漏
- 按需引入減小打包體積
- 側邊欄摺疊時記得 resize
- 用 `chart.showLoading()` 處理數據加載狀態
