---
title: "ECharts in Admin Dashboard Systems: Practical Experience"
date: 2018-04-21 15:51:59
tags:
  - TypeScript
readingTime: 2
description: "Data visualization is a common requirement in admin systems. ECharts is the most widely used charting library in the Chinese ecosystem. Here are some practical "
---

Data visualization is a common requirement in admin systems. ECharts is the most widely used charting library in the Chinese ecosystem. Here are some practical tips from real-world experience.

## Wrapping ECharts as a Vue Component

Writing ECharts initialization code on every page is repetitive. Wrap it into a component:

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
          this.chart.setOption(newOption, true); // true = clear and re-render
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

Usage:

```vue
<EChart :option="chartOption" height="350px" />
```

## Common Chart Configurations

### Line Chart (Trends)

```javascript
const lineOption = {
  tooltip: { trigger: "axis" },
  legend: { data: ["Page Views", "Registrations"] },
  xAxis: {
    type: "category",
    data: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "Page Views",
      type: "line",
      smooth: true,
      data: [820, 932, 901, 934, 1290, 1330],
      areaStyle: { opacity: 0.3 }, // area chart
    },
    {
      name: "Registrations",
      type: "line",
      smooth: true,
      data: [120, 182, 191, 234, 290, 330],
    },
  ],
};
```

### Bar Chart (Comparisons)

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
    data: ["Frontend", "Backend", "DevOps", "UI Design", "Product", "QA"],
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

### Pie Chart (Proportions)

```javascript
const pieOption = {
  tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
  legend: { orient: "vertical", left: "left" },
  series: [
    {
      name: "Traffic Source",
      type: "pie",
      radius: ["40%", "70%"], // donut chart
      avoidLabelOverlap: false,
      label: { show: false, position: "center" },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: "bold" },
      },
      data: [
        { value: 335, name: "Direct" },
        { value: 310, name: "Email Marketing" },
        { value: 234, name: "Affiliate Ads" },
        { value: 135, name: "Video Ads" },
        { value: 1548, name: "Search Engine" },
      ],
    },
  ],
};
```

## On-Demand Loading of ECharts

The full ECharts bundle is ~800KB. On-demand loading reduces the size:

```javascript
// Only import what you need
import echarts from "echarts/lib/echarts";
import "echarts/lib/chart/line";
import "echarts/lib/chart/bar";
import "echarts/lib/chart/pie";
import "echarts/lib/component/tooltip";
import "echarts/lib/component/legend";
import "echarts/lib/component/grid";
```

## Handling Container Size Changes

When the sidebar collapses or expands, charts need to resize:

```javascript
// Watch the sidebar state in Vuex
watch: {
  '$store.state.sidebar.collapsed'() {
    this.$nextTick(() => {
      this.chart?.resize()
    })
  }
}
```

## Chart Loading State

```javascript
methods: {
  async loadChartData() {
    this.chart.showLoading()  // show loading indicator
    try {
      const data = await fetchChartData()
      this.chart.setOption(this.buildOption(data))
    } finally {
      this.chart.hideLoading()
    }
  }
}
```

## Summary

- Wrap a common EChart component to handle init, resize, and dispose uniformly
- Always call `dispose()` in `beforeDestroy` to prevent memory leaks
- Use on-demand imports to reduce bundle size
- Remember to `resize()` when the sidebar collapses
- Use `chart.showLoading()` to handle the data loading state
