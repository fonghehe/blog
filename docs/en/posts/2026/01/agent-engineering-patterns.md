---
title: "Frontend Agent Engineering: From Tool Calls to Autonomous Decisions"
date: 2026-01-15 10:00:00
tags:
  - Frontend
readingTime: 3
description: "In the second half of 2025, I led my team in upgrading an internal low-code platform's code generation module from \"manually written + AI completion\" to \"Agent "
wordCount: 238
---

In the second half of 2025, I led my team in upgrading an internal low-code platform's code generation module from "manually written + AI completion" to "Agent autonomous planning + toolchain execution." The process involved plenty of pitfalls, but also produced some reusable patterns.

## Agent Is Not a Chatbot

Many people still think of AI Agents as "conversational assistants." But the core distinction in Agent engineering is:

```
Chatbot: user asks → model responds → done
Agent:   user goal → model plans → invokes tools → observes result → continues → loops until goal complete
```

In a frontend context, a typical Agent workflow might look like this:

```typescript
// agent-task.ts - abstraction of a frontend Agent task
interface AgentTask {
  goal: string; // User goal description
  context: ProjectContext; // Project context (file tree, dependencies, existing code)
  tools: ToolRegistry; // Available tools
  maxSteps: number; // Maximum execution steps
  onStep: (step: AgentStep) => void; // Per-step callback
}

interface AgentStep {
  thought: string; // Agent's reasoning process
  action: ToolCall; // Chosen tool and parameters
  observation: string; // Result returned by the tool
  status: "continue" | "done" | "failed";
}
```

## Pattern 1: ReAct Loop

The most fundamental Agent pattern is ReAct (Reasoning + Acting). The most common frontend application is the **file operations Agent**:

```typescript
// react-agent.ts - ReAct pattern implementation
class ReactAgent {
  async run(task: AgentTask): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    for (let i = 0; i < task.maxSteps; i++) {
      const prompt = this.buildPrompt(task, steps);
      const response = await this.llm.complete(prompt);

      const { thought, action } = this.parseResponse(response);

      // Execute tool call
      const observation = await task.tools.execute(action);

      const step: AgentStep = {
        thought,
        action,
        observation,
        status: this.judgeStatus(observation),
      };

      steps.push(step);
      task.onStep(step);

      if (step.status === "done" || step.status === "failed") {
        return { steps, finalStatus: step.status };
      }
    }

    return { steps, finalStatus: "failed", reason: "max steps exceeded" };
  }
}
```

In practice, the tool registry can include read file, write file, execute commands, search code, and more:

```typescript
const tools = new ToolRegistry()
  .register("read_file", async (path: string) => {
    return await fs.readFile(path, "utf-8");
  })
  .register("write_file", async (path: string, content: string) => {
    await fs.writeFile(path, content);
    return `Written ${content.length} chars to ${path}`;
  })
  .register("run_command", async (cmd: string) => {
    return await execAsync(cmd);
  })
  .register("search_code", async (query: string) => {
    return await ripgrep(query, "./src");
  });
```

## Pattern 2: Multi-Agent Collaboration

A single Agent has limited capability. For complex scenarios, we use the **Agent team** pattern:

```
User goal: "Help me refactor this page, split into components, and add unit tests"

          ┌─────────────┐
          │ Orchestrator │ ← Primary Agent, handles task decomposition
          └──────┬──────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Coder  │ │Reviewer│ │ Tester │ ← Specialist Agents
└────────┘ └────────┘ └────────┘
```

```typescript
// multi-agent.ts - multi-Agent collaboration
class OrchestratorAgent {
  async decompose(goal: string): Promise<SubTask[]> {
    const response = await this.llm.complete(`
      Break the following goal into executable sub-tasks:
      Goal: ${goal}

      Each sub-task must specify:
      1. Responsible Agent type (coder / reviewer / tester)
      2. Specific description
      3. Prerequisite task IDs this depends on
    `);

    return this.parseSubTasks(response);
  }

  async executeSubTask(
    subTask: SubTask,
    context: TaskContext,
  ): Promise<TaskResult> {
    const agent = this.getAgent(subTask.agentType);

    // Execute with retry
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await agent.run(subTask, context);

      // Have reviewer check the result
      const review = await this.agents.reviewer.review(result);

      if (review.approved) {
        return result;
      }

      // Retry based on review feedback
      context.feedback = review.comments;
    }

    throw new Error(`Failed after 3 attempts: ${subTask.description}`);
  }
}
```

## Pattern 3: Human-in-the-Loop Nodes

Agents shouldn't be fully autonomous. We set up **human-in-the-loop nodes** at critical decision points:

```typescript
// human-in-the-loop.ts
interface HumanApprovalNode {
  type: "approval";
  prompt: string;
  options: string[]; // User-selectable actions
  defaultAction?: string; // Default action after timeout
  timeoutMs?: number;
}

class AgentWithHumanCheckpoints extends ReactAgent {
  private checkpoints: Map<string, HumanApprovalNode> = new Map();

  addCheckpoint(stepPattern: RegExp, node: HumanApprovalNode) {
    this.checkpoints.set(stepPattern.source, node);
  }

  async run(task: AgentTask): Promise<AgentResult> {
    // ... standard ReAct loop ...

    // Check if human confirmation is needed
    const checkpoint = this.findCheckpoint(step);
    if (checkpoint) {
      const humanDecision = await this.waitForHuman(checkpoint);

      if (humanDecision === "reject") {
        // Human rejected, roll back to previous step
        this.rollback(steps);
        continue;
      }

      if (humanDecision === "modify") {
        // Human modified, then continue
        step = await this.applyHumanModification(step);
      }
    }
  }
}

// Usage example
agent.addCheckpoint(/write_file.*\.tsx/, {
  type: "approval",
  prompt: "About to modify a component file — please confirm",
  options: ["approve", "modify", "reject"],
  timeoutMs: 30000,
});
```

## Agent Context Engineering

Agent performance depends heavily on context quality. We've developed a **context compression strategy**:

```typescript
// context-manager.ts
class AgentContextManager {
  private maxTokens = 128_000;

  buildContext(task: AgentTask, history: AgentStep[]): string {
    const sections: string[] = [];

    // 1. Always include: core project info
    sections.push(this.buildProjectSummary(task.context));

    // 2. Always include: current goal
    sections.push(`## Current Goal\n${task.goal}`);

    // 3. Detailed record of the last N steps
    const recentSteps = history.slice(-5);
    sections.push(this.formatRecentSteps(recentSteps));

    // 4. Compress earlier steps into a summary
    if (history.length > 5) {
      const olderSummary = this.summarizeSteps(history.slice(0, -5));
      sections.push(`## Earlier Steps Summary\n${olderSummary}`);
    }

    // 5. Truncate to token limit
    return this.truncateToTokenLimit(sections.join("\n\n"), this.maxTokens);
  }

  private summarizeSteps(steps: AgentStep[]): string {
    // Use a small model to summarize, reducing cost
    return this.fastLlm.summarize(
      steps
        .map((s) => `${s.thought} → ${s.action.name}: ${s.observation}`)
        .join("\n"),
    );
  }
}
```

## Takeaways

- The core of Agent engineering is the ReAct loop + toolchain + context management
- Single Agents have limited capability; multi-Agent collaboration handles more complex tasks
- Human-in-the-loop nodes are the key safety mechanism preventing Agents from going off the rails
- Context engineering determines an Agent's ceiling — investment here has the highest return
- In 2026, frontend Agents will evolve from "support tools" to "team members"
