---
title: "GitHub Copilot 半年使用报告：AI 编程的真实体验"
date: 2023-03-15 16:44:36
tags:
  - Git
readingTime: 2
description: "用 GitHub Copilot 已经半年了，说说真实感受。不是广告，也不是恐慌文，就是真实体验。"
wordCount: 554
---

用 GitHub Copilot 已经半年了，说说真实感受。不是广告，也不是恐慌文，就是真实体验。

## 什么情况下 Copilot 帮我省时间

**写模板代码（最有用）**

```typescript
// 我输入注释或函数名，Copilot 补全
// 比如我写：// 把对象数组按 key 分组
function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  // Copilot 直接给出正确实现
  return arr.reduce(
    (groups, item) => {
      const group = String(item[key]);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
      return groups;
    },
    {} as Record<string, T[]>,
  );
}
```

这类纯逻辑函数，Copilot 往往一次就对，不需要改。

**写测试用例**

```typescript
// 写完函数后，写 describe() 注释
// Copilot 会把各种测试用例都补全出来
describe('groupBy', () => {
  it('按字符串 key 分组', () => { ... })
  it('空数组返回空对象', () => { ... })
  it('所有元素相同 key 时分在同一组', () => { ... })
})
```

**CSS 和 Tailwind**

输入组件名和功能描述，Copilot 直接给出 Tailwind 类名组合，大部分时候直接能用。

## 什么情况下 Copilot 帮不了

**业务逻辑**

```typescript
// Copilot 不知道你的业务规则
// 这种代码还是得自己写
async function processOrder(order: Order) {
  // VIP 用户免运费，订单满 200 打 9 折，
  // 但不和满减券同用，节假日翻倍积分...
}
```

**复杂 Bug 定位**

Copilot 给的建议有时候是"看起来合理但解决不了问题的代码"，反而浪费时间。

**架构决策**

选哪个库、用什么模式、怎么设计接口——这些 Copilot 给不出好答案。

## 我的使用方式

**用，但不盲信**

Copilot 的建议是参考，不是答案。每一行生成的代码都要审查：

- 逻辑是否正确
- 有没有安全隐患（SQL 注入、XSS 等）
- 是否符合项目规范

**把它当"有记忆的 StackOverflow"**

查 API 用法、看常用模式，比 Google 快。但重要的业务代码不能直接用。

**注意版权和隐私**

不要把敏感代码粘贴给 Copilot（虽然 GitHub 说不会存储，但习惯要养成）。

## AI 对前端工作的影响

老实说，Copilot 让我的"写代码"速度提升了大约 20-30%。但 coding 本身在工作中占的比例没那么高——设计方案、Code Review、和产品沟通、解 Bug 这些，AI 现在帮不了多少。

不过变化的速度很快。ChatGPT 出来后，Copilot Chat 也来了，可以直接对话解释代码、生成测试、重构建议。

未来 2-3 年，能更好地和 AI 协作的工程师会有明显优势。不是"AI 会替代工程师"，而是"会用 AI 的工程师会比不用的更高效"。

## 小结

- Copilot 在模板代码、测试、CSS 上帮助显著
- 业务逻辑、架构决策、Bug 定位还是得靠自己
- 生成的代码必须审查，不能无脑接受
- AI 工具是效率倍增器，不是替代品
- 开始认真学如何和 AI 工具高效协作