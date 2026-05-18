---
title: "ECharts 在中后台系统中的实践"
date: 2018-04-21 15:51:59
tags:
  - TypeScript
readingTime: 2
description: "数据可视化是中后台系统的常见需求，ECharts 是国内最主流的图表库。记录一下常见场景的实践经验。"
---

数据可视化是中后台系统的常见需求，ECharts 是国内最主流的图表库。记录一下常见场景的实践经验。

## Vue 中封装 ECharts 组件

直接在每个页面写 ECharts 初始化代码很重复，封装成组件：

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
          this.chart.setOption(newOption, true); // true = 清空后重新渲染
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

## 常见图表配置

### 折线图（趋势）

```javascript
const lineOption = {
  tooltip: { trigger: "axis" },
  legend: { data: ["访问量", "注册量"] },
  xAxis: {
    type: "category",
    data: ["1月", "2月", "3月", "4月", "5月", "6月"],
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "访问量",
      type: "line",
      smooth: true,
      data: [820, 932, 901, 934, 1290, 1330],
      areaStyle: { opacity: 0.3 }, // 面积图
    },
    {
      name: "注册量",
      type: "line",
      smooth: true,
      data: [120, 182, 191, 234, 290, 330],
    },
  ],
};
```

### 柱状图（对比）

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
    data: ["前端", "后端", "运维", "UI设计", "产品", "测试"],
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

### 饼图（占比）

```javascript
const pieOption = {
  tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
  legend: { orient: "vertical", left: "left" },
  series: [
    {
      name: "流量来源",
      type: "pie",
      radius: ["40%", "70%"], // 环形图
      avoidLabelOverlap: false,
      label: { show: false, position: "center" },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: "bold" },
      },
      data: [
        { value: 335, name: "直接访问" },
        { value: 310, name: "邮件营销" },
        { value: 234, name: "联盟广告" },
        { value: 135, name: "视频广告" },
        { value: 1548, name: "搜索引擎" },
      ],
    },
  ],
};
```

## 按需加载 ECharts

ECharts 全量引入约 800KB，按需加载减小体积：

```javascript
// 只引入需要的模块
import echarts from "echarts/lib/echarts";
import "echarts/lib/chart/line";
import "echarts/lib/chart/bar";
import "echarts/lib/chart/pie";
import "echarts/lib/component/tooltip";
import "echarts/lib/component/legend";
import "echarts/lib/component/grid";
```

## 处理容器大小变化

侧边栏折叠/展开时，图表需要 resize：

```javascript
// 监听 Vuex 里的侧边栏状态变化
watch: {
  '$store.state.sidebar.collapsed'() {
    this.$nextTick(() => {
      this.chart?.resize()
    })
  }
}
```

## 图表的 Loading 状态

```javascript
methods: {
  async loadChartData() {
    this.chart.showLoading()  // 显示 loading
    try {
      const data = await fetchChartData()
      this.chart.setOption(this.buildOption(data))
    } finally {
      this.chart.hideLoading()
    }
  }
}
```

## 小结

- 封装通用 EChart 组件，统一处理 init、resize、dispose
- `beforeDestroy` 里必须 `dispose()`，否则内存泄漏
- 按需引入减小打包体积
- 侧边栏折叠时记得 resize
- 用 `chart.showLoading()` 处理数据加载状态
