---
title: "用 ETag 处理并发编辑：别让后保存的人无声覆盖前一个人"
date: 2026-11-10 11:31:22
tags:
  - JavaScript
  - 工程化
description: "把条件写入、草稿保留和三方比较连接起来，建立可解释的冲突恢复流程。"
readingTime: 4
wordCount: 1151
---

两个人打开同一份配置，甲改标题并保存，乙稍后改备注并保存。界面都提示成功，但甲的标题消失了。前端禁用重复点击只能约束本页面，不能防止别的标签、用户或后台任务同时修改数据。

并发编辑需要接口证明“这次修改是基于哪一版”。本文讨论整份文档 PUT 的乐观并发控制，不把它扩展成自动协同编辑，也不假设浏览器缓存本身会保护业务写入。

## 读取时保存内容和验证器

读取文档时同时取得表示及其 ETag，并在草稿旁保存这一基线。保存时带 `If-Match`，让服务端只在当前表示仍匹配时执行。条件不满足时返回 412，前端进入冲突状态。HTTP 条件请求与强比较的规则见 [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)。

用于写入的验证器需要符合强比较语义。不要去掉 `W/` 前缀就把弱验证器伪装成强验证器，也不要自行猜测服务器的 ETag 算法。跨域接口还要暴露响应 ETag，并允许需要的条件请求头，否则代码可能拿不到服务端已经发送的信息。

## 检查和更新必须是一次原子操作

下面前端函数在 412 时返回明确冲突，不自动覆盖。服务端 SQL 示例展示版本条件；事务内还要处理权限、业务校验及对应的 HTTP 映射。它不规定 ETag 必须直接等于数据库版本，验证器到当前表示的映射仍由服务端负责。

```javascript
export async function saveDraft(url, draft, etag, signal) {
  if (!etag || etag.startsWith('W/')) {
    throw new Error('a strong revision validator is required');
  }
  const response = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'If-Match': etag },
    body: JSON.stringify(draft),
    signal,
  });
  if (response.status === 412) return { kind: 'conflict', draft };
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return {
    kind: 'saved',
    etag: response.headers.get('ETag'),
  };
}
```

```sql
-- Execute atomically; zero updated rows means the expected version lost.
UPDATE documents
SET body = $1, version = version + 1
WHERE id = $2 AND tenant_id = $3 AND version = $4
RETURNING version;
```

先读取版本、在应用里比较、最后无条件更新，会在比较与写入之间再开一个竞态窗口。应使用带版本条件的更新或等效原子机制。零行更新还可能意味着资源删除或权限条件不成立，服务端需要按授权策略区分，不能把敏感资源存在性随意泄露。

## 冲突时保留三份信息

界面需要基线、当前本地草稿和最新远端文档。三方比较可以发现甲乙是否改了不同字段，但自动合并仍要按业务语义判断。标题与标题可能冲突，金额与币种即使是不同字段也未必能独立合并，数组顺序更不能按索引机械合并。

显示可理解的差异，让用户选择保留本地、接受远端或手工调整。若用户决定基于最新版本再提交，应更新基线并再次带条件；冲突处理完成前不能偷偷发送一个没有条件的 PUT。自动重试 412 只会把被保护的覆盖重新变成最后写入获胜。

## 保存成功也要对应发出的那份草稿

用户在保存 A 期间继续输入 B，A 成功后不能把 B 全部标成已保存。保存请求应携带本地修订身份，成功后只推进对应基线，并保留较新的编辑。新的 ETag 属于服务端确认的结果，而不是随便绑定到当前输入框内容。

示例允许成功响应没有 ETag；这种情况下 UI 可以说明已保存，但再次安全写入前应重新获取验证器，不能继续用旧值。若接口会规范化内容，例如整理空白或补默认值，还要约定成功后返回表示或要求重新读取，防止本地基线与实际存储分歧。

## 超时与冲突是不同的恢复问题

412 表示条件没有满足；网络超时则可能是写入成功但响应丢失。后者不要直接显示“肯定没保存”。可以重新读取并比较业务修订，或使用服务端支持的请求身份查询结果。幂等语义和并发验证分别解决重复执行与丢失更新，不能相互代替。

测试两个客户端读取同一基线后依次保存、保存中继续编辑、删除后保存、跨域头缺失、响应丢失以及服务端规范化。断言不仅是状态码，还包括本地草稿没有丢失、下一次保存使用正确基线。能够解释并恢复的冲突，远比两个虚假的“保存成功”可靠。
