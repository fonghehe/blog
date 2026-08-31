---
title: "AI 驅動的設計系統自動化：從 Token 生成到元件驗證"
date: 2026-07-18 12:22:00
tags:
  - AI
  - 設計系統
readingTime: 8
description: "探討 LLM 在設計系統全鏈路中的應用：從設計 Token 自動推導、元件程式碼生成到一致性驗證，建構 AI 輔助的設計系統工程化方案。"
wordCount: 1506
---

設計系統是前端工程化的基礎設施，但維護成本往往隨團隊規模呈指數增長。Token 命名不統一、元件偏離設計規範、Figma 與程式碼不同步——這些問題困擾著幾乎每一個中大型前端團隊。2025 年以來，LLM 的程式碼理解和生成能力達到了實用門檻，讓設計系統的自動化維護成為可能。

## AI 在設計系統中的三個應用層次

將 AI 引入設計系統不是簡單地「用 GPT 寫元件」，而是需要在三個層次上建立系統化的工作流：

1. **Token 層**：從品牌指南推導完整的設計 Token 體系，包括顏色、間距、字體、陰影等
2. **元件層**：基於 Token 和設計稿，生成符合規範的元件程式碼
3. **驗證層**：AI 自動檢測程式碼中的設計偏離，保持設計與實作的一致性

這三個層次構成一個閉環：Token 驅動元件生成，元件經過驗證回饋，驗證結果反過來修正 Token 和元件。

## LLM 驅動的設計 Token 推導

### 從品牌色到完整色彩體系

傳統方式中，設計師手動建立色彩體系：選一個品牌色，然後調整明度生成 50-900 的色階。這個過程機械且容易不一致。LLM 可以根據品牌色和語義需求自動推導出完整的 Token 體系：

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface ColorToken {
  name: string;
  value: string;
  description: string;
}

