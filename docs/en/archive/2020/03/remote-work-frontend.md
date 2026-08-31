---
title: "Remote Work Experience for Frontend Developers: Tools and Mindset"
date: 2020-03-25 09:37:10
tags:
  - CSS
readingTime: 2
description: "In early March the company moved everyone to working from home—my first experience with long-term remote work. These are my reflections and tooling notes from the past month or so."
wordCount: 369
---

In early March the company moved everyone to working from home, and this was my first experience with long-term remote work. These are my notes on how it's felt and the tooling I've settled on over the past month or so.

## Remote Collaboration Tools

**沟通**

- Feishu/DingTalk: replaced in-person meetings, and the video quality was surprisingly good.
- Async docs (Confluence/Feishu Docs): cut down on the "let me ask you a quick question" interruptions.

**代码协作**

- GitLab + Merge Requests: code review matters more now that we talk face-to-face less.
- VSCode Live Share: a game-changer for pair programming—real-time shared editing (especially handy when tracking down bugs).

```bash
# 安装 Live Share
code --install-extension ms-vsliveshare.vsliveshare

# 开始共享会话
# Ctrl+Shift+P → Live Share: Start Collaboration Session
# 生成链接发给队友，对方直接在浏览器或 VSCode 里编辑
```

**项目管理**

- Jira/Feishu Projects: task transparency; remote work leans much harder on task tracking.
- Daily 15-minute standup: three things—what I did yesterday, today's plan, and any blockers.

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

## Work Rhythm

**A daily sense of ritual matters**

Without a commute, it's easy to lose the boundary between work and rest. My approach:

- 8:30 — get up, tidy the desk, change into "work clothes."
- 9:00 — start properly, reviewing today's tasks first.
- 12:30 — take a forced lunch break (easy to forget at home).
- 18:00 — wrap up and close the work Slack.

**Pomodoro Technique**

```bash
# 简单的终端番茄钟
alias pomo='( sleep 1500 && notify-send "番茄时间到，休息 5 分钟！" ) &'
alias break='( sleep 300 && notify-send "休息结束，继续！" ) &'
```

**Fewer Meetings, More Documentation**

In-person communication is cheap, and a lot of things got settled by a quick chat. Once remote, those "quick chats" turn into meetings, which are far costlier. That pressure pushes more things into writing—which is actually a good thing.

## Productivity Actually Improved

Here's a possibly surprising observation: my code output actually went up 20–30% after moving to working from home.

Reasons:

- Open-plan offices are full of interruptions; at home I can focus.
- Commute time becomes learning time.
- There's no pressure to "look busy," so the work is more results-oriented.

Of course, losing face-to-face discussion with colleagues is a real loss—online communication simply doesn't go as deep as in person.

## Summary

- Remote work: async docs beat meetings, and task transparency beats status reporting.
- VSCode Live Share is the best pair-programming tool.
- Work-life boundaries have to be built deliberately, not left to chance.
- Nail down the workflow early (code review, docs, interface contracts) and remote collaboration gets much smoother.
