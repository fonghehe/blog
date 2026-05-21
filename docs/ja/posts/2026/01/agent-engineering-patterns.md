---
title: "フロントエンドAgentエンジニアリング：ツール呼び出しから自律的意思決定へ"
date: 2026-01-15 10:00:00
tags:
  - フロントエンド
readingTime: 4
description: "2025年下半期、私はチームを率いて、社内の低コードプラットフォームのコード生成モジュールを「手動記述＋AI補完」から「Agent自律計画＋ツールチェーン実行」へとアップグレードしました。このプロセスで多くの試行錯誤があり、再利用可能なパターンもいくつか見えてきました。"
wordCount: 628
---

2025年下半期、私はチームを率いて、社内の低コードプラットフォームのコード生成モジュールを「手動記述＋AI補完」から「Agent自律計画＋ツールチェーン実行」へとアップグレードしました。このプロセスで多くの試行錯誤があり、再利用可能なパターンもいくつか見えてきました。

## AgentはChatbotではない

AI Agentを「対話型アシスタント」と理解している人がまだ多いです。しかしAgentエンジニアリングの核心的な違いはここにあります：

```
Chatbot：ユーザーが質問する → モデルが回答する → 終了
Agent：  ユーザーが目標を示す → モデルが計画する → ツールを呼び出す → 結果を観察する → 実行を続ける → 目標達成まで繰り返す
```

フロントエンドのシナリオでは、典型的なAgentワークフローはこのようになります：

```typescript
// agent-task.ts - フロントエンドAgentタスクの抽象化
interface AgentTask {
  goal: string; // ユーザーの目標の説明
  context: ProjectContext; // プロジェクトのコンテキスト（ファイルツリー、依存関係、既存コード）
  tools: ToolRegistry; // 利用可能なツールセット
  maxSteps: number; // 最大実行ステップ数
  onStep: (step: AgentStep) => void; // 各ステップのコールバック
}

interface AgentStep {
  thought: string; // Agentの推論プロセス
  action: ToolCall; // 選択したツールとパラメータ
  observation: string; // ツールが返した結果
  status: "continue" | "done" | "failed";
}
```

## パターン1：ReActループ

最も基本的なAgentパターンはReAct（Reasoning + Acting）です。フロントエンド開発での最も一般的な応用は**ファイル操作Agent**です：

```typescript
// react-agent.ts - ReActパターンの実装
class ReactAgent {
  async run(task: AgentTask): Promise<AgentResult> {
    const steps: AgentStep[] = [];

    for (let i = 0; i < task.maxSteps; i++) {
      const prompt = this.buildPrompt(task, steps);
      const response = await this.llm.complete(prompt);

      const { thought, action } = this.parseResponse(response);

      // ツール呼び出しを実行
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

実際の使用では、ツールセットにはファイル読み込み、ファイル書き込み、コマンド実行、コード検索などが含まれます：

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

## パターン2：マルチAgent協調

単一のAgentには限界があります。複雑なシナリオでは**Agentチーム**パターンを採用します：

```
ユーザーの目標：「このページをリファクタリングして、コンポーネントに分割し、単体テストを追加して」

          ┌─────────────┐
          │ Orchestrator │ ← メインAgent、タスク分解を担当
          └──────┬──────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐ ┌────────┐ ┌────────┐
│ Coder  │ │Reviewer│ │ Tester │ ← 専門Agent
└────────┘ └────────┘ └────────┘
```

```typescript
// multi-agent.ts - マルチAgent協調
class OrchestratorAgent {
  async decompose(goal: string): Promise<SubTask[]> {
    const response = await this.llm.complete(`
      以下の目標を実行可能なサブタスクに分解してください：
      目標：${goal}

      各サブタスクには以下を指定する必要があります：
      1. 担当するAgentタイプ（coder / reviewer / tester）
      2. 具体的な説明
      3. 依存する前置タスクのID
    `);

    return this.parseSubTasks(response);
  }

