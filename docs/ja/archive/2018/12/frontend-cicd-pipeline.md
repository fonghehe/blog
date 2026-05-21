---
title: "フロントエンド CI/CD パイプラインの設計と実践"
date: 2018-12-10 15:45:41
tags:
  - エンジニアリング
readingTime: 3
description: "今年、会社プロジェクトのデプロイフローを大幅にアップグレードしました。手動 FTP アップロードから完全自動化された CI/CD へ。その過程を記録します。"
wordCount: 536
---

今年、会社プロジェクトのデプロイフローを大幅にアップグレードしました。手動 FTP アップロードから完全自動化された CI/CD へ。その過程を記録します。

## 以前のデプロイフロー

```
コードを書く → npm run build → FTP で dist をアップロード → サーバーにログインして再起動
```

問題点：

- 手動操作でミスが起きやすい（アップロードを間違える、再起動を忘れる）
- テストなしでコードが直接リリースされる
- リリース時間が不定で、深夜に作業が必要になることも
- ロールバックが困難

## 目標とするフロー

```
git push → 自動でテスト実行 → 自動でビルド → 自動でデプロイ → 通知
```

## CI ツールの選択

主な選択肢：

- **Jenkins**：機能が最も充実しているが、設定が複雑でサーバーの維持が必要
- **GitLab CI**：GitLab と深く統合されていて、設定が簡単で無料
- **GitHub Actions**：2018年10月にベータ公開。将来性がある
- **Travis CI**：オープンソースプロジェクトは無料、プライベートリポジトリは有料

私たちは GitLab を使っているので GitLab CI を選びました。

## GitLab CI の設定

### `.gitlab-ci.yml`

```yaml
# GitLab CI の設定ファイル。プロジェクトのルートに配置
stages:
  - test # テストフェーズ
  - build # ビルドフェーズ
  - deploy # デプロイフェーズ

variables:
  NODE_VERSION: "10.x"

# キャッシュで依存関係のインストールを高速化
cache:
  paths:
    - node_modules/

# テスト
test:
  stage: test
  image: node:10-alpine
  script:
    - npm ci
    - npm run lint # コード規則チェック
    - npm run test:unit # 単体テスト
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  only:
    - merge_requests # MR 時にのみテストを実行
    - main

# ビルド
build:staging:
  stage: build
  image: node:10-alpine
  script:
    - npm ci
    - npm run build:staging # ステージング環境変数でビルド
  artifacts:
    paths:
      - dist/ # ビルド成果物を保存
    expire_in: 1 hour
  only:
    - develop # develop ブランチへのプッシュ時に自動ビルド

build:production:
  stage: build
  image: node:10-alpine
  script:
    - npm ci
    - npm run build:production
  artifacts:
    paths:
      - dist/
    expire_in: 1 day
  only:
    - main # main ブランチへのプッシュ時に自動ビルド

# ステージング環境へのデプロイ
deploy:staging:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client rsync
    - eval $(ssh-agent -s)
    - echo "$STAGING_SSH_PRIVATE_KEY" | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$STAGING_SSH_HOST_KEY" >> ~/.ssh/known_hosts
  script:
    - rsync -avz --delete dist/ $STAGING_USER@$STAGING_HOST:/var/www/html/
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

# 本番環境へのデプロイ（手動トリガー）
deploy:production:
  stage: deploy
  image: alpine:latest
  before_script:
    - apk add --no-cache openssh-client rsync
    - eval $(ssh-agent -s)
    - echo "$PROD_SSH_PRIVATE_KEY" | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - echo "$PROD_SSH_HOST_KEY" >> ~/.ssh/known_hosts
  script:
    - rsync -avz --delete dist/ $PROD_USER@$PROD_HOST:/var/www/html/
    # デプロイ後に CDN キャッシュをクリア
    - curl -X POST "$CDN_PURGE_URL" -H "Authorization: Bearer $CDN_TOKEN"
  environment:
    name: production
    url: https://www.example.com
  when: manual # 手動トリガー。本番への意図しない自動デプロイを防ぐ
  only:
    - main
```

### package.json のビルドスクリプト

```json
{
  "scripts": {
    "build": "vue-cli-service build",
    "build:staging": "VUE_APP_ENV=staging vue-cli-service build",
    "build:production": "VUE_APP_ENV=production vue-cli-service build",
    "test:unit": "vue-cli-service test:unit --coverage",
    "lint": "vue-cli-service lint"
  }
}
```

## 環境変数の管理

```
プロジェクトルート：
├── .env                  # 全環境共通（秘密情報なし）
├── .env.staging          # ステージング環境
├── .env.production       # 本番環境
└── .env.local            # ローカル開発（git にコミットしない）
```

```bash
# .env（基本設定）
VUE_APP_VERSION=$npm_package_version

# .env.staging
VUE_APP_ENV=staging
VUE_APP_API_BASE_URL=https://api.staging.example.com

# .env.production
VUE_APP_ENV=production
VUE_APP_API_BASE_URL=https://api.example.com
```

本当の秘密情報（データベース接続、サードパーティ API キー）は GitLab の CI 変数に保存し、コードリポジトリにはコミットしません。

## デプロイ通知

デプロイの成功/失敗時に通知を送信：

```yaml
# .gitlab-ci.yml に通知ステップを追加
notify:success:
  stage: deploy
  script:
    - |
      curl -X POST "$WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d "{
          \"msgtype\": \"text\",
          \"text\": {
            \"content\": \"✅ $CI_PROJECT_NAME デプロイ成功\\nブランチ: $CI_COMMIT_BRANCH\\nコミット: $CI_COMMIT_SHORT_SHA\\n実行者: $GITLAB_USER_NAME\"
          }
        }"
  when: on_success
  only:
    - main
```

## まとめ

- 手動デプロイから自動 CI/CD へ：エラーが減り、リリースの信頼性が上がる
- テスト → ビルド → デプロイの3段階フロー
- 本番デプロイは `when: manual` で手動トリガーにして安全性を確保
- 環境変数はコードに含めず CI 変数で管理
- デプロイ通知でチーム全体がリリース状況をリアルタイムで把握できる
