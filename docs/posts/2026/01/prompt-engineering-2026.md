---
title: "提示工程 2026 前端最佳实践"
date: 2026-01-21 10:00:00
tags:
  - 前端
---

Prompt Engineering 在 2026 年仍然是前端工程师需要掌握的核心技能。虽然模型越来越强，但"会提问"和"不会提问"之间的差距反而更大了。好的 prompt 能让 AI 一次产出可用代码，差的 prompt 让你在对话中浪费半小时。

## 前端 Prompt 的黄金结构

经过大量实践，我总结出前端场景下最有效的 prompt 结构：角色设定 + 约束条件 + 输入输出格式 + 反例排除。

```typescript
// prompt-templates.ts —— 我们团队的 prompt 模板库
export const promptTemplates = {
  // 组件开发 prompt
  component: (spec: ComponentSpec) => `
你是一个资深 React 前端工程师，严格遵循以下规范：

技术栈：React 20 + TypeScript 7 + Tailwind CSS v4
组件模式：Server Component 优先，需要客户端交互时使用 'use client'
状态管理：本地状态用 useState/useReducer，全局状态用 Zustand
错误处理：所有异步操作必须有 error boundary 兜底

要求：
- 组件名：${spec.name}
- 功能：${spec.description}
- Props 接口：${JSON.stringify(spec.props, null, 2)}
- 必须覆盖的状态：loading, error, empty, success
- 必须支持的无障碍：keyboard navigation, ARIA labels, focus management

不要做的事情：
- 不要使用 any 类型
- 不要使用 useEffect 做可以同步计算的派生状态
- 不要内联 style，使用 Tailwind 类名
- 不要使用 default export，使用 named export
  `,

  // 性能优化 prompt
  performance: (component: string) => `
分析以下组件的性能问题并给出优化方案。

分析维度：
1. 渲染性能：不必要的重渲染、缺失的 memoization
2. 包体积：可替代的重型依赖、未使用的导入
3. 运行时效率：循环中的对象创建、闭包陷阱
4. 网络性能：瀑布式请求、缺失的预加载

输出格式：
- 每个问题标注严重程度（critical/high/medium/low）
- 给出优化前后的代码对比
- 预估优化效果（减少的渲染次数、减少的 bundle size）

${component}
  `,
};
```

## 上下文注入：让 AI 理解你的项目

通用 prompt 只能产出通用代码。让 AI 理解你的项目上下文是产出可用代码的关键。我的做法是维护一个 project-context.md 文件，每次对话时注入。

```markdown
<!-- project-context.md —— 注入到每次 AI 对话的项目上下文 -->

## 项目信息
- 框架：Next.js 15.1, React 20.2, TypeScript 7.0
- 样式：Tailwind CSS v4.1 + shadcn/ui
- 状态管理：Zustand 5.x + TanStack Query v5
- 测试：Vitest 3.x + Testing Library + Playwright
- 包管理：Bun 3.2
- 部署：Vercel (Edge Runtime)

## 编码约定
- 组件用 PascalCase，文件用 kebab-case
- Hook 以 use 开头，放在 hooks/ 目录
- API 调用统一封装在 api/ 目录，使用自定义 fetch wrapper
- 类型定义优先放在 types/ 目录，组件内类型不超过 3 行
- 禁止使用 any，禁止 @ts-ignore，必要时用 @ts-expect-error

## 目录结构
src/
  app/          # App Router 页面
  components/   # 共享组件
    ui/         # 基础 UI 组件（shadcn）
    features/   # 业务组件
  hooks/        # 自定义 Hooks
  stores/       # Zustand stores
  api/          # API 调用层
  types/        # 共享类型
  utils/        # 工具函数
```

```typescript
// context-loader.ts —— 自动注入项目上下文的工具
import { readFileSync } from 'fs';
import { glob } from 'glob';

export async function buildProjectContext(): Promise<string> {
  // 加载基础上下文
  const baseContext = readFileSync('project-context.md', 'utf-8');

  // 自动扫描最近修改的文件，了解当前开发方向
  const recentFiles = await glob('src/**/*.{ts,tsx}', {
    ignore: ['**/*.test.*', '**/node_modules/**'],
  });

  // 加载 package.json 获取依赖信息
  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));

  return `
${baseContext}

## 当前依赖版本
${Object.entries(pkg.dependencies ?? {})
  .map(([name, version]) => `- ${name}: ${version}`)
  .join('\n')}
  `;
}
```

## Chain-of-Thought：复杂任务的拆分策略

复杂功能不应该一次性让 AI 生成。用 Chain-of-Thought 策略，引导 AI 分步思考。

```typescript
// 复杂任务的 prompt 链
const cotSteps = [
  {
    step: 1,
    prompt: `
先不写代码，分析这个功能需要哪些数据结构和接口。
列出所有 TypeScript 类型定义。
    `,
    output: 'types/',
  },
  {
    step: 2,
    prompt: `
基于上面的类型定义，实现数据获取层。
包括 API 调用函数和 TanStack Query hooks。
    `,
    output: 'api/ + hooks/',
  },
  {
    step: 3,
    prompt: `
基于上面的 hooks，实现 UI 组件。
从最底层的原子组件开始，逐步构建到页面级组件。
    `,
    output: 'components/',
  },
  {
    step: 4,
    prompt: `
为上面的 hooks 和组件编写测试。
优先覆盖核心业务逻辑和边界情况。
    `,
    output: '__tests__/',
  },
];

// 实际示例：实现一个搜索功能
async function buildSearchFeature() {
  // Step 1: 类型定义
  await askAI(cotSteps[0].prompt + `
搜索功能需求：
- 全文搜索：支持商品名、描述、标签
- 筛选器：价格区间、分类、评分、库存状态
- 排序：相关性、价格升降序、销量、上新时间
- 分页：游标分页（cursor-based），每页 20 条
  `);

  // Step 2-4 依次执行...
}
```

## Few-Shot 示例：最被低估的 Prompt 技巧

Few-shot 是指在 prompt 中提供 1-2 个示例，告诉 AI 你期望的输出格式和质量。这是提升 AI 输出质量最直接的方法。

```typescript
// few-shot-prompt.ts
const fewShotExample = `
参考以下示例的代码风格和质量标准：

// 示例：useDebounce hook 的实现
import { useEffect, useState, useRef } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// 注意示例中的要点：
// 1. 泛型参数保证类型安全
// 2. useEffect 中正确清理 timer
// 3. 依赖数组精确，不多不少
// 4. 命名清晰，不需要注释就能理解
// 5. 函数签名简洁，无多余参数

现在，按照同样的代码风格实现 useThrottle hook。
`;
```

## 小结

- 好的前端 prompt = 角色 + 约束 + 格式 + 反例，缺一不可
- 项目上下文注入是让 AI 产出可用代码的前提条件
- 复杂任务用 Chain-of-Thought 分步引导，不要指望一次出结果
- Few-shot 示例是提升输出质量最直接的技巧，值得花时间维护示例库
- Prompt 模板应该和代码一样纳入版本管理，团队共享和迭代
