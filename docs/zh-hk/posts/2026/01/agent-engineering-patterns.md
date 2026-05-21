---
title: "前端 Agent 工程化：從工具調用到自主決策"
date: 2026-01-15 10:00:00
tags:
  - 前端
readingTime: 3
description: "2025 年下半年，我帶團隊把一個內部低代碼平台的代碼生成模塊從\"人工編寫 + AI 補全\"升級成了\"Agent 自主規劃 + 工具鏈執行\"。這個過程踩了不少坑，也總結出了一些可複用的模式。"
wordCount: 403
---

2025 年下半年，我帶團隊把一個內部低代碼平台的代碼生成模塊從"人工編寫 + AI 補全"升級成了"Agent 自主規劃 + 工具鏈執行"。這個過程踩了不少坑，也總結出了一些可複用的模式。

## Agent 不是 Chatbot

很多人對 AI Agent 的理解還停留在"對話式助手"。但 Agent 工程化的核心區別在於：

```
Chatbot：用户提問 → 模型回答 → 結束
Agent：  用户目標 → 模型規劃 → 調用工具 → 觀察結果 → 繼續執行 → 循環直到目標完成
```

在前端場景下，一個典型的 Agent 工作流可能是：

```typescript
// agent-task.ts - 一個前端 Agent 任務的抽象
interface AgentTask {
  goal: string;           // 用户目標描述
  context: ProjectContext; // 項目上下文（文件樹、依賴、已有代碼）
  tools: ToolRegistry;     // 可用工具集
  maxSteps: number;        // 最大執行步數
  onStep: (step: AgentStep) => void; // 每步回調
}

interface AgentStep {
  thought: string;      // Agent 的推理過程
  action: ToolCall;     // 選擇的工具和參數
  observation: string;  // 工具返回的結果
  status: 'continue' | 'done' | 'failed';
}
```

## 模式一：ReAct 循環

最基礎的 Agent 模式是 ReAct（Reasoning + Acting）。前端開發中最常見的應用是**文件操作 Agent**：

```typescript
// react-agent.ts - ReAct 模式實現
class ReactAgent {
  async run(task: AgentTask): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    for (let i = 0; i < task.maxSteps; i++) {
      const prompt = this.buildPrompt(task, steps);
      const response = await this.llm.complete(prompt);

      const { thought, action } = this.parseResponse(response);

      // 執行工具調用
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

實際使用時，工具集可以包括：讀文件、寫文件、執行命令、搜索代碼等：

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

## 模式二：多 Agent 協作

單個 Agent 的能力有限。在複雜場景下，我們採用**Agent 團隊**模式：

```
用户目標："幫我重構這個頁面，拆分成組件，並加上單元測試"

          ┌─────────────┐
          │ Orchestrator │ ← 主 Agent，負責任務分解
          └──────┬──────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Coder  │ │Reviewer│ │ Tester │ ← 專業 Agent
└────────┘ └────────┘ └────────┘
```

```typescript
// multi-agent.ts - 多 Agent 協作
class OrchestratorAgent {
  async decompose(goal: string): Promise<SubTask[]> {
    const response = await this.llm.complete(`
      將以下目標拆解為可執行的子任務：
      目標：${goal}

      每個子任務需要指定：
      1. 負責的 Agent 類型（coder / reviewer / tester）
      2. 具體描述
      3. 依賴的前置任務 ID
    `);

    return this.parseSubTasks(response);
  }

  async executeSubTask(subTask: SubTask, context: TaskContext): Promise<TaskResult> {
    const agent = this.getAgent(subTask.agentType);

    // 帶重試的執行
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await agent.run(subTask, context);

      // 讓 reviewer 檢查結果
      const review = await this.agents.reviewer.review(result);

      if (review.approved) {
        return result;
      }

      // 根據 review 意見重試
      context.feedback = review.comments;
    }

    throw new Error(`Failed after 3 attempts: ${subTask.description}`);
  }
}
```

## 模式三：人機協作節點

Agent 不應該完全自主。我們在關鍵決策點設置**人機協作節點**：

```typescript
// human-in-the-loop.ts
interface HumanApprovalNode {
  type: 'approval';
  prompt: string;
  options: string[];        // 用户可選的操作
  defaultAction?: string;   // 超時後的默認操作
  timeoutMs?: number;
}

class AgentWithHumanCheckpoints extends ReactAgent {
  private checkpoints: Map<string, HumanApprovalNode> = new Map();

  addCheckpoint(stepPattern: RegExp, node: HumanApprovalNode) {
    this.checkpoints.set(stepPattern.source, node);
  }

  async run(task: AgentTask): Promise<AgentResult> {
    // ... 常規 ReAct 循環 ...

    // 檢查是否需要人工確認
    const checkpoint = this.findCheckpoint(step);
    if (checkpoint) {
      const humanDecision = await this.waitForHuman(checkpoint);

      if (humanDecision === 'reject') {
        // 人工否決，回退到上一步
        this.rollback(steps);
        continue;
      }

      if (humanDecision === 'modify') {
        // 人工修改後繼續
        step = await this.applyHumanModification(step);
      }
    }
  }
}

// 使用示例
agent.addCheckpoint(/write_file.*\.tsx/, {
  type: 'approval',
  prompt: '即將修改組件文件，請確認',
  options: ['approve', 'modify', 'reject'],
  timeoutMs: 30000,
});
```

## Agent 的上下文工程

Agent 的表現很大程度上取決於上下文質量。我們總結了一套**上下文壓縮策略**：

```typescript
// context-manager.ts
class AgentContextManager {
  private maxTokens = 128_000;

  buildContext(task: AgentTask, history: AgentStep[]): string {
    const sections: string[] = [];

    // 1. 始終保留：項目核心信息
    sections.push(this.buildProjectSummary(task.context));

    // 2. 始終保留：當前目標
    sections.push(`## 當前目標\n${task.goal}`);

    // 3. 最近 N 步的詳細記錄
    const recentSteps = history.slice(-5);
    sections.push(this.formatRecentSteps(recentSteps));

    // 4. 更早的步驟做摘要壓縮
    if (history.length > 5) {
      const olderSummary = this.summarizeSteps(history.slice(0, -5));
      sections.push(`## 早期步驟摘要\n${olderSummary}`);
    }

    // 5. 壓縮到 token 限制內
    return this.truncateToTokenLimit(sections.join('\n\n'), this.maxTokens);
  }

  private summarizeSteps(steps: AgentStep[]): string {
    // 用小型模型做摘要，節省成本
    return this.fastLlm.summarize(
      steps.map(s => `${s.thought} → ${s.action.name}: ${s.observation}`).join('\n')
    );
  }
}
```

## 小結

- Agent 工程化的核心是 ReAct 循環 + 工具鏈 + 上下文管理
- 單 Agent 能力有限，多 Agent 協作能處理更復雜的任務
- 人機協作節點是防止 Agent 失控的關鍵安全機制
- 上下文工程決定 Agent 的上限，投入精力在這上面回報最高
- 2026 年，前端 Agent 將從"輔助工具"變成"團隊成員"
