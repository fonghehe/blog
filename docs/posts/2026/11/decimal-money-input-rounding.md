---
title: "金额输入与舍入契约：显示两位小数不等于计算准确"
date: 2026-11-12 15:33:05
tags:
  - JavaScript
  - 工程化
description: "用十进制字符串、最小单位整数和明确舍入规则处理金额，保持分摊总和一致。"
readingTime: 4
wordCount: 1225
---

页面显示 `0.10 + 0.20 = 0.30`，不代表底层金额模型正确。把结果 `toFixed(2)` 只是格式化，无法说明中间计算、负数退款和多行分摊采用了什么规则。真正容易出问题的地方，往往是前后端都说“保留两位”，却各自选择了不同的时机和方式。

本文讨论软件中的金额表示与输入校验，不提供财务或税务规则。示例只支持恰好约定为两位小数的业务货币；其他货币或高精度资产必须使用自己的精度契约。

## 原始输入、业务金额和展示分别保存

输入框暂时出现 `-` 或 `1.` 是正常编辑过程，不能因为尚未形成最终金额就每次重置。草稿可以保存原始字符串，提交时用严格语法解析成业务值。展示则用本地化格式化，不把千分位和货币符号重新送进计算。

JavaScript Number 使用二进制浮点，相关语义见 [ECMAScript Number](https://tc39.es/ecma262/#sec-number-objects)。可以选十进制库或最小单位整数，但必须规定范围、精度与乘除法规则。简单写 `Math.round(Number(text) * 100)` 仍先经历二进制转换，不是一个通用十进制解析器。

## 从十进制文本直接生成最小单位整数

下面只接受无分组符、无指数、最多两位小数的有界字符串，直接组成 BigInt 分。它拒绝 `.5`、`1.`、多余精度和前导零形式，界面可在提交前给明确提示。是否允许这些写法是产品选择，前后端应使用同一契约。

```javascript
export function parseCents(text) {
  if (typeof text !== 'string' || text.length > 128) {
    throw new TypeError('bounded decimal text required');
  }
  const match = /^(-?)(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new Error('invalid two-decimal amount');
  const magnitude = BigInt(match[2]) * 100n +
    BigInt((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -magnitude : magnitude;
}

export function roundRatioHalfAway(numerator, denominator) {
  if (denominator <= 0n) throw new RangeError('positive denominator required');
  const sign = numerator < 0n ? -1n : 1n;
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const remainder = absolute % denominator;
  return sign * (quotient + (remainder * 2n >= denominator ? 1n : 0n));
}

console.assert(parseCents('0.10') + parseCents('0.20') === 30n);
console.assert(roundRatioHalfAway(-5n, 2n) === -3n);
```

BigInt 避免这里的整数加减溢出 Number 安全范围，但不意味着可以接受无限长度输入，代码对长度做了限制。JSON 不直接序列化 BigInt，接口可以发送十进制整数字符串，并明确单位与币种。服务端仍要独立校验范围，不能相信前端已经解析过。

## 舍入必须说清方向和发生位置

示例的比例函数采用正负数都在中点远离零的规则，所以 -2.5 变为 -3。这只是选定的算法，不代表所有业务都该这样处理。向偶数舍入、向下取整以及按现金面额舍入会给出不同结果，需要业务确认。

还要约定在单行、分类小计还是最终总额舍入。三行各自计算再取整，与合计后取整可能相差最小单位。税率和折扣率可以用有理数分子分母或十进制库表达，不应该每一步都变成经过格式化的字符串再转回数字。

## 分摊不是把同一个小数四舍五入三次

把 100 分分给三项，逐项取 33 分只得到 99 分。可以先取整得到每份 33 分，再按稳定顺序分配剩余一分，结果为 34、33、33；不等权分摊还要规定余数排序与相同余数的决胜规则。稳定 ID 比当前画面顺序更容易重现。

退款时应尽量引用原始分摊记录，而不是按今天的排序重新计算。否则用户排序一次，退款就落到另一行。系统需要保存采用的规则与最终分配结果，保证追查时能解释总额和各行如何对应。

## 本地化只负责展示，不替你定义输入语法

[Intl.NumberFormat](https://tc39.es/ecma402/#numberformat-objects)用于格式化，不是通用的本地化金额解析器。逗号可能表示分组或小数点，空格也可能是地区分隔符。若支持多种输入形式，需要明确地区来源和解析策略，不要简单删除所有逗号。

特别大的最小单位整数不要为了调用格式化函数又强转 Number。可以在业务范围内安全转换，或使用能保持精度的十进制展示路径。界面还要避免把负零显示成有意义的退款；示例的 BigInt 模型会把负零归一为零。

## 用不变量验收金额流程

固定测试最小单位、最大范围、非法指数、超长输入、多余小数、负数中点，以及分摊后求和等于原总额。对序列化再解析做往返，确认单位和币种没有丢。前后端用同一组样例比对，而不是只看两个界面都显示两位小数。

把“输入允许什么、内部存什么、何时舍入、如何分配余数”写进接口契约。金额正确性应当能由这些规则推导出来，而不是靠最后一层格式化碰巧显得正常。
