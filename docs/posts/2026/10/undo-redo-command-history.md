---
title: "撤销与重做的命令历史：一次操作到底应该恢复什么"
date: 2026-10-27 15:18:29
tags:
  - JavaScript
  - 工程化
description: "用字幕编辑示例解释事务分组、反向命令、保存基线和外部副作用的边界。"
readingTime: 4
wordCount: 1127
---

拖动一个对象产生 80 次状态更新，按一次撤销却只退回一像素；另一种实现保存整棵组件状态，连展开面板和加载标记也一起恢复了。撤销的困难不在维护两个数组，而在定义用户认知中的“一次操作”。

这里用字幕文本编辑建立最小模型：每条字幕有稳定 ID，命令记录修改前后文本。示例只处理本地已有字幕的文本替换，不包含插入删除、多人协同或网络回滚。

## 历史应记录领域变化

领域状态包括字幕内容、顺序和时间范围；选中项、播放位置、悬浮提示是交互状态。一次文本撤销是否恢复选区可以单独约定，但不应把整个 UI 状态作为业务快照。否则异步请求标记和已经失效的资源引用也会被带回过去。

稳定 ID 比数组位置更适合命令。若命令写着“修改第三行”，排序之后就可能修改另一条字幕。命令应定位 ID，附带必要的版本或前置条件。不存在的目标不能静默跳过，否则界面会误报撤销成功。

## 反向命令需要前置条件

以下历史存储 `before` 与 `after`，撤销前检查当前值仍然等于预期。检查失败时先抛错，保持历史栈不变，交给调用层选择重新加载或冲突处理。直接覆盖会把外部变更吃掉。类是教学模型，生产代码应隐藏内部数组并限制外部直接修改状态。

```javascript
export class CaptionHistory {
  constructor(initial, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1) throw new RangeError('limit');
    this.state = { ...initial };
    this.past = [];
    this.future = [];
    this.limit = limit;
  }
  apply(command, reverse = false) {
    const expected = reverse ? command.after : command.before;
    const next = reverse ? command.before : command.after;
    if (this.state[command.id] !== expected) throw new Error('revision conflict');
    this.state = { ...this.state, [command.id]: next };
  }
  execute(id, after) {
    if (!Object.hasOwn(this.state, id) || typeof after !== 'string') {
      throw new Error('unknown caption or invalid text');
    }
    const command = { id, before: this.state[id], after };
    if (command.before === after) return;
    this.apply(command);
    this.past.push(command);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }
  undo() {
    const command = this.past.at(-1);
    if (!command) return false;
    this.apply(command, true);
    this.past.pop();
    this.future.push(command);
    return true;
  }
  redo() {
    const command = this.future.at(-1);
    if (!command) return false;
    this.apply(command);
    this.future.pop();
    this.past.push(command);
    return true;
  }
}
```

执行新命令后清空 redo 分支，因为未来历史属于已经放弃的另一条时间线。无实际变化不入栈。容量上限只控制命令数量；若文本很大，还需按实际内容大小预算内存。对含图片或二进制内容的编辑器，历史最好引用受管理资源，不复制完整数据。

## 输入和拖动必须按意图分组

一段连续输入可合并为一条命令，但不能只按固定毫秒窗口决定。光标移动、切换字幕、粘贴和输入法确认通常应结束一个分组。拖动则在开始时记录原值，移动期间展示预览，结束时只提交一次命令；取消拖动应回到原值且不新增历史。

事务组中若有多个领域修改，应全部成功后才入栈，失败则恢复已完成的部分。反向顺序通常与正向顺序相反，但对于依赖外部系统的操作，未必存在真正可逆的命令。不要把本地文本历史推广成“任何功能都能一键回滚”。

## 已保存状态不是历史栈长度

保存后继续修改再撤销，内容可能重新等于已保存版本。用 `past.length > 0` 判断未保存会一直亮红点。相反，历史达到上限后长度不变，内容却仍在变化。应保留保存基线的内容指纹或文档修订标识，比较当前领域状态，而不是历史长度。

异步保存还要绑定发起保存时的快照。若保存 A 时用户已改成 B，A 成功后只能把 A 标为服务端基线，不能宣布 B 已保存。保存失败也不应该删除本地历史，用户仍需要撤销与继续编辑。

## 网络和多人编辑需要另一层协议

撤销“已发送邮件”不能简单恢复本地按钮状态。对外部副作用应使用取消、补偿或新的业务命令，并明确是否真的可恢复。多人编辑时，旧的 before 值可能已失效，需要操作转换、协同模型或冲突策略；本例的前置条件检查只能发现冲突，不能自动合并。

验收应覆盖连续两次撤销与重做、撤销后新建分支、空操作、目标失效、容量裁剪、保存中继续输入，以及输入法和拖动的事务边界。浏览器输入事件与原生历史的关系可以参考 [Input Events](https://www.w3.org/TR/input-events-2/)，不要让原生撤销和自建历史同时消费同一次按键。
