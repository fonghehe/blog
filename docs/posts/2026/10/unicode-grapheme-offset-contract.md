---
title: "Unicode 文本偏移契约：为什么一个表情能把高亮和字数限制弄错"
date: 2026-10-06 11:29:53
tags:
  - JavaScript
  - 工程化
description: "区分 UTF-16、码点与字素簇，统一截断、选区和后端标注的坐标系统。"
readingTime: 4
wordCount: 1106
---

备注框允许输入 20 个字符，却在粘贴家庭表情后提前报超长；另一处搜索高亮把重音拆开，只标中了半个可见字符。这两类问题往往来自同一个假设：字符串长度、用户看到的字符数量和接口偏移是一回事。

处理输入限制、字幕、标注或编辑器时，需要先定义文本坐标，而不是到处补一个表情正则。这里讨论普通文本，不尝试用一个小函数实现完整的富文本编辑模型。

## 三种长度回答三种问题

JavaScript 的 `length` 计算 UTF-16 代码单元。遍历字符串得到码点，但一个用户感知的字符仍可能由多个码点组成：组合重音、肤色修饰符、旗帜和零宽连接序列都需要考虑。字素簇是更适合界面截断的近似单位，它仍然不等于像素宽度。

因此数据库字节限制、协议偏移和界面计数应分别命名。比如 `maxUtf8Bytes`、`startUtf16`、`graphemeCount`，比一个没有单位的 `length` 更能阻止误用。后端用字节偏移而前端用 UTF-16 时，ASCII 样例会全部通过，直到真实姓名或表情出现才暴露错误。

## 用分段器截断可见字符

[Unicode 文本分段规则](https://unicode.org/reports/tr29/)描述字素边界；JavaScript 提供 [Intl.Segmenter](https://tc39.es/ecma402/#segmenter-objects)。以下函数按字素簇截断，不会在示例家庭表情的中间切开。它只返回截断文本，是否添加省略号由调用者决定，省略号自身是否占额度也必须约定。

```javascript
export function truncateGraphemes(text, limit, locale = 'en') {
  if (!Number.isInteger(limit) || limit < 0) {
    throw new RangeError('invalid limit');
  }
  const segmenter = new Intl.Segmenter(locale, {
    granularity: 'grapheme',
  });
  let result = '';
  let count = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (count === limit) break;
    result += segment;
    count++;
  }
  return result;
}

const text = 'A👨‍👩‍👧‍👦e\u0301';
console.assert(text.length > 3);
console.assert(truncateGraphemes(text, 2) === 'A👨‍👩‍👧‍👦');
```

代码依赖 `Intl.Segmenter`。部署前检查目标运行环境；缺少能力时使用经过维护的分段实现，而不是退回 `Array.from(text)` 后继续宣称按可见字符计数。不同运行时携带的 Unicode 数据版本也可能不同，服务端若要求严格一致，应固定规则和测试语料。

## 偏移只对某一版原文有效

假设接口返回 `[start, end)` 区间，必须说明它是 UTF-16、UTF-8 字节还是码点。半开区间可以自然表示空选区与相邻区间，但不能消除单位差异。最好同时返回文档版本和片段校验信息；原文发生修改后，旧区间就不应直接继续应用。

对于纯文本框，`selectionStart` 等位置使用 UTF-16 偏移。若标注服务输出码点偏移，建立码点边界到 UTF-16 位置的映射即可；富文本 DOM Range 则还涉及文本节点及其边界，不能拿整篇字符串的偏移直接充当节点内偏移。展示层的坐标转换应集中在适配层。

## 规范化会改变坐标，不只是改变外观

`é` 可以是一个预组字符，也可以是 `e` 加组合重音。两者显示相似，原始长度却不同。NFC 适合某些比较和索引流程，但不能在获得选区之后悄悄规范化再沿用旧偏移。搜索侧如果做了规范化，必须保留到原文位置的映射，或者明确使用规范化后的文档版本。

不要把 NFKC 当成免费的清洗步骤，它可能改变兼容字符的表达。标识符比较、法律文档和用户原文留存的目标不同。保存原文、生成搜索表示和展示截断最好是三个明确步骤，而不是共同修改同一个字符串。

## 字数限制也需要产品语义

一个标签的上限到底是 20 个字素、40 字节还是一行宽度？视觉上限应通过布局判断，存储上限则按实际编码验证。界面可以同时提示可见字符计数与剩余字节，但不应该把后端拒绝笼统描述成“你输入的字太多”。组合输入尚未完成时也别立即截断，否则候选文本可能被破坏。

建立包含中文、日文、组合重音、旗帜、肤色表情和家庭序列的固定语料，验证截断、复制、删除与高亮往返。最有价值的断言是“这个坐标切出来的仍是预期原文”，而不是只比较一个数字。
