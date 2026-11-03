---
title: "输入法组合态：搜索框为什么会吞字、误提交和重复请求"
date: 2026-11-03 10:28:18
tags:
  - JavaScript
  - 工程化
description: "把正在组合的文本与已提交输入分开，设计中文、日文和快捷键的交互边界。"
readingTime: 4
wordCount: 1145
---

用户输入拼音并按回车选择候选词，页面却把半成品拼音当成搜索提交。另一个输入框每次变更都格式化并写回值，候选窗口突然关闭。英文键盘测试正常，并不能证明输入体验正确，因为组合输入不是一串普通按键。

这里讨论独立的原生搜索输入框。框架受控输入、富文本编辑器和移动端键盘还要结合各自事件模型验证，不能靠一段通用监听器覆盖全部环境。

## 组合中的文本不是最终业务值

`compositionstart` 到 `compositionend` 之间，输入法维护候选与中间文本。用户可能多次更新、选择或取消，最终文本未必等于任何中间结果。画面可以显示当前值，但自动搜索、长度截断、持久化和格式化应先决定是否允许处理中间态。

尤其不要在组合过程中把 `value` 强行替换成清洗后的版本。DOM 值、选区和输入法内部状态可能失去对应。对于受控组件，可以更新展示用草稿，同时推迟业务提交；不应简单忽略全部事件，让下一次渲染又把旧值盖回输入框。

## 同时关注事件属性和组件自己的组合标记

[UI Events](https://w3c.github.io/uievents/#events-compositionevents)定义组合事件，[Input Events](https://www.w3.org/TR/input-events-2/)描述输入意图。真实浏览器、系统和输入法的边界事件顺序需要测试。下面监听原生输入，组合期间不发布业务变更，结束后读取最终 DOM 值，并用最后一次已发布值去重。

```javascript
export function bindSearch(input, onChange, onSubmit) {
  let composing = false;
  let active = true;
  let last = input.value;
  const publish = () => {
    if (!active || composing || input.value === last) return;
    last = input.value;
    onChange(last);
  };
  const start = () => { composing = true; };
  const end = () => {
    composing = false;
    queueMicrotask(publish);
  };
  const change = event => {
    if (!event.isComposing) publish();
  };
  const key = event => {
    if (event.key !== 'Enter' || composing || event.isComposing) return;
    event.preventDefault();
    publish();
    onSubmit(input.value);
  };
  const listeners = [
    ['compositionstart', start], ['compositionend', end],
    ['input', change], ['keydown', key],
  ];
  for (const [name, fn] of listeners) input.addEventListener(name, fn);
  return () => {
    active = false;
    for (const [name, fn] of listeners) input.removeEventListener(name, fn);
  };
}
```

微任务用于合并当前事件序列中的读取，不是跨浏览器正确性的证明。如果目标输入法在稍后任务才发出最终 input，后续 input 仍会读取新值；相同值不会重复通知。对回车的组合标记也必须在目标系统验证，必要的兼容补丁应绑定具体环境证据，不能堆砌魔法延时。

## 把确认候选与提交搜索作为两个意图

第一次回车可能只是确认候选，下一次才是提交。不要在捕获阶段统一拦截所有 Enter，再让输入框追着修复。表单默认提交、全局快捷键与输入控件需要约定优先级；示例的独立输入框自行处理回车，集成表单时应避免再由 submit 监听器重复发送。

输入是否变化与用户是否显式提交也不相同。例子对 `onChange` 去重，但允许同一个关键词再次 `onSubmit`，因为用户可能主动刷新结果。网络层再根据查询身份、请求世代和防抖策略处理并发，不应把输入协议和缓存策略揉成一个函数。

## 校验要保留可编辑的中间状态

金额框中的负号、小数点和搜索中的尾随空格可能暂时不是合法最终值，但仍是自然输入过程的一部分。可以让草稿表示中间态，失焦或提交时再转换为业务值。字符上限也应区分代码单元和可见字符，不要在组合进行一半时切掉文本。

粘贴、语音输入、自动填充和撤销未必产生预想的 keydown 序列，因此业务变更应基于 input 而不是只监听按键。选择文本后替换、组合取消和焦点切换也要保持光标与草稿一致。若异步建议返回，必须核对当前查询，避免旧建议覆盖正在输入的内容。

## 自动测试只能覆盖部分真实输入链

单元测试可以验证标记、去重、销毁清理和明确给定的事件序列。人为派发 composition 事件并不能证明操作系统候选窗口的真实行为。还应在目标桌面和移动系统，用中文与日文输入法实际完成候选选择、取消、回车和连续输入。

记录系统、浏览器、输入法名称及触发顺序。验收重点是最终文本没有丢失、候选确认不会提交、一次有效变更没有重复请求。这样发现差异时，修补的是可解释的边界，而不是到处加一个延时。
