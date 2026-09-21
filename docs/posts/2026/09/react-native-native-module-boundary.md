---
title: "React Native 原生能力接入：模块边界和失败语义怎么定"
date: 2026-09-21 17:46:21
tags:
  - 移动端
description: "从扫码与生物识别案例设计 RN 原生模块的接口、权限、取消和错误语义。"
readingTime: 1
wordCount: 376
---

RN 页面要调用扫码、蓝牙或生物识别时，难点并不只是把一个方法暴露给 JavaScript。原生权限弹窗、应用退到后台、设备不支持、用户主动取消，这些状态都要进入业务流程，否则页面只会看到一个含糊的 Promise rejection。

## 接口先说清楚结果

把结果分成 `success`、`cancelled`、`permissionDenied`、`unavailable` 与 `failed`。取消不是异常；权限拒绝也不应被吞成“扫码失败”。模块只返回扫码文本等原始结果，业务层负责查询订单、校验权限和展示内容，避免原生实现与后端业务模型耦合。

一次扫码只允许一个活跃调用。若页面离开或应用进入后台，结束原生会话并释放摄像头；重复点击返回“正在进行中”或聚合到同一次调用。事件订阅必须在卸载时解除，防止回到页面后收到两份结果。

## 用真实设备验证契约

模拟器可以验证 JS 的分支，但不能代替真机权限、摄像头和系统弹窗测试。至少检查首次授权、永久拒绝、系统设置中撤回权限、扫码期间切后台、快速重复点击，以及 iOS / Android 错误码映射。原生接口变更还需要与安装包版本兼容，不能假设一次 JS 更新就能更新本机原生代码。

参考：[React Native Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
