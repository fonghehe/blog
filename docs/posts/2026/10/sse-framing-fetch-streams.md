---
title: "Fetch 读取 SSE：网络分块不是消息边界"
date: 2026-10-15 09:06:03
tags:
  - JavaScript
  - 工程化
description: "为流式响应设计增量解码、事件分帧、取消与业务完成标记。"
readingTime: 4
wordCount: 1076
---

服务端每次发送完整 JSON，前端却偶尔报解析失败。抓包看不出坏数据，重试又好了。常见原因是把 `reader.read()` 返回的一块字节直接交给 `JSON.parse`：网络可以拆开一个字符，也可以把两个事件合成一块。

流式接口至少存在字节、文本、事件和业务状态四层边界。先把它们分开，才能判断一个空白屏幕是解码错误、分帧错误，还是业务根本没有发出完成消息。

## 解码器必须跨分块保留状态

UTF-8 中文可能在字节中途被切开。对每个 chunk 新建 `TextDecoder` 会失去未完成字节；正确方法是持续解码并在结束时刷新，或者使用 `TextDecoderStream`。字符解码不负责找到 JSON 边界，输出的字符串仍然可能包含半个事件。

随后才轮到 SSE 行与空行分隔。通用 SSE 还包含 `event`、`id`、重连和其他语义，优先使用原生 `EventSource` 或成熟实现。原生接口不能直接满足所有带自定义请求头或请求体的需求；选择 Fetch 时，要明确自己承担了哪些协议能力。规则见 [HTML 事件流](https://html.spec.whatwg.org/multipage/server-sent-events.html)与[编码标准](https://encoding.spec.whatwg.org/#interface-textdecoder)。

## 示例故意限定为 data-only 子协议

下面的生成器只适用于服务端明确约定的 LF 或 CRLF、`data:` 字段子集。它不支持单独 CR 行尾、不解释事件 ID、类型和重连指令，不能当成完整 EventSource 替代品。多行 data 合并后才交给业务层。缓冲上限以 JavaScript 字符串代码单元计数，并不是严格的字节内存配额。

```javascript
export async function* readDataEvents(body, maxChars = 65536) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let pending = '';
  let data = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += value;
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end).replace(/\r$/, '');
        pending = pending.slice(end + 1);
        if (line === '') {
          if (data.length) yield data.join('\n');
          data = [];
          size = 0;
        } else if (line.startsWith('data:')) {
          const part = line.slice(5).replace(/^ /, '');
          size += part.length + 1;
          if (size > maxChars) throw new Error('event too large');
          data.push(part);
        }
        if (line.length > maxChars) throw new Error('line too large');
      }
      if (pending.length + size > maxChars) throw new Error('buffer too large');
    }
    if (pending || data.length) throw new Error('incomplete application event');
  } finally {
    try { await reader.cancel(); }
    finally { reader.releaseLock(); }
  }
}
```

连接结束还有残留时，这个应用子协议选择报错；通用 SSE 的末尾未完成事件处理不能由此推断。空 data 也可以组成事件，注释和非 data 字段在这个子集中被忽略。调用方还应检查 HTTP 状态与响应类型，防止把代理返回的 HTML 错误页读成沉默的事件流。

## JSON 解析与流完成是两个决定

每次 yield 是一个完整事件的 data 文本，此时才解析 JSON，并通过业务 schema 校验字段。不要假设每个事件都等价于一个 token；它也可能是进度、错误或业务完成。业务消息最好带请求 ID 和单调序号，让重复事件和旧请求消息可以被识别。

传输 EOF 不代表生成成功。设计一个明确的完成事件，携带最终状态或输出校验信息。断线前收到大量文本但没有完成标记时，界面应保留部分结果并显示“中断”，而不是装作成功。若允许恢复，需要服务端事件日志、游标和重复处理规则；不能只在前端从头重连再拼接。

## 取消必须穿过整个消费链

用户切换问题时取消 Fetch，同时停止消费者和后续渲染。生成器的 `finally` 负责释放读取器；调用方提前退出迭代也应到达清理逻辑。已经入队的 UI 更新仍要检查请求身份，避免旧内容在取消后闪回。

渲染速度也可能慢于接收速度。按帧批量更新文本，限制保留事件和历史字符数；不要为每个字符重排整页。背压能协调消费速度，但不能让代理、服务端和全部中间缓冲自动消失。超时应区分长时间无数据和总任务过长，心跳也不能伪装成业务进展。

## 用任意切块测试协议，而不是只测示例字符串

将同一串事件在每一个字节位置切开，验证重组结果一致；再用一字节一块、多事件一块、CRLF 跨块和中文跨块的输入。加入超限行、残缺事件、业务完成缺失和消费中取消。测试解析器的同时测试页面状态，才能确认“读到了内容”与“完成了任务”不会混为一谈。
