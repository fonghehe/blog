---
title: "管理画面システムにおける ECharts 実践"
date: 2018-04-21 15:51:59
tags:
  - TypeScript
readingTime: 2
description: "データビジュアライゼーションは管理画面システムの定番要件です。ECharts は最も広く使われているチャートライブラリです。実際のプロジェクト経験から得た知見をまとめます。"
---

データビジュアライゼーションは管理画面システムの定番要件です。ECharts は最も広く使われているチャートライブラリです。実際のプロジェクト経験から得た知見をまとめます。

## Vue での ECharts コンポーネント化

各ページで ECharts の初期化コードを書くのは繰り返しが多いため、コンポーネントとしてラップします：

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
          this.chart.setOption(newOption, true); // true = クリアして再レンダリング
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

## よく使うチャート設定

### 折れ線グラフ（トレンド）

```javascript
const lineOption = {
  tooltip: { trigger: "axis" },
  legend: { data: ["ページビュー", "登録数"] },
  xAxis: {
    type: "category",
    data: ["1月", "2月", "3月", "4月", "5月", "6月"],
  },
  yAxis: { type: "value" },
  series: [
    {
      name: "ページビュー",
      type: "line",
      smooth: true,
      data: [820, 932, 901, 934, 1290, 1330],
      areaStyle: { opacity: 0.3 }, // 面グラフ
    },
    {
      name: "登録数",
      type: "line",
      smooth: true,
      data: [120, 182, 191, 234, 290, 330],
    },
  ],
};
```

### 棒グラフ（比較）

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
    data: [
      "フロントエンド",
      "バックエンド",
      "インフラ",
      "UIデザイン",
      "プロダクト",
      "QA",
    ],
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

### 円グラフ（割合）

```javascript
const pieOption = {
  tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
  legend: { orient: "vertical", left: "left" },
  series: [
    {
      name: "流入元",
      type: "pie",
      radius: ["40%", "70%"], // ドーナツグラフ
      avoidLabelOverlap: false,
      label: { show: false, position: "center" },
      emphasis: {
        label: { show: true, fontSize: 16, fontWeight: "bold" },
      },
      data: [
        { value: 335, name: "ダイレクト" },
        { value: 310, name: "メール" },
        { value: 234, name: "アフィリエイト" },
        { value: 135, name: "動画広告" },
        { value: 1548, name: "検索エンジン" },
      ],
    },
  ],
};
```

## ECharts のオンデマンド読み込み

ECharts の全量インポートは約 800KB です。オンデマンド読み込みでサイズを削減できます：

```javascript
// 必要なモジュールだけインポート
import echarts from "echarts/lib/echarts";
import "echarts/lib/chart/line";
import "echarts/lib/chart/bar";
import "echarts/lib/chart/pie";
import "echarts/lib/component/tooltip";
import "echarts/lib/component/legend";
import "echarts/lib/component/grid";
```

## コンテナサイズ変更への対応

サイドバーの折りたたみ・展開時にチャートの resize が必要です：

```javascript
// Vuex のサイドバー状態変化を監視
watch: {
  '$store.state.sidebar.collapsed'() {
    this.$nextTick(() => {
      this.chart?.resize()
    })
  }
}
```

## チャートのローディング状態

```javascript
methods: {
  async loadChartData() {
    this.chart.showLoading()  // ローディング表示
    try {
      const data = await fetchChartData()
      this.chart.setOption(this.buildOption(data))
    } finally {
      this.chart.hideLoading()
    }
  }
}
```

## まとめ

- 共通 EChart コンポーネントをラップして init・resize・dispose を一元管理する
- `beforeDestroy` で必ず `dispose()` を呼びメモリリークを防ぐ
- オンデマンドインポートでバンドルサイズを削減する
- サイドバー折りたたみ時に `resize()` を忘れずに
- `chart.showLoading()` でデータ読み込み状態を管理する
