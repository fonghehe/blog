---
title: "Flutter 表单异步校验：防止旧结果覆盖新输入"
date: 2026-09-18 10:25:57
tags:
  - 移动端
description: "处理 Flutter 表单的防抖、请求代次、提交锁定和服务端错误回填。"
readingTime: 3
wordCount: 753
---

注册、转账或修改资料页面常要异步检查用户名、优惠码或收款账户。用户输入 A 后立即改成 B，A 的校验响应晚到，就可能把 B 标成“不可用”。这不是一个输入框样式问题，而是异步结果归属问题。

## 校验绑定到输入快照

每次输入变化递增代次，并对文本做短暂防抖；请求返回时同时比较代次和当前文本。不匹配就丢弃结果。提交按钮不应只看本地正则通过，还要确认必要的异步校验已完成；提交时再由服务端做最终检查。

```dart
int generation = 0;

Future<void> validateName(String name) async {
  final current = ++generation;
  final result = await repository.checkName(name);
  if (!mounted || current != generation || controller.text != name) return;
  setState(() => nameError = result.isAvailable ? null : '名称已被使用');
}
```

这个片段说明结果归属，不包含防抖定时器及异常分支；实际实现中还要在页面销毁时取消定时器，并把网络错误与“名称不可用”区别显示。

## 提交是另一条状态机

提交开始后锁住重复点击，给服务端请求带幂等键；服务端返回字段级错误时回填到对应输入框，同时保留其他字段。失败后允许修改和重试，成功后只导航一次。测试快慢交错响应、旋转屏幕、离开页面后返回，以及提交期间断网。

## 用户改了输入，旧结果就失去资格

以注册表单的用户名检查为例：用户先输入 `alice`，请求 A 尚未返回时又改成 `alice2` 并发出请求 B。即使 A 后返回“已占用”，也不能把错误标在 `alice2` 上。每个异步校验保存发起时的字段值与序号，响应回来后先比较当前值和最新序号。取消 HTTP 请求可以省流量，但是否更新 UI 仍要靠这个检查，因为取消与响应可能同时发生。

把本地同步规则（必填、长度、格式）放在输入时即可执行的路径；需要服务器知识的检查（用户名可用、优惠码有效）只在停止输入一小段时间后发起。页面离开时释放监听和定时器。提交时不要信赖几秒前的“可用”提示，服务端仍需原子地校验唯一性。提交结果按字段映射错误，保留用户已填内容；网络错误显示为表单级问题，不应伪装成某个字段不合法。

```dart
final valueAtStart = controller.text;
final ticket = ++latestValidation;
final available = await api.isUsernameAvailable(valueAtStart);
if (!mounted || ticket != latestValidation || controller.text != valueAtStart) return;
setState(() => usernameError = available ? null : 'Name is taken');
```

## 验证完整的表单生命周期

测试快速输入、删除后重输同一值、慢响应逆序、旋转屏幕、离开页面后响应、提交期间断网与重复点击。特别检查提交成功后的导航只能发生一次，失败后按钮恢复可用。若页面使用状态管理器而非 `StatefulWidget`，把 `mounted` 换成相应的生命周期检查；关键条件仍是“结果属于当前字段值与当前请求”。
