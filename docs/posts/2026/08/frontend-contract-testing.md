---
title: "前端契约测试：用 Consumer-Driven Contract 终结 API 漂移"
date: 2026-08-25 09:26:47
tags:
  - 测试
readingTime: 8
description: "当 mock 单元测试和手动集成测试反复漏掉后端接口变更时，Consumer-Driven Contract Testing 把契约定义权交给前端。本文从 Pact 和 OpenAPI 两条路线出发，记录一个 4 前端共享 BFF 团队的落地过程、踩坑与收益。"
wordCount: 1896
---

我们团队有四个前端应用（管理后台、C 端 H5、小程序、运营工具）共用一套 BFF。过去两年里，线上事故中大约有三分之一是"前端以为字段还在，后端已经改了"造成的。Mock 数据写死在单元测试里，跑过；集成测试靠人工点对接文档，也过了；上线才发现白屏。问题不是测试不够多，而是测试验证的东西和真实契约不一致。

Consumer-Driven Contract Testing（CDCT）的核心思路是把契约的定义权从后端挪到前端——谁消费 API，谁来声明期望的交互格式，后端在 CI 中验证自己是否满足这些期望。这不是替代现有测试，而是在单元测试和 E2E 之间补一层专门抓接口漂移的安全网。

## 为什么 Mock 和手动对接不够用

Mock 的问题不在于它假，而在于它不会自动更新。后端把 `user.avatar` 改成 `user.avatarUrl`，前端的 mock 文件没人改，单元测试照样绿。等联调或上线才暴露。

手动对接依赖人记得去查文档、比对字段。四个前端各自维护一份心智模型，BFF 每次发版要通知四拨人。漏掉任何一个就是事故。

| 检测手段 | 能抓到什么 | 抓不到什么 |
|---------|-----------|-----------|
| Mock 单元测试 | 组件逻辑、状态流转 | API 结构变更、字段重命名 |
| 手动联调 | 当前版本的兼容问题 | 下一次发布的破坏性变更 |
| E2E 测试 | 完整用户流程 | 非核心路径的接口变更 |
| 契约测试 | 接口结构、字段类型、必填项变更 | 业务逻辑错误 |

契约测试填补的是"接口结构一致性"这个特定缺口。它不验证业务对不对，只验证双方对数据格式的约定有没有被打破。

## Pact：Consumer 定义契约，Provider 验证

Pact 是 CDCT 最成熟的实现。工作流程分三步：

1. **Consumer 端**编写交互期望，生成 pact 文件
2. **Pact Broker**存储和版本化契约
3. **Provider 端**在 CI 中拉取契约并验证

```typescript
// consumer: 前端订单列表页的契约
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'admin-dashboard',
  provider: 'bff-order-service',
});

describe('GET /api/orders', () => {
  it('返回分页订单列表', async () => {
    const { like, eachLike, integer, string } = MatchersV3;

    await provider
      .given('存在 3 条订单')
      .uponReceiving('获取订单列表请求')
      .withRequest({
        method: 'GET',
        path: '/api/orders',
        query: { page: '1', pageSize: '20' },
      })
      .willRespondWith({
        status: 200,
        body: {
          total: integer(3),
          items: eachLike({
            id: string('ORD-20260801-001'),
            status: string('confirmed'),
            amount: like(9900),           // 金额单位为分
            createdAt: string('2026-08-01T10:00:00Z'),
            buyer: {
              name: string('张三'),
              phone: string('138****1234'),
            },
          }),
        },
      });

    // 执行实际请求，验证响应匹配契约
    const interaction = await provider.executeTest(async (mockserver) => {
      const res = await fetch(`${mockserver.url}/api/orders?page=1&pageSize=20`);
      return res.json();
    });

    expect(interaction.items).toHaveLength(3);
    expect(typeof interaction.items[0].amount).toBe('number');
  });
});
```

这段代码的关键不在断言本身，而在 `willRespondWith` 里的 matcher。`like(9900)` 表示"这里是个数字就行"，`string('ORD-...')` 表示"字符串格式"。Pact 生成的契约文件描述的是结构约束而非精确值，所以后端只要保持结构一致就能通过验证，不需要返回一模一样的数据。

Provider 端的验证通常在 Node.js 或 JVM 测试套件中运行：

```typescript
// provider: BFF 端验证契约
import { Verifier } from '@pact-foundation/pact';

describe('bff-order-service 契约验证', () => {
  it('满足 admin-dashboard 的契约', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3000',
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      provider: 'bff-order-service',
      consumerVersionSelectors: [
        { branch: 'main' },
        { deployedOrReleased: true },
      ],
      publishVerificationResult: true,
      providerVersion: process.env.GIT_SHA,
    });

    await verifier.verifyProvider();
  });
});
```

CI 流水线中的顺序是：Consumer PR → 生成 pact → 上传 Broker → Provider main 分支定时验证 + Provider PR 触发 can-i-deploy 检查。如果 Provider 改动破坏了某个 Consumer 的契约，PR 直接标红。

## OpenAPI 契约：Schema 驱动的另一条路

