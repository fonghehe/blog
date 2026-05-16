---
title: "Remote Work Experience for Frontend Developers: Tools and Mindset"
date: 2020-03-25 09:37:10
tags:
  - CSS
readingTime: 2
description: "三月初公司开始全员居家办公，这是我第一次长期远程工作。记录一下这一个多月的感受和工具实践。"
---

三月初公司开始全员居家办公，这是我第一次长期远程工作。记录一下这一个多月的感受和工具实践。

## Remote Collaboration Tools

**沟通**

- 飞书/钉钉：取代了线下会议，视频效果出乎意料地好
- 异步文档（Confluence/飞书文档）：减少"我问你一个问题"的打断

**代码协作**

- GitLab + Merge Request：Code Review 流程更重要了，因为少了当面沟通
- VSCode Live Share：结对编程神器，可以实时共享编辑（发现 bug 时特别有用）

```bash
# 安装 Live Share
code --install-extension ms-vsliveshare.vsliveshare

# 开始共享会话
# Ctrl+Shift+P → Live Share: Start Collaboration Session
# 生成链接发给队友，对方直接在浏览器或 VSCode 里编辑
```

**项目管理**

- Jira/飞书项目：任务透明化，远程更依赖任务跟踪
- 每天早会 15 分钟：说三件事（昨天做了什么、今天计划、有什么阻塞）

## Local Development Environment Optimization

```bash
# 网络问题：npm 镜像
npm config set registry https://registry.npm.taobao.org

# 更好的终端：oh-my-zsh + starship
curl -fsSL https://starship.rs/install.sh | bash

# ~/.zshrc
eval "$(starship init zsh)"
alias gs="git status"
alias gp="git push"
alias gl="git log --oneline -20"

# 进程管理：自动重启
npm i -g pm2
pm2 start npm --name "dev-server" -- run dev
pm2 logs  # 查看日志
```

## VSCode Configuration Sharing

```json
// settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.fontSize": 14,
  "editor.lineHeight": 24,
  "editor.fontFamily": "JetBrains Mono, Fira Code, monospace",
  "editor.fontLigatures": true,
  "terminal.integrated.fontFamily": "JetBrains Mono",

  // 减少 CPU 占用（远程时笔记本发热）
  "search.followSymlinks": false,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

## 工作节奏

**每天的仪式感很重要**

没有了通勤，容易失去工作和休息的边界。我的做法：

- 8:30 起床，整理桌面，换上"工作服"
- 9:00 正式开始，先看一遍今天的任务
- 12:30 强制午休（在家反而容易忘记）
- 18:00 收工，关掉工作用的 Slack

**番茄钟**

```bash
# 简单的终端番茄钟
alias pomo='( sleep 1500 && notify-send "番茄时间到，休息 5 分钟！" ) &'
alias break='( sleep 300 && notify-send "休息结束，继续！" ) &'
```

**减少会议，增加文档**

线下沟通成本低，很多事情可以当面说说就解决了。远程后，"说说"变成会议，代价高了。倒逼着把更多东西写成文档，反而是好事。

## 效率反而提升了

说个可能让人意外的感受：我的代码产出在居家办公后反而提升了 20-30%。

原因：

- 开放式办公室经常被打断，居家可以专注
- 通勤时间变成学习时间
- 没有"看上去在努力"的压力，更结果导向

当然，缺少同事面对面讨论是真正的损失，线上沟通的深度不如线下。

## Summary

- 远程工作：异步文档 > 开会，任务透明化比汇报更有效
- VSCode Live Share 是最好的结对编程工具
- 工作生活边界要主动建立，而不是自然形成
- 提前规范化工作流（Code Review、文档、接口约定），远程协作会更顺
