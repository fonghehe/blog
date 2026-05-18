---
title: "AI 輔助開發工作流：從 Copilot 到 Claude Code 的實踐"
date: 2025-01-25 10:00:00
tags:
  - 工程化
readingTime: 2
description: "2025 年初，團隊已經全面接入 AI 輔助開發。從 GitHub Copilot 到 Claude Code，從 Cursor 到各種 AI 插件，變化比想象中快。來分享一下實際落地的工作流。"
---

2025 年初，團隊已經全面接入 AI 輔助開發。從 GitHub Copilot 到 Claude Code，從 Cursor 到各種 AI 插件，變化比想象中快。來分享一下實際落地的工作流。

## 工具矩陣

```
場景                    推薦工具              説明
──────────────────────────────────────────────────────
日常編碼補全            Cursor / Copilot      Tab 補全，降低重複勞動
複雜功能實現            Claude Code           項目級理解，端到端實現
代碼審查                Claude Code review    深度分析，不只是 lint
架構設計討論            Claude 對話           多輪對話，逐步細化
文檔生成                Copilot / Claude      根據代碼生成文檔
Bug 排查               Cursor + Claude       定位問題 + 修復建議
```

## 工作流 1：Cursor + Claude Code 協作

```bash
# 在 Cursor 中編碼（實時補全）
# 遇到複雜任務時，切到 Claude Code 終端

# Claude Code 項目級操作
claude "重構 src/utils/date.ts 中的日期處理，
        使用 Temporal API 替代 moment，
        保持所有導出函數簽名不變"
```

Cursor 擅長行級補全，Claude Code 擅長理解整個項目上下文後做大規模修改。兩個配合用效率最高。

## 工作流 2：AI 驅動的 PR Review

```yaml
# .github/workflows/ai-review.yml
name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: AI Review
        run: |
          # 獲取 diff
          DIFF=$(git diff origin/main...HEAD)

          # 調用 Claude API 做 review
          curl https://api.anthropic.com/v1/messages \
            -H "x-api-key: ${{ secrets.ANTHROPIC_API_KEY }}" \
            -H "content-type: application/json" \
            -d '{
              "model": "claude-sonnet-4-20250514",
              "max_tokens": 4096,
              "messages": [{
                "role": "user",
                "content": "Review this diff for bugs, security issues, and best practices:\n'"$DIFF"'"
              }]
            }'
```

## 工作流 3：設計稿轉代碼

```tsx
// Claude Code + Figma MCP 的工作流
// 1. 從 Figma 獲取設計稿信息
// 2. Claude 根據設計稿生成組件代碼
// 3. 人工審核和調整

// 生成的組件示例
interface PricingCardProps {
  plan: string;
  price: string;
  features: string[];
  highlighted?: boolean;
  onSelect: () => void;
}

export function PricingCard({
  plan,
  price,
  features,
  highlighted = false,
  onSelect,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-8",
        highlighted
          ? "border-primary bg-primary/5 shadow-lg scale-105"
          : "border-border bg-card",
      )}
    >
      <h3 className="text-lg font-semibold">{plan}</h3>
      <div className="mt-4">
        <span className="text-4xl font-bold">{price}</span>
        <span className="text-muted-foreground">/月</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-primary" />
            <span className="text-sm">{f}</span>
          </li>
        ))}
      </ul>
      <Button
        className="mt-8 w-full"
        variant={highlighted ? "default" : "outline"}
        onClick={onSelect}
      >
        選擇方案
      </Button>
    </div>
  );
}
```

## 實際效果數據

```
團隊數據（3 個月跟蹤）：
  PR 合併速度：提升 35%
  代碼行產出：提升 40%
  Bug 密度：下降 15%（AI review 幫助發現）
  代碼審查時間：減少 50%
  文檔覆蓋率：從 30% 提升到 70%
```

## 注意事項

```
1. AI 生成的代碼一定要 review，不要直接合並
2. 敏感代碼（認證、支付）不要發送給 AI
3. Prompt 越具體，生成質量越高
4. AI 擅長樣板代碼，不擅長業務邏輯創新
5. 建立團隊的 prompt 庫，複用高質量 prompt
```

## 小結

- AI 輔助開發不是替代工程師，是放大工程師的能力
- Cursor 做實時補全，Claude Code 做項目級任務，各有優勢
- AI Review 可以發現人類容易忽略的問題
- 關鍵是建立適合團隊的 AI 工作流，而不是盲目堆工具
- 2025 年，不會用 AI 的前端工程師會越來越被動
