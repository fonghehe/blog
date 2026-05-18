---
title: "前端 CI/CD 流水线设计与实践"
date: 2018-12-10 15:45:41
tags:
  - 工程化
readingTime: 3
description: "今年把公司项目的部署流程做了一次大升级，从原来的手动 FTP 上传，到现在的全自动 CI/CD。记录一下整个过程。"
---

今年把公司项目的部署流程做了一次大升级，从原来的手动 FTP 上传，到现在的全自动 CI/CD。记录一下整个过程。

## 我们之前的部署流程

```
写代码 → npm run build → FTP 上传 dist → 登录服务器重启
```

问题：

- 手动操作容易出错（上传错了、忘记重启）
- 没有测试环节，代码直接上线
- 发版时间不固定，半夜也可能需要操作
- 回滚困难

## 目标流程

```
git push → 自动跑测试 → 自动构建 → 自动部署 → 通知
```

## 选择 CI 工具

市面上主要选项：

- **Jenkins**：功能最强，但配置复杂，需要自己维护服务器
- **GitLab CI**：和 GitLab 深度集成，配置简单，免费
- **GitHub Actions**：2018年10月刚开放测试，很有潜力
- **Travis CI**：开源项目免费，私有项目收费

我们用的是 GitLab，所以选了 GitLab CI。

## GitLab CI 配置

### `.gitlab-ci.yml`

```yaml
# GitLab CI 配置文件，放在项目根目录
stages:
  - test # 测试阶段
  - build # 构建阶段
  - deploy # 部署阶段

variables:
  NODE_VERSION: "10.x"

# 使用缓存加速依赖安装
cache:
  paths:
    - node_modules/

# 测试
test:
  stage: test
  image: node:10-alpine
  script:
    - npm ci
    - npm run lint # 代码规范检查
    - npm run test:unit # 单元测试
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  only:
    - merge_requests # 只在 MR 时运行测试
    - main

# 构建
build:staging:
  stage: build
  image: node:10-alpine
  script:
    - npm ci
    - npm run build:staging # 使用 staging 环境变量构建
  artifacts:
    paths:
      - dist/ # 保存构建产物
    expire_in: 1 hour
  only:
    - develop # develop 分支推送时自动构建

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
    - main # main 分支推送时自动构建

# 部署到测试环境
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

# 部署到生产环境（需要手动触发）
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
    # 部署完清除 CDN 缓存
    - curl -X POST "$CDN_PURGE_URL" -H "Authorization: Bearer $CDN_TOKEN"
  environment:
    name: production
    url: https://www.example.com
  when: manual # 手动触发，避免意外自动部署到生产
  only:
    - main
```

### package.json 中的构建脚本

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

## 环境变量管理

```
项目根目录：
├── .env                  # 所有环境共用（不包含密钥）
├── .env.staging          # staging 环境
├── .env.production       # 生产环境
└── .env.local            # 本地开发（不提交 git）
```

```bash
# .env（基础配置）
VUE_APP_VERSION=$npm_package_version

# .env.staging
VUE_APP_ENV=staging
VUE_APP_API_BASE_URL=https://api.staging.example.com

# .env.production
VUE_APP_ENV=production
VUE_APP_API_BASE_URL=https://api.example.com
```

真正的密钥（数据库连接、第三方 API Key）放在 GitLab 的 CI 变量里，不提交到代码库。

## 部署通知

部署成功/失败时发送钉钉通知：

```yaml
# 在 .gitlab-ci.yml 中添加通知步骤
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

## 回滚方案

GitLab CI 保留了每次的构建产物（artifact），回滚时可以：

1. 在 GitLab 界面找到上一次成功的 pipeline
2. 点击 `deploy:production` job 重新触发
3. 也可以 `git revert` 回滚代码，触发新的 pipeline

## 效果

上线 3 个月：

- 部署时间从 15 分钟（手动）→ 3 分钟（自动）
- 生产故障因配置错误导致的次数：0
- 开发心智负担降低：专注写代码，不用操心怎么部署

## 小结

- GitLab CI 配置直观，和代码库深度集成
- 测试、构建、部署分三阶段，清晰隔离
- 生产部署设置 `when: manual`，避免意外自动上线
- 密钥通过 CI 变量管理，不放在代码里
- 构建产物保留，方便回滚
