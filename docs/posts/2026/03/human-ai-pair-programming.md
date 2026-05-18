---
title: "人机结对编程的三个阶段：从补全到协作"
date: 2026-03-05 10:00:00
tags:
  - 前端
readingTime: 3
description: "去年底我做了一个实验：连续两周，所有新功能都用\"人机结对\"的方式开发。不是 Copilot 式的代码补全，而是真正的协作模式。效果超出预期，但过程中的心态转变才是最大的收获。"
---

去年底我做了一个实验：连续两周，所有新功能都用"人机结对"的方式开发。不是 Copilot 式的代码补全，而是真正的协作模式。效果超出预期，但过程中的心态转变才是最大的收获。

## 阶段一：AI 是"高级自动补全"（2023-2024）

这个阶段大家都经历过。AI 是 Tab 键的增强版：

```typescript
// 你写：
function calculateTotal(items: CartItem[])

// AI 补全：
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
```

**这个阶段的特征：**
- 人类写骨架，AI 填充血肉
- AI 的输出范围很小（一行到一个函数）
- 人类对每一行代码都有完全的掌控感
- 信任度：低。每行都要审

这个模式的瓶颈很明显：**AI 不理解业务上下文**。它只能根据当前文件和附近文件做预测。

## 阶段二：AI 是"实习生"（2025）

到了 2025 年，上下文窗口扩大 + MCP 协议普及，AI 开始能理解整个项目。但人类的心态还是"监工"：

```typescript
// 人：写一个用户注册表单组件
// 要求：邮箱、密码、确认密码
// 密码需要强度校验，弱密码要实时提示
// 提交时调用 POST /api/auth/register

// AI 生成完整组件
// 人类 review，改几个细节，合并
```

**这个阶段的特征：**
- 人类写需求，AI 写实现
- 人类花大量时间做 code review
- 信任度：中。大方向信任，细节不放心
- 瓶颈：**review 的时间可能比自己写还长**

我在这个阶段最大的感悟：如果你花 30 分钟 review AI 生成的代码，不如花 5 分钟写清楚需求。**投入产出比在需求端，不在审查端。**

## 阶段三：AI 是"结对伙伴"（2026）

这是我目前在用的模式。核心转变是：**人类和 AI 各自发挥优势，而不是上下游关系。**

```markdown
## 我的结对工作流

### 人类负责（架构 + 决策）：
1. 定义组件的接口边界（Props 类型、事件契约）
2. 决定状态管理方案（放在哪、怎么流）
3. 定义关键路径的测试用例
4. 处理跨模块的架构决策

### AI 负责（实现 + 验证）：
1. 根据接口契约生成组件实现
2. 编写所有测试用例
3. 生成 Storybook stories
4. 检查边界情况和可访问性
```

实际操作中，我用这种方式：

```typescript
// 第一步：人类定义接口（这是最关键的一步）
// file: src/features/auth/components/RegisterForm.types.ts

export interface RegisterFormProps {
  onSuccess: (user: User) => void;
  onError: (error: AuthError) => void;
  initialEmail?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: '极弱' | '弱' | '一般' | '强' | '极强';
  suggestions: string[];
}

// 然后对 AI 说：
// "根据上面的类型定义，生成 RegisterForm 组件
//  要求：使用 react-hook-form + zod
//  密码强度用 PasswordStrength 类型
//  UI 用我们的 @company/ui 组件库"
```

AI 生成实现后，我不逐行 review，而是**只检查接口是否对齐**：

```typescript
// 我的 review checklist（只检查这些）：
// □ Props 接口是否完全匹配定义
// □ 回调函数的参数类型是否正确
// □ 状态管理是否在组件内部（没有意外提升）
// □ 错误处理是否覆盖了所有 AuthError 类型
```

## 关键技巧：给 AI 写"设计文档"而不是"需求描述"

我发现一个反直觉的事实：**给 AI 写的技术设计文档，比我给自己团队写的还要重要。**

```markdown
## 传统写法（给 AI 的 prompt）：
"帮我写一个订单列表页面，支持分页、筛选、排序"

## 更好的写法（给 AI 的设计文档）：
### 订单列表页面设计

#### 数据流
- 数据源：useOrderList hook（已有）
- 筛选状态：URL search params（保持可分享）
- 排序状态：本地 state（不需要持久化）

#### 组件结构
- OrderListPage（页面级）
  - OrderFilters（筛选栏）
  - OrderTable（表格）
    - OrderRow（行）
      - StatusBadge（状态标签，已有）
  - Pagination（分页，用 @company/ui）

#### 边界情况
- 空状态：显示"暂无订单" + 引导创建
- 加载中：表格骨架屏
- 筛选无结果：提示"调整筛选条件"
- 网络错误：Toast 提示 + 重试按钮
```

第二种方式生成的代码质量高了一个量级。因为 AI 不需要"猜"你的架构决策。

## 小结

- 人机结对编程经历了三个阶段：补全 → 监工 → 协作
- 当前最优模式：人类做架构决策和接口定义，AI 做实现和验证
- 关键心态转变：从"审查代码"到"审查接口契约"
- 给 AI 写设计文档比写需求描述产出质量高 10 倍
- 人类的价值不在写代码，在做决策和定义边界