  async executeSubTask(
    subTask: SubTask,
    context: TaskContext,
  ): Promise<TaskResult> {
    const agent = this.getAgent(subTask.agentType);

    // リトライ付き実行
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await agent.run(subTask, context);

      // reviewerに結果を確認させる
      const review = await this.agents.reviewer.review(result);

      if (review.approved) {
        return result;
      }

      // レビューのコメントに基づいてリトライ
      context.feedback = review.comments;
    }

    throw new Error(`3回試みて失敗しました: ${subTask.description}`);
  }
}
```

## パターン3：人機協調ノード

Agentは完全に自律的であるべきではありません。重要な意思決定ポイントに**人機協調ノード**を設置します：

```typescript
// human-in-the-loop.ts
interface HumanApprovalNode {
  type: "approval";
  prompt: string;
  options: string[]; // ユーザーが選択できる操作
  defaultAction?: string; // タイムアウト後のデフォルト操作
  timeoutMs?: number;
}

class AgentWithHumanCheckpoints extends ReactAgent {
  private checkpoints: Map<string, HumanApprovalNode> = new Map();

  addCheckpoint(stepPattern: RegExp, node: HumanApprovalNode) {
    this.checkpoints.set(stepPattern.source, node);
  }

  async run(task: AgentTask): Promise<AgentResult> {
    // ... 通常のReActループ ...

    // 人間の確認が必要かチェック
    const checkpoint = this.findCheckpoint(step);
    if (checkpoint) {
      const humanDecision = await this.waitForHuman(checkpoint);

      if (humanDecision === "reject") {
        // 人間が拒否、前のステップにロールバック
        this.rollback(steps);
        continue;
      }

      if (humanDecision === "modify") {
        // 人間が修正してから続行
        step = await this.applyHumanModification(step);
      }
    }
  }
}

// 使用例
agent.addCheckpoint(/write_file.*\.tsx/, {
  type: "approval",
  prompt: "コンポーネントファイルを変更しようとしています。確認してください",
  options: ["approve", "modify", "reject"],
  timeoutMs: 30000,
});
```

## AgentのコンテキストEngineering

Agentのパフォーマンスはコンテキストの品質に大きく依存します。**コンテキスト圧縮戦略**をまとめました：

```typescript
// context-manager.ts
class AgentContextManager {
  private maxTokens = 128_000;

  buildContext(task: AgentTask, history: AgentStep[]): string {
    const sections: string[] = [];

    // 1. 常に含める：プロジェクトのコア情報
    sections.push(this.buildProjectSummary(task.context));

    // 2. 常に含める：現在の目標
    sections.push(`## 現在の目標\n${task.goal}`);

    // 3. 直近N個のステップの詳細記録
    const recentSteps = history.slice(-5);
    sections.push(this.formatRecentSteps(recentSteps));

    // 4. それ以前のステップは要約して圧縮
    if (history.length > 5) {
      const olderSummary = this.summarizeSteps(history.slice(0, -5));
      sections.push(`## 初期ステップの要約\n${olderSummary}`);
    }

    // 5. トークン制限内に収める
    return this.truncateToTokenLimit(sections.join("\n\n"), this.maxTokens);
  }

  private summarizeSteps(steps: AgentStep[]): string {
    // 小型モデルで要約し、コストを節約する
    return this.fastLlm.summarize(
      steps
        .map((s) => `${s.thought} → ${s.action.name}: ${s.observation}`)
        .join("\n"),
    );
  }
}
```

## まとめ

- Agentエンジニアリングの核心はReActループ＋ツールチェーン＋コンテキスト管理
- 単一Agentには限界がある。マルチAgent協調でより複雑なタスクに対処できる
- 人機協調ノードはAgentが暴走するのを防ぐ重要な安全機構
- コンテキストエンジニアリングがAgentの上限を決める——ここへの投資は最も高いリターンをもたらす
- 2026年、フロントエンドAgentは「補助ツール」から「チームメンバー」へと進化する
