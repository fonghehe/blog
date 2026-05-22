---
title: "チーム拡張におけるAI戦略"
date: 2025-08-25 10:59:36
tags:
  - エンジニアリング
readingTime: 2
description: "チームが5人から20人に拡張する中で、AI ツールが知識伝達、コード一貫性、新人オンボーディングに大きく貢献しました。実際の戦略を共有します。"
wordCount: 278
---

チームが5人から20人に拡張する中で、AI ツールが知識伝達、コード一貫性、新人オンボーディングに大きく貢献しました。実際の戦略を共有します。

## チーム拡張の課題

```
5 人团队：沟通成本低，代码风格靠默契
15 人团队：需要规范，但规范执行靠人工
20 人团队：靠 AI 做强制执行 + 知识库

AI 解决的问题：
  1. 代码风格不一致 → AI review 强制执行
  2. 新人上手慢 → AI 辅助 onboarding
  3. 知识分散 → AI 知识库
  4. 重复造轮子 → AI 推荐已有方案
```

## 戦略1：チームプロンプトライブラリ

```yaml
# prompts/component-creation.yaml
name: 创建新组件
description: 按团队规范创建新的 React 组件
template: |
  创建组件 {{componentName}}，要求：
  1. 使用 TypeScript，严格模式
  2. 使用 cva 管理 variant
  3. 使用 forwardRef
  4. 配套 Storybook stories
  5. 配套单元测试（vitest + testing-library）
  6. 放在 src/components/{{componentName}} 目录
  7. 遵循团队 naming convention：PascalCase 组件，camelCase props
  8. 导出类型定义
variables:
  - name: componentName
    description: 组件名称
    required: true

# prompts/api-integration.yaml
name: API 集成
description: 按团队规范创建 API 集成代码
template: |
  在 {{feature}} 模块中集成 {{apiEndpoint}} API：
  1. 使用 @tanstack/react-query 管理请求
  2. 创建 src/api/{{feature}}.ts 定义请求函数
  3. 创建 src/hooks/use{{Feature}}.ts 封装 hook
  4. 添加 loading/error 状态处理
  5. 使用 zod 验证响应类型
  6. 添加乐观更新（如适用）
```

## 戦略2：AIを活用した新人オンボーディング

```tsx
// 新人第一天的 AI 工作流

// 1. AI 生成项目概览
const onboardingGuide = await generateOnboardingGuide({
  projectName: "frontend-app",
  role: "frontend-engineer",
  techStack: ["react", "typescript", "tailwind", "next.js"],
});

// 2. AI 基于代码库回答新人问题
// 新人在 Claude Code 中提问：
// "这个项目的认证流程是怎么实现的？"
// "useAuth hook 在哪些地方被使用？"
// "如何添加一个新的 API 端点？"

// 3. AI 分配的练习任务
const practiceTasks = [
  {
    title: "修复一个 Good First Issue",
    description: "选择一个标记为 good-first-issue 的 ticket",
    aiSupport: "Claude Code 会帮助你理解相关代码",
  },
  {
    title: "添加一个简单的组件",
    description: "使用 AI prompt 库创建一个 Button 组件",
    aiSupport: "AI 会按团队规范生成初始代码",
  },
  {
    title: "写一个单元测试",
    description: "为现有组件补充测试用例",
    aiSupport: "AI 会分析代码生成测试框架",
  },
];
```

## 戦略3：コード一貫性の確保

```json
// .claude/settings.json
{
  "rules": [
    {
      "pattern": "src/components/**/*.tsx",
      "rules": [
        "必须使用 TypeScript",
        "必须使用 forwardRef",
        "必须导出 Props 类型",
        "使用 cn() 合并 className",
        "禁止使用 inline style"
      ]
    },
    {
      "pattern": "src/api/**/*.ts",
      "rules": [
        "必须使用 zod 验证响应",
        "必须定义返回类型",
        "使用 react-query 管理缓存",
        "错误处理必须返回 Result 类型"
      ]
    }
  ]
}
```

## 戦略4：AI知識ベース

```ts
// scripts/knowledge-base.ts
// 将团队的技术决策和最佳实践存入 AI 可检索的知识库

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  lastUpdated: string;
  author: string;
}

const knowledgeBase: KnowledgeEntry[] = [
  {
    id: "state-management",
    title: "状态管理选型",
    content: `我们使用：
      - 服务端状态：@tanstack/react-query
      - 全局 UI 状态：Zustand
      - 表单状态：React Hook Form
      - URL 状态：nuqs
    不使用 Redux（过度设计）和 Context（性能问题）`,
    tags: ["architecture", "state-management"],
    lastUpdated: "2025-06-01",
    author: "tech-lead",
  },
  {
    id: "error-handling",
    title: "错误处理规范",
    content: `所有 API 调用必须：
      1. 使用 try-catch 包裹
      2. 返回 Result<T, E> 类型
      3. 上报到 Sentry
      4. 展示用户友好的错误信息
    禁止：静默吞掉错误`,
    tags: ["error-handling", "best-practices"],
    lastUpdated: "2025-05-15",
    author: "tech-lead",
  },
];
```

## チームデータ

```
引入 AI 后的团队效率变化（6 个月跟踪）：

新人上手时间：从 3 周降到 1.5 周
代码审查时间：减少 40%
代码风格不一致问题：减少 75%
重复造轮子事件：减少 60%
技术债务累积速度：降低 30%
```

## まとめ

- チーム拡張時、AIは付加価値ではなく必需品です
- チームのプロンプトライブラリを構築し、AIの出力がチーム規約に準拠するようにする
- AIアシストオンボーディングにより、新人の習熟期間を大幅に短縮できる
- コード一貫性はAIレビューで強制執行し、人手に頼らない
- 知識ベースの構築は継続的な投資が必要ですが、見返りは大きい
