---
title: "前端 Agent 工程化：从工具调用到自主决策"
date: 2026-01-15 10:00:00
tags:
  - 前端
readingTime: 3
description: "2025 年下半年，我带团队把一个内部低代码平台的代码生成模块从\"人工编写 + AI 补全\"升级成了\"Agent 自主规划 + 工具链执行\"。这个过程踩了不少坑，也总结出了一些可复用的模式。"
wordCount: 403
---

2025 年下半年，我带团队把一个内部低代码平台的代码生成模块从"人工编写 + AI 补全"升级成了"Agent 自主规划 + 工具链执行"。这个过程踩了不少坑，也总结出了一些可复用的模式。

## Agent 不是 Chatbot

很多人对 AI Agent 的理解还停留在"对话式助手"。但 Agent 工程化的核心区别在于：

```
Chatbot：用户提问 → 模型回答 → 结束
Agent：  用户目标 → 模型规划 → 调用工具 → 观察结果 → 继续执行 → 循环直到目标完成
```

在前端场景下，一个典型的 Agent 工作流可能是：

```typescript
// agent-task.ts - 一个前端 Agent 任务的抽象
interface AgentTask {
  goal: string;           // 用户目标描述
  context: ProjectContext; // 项目上下文（文件树、依赖、已有代码）
  tools: ToolRegistry;     // 可用工具集
  maxSteps: number;        // 最大执行步数
  onStep: (step: AgentStep) => void; // 每步回调
}

interface AgentStep {
  thought: string;      // Agent 的推理过程
  action: ToolCall;     // 选择的工具和参数
  observation: string;  // 工具返回的结果
  status: 'continue' | 'done' | 'failed';
}
```

## 模式一：ReAct 循环

最基础的 Agent 模式是 ReAct（Reasoning + Acting）。前端开发中最常见的应用是**文件操作 Agent**：

```typescript
// react-agent.ts - ReAct 模式实现
class ReactAgent {
  async run(task: AgentTask): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    for (let i = 0; i < task.maxSteps; i++) {
      const prompt = this.buildPrompt(task, steps);
      const response = await this.llm.complete(prompt);

      const { thought, action } = this.parseResponse(response);

      // 执行工具调用
      const observation = await task.tools.execute(action);

      const step: AgentStep = {
        thought,
        action,
        observation,
        status: this.judgeStatus(observation),
      };

      steps.push(step);
      task.onStep(step);

      if (step.status === 'done' || step.status === 'failed') {
        return { steps, finalStatus: step.status };
      }
    }

    return { steps, finalStatus: 'failed', reason: 'max steps exceeded' };
  }
}
```

实际使用时，工具集可以包括：读文件、写文件、执行命令、搜索代码等：

```typescript
const tools = new ToolRegistry()
  .register('read_file', async (path: string) => {
    return await fs.readFile(path, 'utf-8');
  })
  .register('write_file', async (path: string, content: string) => {
    await fs.writeFile(path, content);
    return `Written ${content.length} chars to ${path}`;
  })
  .register('run_command', async (cmd: string) => {
    return await execAsync(cmd);
  })
  .register('search_code', async (query: string) => {
    return await ripgrep(query, './src');
  });
```

## 模式二：多 Agent 协作

单个 Agent 的能力有限。在复杂场景下，我们采用**Agent 团队**模式：

```
用户目标："帮我重构这个页面，拆分成组件，并加上单元测试"

          ┌─────────────┐
          │ Orchestrator │ ← 主 Agent，负责任务分解
          └──────┬──────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Coder  │ │Reviewer│ │ Tester │ ← 专业 Agent
└────────┘ └────────┘ └────────┘
```

