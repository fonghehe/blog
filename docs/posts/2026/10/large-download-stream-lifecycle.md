---
title: "大文件下载的内存预算：从 response.blob 到可取消的写入流水线"
date: 2026-10-22 09:34:27
tags:
  - JavaScript
  - 性能优化
description: "设计流式落盘、进度含义和失败清理，避免把下载进度误当成文件已经保存。"
readingTime: 4
wordCount: 1186
---

导出文件只有几十兆时，`fetch → blob → object URL` 很方便。文件增长到数百兆以后，浏览器可能同时保留响应、Blob 与其他业务对象，低内存设备首先出现问题。把代码换成读取流还不够：如果最终仍把所有 chunk 收集到数组里，内存曲线没有改变。

下载方案应先回答三个问题：是否需要前端处理文件、目标浏览器是否允许直接写入用户选择的位置，以及失败后用户应该看到什么。最便宜的方案往往是让服务器提供正常下载响应，交给浏览器管理。

## 不需要转换内容时，先考虑浏览器下载

普通下载链接配合服务端的授权和下载响应，可以避免前端为整个文件建立内存对象。跨域链接、文件名和凭证规则要按真实部署验证，不能假设 `download` 属性在所有情况下都生效。短期签名地址还需限制有效期和数据范围，避免在分析系统里记录敏感 URL。

只有必须变换、检查或逐块处理内容时，才让 JavaScript 接管字节流。对于不支持文件选择写入能力的浏览器，可以回退服务端下载或异步导出任务，而不是用无限大的 Blob 假装具有相同内存特征。

## 选择文件发生在用户操作链中

[File System Access](https://wicg.github.io/file-system-access/)的选择器有上下文和用户激活要求，能力支持需要检测。应先在点击处理里请求保存位置，再发起长时间网络操作；等下载完成后再弹选择器，可能早已失去用户激活。取消选择文件与网络失败要显示不同状态。

以下函数把选择器作为参数注入，便于测试。它只实现完整响应下载，不实现 Range 续传。流的管道与关闭行为参考 [Streams 标准](https://streams.spec.whatwg.org/)，写入接口见 [File System 标准](https://fs.spec.whatwg.org/)。

```javascript
export async function saveResponse(url, chooseFile, signal, onBytes = () => {}) {
  const handle = await chooseFile();
  const writable = await handle.createWritable();
  try {
    const response = await fetch(url, { signal });
    if (response.status !== 200 || !response.body) {
      throw new Error(`download rejected: ${response.status}`);
    }
    let received = 0;
    const meter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        onBytes(received);
        controller.enqueue(chunk);
      },
    });
    await response.body.pipeThrough(meter).pipeTo(writable, { signal });
    return received;
  } catch (error) {
    try { await writable.abort(error); } catch { /* preserve original error */ }
    throw error;
  }
}

// Invoke directly from a click handler in a supported secure context:
// saveResponse(url, () => window.showSaveFilePicker(), signal, renderBytes);
```

`pipeTo` 完成后才把 UI 标为已保存。出错时主动尝试中止写入，并保留原始错误。文件系统与浏览器对中止的表现仍需验证，不能向用户承诺任何情况下都绝不会留下临时内容。不要在 finally 中无条件 close，把部分文件包装成一次成功保存。

## 进度的分母必须和分子属于同一种字节

示例只报告收到的响应体字节，不贸然显示百分比。`Content-Length` 可能缺失，经过内容编码时还可能与解码后读取的长度不一致。若服务端提供稳定的逻辑总量，就给它明确字段；否则显示已接收字节和不确定进度，比一个超过 100% 的进度条更可信。

同时区分下载、转换和保存三个阶段。网络已结束但文件尚未关闭时，仍可能出现磁盘或权限错误。对大文件还应限制转换器内部队列；流式 API 只能协调参与管道的步骤，不能防止业务回调自己缓存全部数据。

## 续传需要资源身份，而不只是记住偏移

若要加入 Range，客户端必须确认前后是同一资源版本，检查状态、范围和总大小，并处理服务器忽略范围返回 200 的情况。直接在原文件末尾拼接新响应，可能把两个版本合成损坏文件。涉及加密或压缩时，偏移还必须对应正确的表示层。

可恢复导出通常更适合服务端生成稳定对象，返回任务 ID、版本与可验证元信息，前端只管理恢复流程。不要因为有 `seek` 方法，就把网络续传的协议设计省略掉。

## 验证峰值内存和失败后的文件

用受控的大响应和慢写入端，确认内存不会随整个文件线性增长；同时测试开始前取消、传输中取消、磁盘写入失败、缺失响应体和错误状态。浏览器实测应记录设备、文件大小和峰值内存，而不是直接给出未经测量的节省比例。

交付时明确支持列表与回退路径。用户关心的是拿到完整可打开的文件，所以最终验收要重新打开保存结果或校验摘要，而不只是看进度条走到终点。
