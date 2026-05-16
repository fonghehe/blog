---
title: "Frontend CI/CD Pipeline Design and Practice"
date: 2018-12-10 15:45:41
tags:
  - Engineering
readingTime: 2
description: "This year I gave our company's deployment process a major upgrade — from manual FTP uploads to fully automated CI/CD. Here's the complete story."
---

This year I gave our company's deployment process a major upgrade — from manual FTP uploads to fully automated CI/CD. Here's the complete story.

## Our Previous Deployment Process

```
Write code → npm run build → FTP upload dist → SSH in and restart
```

Problems:

- Manual steps led to mistakes (wrong files uploaded, forgetting to restart)
- No testing step; code went straight to production
- Release times unpredictable; sometimes 2 AM
- Rollback was painful

## Target Process

```
git push → tests run automatically → build automatically → deploy automatically → notify
```

## Choosing a CI Tool

Main options on the market:

- **Jenkins**: Most powerful, but complex config and requires managing your own server
- **GitLab CI**: Deeply integrated with GitLab, simple config, free
- **GitHub Actions**: Opened in beta in October 2018, very promising
- **Travis CI**: Free for open source, paid for private repos

We use GitLab, so GitLab CI was the natural choice.

## GitLab CI Configuration

### `.gitlab-ci.yml`

```yaml
# GitLab CI config file — place in project root
stages:
  - test # Testing stage
  - build # Build stage
  - deploy # Deploy stage

variables:
  NODE_VERSION: "10.x"

# Cache to speed up dependency installs
cache:
  paths:
    - node_modules/

# Tests
test:
  stage: test
  image: node:10-alpine
  script:
    - npm ci
    - npm run lint # Code style check
    - npm run test:unit # Unit tests
  coverage: '/Lines\s*:\s*(\d+\.?\d*)%/'
  only:
    - merge_requests # Only run tests on MRs
    - main

# Staging build
build:staging:
  stage: build
  image: node:10-alpine
  script:
    - npm ci
    - npm run build:staging # Build with staging env vars
  artifacts:
    paths:
      - dist/ # Save build artifacts
    expire_in: 1 hour
  only:
    - develop # Auto-build on develop branch push

# Production build
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
    - main # Auto-build on main branch push

# Deploy to staging
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

# Deploy to production (manual trigger required)
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
    # Clear CDN cache after deploy
    - curl -X POST "$CDN_PURGE_URL" -H "Authorization: Bearer $CDN_TOKEN"
  environment:
    name: production
    url: https://www.example.com
  when: manual # Manual trigger to prevent accidental auto-deploy to production
  only:
    - main
```

### Build Scripts in package.json

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

## Environment Variable Management

```
Project root:
├── .env                  # Shared across all environments (no secrets)
├── .env.staging          # Staging environment
├── .env.production       # Production environment
└── .env.local            # Local development (not committed to git)
```

```bash
# .env (base config)
VUE_APP_VERSION=$npm_package_version

# .env.staging
VUE_APP_ENV=staging
VUE_APP_API_BASE_URL=https://api.staging.example.com

# .env.production
VUE_APP_ENV=production
VUE_APP_API_BASE_URL=https://api.example.com
```

Real secrets (database connections, third-party API keys) go in GitLab's CI variables — never committed to the repository.

## Deployment Notifications

Send DingTalk notifications on success/failure:

```yaml
# Add a notification step to .gitlab-ci.yml
notify:success:
  stage: deploy
  script:
    - |
      curl -X POST "$DINGTALK_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d "{
          \"msgtype\": \"text\",
          \"text\": {
            \"content\": \"✅ $CI_PROJECT_NAME deployed successfully\\nBranch: $CI_COMMIT_BRANCH\\nCommit: $CI_COMMIT_SHORT_SHA\\nBy: $GITLAB_USER_NAME\"
          }
        }"
  when: on_success
  only:
    - main
```

## Summary

- Before: write → build → FTP upload → SSH restart — error-prone and slow
- After: `git push` triggers the whole pipeline automatically
- GitLab CI integrates seamlessly with GitLab repos; `.gitlab-ci.yml` is clear and simple
- Production deploys are manually triggered to prevent accidents
- Sensitive environment variables live in GitLab CI variables, not in source code
