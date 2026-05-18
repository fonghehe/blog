---
title: "遠程工作的前端開發體驗：工具與心態"
date: 2020-03-25 09:37:10
tags:
  - CSS
readingTime: 2
description: "三月初公司開始全員居家辦公，這是我第一次長期遠程工作。記錄一下這一個多月的感受和工具實踐。"
---

三月初公司開始全員居家辦公，這是我第一次長期遠程工作。記錄一下這一個多月的感受和工具實踐。

## 遠程協作工具

**溝通**

- 飛書/釘釘：取代了線下會議，視頻效果出乎意料地好
- 異步文檔（Confluence/飛書文檔）：減少"我問你一個問題"的打斷

**代碼協作**

- GitLab + Merge Request：Code Review 流程更重要了，因為少了當面溝通
- VSCode Live Share：結對編程神器，可以實時共享編輯（發現 bug 時特別有用）

```bash
# 安裝 Live Share
code --install-extension ms-vsliveshare.vsliveshare

# 開始共享會話
# Ctrl+Shift+P → Live Share: Start Collaboration Session
# 生成鏈接發給隊友，對方直接在瀏覽器或 VSCode 裏編輯
```

**項目管理**

- Jira/飛書項目：任務透明化，遠程更依賴任務跟蹤
- 每天早會 15 分鐘：説三件事（昨天做了什麼、今天計劃、有什麼阻塞）

## 本地開發環境優化

```bash
# 網絡問題：npm 鏡像
npm config set registry https://registry.npm.taobao.org

# 更好的終端：oh-my-zsh + starship
curl -fsSL https://starship.rs/install.sh | bash

# ~/.zshrc
eval "$(starship init zsh)"
alias gs="git status"
alias gp="git push"
alias gl="git log --oneline -20"

# 進程管理：自動重啓
npm i -g pm2
pm2 start npm --name "dev-server" -- run dev
pm2 logs  # 查看日誌
```

## VSCode 配置分享

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

  // 減少 CPU 佔用（遠程時筆記本發熱）
  "search.followSymlinks": false,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

## 工作節奏

**每天的儀式感很重要**

沒有了通勤，容易失去工作和休息的邊界。我的做法：

- 8:30 起牀，整理桌面，換上"工作服"
- 9:00 正式開始，先看一遍今天的任務
- 12:30 強制午休（在家反而容易忘記）
- 18:00 收工，關掉工作用的 Slack

**番茄鍾**

```bash
# 簡單的終端番茄鍾
alias pomo='( sleep 1500 && notify-send "番茄時間到，休息 5 分鐘！" ) &'
alias break='( sleep 300 && notify-send "休息結束，繼續！" ) &'
```

**減少會議，增加文檔**

線下溝通成本低，很多事情可以當面説説就解決了。遠程後，"説説"變成會議，代價高了。倒逼着把更多東西寫成文檔，反而是好事。

## 效率反而提升了

説個可能讓人意外的感受：我的代碼產出在居家辦公後反而提升了 20-30%。

原因：

- 開放式辦公室經常被打斷，居家可以專注
- 通勤時間變成學習時間
- 沒有"看上去在努力"的壓力，更結果導向

當然，缺少同事面對面討論是真正的損失，線上溝通的深度不如線下。

## 小結

- 遠程工作：異步文檔 > 開會，任務透明化比彙報更有效
- VSCode Live Share 是最好的結對編程工具
- 工作生活邊界要主動建立，而不是自然形成
- 提前規範化工作流（Code Review、文檔、接口約定），遠程協作會更順
