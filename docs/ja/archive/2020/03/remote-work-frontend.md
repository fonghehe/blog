---
title: "フロントエンドエンジニアのリモートワーク体験：ツールとマインドセット"
date: 2020-03-25 09:37:10
tags:
  - CSS
readingTime: 4
description: "三月初公司开始全员居家办公，这是我第一次长期远程工作。记录一下这一个多月的感受和工具实践。"
wordCount: 944
---

3 月初めに会社が全員在宅勤務へ切り替わり、これが私にとって初めての長期リモートワークとなった。この 1 ヶ月あまりの感想とツールの実践を書き留めておく。

## リモート協業ツール

**コミュニケーション**

- 飞书 / 钉钉：対面会議に取って代わり、ビデオの品質は意外によかった
- 非同期ドキュメント（Confluence / 飞书ドキュメント）：「ちょっと聞きたいことがある」という割り込みを減らせる

**コードの協業**

- GitLab + Merge Request：対面でのやり取りが減った分、Code Review のプロセスがこれまで以上に重要になる
- VSCode Live Share：ペアプログラミングの神ツール。編集をリアルタイムで共有でき（バグ発見時に特に役立つ）

```bash
# Live Share のインストール
code --install-extension ms-vsliveshare.vsliveshare

# 共有セッションを開始
# Ctrl+Shift+P → Live Share: Start Collaboration Session
# リンクを生成してチームメイトへ送り、相手はブラウザか VSCode で直接編集
```

**プロジェクト管理**

- Jira / 飞书プロジェクト：タスクの見える化。リモートではタスク管理により依存することになる
- 毎朝 15 分の朝会：3 つのことを話す（昨日やったこと・今日の予定・詰まりごと）

## ローカル開発環境の最適化

```bash
# ネットワーク問題：npm ミラー
npm config set registry https://registry.npm.taobao.org

# より良いターミナル：oh-my-zsh + starship
curl -fsSL https://starship.rs/install.sh | bash

# ~/.zshrc
eval "$(starship init zsh)"
alias gs="git status"
alias gp="git push"
alias gl="git log --oneline -20"

# プロセス管理：自動再起動
npm i -g pm2
pm2 start npm --name "dev-server" -- run dev
pm2 logs  # 查看日志
```

## VSCode設定の共有

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

  // CPU 占有を下げる（リモート時はノートが熱を持つため）
  "search.followSymlinks": false,
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/dist/**": true
  }
}
```

## 働くリズム

**毎日のルーティンを作ることが重要**

通勤がなくなると、仕事と休息の境界があいまいになりやすい。私のやり方は以下のとおり：

- 8:30 起床、机を片付け、「仕事着」に着替える
- 9:00 本格開始。まず今日のタスクをざっと確認
- 12:30 昼休みを強制（在宅だとかえって忘れがち）
- 18:00 仕事終わり。仕事用の Slack を閉じる

**ポモドーロテクニック**

```bash
# シンプルなターミナル用ポモドーロ
alias pomo='( sleep 1500 && notify-send "ポモドーロ終了、5分休憩！" ) &'
alias break='( sleep 300 && notify-send "休憩終了、再開！" ) &'
```

**会議を減らし、ドキュメントを増やす**

対面でのコミュニケーションはコストが低く、多くのことはその場で口頭ですませられた。リモートにしてからは「ちょっと話す」が会議になり、コストが高くなった。その分、より多くをドキュメントに書くよう迫られ、結果として良かった。

## かえって生産性が上がった

少し意外かもしれない感触を言うと、在宅勤務にしてから私のコードの産出がかえって 20〜30% 向上した。

その理由：

- オープンオフィスでは頻繁に割り込まれたが、在宅なら集中できる
- 通勤時間が学習時間になった
- 「頑張って見える」ことへのプレッシャーがなく、より成果主義になった

もちろん、同僚との対面ディスカッションが減るのは本当の損失で、オンラインでのコミュニケーションは対面より深みに欠ける。

## まとめ

- リモートワーク：非同期ドキュメント ＞ 会議。タスクの見える化は報告より効果的
- VSCode Live Share は最高のペアプロツール
- 仕事と生活の境界は自然にできるのを待たず、自ら作るもの
- Code Review・ドキュメント・インターフェースの取り決めをあらかじめ標準化しておけば、リモート協業はよりスムーズになる
