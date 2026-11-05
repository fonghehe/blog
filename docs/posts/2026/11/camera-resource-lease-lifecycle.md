---
title: "摄像头预览的资源租约：权限弹窗晚返回时，页面已经关闭了"
date: 2026-11-05 14:40:22
tags:
  - JavaScript
  - 工程化
description: "用请求世代和轨道清理管理摄像头生命周期，区分停止预览与真正释放设备。"
readingTime: 4
wordCount: 1137
---

用户点开扫码弹窗，浏览器开始请求摄像头权限。用户随即关闭弹窗，几秒后又允许了权限，摄像头指示灯却亮了起来。组件已经卸载，不代表尚未完成的设备请求被撤销；晚返回的 MediaStream 仍需要有人接住并释放。

扫码、证件拍照和视频预览都需要明确的资源所有者。本文把一次预览看成一份有开始和结束的租约，只讨论本地采集，不包含上传、录制和远端通话。

## 权限、设备、轨道和画面不是一回事

权限允许不保证设备可用：设备可能不存在、正在被占用，或不符合分辨率条件。视频元素能否播放又受到另一组条件影响。把所有失败都显示为“请开启权限”，会让用户在硬件错误里反复修改设置。

根据实际异常分类提供重试或选择设备，但不要靠轮询权限不断弹窗。[Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)定义设备请求和轨道行为。HTTPS、安全上下文、嵌入页面策略及目标浏览器差异都需要在部署环境验证。

## 用请求世代接住晚返回结果

`getUserMedia` 没有一个可照搬 Fetch 的通用 AbortSignal 取消参数。关闭弹窗时递增世代号；旧请求即使成功，也立即停止它返回的全部轨道。切换前后摄像头时沿用同样办法，避免较慢的旧请求覆盖新预览。

```javascript
export function cameraSession(mediaDevices, video) {
  let generation = 0;
  let current = null;
  function stop() {
    generation++;
    if (current) {
      if (video.srcObject === current) video.srcObject = null;
      current.getTracks().forEach(track => track.stop());
      current = null;
    }
  }
  async function start(constraints = { video: true, audio: false }) {
    stop();
    const own = generation;
    let candidate;
    try {
      candidate = await mediaDevices.getUserMedia(constraints);
      if (own !== generation) {
        candidate.getTracks().forEach(track => track.stop());
        return false;
      }
      current = candidate;
      video.srcObject = candidate;
      await video.play();
      return own === generation;
    } catch (error) {
      if (own === generation) {
        stop();
        throw error;
      }
      candidate?.getTracks().forEach(track => track.stop());
      return false;
    }
  }
  return { start, stop };
}
```

这个帮助函数拥有自己取得的流，外部不应把轨道再共享出去后还期望独立控制寿命。`video.play()` 失败也需要清理；第二次开始与第一次等待播放交错时，第一份流已由 stop 释放。示例用世代判断返回是否仍然有效，调用方不能把每次 Promise 完成都当成预览开启成功。

## 清空 srcObject 只是解除显示关联

隐藏视频元素或把 `srcObject` 设为 null 不等于停止采集。真正释放本例拥有的资源需要调用所有轨道的 `stop()`。只停视频轨道而忘记音轨，会留下不必要的麦克风使用，所以不需要音频时一开始就不要请求。

`enabled = false` 更像暂停输出，不应被当成释放设备的替代品。若业务允许临时静音或暂停，可以单独建状态；结束扫描、路由离开和组件销毁都应进入明确的释放路径。对外部结束的轨道还要监听状态，通知画面预览已经失效。

## 生命周期规则要符合产品承诺

扫码页进入后台时是否停止，取决于任务需求与平台限制。若决定停止，恢复时由用户明确重新开始，或在已经授权且环境允许的条件下重新请求，并处理失败。不要每次 visibilitychange 都无条件申请，造成权限打扰与设备争抢。

多个预览组件需要共享设备时，应由统一管理器持有流，按消费者引用计数或租约决定何时释放。组件各自随手 stop 同一条轨道，会互相中断。反过来，管理器不应因为某个忘记退出的消费者永久占用设备，必须有可观测的所有者和清理路径。

## 约束失败要允许降级，但不能伪报能力

先区分必需条件和理想条件。强制指定不支持的尺寸会失败，适度使用 ideal 可以让浏览器协商；业务若必须满足清晰度，协商后还要读取实际轨道设置并验证。前后置选择也不能在缺少设备时装作成功。

测试延迟授权后关闭、连续切换、拒绝权限、设备不可用、播放失败、销毁时清理，以及旧请求晚于新请求完成。自动测试可用可控 Promise 验证清理次数，但摄像头指示灯、系统权限与真实设备只能通过浏览器设备走查确认。

交付时让每份流都有明确主人、每条退出路径都有释放动作。这样页面消失后，设备才不会继续替一个已经不存在的界面工作。
