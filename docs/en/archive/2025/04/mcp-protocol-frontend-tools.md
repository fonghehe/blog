---
title: "MCP Protocol: Bridging Frontend Toolchains"
date: 2025-04-05 10:00:00
tags:
  - Frontend
readingTime: 2
description: "MCP (Model Context Protocol) is becoming the standard protocol between AI and tools. Let's talk about how frontend engineers can leverage MCP to boost developme"
wordCount: 143
---

MCP (Model Context Protocol) is becoming the standard protocol between AI and tools. Let's talk about how frontend engineers can leverage MCP to boost development efficiency.

## What is MCP

```
MCP = Model Context Protocol

Essence: enables AI models to safely call external tools and data sources
Analogy: like how APIs serve web apps, MCP serves AI models

Supporters: Anthropic (Claude), major IDEs, dev tools
```

## MCP Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  AI Model   │────▶│  MCP Client │────▶│  MCP Server │
│  (Claude)   │◀────│  (IDE/CLI)  │◀────│  (Tool)     │
└─────────────┘     └─────────────┘     └─────────────┘

MCP Server provides:
  - Resources: data sources (files, databases, APIs)
  - Tools: executable operations
  - Prompts: preset prompt templates
```

## Hands-On: Building a Figma MCP Server

```ts
// figma-mcp-server.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server(
  { name: "figma-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

// 注册工具：获取 Figma 设计稿信息
server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "get_figma_file",
      description: "获取 Figma 文件的结构和组件信息",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string", description: "Figma 文件 key" },
          nodeId: { type: "string", description: "节点 ID（可选）" },
        },
        required: ["fileKey"],
      },
    },
    {
      name: "export_figma_assets",
      description: "导出 Figma 中的图标和图片资源",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string" },
          format: { type: "string", enum: ["svg", "png", "jpg"] },
          scale: { type: "number", default: 1 },
        },
        required: ["fileKey", "format"],
      },
    },
  ],
}));

// 处理工具调用
server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_figma_file") {
    const response = await fetch(
      `https://api.figma.com/v1/files/${args.fileKey}`,
      {
        headers: { "X-Figma-Token": process.env.FIGMA_TOKEN! },
      },
    );
    const data = await response.json();
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

// 启动服务
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Hands-On: Frontend Project Analysis MCP Server

```ts
// project-analyzer-mcp.ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { glob } from "glob";
import fs from "fs/promises";

const server = new Server(
  { name: "project-analyzer", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "analyze_dependencies",
      description: "分析项目依赖关系和未使用的包",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
        },
        required: ["projectRoot"],
      },
    },
    {
      name: "find_unused_exports",
      description: "查找未被引用的导出",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
          pattern: { type: "string", default: "src/**/*.{ts,tsx}" },
        },
        required: ["projectRoot"],
      },
    },
    {
      name: "component_usage_report",
      description: "生成组件使用频率报告",
      inputSchema: {
        type: "object",
        properties: {
          projectRoot: { type: "string" },
        },
        required: ["projectRoot"],
      },
    },
  ],
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "analyze_dependencies") {
    const pkgJson = JSON.parse(
      await fs.readFile(`${args.projectRoot}/package.json`, "utf-8"),
    );
    const allFiles = await glob(`${args.projectRoot}/src/**/*.{ts,tsx}`);
    const imports = new Set<string>();

    for (const file of allFiles) {
      const content = await fs.readFile(file, "utf-8");
      const matches = content.matchAll(/from ['"]([^'"]+)['"]/g);
      for (const match of matches) {
        if (!match[1].startsWith(".") && !match[1].startsWith("@/")) {
          imports.add(
            match[1]
              .split("/")
              .slice(0, match[1].startsWith("@") ? 2 : 1)
              .join("/"),
          );
        }
      }
    }

    const deps = Object.keys(pkgJson.dependencies || {});
    const unused = deps.filter((d) => !imports.has(d));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ used: [...imports], unused }, null, 2),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Configuring MCP in Claude Code

```json
// .claude/mcp.json
{
  "mcpServers": {
    "figma": {
      "command": "node",
      "args": ["./mcp-servers/figma-mcp-server.js"],
      "env": {
        "FIGMA_TOKEN": "${FIGMA_TOKEN}"
      }
    },
    "project-analyzer": {
      "command": "node",
      "args": ["./mcp-servers/project-analyzer.js"]
    }
  }
}
```

Once configured, you can tell Claude Code directly: "Help me analyze this project's dependency usage," and the AI will automatically call the MCP tools.

## Summary

- MCP is the standardized protocol for AI tool calls, solving the "how does AI access external tools" problem
- Frontend toolchains (Figma, ESLint, test frameworks) can all be wrapped as MCP Servers
- Claude Code natively supports MCP with a simple configuration
- The barrier to building your own MCP Server is low; the SDK handles most of the heavy lifting
- In 2025, the MCP ecosystem is expanding rapidly—worth keeping an eye on
