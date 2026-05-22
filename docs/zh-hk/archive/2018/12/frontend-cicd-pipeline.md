---
title: "前端 CI/CD 流水線設計與實踐：落地路徑與實戰建議"
date: 2018-12-10 15:45:41
tags:
  - 工程化
readingTime: 3
description: "今年把公司項目的部署流程做了一次大升級，從原來的手動 FTP 上傳，到現在的全自動 CI/CD。記錄一下整個過程。"
wordCount: 465
---

今年把公司項目的部署流程做了一次大升級，從原來的手動 FTP 上傳，到現在的全自動 CI/CD。記錄一下整個過程。

## 我們之前的部署流程

```
寫代碼 → npm run build → FTP 上傳 dist → 登錄服務器重啓
```

問題：

- 手動操作容易出錯（上傳錯了、忘記重啓）
- 沒有測試環節，代碼直接上線
- 發版時間不固定，半夜也可能需要操作
- 回滾困難

## 目標流程

```
git push → 自動跑測試 → 自動構建 → 自動部署 → 通知
```

## 選擇 CI 工具

市面上主要選項：

- **Jenkins**：功能最強，但設定複雜，需要自己維護服務器
- **GitLab CI**：和 GitLab 深度集成，配置簡單，免費
- **GitHub Actions**：2018年10月剛開放測試，很有潛力
- **Travis CI**：開源項目免費，私有項目收費

我們用的是 GitLab，所以選了 GitLab CI。

## GitLab CI 設定

### `.gitlab-ci.yml`

```yaml
# GitLab CI 設定檔案，放在項目根目錄
stages:
  - test # 測試階段
  - build # 構建階段
  - deploy # 部署階段

variables:
  NODE_VERSION: "10.x"

# 使用緩存加速依賴安裝
cache:
  paths:
    - node_modules/

# 測試
test:
  stage: test
  image: node:10-alpine
  script:
    - npm ci
    - npm run lint # 代碼規範檢查
    - npm run test:unit # 單元測試
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  only:
    - merge_requests # 隻在 MR 時運行測試
    - main

# 構建
build:staging:
  stage: build
  image: node:10-alpine
  script:
    - npm ci
    - npm run build:staging # 使用 staging 環境變量構建
  artifacts:
    paths:
      - dist/ # 保存構建產物
    expire_in: 1 hour
  only:
    - develop # develop 分支推送時自動構建

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
    - main # main 分支推送時自動構建

# 部署到測試環境
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

# 部署到生產環境（需要手動觸發）
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
    # 部署完清除 CDN 緩存
    - curl -X POST "$CDN_PURGE_URL" -H "Authorization: Bearer $CDN_TOKEN"
  environment:
    name: production
    url: https://www.example.com
  when: manual # 手動觸發，避免意外自動部署到生產
  only:
    - main
```

### package.json 中的構建腳本

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

## 環境變量管理

```
項目根目錄：
├── .env                  # 所有環境共用（不包含密鑰）
├── .env.staging          # staging 環境
├── .env.production       # 生產環境
└── .env.local            # 本地開發（不提交 git）
```

```bash
# .env（基礎設定）
VUE_APP_VERSION=$npm_package_version

# .env.staging
VUE_APP_ENV=staging
VUE_APP_API_BASE_URL=https://api.staging.example.com

# .env.production
VUE_APP_ENV=production
VUE_APP_API_BASE_URL=https://api.example.com
```

真正的密鑰（數據庫連接、第三方 API Key）放在 GitLab 的 CI 變量裏，不提交到代碼庫。

## 部署通知

部署成功/失敗時發送釘釘通知：

```yaml
# 在 .gitlab-ci.yml 中添加通知步驟
notify:success:
  stage: deploy
  script:
    - |
      curl -X POST "$DINGTALK_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{
          \"msgtype\": \"text\",
          \"text\": {
            \"content\": \"✅ $CI_PROJECT_NAME 部署成功\\n分支: $CI_COMMIT_BRANCH\\n提交: $CI_COMMIT_SHORT_SHA\\n操作人: $GITLAB_USER_NAME\"
          }
        }"
  when: on_success
  only:
    - main
```

## 回滾方案

GitLab CI 保留了每次的構建產物（artifact），回滾時可以：

1. 在 GitLab 界面找到上一次成功的 pipeline
2. 點擊 `deploy:production` job 重新觸發
3. 也可以 `git revert` 回滾代碼，觸發新的 pipeline

## 效果

上線 3 個月：

- 部署時間從 15 分鐘（手動）→ 3 分鐘（自動）
- 生產故障因配置錯誤導致的次數：0
- 開發心智負擔降低：專注寫代碼，不用操心怎麼部署

## 小結

- GitLab CI 配置直觀，和代碼庫深度集成
- 測試、構建、部署分三階段，清晰隔離
- 生產部署設置 `when: manual`，避免意外自動上線
- 密鑰通過 CI 變量管理，不放在代碼裏
- 構建產物保留，方便回滾
