---
title: "Team Technology Stack Upgrade Methodology"
date: 2021-12-06 10:05:18
tags:
  - Engineering
  - Frontend

readingTime: 1
description: "今年主导了三个大的技术栈升级：Vue 2 → Vue 3、Jest → Vitest、Lerna → pnpm workspace。每个都踩过坑，总结出一套方法论。技术升级不只是技术决策，更是一次团队管理实践。"
wordCount: 260
---

今年主导了三个大的技术栈升级：Vue 2 → Vue 3、Jest → Vitest、Lerna → pnpm workspace。每个都踩过坑，总结出一套方法论。技术升级不只是技术决策，更是一次团队管理实践。

## Three Stages of Upgrade

```
阶段一：评估（2-4 周）
- 收益分析：解决什么问题？ROI 如何？
- 风险评估：兼容性、团队学习成本、回滚方案
- 小范围 POC：验证可行性

阶段二：执行（4-12 周）
- 制定分阶段计划
- 确定迁移边界
- 并行运行新旧方案

阶段三：收尾（2-4 周）
- 清理旧代码
- 补充文档
- 团队知识分享
```

## Key Questions in the Evaluation Phase

每次做升级决策，我都会问自己这 5 个问题：

```markdown
## 升级评估清单

1. 痛点量化
   - 当前方案每月浪费多少开发时间？
   - 新方案预计能提升多少效率？
   - 能否用数字说明？（构建时间、bug 率、新人上手时间）

2. 成本估算
   - 迁移需要多少人天？
   - 学习曲线有多陡？
   - 是否需要外部培训或咨询？

3. 回滚方案
   - 如果迁移失败，能不能回到原状态？
   - 回滚成本是多少？

4. 团队共识
   - 核心成员是否支持？
   - 是否有人能成为迁移的 champion？
   - 团队的工作量是否允许同时做迁移？

5. 时机判断
   - 目标技术是否足够稳定？
   - 是否有其他更紧迫的事情？
   - 是否可以和业务需求结合推进？
```

## Execution Phase Strategy

### Vue 3 迁移：渐进式

```javascript
// 迁移路线图
const migrationPlan = {
  week1_2: '搭建 Vue 3 + Vite 开发环境，写迁移指南文档',
  week3_4: '迁移公共组件（Button、Input、Modal）',
  week5_8: '逐个页面迁移，新功能直接用 Vue 3 写',
  week9_12: '处理边缘用例，清理 Vue 2 兼容代码',
  parallel: '旧分支保持可部署状态，随时回滚'
}
```

### pnpm 迁移：一次性切换

```bash
# pnpm 迁移不适合渐进式，要么用要么不用
# 我们的步骤：

# 1. 本地验证
npx pnpm import  # 从 package-lock.json 生成 pnpm-lock.yaml
pnpm install     # 验证安装是否正常
pnpm test        # 验证测试是否通过

# 2. CI 切换
# 修改 CI 配置从 npm 切换到 pnpm
# 保留旧的 CI 配置作为 fallback 一周

# 3. 全团队统一
# 更新开发环境搭建文档
# 在 .npmrc 中添加 shamefully-hoist 处理兼容问题
```

## Team Knowledge Transfer

技术升级最怕的是只有一个人懂。我们的做法：

```typescript
// 知识传递计划

interface KnowledgeTransfer {
  // 1. 文档先行
  docs: {
    migrationGuide: '迁移指南，覆盖常见场景和坑',
    decisionLog: '决策记录，为什么选这个方案',
    runbook: '操作手册，出问题怎么处理'
  }

  // 2. 结对编程
  pairing: {
    // 升级初期安排结对，让多人参与
    schedule: '每周 2 次结对编程 session',
    rotation: '轮换结对对象，覆盖整个团队'
  }

  // 3. 技术分享
  sharing: {
    kickoff: '迁移前做一次 Kick-off 分享',
    midReview: '迁移中做阶段回顾',
    retrospective: '迁移后做技术复盘'
  }
}
```

## Handling Resistance

技术升级一定会遇到阻力。常见的几种情况：

```
"现在的方案挺好的，为什么要换？"
→ 用数据说话：构建时间从 40s 降到 3s，HMR 从 2s 降到 50ms

"太忙了，没时间迁移"
→ 和业务需求结合：新功能用新方案写，旧代码逐步迁移

"万一新方案有 bug 怎么办？"
→ 回滚方案是必须的，渐进式迁移确保随时可回滚

"我学不会新东西"
→ 安排培训和结对，降低学习压力
```

## Summary

- 技术升级的评估要量化，用数字说服团队和领导
- 执行阶段要有明确的回滚方案，降低风险
- 知识传递比技术方案更重要，避免单点依赖
- 阻力是正常的，关键是用数据和体验来化解
- 好的技术升级应该是"无痛"的——用户和大部分团队成员感觉不到变化