```typescript
// multi-agent.ts - 多 Agent 协作
class OrchestratorAgent {
  async decompose(goal: string): Promise<SubTask[]> {
    const response = await this.llm.complete(`
      将以下目标拆解为可执行的子任务：
      目标：${goal}

      每个子任务需要指定：
      1. 负责的 Agent 类型（coder / reviewer / tester）
      2. 具体描述
      3. 依赖的前置任务 ID
    `);

    return this.parseSubTasks(response);
  }

  async executeSubTask(subTask: SubTask, context: TaskContext): Promise<TaskResult> {
    const agent = this.getAgent(subTask.agentType);

    // 带重试的执行
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await agent.run(subTask, context);

      // 让 reviewer 检查结果
      const review = await this.agents.reviewer.review(result);

      if (review.approved) {
        return result;
      }

      // 根据 review 意见重试
      context.feedback = review.comments;
    }

    throw new Error(`Failed after 3 attempts: ${subTask.description}`);
  }
}
```

## 模式三：人机协作节点

Agent 不应该完全自主。我们在关键决策点设置**人机协作节点**：

```typescript
// human-in-the-loop.ts
interface HumanApprovalNode {
  type: 'approval';
  prompt: string;
  options: string[];        // 用户可选的操作
  defaultAction?: string;   // 超时后的默认操作
  timeoutMs?: number;
}

class AgentWithHumanCheckpoints extends ReactAgent {
  private checkpoints: Map<string, HumanApprovalNode> = new Map();

  addCheckpoint(stepPattern: RegExp, node: HumanApprovalNode) {
    this.checkpoints.set(stepPattern.source, node);
  }

  async run(task: AgentTask): Promise<AgentResult> {
    // ... 常规 ReAct 循环 ...

    // 检查是否需要人工确认
    const checkpoint = this.findCheckpoint(step);
    if (checkpoint) {
      const humanDecision = await this.waitForHuman(checkpoint);

      if (humanDecision === 'reject') {
        // 人工否决，回退到上一步
        this.rollback(steps);
        continue;
      }

      if (humanDecision === 'modify') {
        // 人工修改后继续
        step = await this.applyHumanModification(step);
      }
    }
  }
}

// 使用示例
agent.addCheckpoint(/write_file.*\.tsx/, {
  type: 'approval',
  prompt: '即将修改组件文件，请确认',
  options: ['approve', 'modify', 'reject'],
  timeoutMs: 30000,
});
```

## Agent 的上下文工程

Agent 的表现很大程度上取决于上下文质量。我们总结了一套**上下文压缩策略**：

```typescript
// context-manager.ts
class AgentContextManager {
  private maxTokens = 128_000;

  buildContext(task: AgentTask, history: AgentStep[]): string {
    const sections: string[] = [];

    // 1. 始终保留：项目核心信息
    sections.push(this.buildProjectSummary(task.context));

    // 2. 始终保留：当前目标
    sections.push(`## 当前目标\n${task.goal}`);

    // 3. 最近 N 步的详细记录
    const recentSteps = history.slice(-5);
    sections.push(this.formatRecentSteps(recentSteps));

    // 4. 更早的步骤做摘要压缩
    if (history.length > 5) {
      const olderSummary = this.summarizeSteps(history.slice(0, -5));
      sections.push(`## 早期步骤摘要\n${olderSummary}`);
    }

    // 5. 压缩到 token 限制内
    return this.truncateToTokenLimit(sections.join('\n\n'), this.maxTokens);
  }

  private summarizeSteps(steps: AgentStep[]): string {
    // 用小型模型做摘要，节省成本
    return this.fastLlm.summarize(
      steps.map(s => `${s.thought} → ${s.action.name}: ${s.observation}`).join('\n')
    );
  }
}
```

## 小结

- Agent 工程化的核心是 ReAct 循环 + 工具链 + 上下文管理
- 单 Agent 能力有限，多 Agent 协作能处理更复杂的任务
- 人机协作节点是防止 Agent 失控的关键安全机制
- 上下文工程决定 Agent 的上限，投入精力在这上面回报最高
- 2026 年，前端 Agent 将从"辅助工具"变成"团队成员"