Pact 的优势是细粒度、consumer-driven，劣势是需要引入 Broker 基础设施和学习成本。对于已有 OpenAPI spec 的团队，用 schema validator 做契约检查是一条更轻量的路线。

```typescript
// 基于 OpenAPI spec 的请求/响应校验中间件
import openapiValidator from 'express-openapi-validator';
import swaggerParser from '@apidevtools/swagger-parser';

async function setupContractValidation(app: Express.Application) {
  const spec = await swaggerParser.validate('./openapi/bff-order.yaml');

  app.use(
    openapiValidator.middleware({
      apiSpec: spec,
      validateRequests: true,   // 校验入参是否符合 spec
      validateResponses: true,  // 校验出参是否符合 spec
      validateSecurity: false,
    }),
  );

  // 响应不符合 spec 时自动返回 500 + 详细错误
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.status && err.errors) {
      console.error('[Contract Violation]', {
        path: req.path,
        method: req.method,
        errors: err.errors,
      });
      res.status(500).json({
        error: 'SERVER_CONTRACT_VIOLATION',
        details: err.errors,
      });
    } else {
      next(err);
    }
  });
}
```

这种方式的好处是契约即文档，spec 本身就是前后端共享的真相源。缺点是它是 provider-centric 的——spec 由后端维护，前端只是被动消费者。当四个前端的需求不一致时，spec 容易变成最小公约数，覆盖不到某些 Consumer 真正依赖的字段。

我的建议是两条路结合：核心接口用 OpenAPI spec 做基础校验，关键的 Consumer 特定需求用 Pact 补充。

## 在一个 4 前端 + 1 BFF 的团队中落地

我们的落地分了三个阶段：

**第一阶段：选一个痛点最大的接口试水。** 选了订单列表——四个前端都用，字段变更最频繁。只用 Pact，只在 admin-dashboard 这一个 Consumer 上写契约。两周后第一次抓到破坏性变更：BFF 把 `buyer.phone` 从可选改为删除（因为隐私合规），但没通知 C 端 H5 还在展示手机号脱敏。契约测试在 Provider CI 里红了，修复合约后才合并。

**第二阶段：扩展到其他 Consumer。** 每个前端应用各自为关键接口写契约。建立了规范：只为核心业务流程（下单、支付、退款、用户信息）写契约，不为内部工具类接口写。契约数量控制在 40 个左右，维护成本可控。

**第三阶段：OpenAPI spec 作为基线。** BFF 团队开始维护 OpenAPI spec，所有新接口必须先写 spec 再开发。spec 校验放在 BFF 的集成测试里，Pact 继续保留用于 Consumer 特定的细粒度约束。

落地的阻力主要来自两方面。一是前端同事觉得"又要写一种测试"，解决方案是把契约测试的编写模板化，提供一个脚手架命令直接生成骨架代码。二是 BFF 团队担心契约太多会拖慢发布节奏，解决方案是区分 breaking 和 non-breaking：新增字段不触发失败（向后兼容），只有删除字段、改类型、改必填才阻断。

## 契约测试抓到的典型问题

上线三个月，契约测试拦截了十几次破坏性变更，举几个典型的：

- **字段重命名未同步**：`orderStatus` → `status`，三个 Consumer 的契约同时红了
- **返回值类型变更**：`amount` 从 number 变成 string（后端序列化框架升级导致），Pact matcher 立刻报错
- **嵌套结构拍平**：`buyer.name` 被提升到顶层 `buyerName`，Consumer 还在读 `item.buyer.name`
- **枚举值删除**：订单状态的 `cancelled` 被移除，替换为 `refunded`，C 端的状态映射表缺了这个 case
- **分页参数语义变更**：`page` 从 0-based 改成 1-based，没有文档说明

这些问题的共同点是：单元测试不会发现（mock 还是旧的），E2E 不一定覆盖（非核心路径），只有契约测试能在代码合并前拦住。

## 什么时候不该用契约测试

契约测试不是万能的。以下场景用它反而是负担：

- **内部微服务之间的调用**：如果两个服务的部署节奏完全同步且同属一个团队，直接集成测试更高效
- **第三方 API**：你没法让对方跑你的契约验证，只能用本地 mock + 定期冒烟测试
- **高度动态的接口**：GraphQL 的 flexible query 很难用传统契约描述，更适合 schema introspection + persisted queries
- **原型阶段**：接口每天都在变，写契约等于每天重写，等产品稳定后再引入

判断标准很简单：如果两个团队的发布节奏独立，且接口变更的历史频率高于每月一次，契约测试就值得投入。

## 小结

契约测试解决的是一个具体的工程问题：前后端独立演进时，如何低成本地保证接口一致性。它不替代单元测试和 E2E，而是在两者之间补了一层针对 API 结构的防护。Pact 适合 Consumer 驱动的精细化契约，OpenAPI validator 适合 spec 驱动的基线校验，两者可以组合使用。落地时从一个痛点接口切入，逐步扩展，避免一开始就追求全覆盖。最终衡量标准不是契约数量，而是它实际拦住了多少次本该上线的接口漂移。
