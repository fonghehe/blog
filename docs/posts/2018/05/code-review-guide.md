---
title: "前端代码审查指南"
date: 2018-05-22 11:15:39
tags:
  - 前端
---

代码审查（Code Review）是提升团队代码质量最有效的手段之一。但很多团队要么不做，要么做了流于形式。这篇文章分享我们团队的实践经验。

## 为什么 Code Review 值得投入

- 发现 bug：比测试发现的成本低 10 倍
- 传播知识：新人能快速学习团队最佳实践
- 统一风格：减少"个人风格"代码
- 设计把关：在代码合并前发现架构问题
- 分散知识：避免只有一个人懂某块代码

## 提交 PR 的规范

好的 PR 让审查者轻松，差的 PR 让人不知从何看起。

**PR 大小**：单个 PR 不超过 400 行改动（不含自动生成的文件）。大需求拆分成多个 PR。

**PR 描述模板**：

```markdown
## 做了什么

用户现在可以在个人设置里上传头像。

## 改动说明

- 新增 `AvatarUpload` 组件，支持裁剪
- `userStore` 新增 `updateAvatar` action
- 上传限制：5MB，支持 jpg/png/gif

## 测试验证

- [x] 正常上传流程
- [x] 文件大小超限提示
- [x] 文件类型不支持提示
- [x] 上传失败重试

## 相关截图

[上传头像截图]
```

## 审查者应该关注什么

### 必须检查

**正确性**

```javascript
// ❌ 逻辑错误：应该用 || 而不是 &&
if (!isAdmin && !hasPermission) {
  // 实际上：管理员 OR 有权限 其中一个满足就放行
}

// ✅ 修正
if (!isAdmin && !hasPermission) {  // 两个都没有才拒绝
```

**安全性**

```javascript
// ❌ 直接把用户输入插入 HTML
element.innerHTML = userInput;

// ❌ 把敏感信息输出到日志
console.log("Token:", userToken);
```

**边界情况**

```javascript
// ❌ 没有处理数组为空的情况
const firstItem = list[0].name; // list 为空时 crash

// ✅
const firstItem = list[0]?.name || "未知";
```

### 重点关注

**可维护性**：函数太长？逻辑太复杂？变量名不清晰？

```javascript
// ❌ 难以理解
function p(d, t) {
  return d.filter((i) => i.s === t).map((i) => i.v);
}

// ✅ 清晰
function filterValuesByStatus(data, targetStatus) {
  return data
    .filter((item) => item.status === targetStatus)
    .map((item) => item.value);
}
```

**重复代码**：相同逻辑出现多次，是否应该抽取？

**性能问题**：

```javascript
// ❌ 在渲染循环里做昂贵计算
// Vue 模板里
<li v-for="item in list" :class="{ active: expensiveCompute(item) }">

// ✅ 预计算
computed: {
  processedList() {
    return this.list.map(item => ({
      ...item,
      isActive: this.expensiveCompute(item)
    }))
  }
}
```

### 可以不要求的

- 代码风格（ESLint 会处理）
- 小的命名偏好（只要不影响可读性）
- 实现方式（只要正确且可维护）

## 给出好的反馈

**不好的审查意见**：

```
这代码写得太烂了，重新写。
这个函数太长。
```

**好的审查意见**：

```
这里的 for 循环可以用 Array.reduce 简化，
而且当前实现时间复杂度是 O(n²)，数据量大时会有性能问题。
参考：[链接]

考虑提取成独立函数，比如 calculateTotalPrice(items)，
这样在其他地方也能复用，测试也更容易写。

可选建议：这里可以加一个边界检查，list 为空时
直接返回 []，避免后续处理出现异常。（不是必须改）
```

## 审查的节奏

- 不要一次 review 超过 500 行
- 复杂 PR 安排专门时间，不要在碎片时间审查
- 给出 comment 后等作者修改，不要批了又发现新问题（应该第一次就看全）
- PR 不是作业，是协作工具，避免权威式审查

## 不要在 PR 里争架构

如果发现架构层面的问题，**应该先沟通，不是拒绝 PR**：

1. 标记为 `需要讨论`，线下或者 issue 里讨论
2. 如果是小项目且影响不大，先合并，后续重构
3. 如果确实需要改，给出具体建议而不是"重写"

## 小结

- PR 小而聚焦，附上清晰的描述
- 审查聚焦正确性、安全性、可维护性
- 反馈具体、建设性，区分"必须改"和"建议"
- Code Review 是合作，不是审判