async function generateColorSystem(brandColor: string): Promise<ColorToken[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是一個設計系統專家。根據給定的品牌色，生成一個完整的語義化色彩 Token 體系。
        輸出 JSON 陣列，每個 Token 包含 name（如 primary.500）、value（hex 值）、description。
        色階範圍：50, 100, 200, 300, 400, 500, 600, 700, 800, 900。
        同時生成 semantic tokens：success, warning, error, info 各 5 個色階。
        品牌色應對應 500 色階。`
      },
      {
        role: 'user',
        content: `品牌色: ${brandColor}`
      }
    ],
    response_format: { type: 'json_object' }
  });

  const result = JSON.parse(response.choices[0].message.content!);
  return result.tokens;
}

// 使用範例
generateColorSystem('#3B82F6').then(tokens => {
  console.log(tokens);
  // 輸出: [{ name: 'primary.50', value: '#EFF6FF', ... }, ...]
});
```

關鍵在於 prompt 工程——不能只讓 LLM「生成顏色」，而要明確約束輸出格式、色階範圍、語義分類和品牌色錨點。否則生成的 Token 體系無法直接接入工程流程。

### Token 的層次化結構

一個成熟的設計系統 Token 通常分為三層：

```typescript
// 第一層：原始 Token（Reference Tokens）
const referenceTokens = {
  'blue-500': '#3B82F6',
  'blue-600': '#2563EB',
  'gray-100': '#F3F4F6',
  'spacing-4': '1rem',
  'radius-md': '0.375rem',
};

// 第二層：語義 Token（System Tokens）
const systemTokens = {
  'color-primary': '{blue-500}',
  'color-primary-hover': '{blue-600}',
  'color-background': '{gray-100}',
  'spacing-base': '{spacing-4}',
};

// 第三層：元件 Token（Component Tokens）
const componentTokens = {
  'button-bg-primary': '{color-primary}',
  'button-bg-primary-hover': '{color-primary-hover}',
  'button-padding': '{spacing-base}',
  'button-radius': '{radius-md}',
};
```

LLM 可以根據品牌指南和元件需求，自動生成這三層 Token 並保持參考關係。這種層次化結構讓設計變更時只需修改源頭，所有元件自動跟隨更新。

## 元件程式碼自動生成：Figma 到程式碼的 AI 管道

### 從設計稿提取結構化資料

Figma 的 Plugin API 和 REST API 可以匯出設計稿的結構化資料。結合 LLM，可以建構一個從設計稿到元件程式碼的自動化管道：

```typescript
interface FigmaNode {
  id: string;
  name: string;
  type: 'FRAME' | 'COMPONENT' | 'TEXT' | 'RECTANGLE' | 'ELLIPSE';
  fills?: Array<{ color: string; opacity: number }>;
  strokes?: Array<{ color: string; weight: number }>;
  cornerRadius?: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  children?: FigmaNode[];
  characters?: string;
  style?: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    lineHeightPx: number;
  };
}

async function generateComponentCode(
  figmaNode: FigmaNode,
  designTokens: Record<string, string>
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `你是一個高級前端工程師。根據 Figma 節點資料生成 React + TypeScript 元件程式碼。
        要求：
        1. 使用 Tailwind CSS 或 CSS Modules，樣式值必須參考設計 Token
        2. 元件 props 要型別安全，包含必要的無障礙屬性
        3. 響應式佈局，遵循 Figma 的 Auto Layout 設定
        4. 不要硬編碼顏色值，必須使用 Token 參考
        輸出完整的 .tsx 檔案內容。`
      },
      {
        role: 'user',
        content: `Figma 節點資料:\n${JSON.stringify(figmaNode, null, 2)}\n\n設計 Token:\n${JSON.stringify(designTokens, null, 2)}`
      }
    ]
  });

  return response.choices[0].message.content!;
}
```

### 實際管道架構

一個完整的 Figma-to-Code 管道包含以下步驟：

```typescript
class DesignToCodePipeline {
  private figmaAPI: FigmaAPI;
  private tokenStore: TokenStore;
  private llmClient: LLMClient;

  async processFigmaFile(fileKey: string): Promise<ComponentPackage[]> {
    // 1. 從 Figma 取得設計檔案
    const figmaData = await this.figmaAPI.getFile(fileKey);

    // 2. 提取所有 Component 節點
    const components = this.extractComponents(figmaData);

    // 3. 為每個元件生成程式碼
    const packages: ComponentPackage[] = [];
    for (const component of components) {
      // 提取設計變數，匹配到已有 Token
      const matchedTokens = await this.matchTokens(component);

      // 生成元件程式碼
      const code = await this.llmClient.generateComponent(component, matchedTokens);

      // 自動生成測試
      const tests = await this.llmClient.generateTests(code, component);

      // 生成 Storybook story
      const story = await this.llmClient.generateStory(code, component);

      packages.push({ code, tests, story, figmaNodeId: component.id });
    }

    return packages;
  }

  private async matchTokens(node: FigmaNode): Promise<Record<string, string>> {
    // 將 Figma 中的原始樣式值對映到設計 Token
    const tokens: Record<string, string> = {};
    if (node.fills?.[0]?.color) {
      const hex = this.rgbToHex(node.fills[0].color);
      const tokenName = await this.tokenStore.findClosestToken(hex);
      tokens['background'] = tokenName;
    }
    return tokens;
  }
}
```

## 設計一致性自動化驗證

### AI 檢測設計偏離

元件程式碼生成後，最大的挑戰是長期維護中出現的「設計漂移」——開發者在迭代中引入了不在 Token 體系內的值。LLM 可以作為自動化的設計稽核工具：

```typescript
interface DesignViolation {
  file: string;
  line: number;
  type: 'color' | 'spacing' | 'font' | 'radius';
  actualValue: string;
  expectedToken: string;
  severity: 'error' | 'warning';
  suggestion: string;
}

async function auditDesignCompliance(
  sourceFiles: string[],
  designTokens: Record<string, string>
): Promise<DesignViolation[]> {
  const violations: DesignViolation[] = [];

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf-8');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `你是設計系統稽核專家。分析程式碼中的樣式值是否使用了設計 Token。
          檢查：
          1. 硬編碼的顏色值（hex, rgb, hsl）
          2. 硬編碼的間距值（px, rem）不在 Token 體系中
          3. 硬編碼的字體大小和字重
          4. 硬編碼的圓角值
          對每個違規輸出 JSON 物件。沒有違規時返回空陣列。`
        },
        {
          role: 'user',
          content: `檔案: ${file}\n程式碼:\n${content}\n\n設計 Token:\n${JSON.stringify(designTokens)}`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(response.choices[0].message.content!);
    violations.push(...result.violations);
  }

  return violations;
}
```

### 整合到 CI/CD

將設計稽核整合到 CI 管道中，可以在 PR 階段攔截設計偏離：

```yaml
# .github/workflows/design-audit.yml
name: Design System Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - name: Run Design Audit
        run: npx tsx scripts/design-audit.ts
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      - name: Annotate PR
        uses: actions/github-script@v7
        with:
          script: |
            const violations = require('./audit-result.json');
            for (const v of violations) {
              core.warning(
                `${v.type} violation: expected ${v.expectedToken}, got ${v.actualValue}. ${v.suggestion}`,
                { file: v.file, startLine: v.line }
              );
            }
```

## 建構實踐：AI 輔助的 Token 管理系統

以下是一個完整的 Token 管理系統核心，整合了 AI 生成、版本管理和 CI 驗證：

```typescript
// token-manager.ts
import { z } from 'zod';

const TokenSchema = z.object({
  name: z.string(),
  value: z.string(),
  type: z.enum(['color', 'spacing', 'font', 'shadow', 'radius', 'duration']),
  description: z.string().optional(),
});

const TokenGroupSchema = z.object({
  category: z.string(),
  tokens: z.array(TokenSchema),
});

class TokenManager {
  private tokens = new Map<string, z.infer<typeof TokenSchema>>();

  loadFromJSON(json: string) {
    const data = JSON.parse(json);
    const groups = z.array(TokenGroupSchema).parse(data);
    for (const group of groups) {
      for (const token of group.tokens) {
        this.tokens.set(token.name, token);
      }
    }
  }

  // 查找最接近的 Token
  findClosestToken(value: string): string | null {
    // 精確匹配
    for (const [name, token] of this.tokens) {
      if (token.value.toLowerCase() === value.toLowerCase()) {
        return name;
      }
    }
    // 近似匹配（顏色相似度計算）
    if (value.startsWith('#')) {
      return this.findClosestColor(value);
    }
    return null;
  }

  private findClosestColor(hex: string): string | null {
    const target = this.hexToLab(hex);
    let closest: { name: string; delta: number } | null = null;

    for (const [name, token] of this.tokens) {
      if (token.type !== 'color' || !token.value.startsWith('#')) continue;
      const candidate = this.hexToLab(token.value);
      const delta = this.deltaE(target, candidate);
      if (!closest || delta < closest.delta) {
        closest = { name, delta };
      }
    }

    return closest && closest.delta < 5 ? closest.name : null;
  }

  // CIE Lab 色差計算
  private hexToLab(hex: string): [number, number, number] {
    // hex → RGB → XYZ → Lab 轉換
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    // ... 完整的 Lab 轉換省略
    return [0, 0, 0]; // 簡化
  }

  private deltaE(lab1: number[], lab2: number[]): number {
    return Math.sqrt(
      lab1.reduce((sum, v, i) => sum + (v - lab2[i]) ** 2, 0)
    );
  }

  exportToCSS(): string {
    let css = ':root {\n';
    for (const [name, token] of this.tokens) {
      css += `  --${name}: ${token.value};\n`;
    }
    css += '}\n';
    return css;
  }

  exportToTailwind(): Record<string, string> {
    const config: Record<string, string> = {};
    for (const [name, token] of this.tokens) {
      config[name] = `var(--${name})`;
    }
    return config;
  }
}
```

## AI 生成程式碼的品質保障

LLM 生成的元件程式碼不能直接合入程式碼庫。需要建立一套人工審查流程：

1. **自動 lint**：ESLint + 設計系統自訂規則攔截硬編碼值
2. **型別檢查**：TypeScript 嚴格模式 + 元件 props 型別校驗
3. **視覺回歸測試**：自動截圖與 Figma 設計稿對比（使用 Playwright + pixelmatch）
4. **人工 Code Review**：資深工程師審查元件 API 設計和無障礙性
5. **A/B 測試**：AI 生成的元件與手寫元件在關鍵指標上對比

```typescript
// 自動化驗證管道
async function validateGeneratedComponent(
  componentCode: string,
  figmaNodeId: string
): Promise<ValidationReport> {
  const checks = await Promise.all([
    checkNoHardcodedValues(componentCode),
    checkAccessibility(componentCode),
    checkTokenType(componentCode),
    captureAndCompare(componentCode, figmaNodeId),
  ]);

  return {
    passed: checks.every(c => c.passed),
    checks,
  };
}

async function checkNoHardcodedValues(code: string) {
  // 正則檢測硬編碼的 hex/rgb 值
  const hexPattern = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/g;
  const matches = code.match(hexPattern);
  return {
    name: 'no-hardcoded-colors',
    passed: !matches,
    message: matches ? `發現硬編碼顏色: ${matches.join(', ')}` : '通過',
  };
}
```

## 優缺點分析與團隊協作模式

### 優勢

- **效率提升**：Token 體系生成從數小時縮短到分鐘級
- **一致性保證**：CI 整合的自動稽核有效阻止設計偏離
- **降低門檻**： junior 開發者也能產出符合規範的元件
- **文件同步**：AI 可以從 Token 和元件程式碼自動生成文件

### 局限

- **LLM 幻覺**：生成的 Token 值可能有細微偏差，需要人工校準
- **上下文限制**：大型設計系統的 Token 量可能超出 LLM 上下文視窗
- **成本**：頻繁呼叫 LLM API 的費用在小型團隊中可能不划算
- **創意約束**：AI 傾向於生成「安全」的方案，可能抑制設計創新

### 團隊協作模式

在實踐中效果較好的協作模式是「AI 生成 + 人工審核 + 自動化驗證」：

- **設計師**：定義品牌方向和關鍵設計 Token，審查 AI 生成的 Token 體系
- **AI Pipeline**：批次生成 Token 衍生值和元件程式碼骨架
- **資深開發**：審核元件 API 設計和架構合理性
- **CI 系統**：自動化驗證設計合規性，攔截偏離

這種模式不是用 AI 替代設計系統和前端工程，而是將機械性的工作自動化，讓人類專注於創造性的設計決策和架構設計。

## 小結

AI 在設計系統中的應用不是錦上添花，而是解決了一個長期存在的工程痛點——設計規範與程式碼實作之間的鴻溝。從 Token 推導到元件生成再到一致性驗證，LLM 提供了端到端的自動化能力。

但 AI 生成不是萬能的。在實際落地中，Token 校準的精度、元件 API 的合理性、無障礙性的保證——這些仍然需要人工判斷。AI 的價值在於將團隊從重複勞動中解放出來，集中精力在真正需要創造力的環節上。

設計系統的未來不是「AI 驅動」或「人工驅動」的二選一，而是人機協作的工程化體系。建構好這個體系的管道和流程，比追求單次生成的品質更重要。
