---
title: "React Native 原生能力接入：模块边界和失败语义怎么定"
date: 2026-09-21 17:46:21
tags:
  - 移动端
description: "从扫码与生物识别案例设计 RN 原生模块的接口、权限、取消和错误语义。"
readingTime: 3
wordCount: 819
---

RN 页面要调用扫码、蓝牙或生物识别时，难点并不只是把一个方法暴露给 JavaScript。原生权限弹窗、应用退到后台、设备不支持、用户主动取消，这些状态都要进入业务流程，否则页面只会看到一个含糊的 Promise rejection。

## 接口先说清楚结果

把结果分成 `success`、`cancelled`、`permissionDenied`、`unavailable` 与 `failed`。取消不是异常；权限拒绝也不应被吞成“扫码失败”。模块只返回扫码文本等原始结果，业务层负责查询订单、校验权限和展示内容，避免原生实现与后端业务模型耦合。

一次扫码只允许一个活跃调用。若页面离开或应用进入后台，结束原生会话并释放摄像头；重复点击返回“正在进行中”或聚合到同一次调用。事件订阅必须在卸载时解除，防止回到页面后收到两份结果。

## 用真实设备验证契约

模拟器可以验证 JS 的分支，但不能代替真机权限、摄像头和系统弹窗测试。至少检查首次授权、永久拒绝、系统设置中撤回权限、扫码期间切后台、快速重复点击，以及 iOS / Android 错误码映射。原生接口变更还需要与安装包版本兼容，不能假设一次 JS 更新就能更新本机原生代码。

## 以扫码能力为例定义边界

业务页面需要“扫描二维码并得到文本”，却不应知道 Android 权限回调、iOS 相机中断和原生库的内部事件。先把 JS 可见契约缩小成 `scan(options): Promise<ScanResult>`，结果包含规范化文本和来源，错误用稳定代码表达取消、无权限、设备不可用。权限弹窗的时机由业务流程决定，但权限状态和设备资源的最终事实来自原生平台。不要把原生异常字符串直接透传给用户界面，它们随平台和系统版本变化。

一次扫描可能跨越页面离开、App 进入后台、React Native 实例销毁。原生侧必须保证每次调用恰好完成或取消一次，关闭相机、取消监听，并拒绝第二个并发扫描或明确排队。JS 侧也要把结果与当前页面实例关联；旧页面的 Promise 返回后不能导航新页面。对于较大的二进制图像，传文件句柄或受控路径比把 base64 反复穿过 JS 边界更合适，同时要定义临时文件的清理责任。

```ts
type ScanResult = { text: string; source: 'camera' | 'image' };
type ScanErrorCode = 'CANCELLED' | 'PERMISSION_DENIED' | 'UNAVAILABLE';
interface Scanner { scan(options: { formats: string[] }): Promise<ScanResult> }
```

## 用契约测试隔离平台差异

在 JS 测试中模拟成功、取消、拒绝权限、页面离开和重复点击；在原生集成测试中确认资源释放、前后台切换、权限被系统撤销。分别在 iOS 和 Android 设备上做一次真实扫描，检查相同二维码返回的规范化结果。接入新架构或替换原生库时，只要业务契约不变，页面无需一起改写。参考：[React Native 原生模块生命周期](https://reactnative.dev/docs/the-new-architecture/native-modules-lifecycle)。

参考：[React Native Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction)。
