---
title: "AI 辅助架构决策工具"
date: 2026-01-08 10:00:00
tags:
  - 工程化
---

技术选型和架构决策是高级工程师的核心工作，也是最难用 AI 替代的部分。但 AI 可以成为极强的决策辅助工具——帮你分析 trade-off、模拟不同方案的性能表现、甚至发现你遗漏的约束条件。

## 用 AI 做技术选型对比分析

选型不再是拍脑袋或看 GitHub star 数。现在的做法是让 AI 基于你的项目约束做结构化分析，给出带权重评分的推荐。

```typescript
// tech-selection.ts —— AI 辅助技术选型框架
interface SelectionCriteria {
  factor: string;
  weight: number; // 1-10
  description: string;
}

interface TechOption {
  name: string;
  scores: Record<string, number>; // factor -> score (1-10)
}

// 定义你的项目约束
const criteria: SelectionCriteria[] = [
  { factor: 'performance', weight: 9, description: '首屏加载 < 2s，交互响应 < 100ms' },
  { factor: 'dx', weight: 7, description: '开发体验，类型安全，HMR 速度' },
  { factor: 'ecosystem', weight: 8, description: '社区活跃度、第三方库质量' },
  { factor: 'team-familiarity', weight: 6, description: '团队现有技术栈匹配度' },
  { factor: 'hiring', weight: 5, description: '人才市场供给' },
  { factor: 'ai-tooling', weight: 8, description: 'AI 工具支持程度' },
];

// AI 根据约束评估各方案
function calculateWeightedScore(option: TechOption, criteria: SelectionCriteria[]) {
  const totalWeight = criteria.reduce((sum, c) => sum + c.weight, 0);
  return criteria.reduce((score, c) => {
    return score + (option.scores[c.factor] * c.weight) / totalWeight;
  }, 0);
}
```

## 架构影响分析：拆分还是聚合？

"该不该拆微前端"、"该不该上 Monorepo"这类问题没有标准答案。AI 的价值是帮你量化分析不同决策的长期影响。

```typescript
// architecture-analysis.ts
interface ModuleAnalysis {
  path: string;
  linesOfCode: number;
  changeFrequency: number;      // 每月平均变更次数
  dependencyCount: number;      // 被多少模块依赖
  couplingScore: number;        // 0-1，耦合度
  teamOwner: string;
}

// AI 分析代码库后输出的模块关系图
const moduleGraph: ModuleAnalysis[] = [
  { path: 'src/features/auth', linesOfCode: 3200, changeFrequency: 4.2, dependencyCount: 23, couplingScore: 0.82, teamOwner: 'platform' },
  { path: 'src/features/checkout', linesOfCode: 8500, changeFrequency: 12.1, dependencyCount: 8, couplingScore: 0.35, teamOwner: 'commerce' },
  { path: 'src/features/catalog', linesOfCode: 6100, changeFrequency: 8.7, dependencyCount: 15, couplingScore: 0.61, teamOwner: 'catalog' },
  { path: 'src/shared/ui', linesOfCode: 4200, changeFrequency: 2.1, dependencyCount: 45, couplingScore: 0.12, teamOwner: 'platform' },
];

// AI 的拆分建议逻辑
function shouldExtractModule(mod: ModuleAnalysis): boolean {
  // 高变更频率 + 低耦合 = 适合独立
  // 高耦合 + 多依赖 = 拆分成本高，不建议
  const independenceScore = (1 - mod.couplingScore) * mod.changeFrequency;
  return independenceScore > 5;
}
```

## 性能预算决策支持

AI 可以基于你的用户画像和流量数据，帮你制定合理的性能预算，而不是拍一个"LCP < 2.5s"了事。

```typescript
// performance-budget-ai.ts
interface UserSegment {
  name: string;
  percentage: number;
  device: 'high-end' | 'mid-range' | 'low-end';
  network: '4g' | '3g' | 'slow-3g';
  region: string;
}

const userSegments: UserSegment[] = [
  { name: '一线城市iOS', percentage: 35, device: 'high-end', network: '4g', region: 'cn-east' },
  { name: '二线城市Android', percentage: 28, device: 'mid-range', network: '4g', region: 'cn-central' },
  { name: '下沉市场', percentage: 22, device: 'low-end', network: '3g', region: 'cn-west' },
  { name: '海外用户', percentage: 15, device: 'mid-range', network: '4g', region: 'sea' },
];

// AI 基于用户分群推荐的性能预算
interface PerformanceBudget {
  metric: string;
  p50: number;
  p75: number;
  p95: number;
  unit: string;
}

const aiRecommendedBudget: PerformanceBudget[] = [
  { metric: 'FCP', p50: 1200, p75: 1800, p95: 3200, unit: 'ms' },
  { metric: 'LCP', p50: 2000, p75: 2800, p95: 4500, unit: 'ms' },
  { metric: 'INP', p50: 80, p75: 150, p95: 350, unit: 'ms' },
  { metric: 'CLS', p50: 0.02, p75: 0.08, p95: 0.18, unit: 'score' },
  { metric: 'JS Bundle', p50: 180, p75: 250, p95: 400, unit: 'KB' },
  // 注意：下沉市场占 22%，所以 p95 预算比一般建议更保守
];
```

## 避免 AI 决策的常见陷阱

AI 最大的问题是"看起来很有道理但其实是错的"。它会编造不存在的 benchmark 数据、忽略你的具体业务场景、甚至推荐已经停止维护的库。永远交叉验证 AI 的输出。

```typescript
// 决策验证检查清单
const decisionValidation = {
  // AI 推荐的库/框架，必须验证以下几点
  checks: [
    {
      name: '活跃度验证',
      action: 'npm info <package> --json | jq ".time.modified"',
      threshold: '最近 6 个月内有更新',
    },
    {
      name: '安全审计',
      action: 'npm audit && snyk test <package>',
      threshold: '无 critical/high 漏洞',
    },
    {
      name: '兼容性验证',
      action: '在目标 Node/浏览器版本上运行测试',
      threshold: 'CI 全绿',
    },
    {
      name: '团队反馈',
      action: '技术评审会上讨论，收集意见',
      threshold: '核心成员无强烈反对',
    },
  ],
};
```

## 小结

- AI 是决策的加速器和放大器，不是决策者本身
- 结构化的约束定义是 AI 给出好建议的前提条件
- 量化分析（加权评分、耦合度计算）比模糊的"AI 推荐"更可靠
- 性能预算应该基于实际用户分群数据，而不是行业平均值
- 永远交叉验证 AI 的输出，尤其是 benchmark 数据和库推荐
