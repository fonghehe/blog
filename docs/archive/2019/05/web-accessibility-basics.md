---
title: "前端开发者应该知道的 Web 无障碍（a11y）基础"
date: 2019-05-26 10:51:45
tags:
  - 前端
readingTime: 6
description: "无障碍（accessibility，缩写 a11y）在国内前端开发中经常被忽视，但它并不只是\"给盲人用的\"。键盘用户、色觉障碍用户、临时性损伤用户（比如手臂骨折只能单手操作）都是无障碍的受益者。作为前端开发者，掌握基础的 a11y 知识是专业素养的一部分。"
wordCount: 944
---

无障碍（accessibility，缩写 a11y）在国内前端开发中经常被忽视，但它并不只是"给盲人用的"。键盘用户、色觉障碍用户、临时性损伤用户（比如手臂骨折只能单手操作）都是无障碍的受益者。作为前端开发者，掌握基础的 a11y 知识是专业素养的一部分。

## 为什么前端要关注无障碍

根据世界卫生组织的数据，全球约有 10 亿人有某种形式的残障。在 Web 开发中：

- 视力障碍用户依赖 **屏幕阅读器**（如 NVDA、VoiceOver）来"听"网页
- 运动障碍用户依赖 **键盘导航** 而非鼠标
- 色觉障碍用户无法区分某些颜色组合
- 认知障碍用户需要清晰的结构和提示

做好无障碍不仅能服务这些用户，还能提升整体用户体验和 SEO。

## 语义化 HTML 是第一道防线

最有效的无障碍手段就是正确使用 HTML 标签。很多开发者习惯用 `div` 和 `span` 包一切，但语义化标签自带无障碍属性。

```html
<!-- 不好的做法 -->
<div class="header">
  <div class="nav">
    <span class="nav-item" onclick="goHome()">首页</span>
    <span class="nav-item" onclick="goAbout()">关于</span>
  </div>
</div>
<div class="main">
  <div class="article">
    <span class="title">文章标题</span>
    <div>文章内容...</div>
  </div>
</div>
<div class="footer">版权信息</div>
```

屏幕阅读器看到的是一堆没有意义的 `div` 和 `span`。用户不知道哪里是导航、哪里是正文、哪里是页脚。

```html
<!-- 好的做法 -->
<header>
  <nav aria-label="主导航">
    <ul>
      <li><a href="/">首页</a></li>
      <li><a href="/about">关于</a></li>
    </ul>
  </nav>
</header>
<main>
  <article>
    <h1>文章标题</h1>
    <p>文章内容...</p>
  </article>
</main>
<footer>
  <p>&copy; 2019 我的博客</p>
</footer>
```

屏幕阅读器可以通过 `<header>`、`<nav>`、`<main>`、`<article>`、`<footer>` 快速定位页面结构，用户可以用快捷键跳转到不同区域。

### 常用语义化标签速查

```html
<!-- 页面结构 -->
<header>    <!-- 页头或某个区块的头部 -->
<nav>       <!-- 导航区域 -->
<main>      <!-- 页面主内容（一个页面只能有一个） -->
<article>   <!-- 独立的文章/内容块 -->
<section>   <!-- 有主题的内容分组 -->
<aside>     <!-- 侧边栏或附属内容 -->
<footer>    <!-- 页脚 -->

<!-- 文本语义 -->
<strong>    <!-- 重要文本（屏幕阅读器会加重语气） -->
<em>        <!-- 强调文本 -->
<mark>      <!-- 高亮/标记文本 -->
<time>      <!-- 时间 -->

<!-- 表单相关 -->
<label>     <!-- 表单标签，必须与 input 关联 -->
<fieldset>  <!-- 表单分组 -->
<legend>    <!-- fieldset 的标题 -->
<button>    <!-- 按钮（不要用 div 模拟） -->

<!-- 列表 -->
<ul>        <!-- 无序列表 -->
<ol>        <!-- 有序列表 -->
<dl>        <!-- 描述列表（术语+定义） -->
```

## ARIA 属性的正确使用

当语义化 HTML 不足以表达组件的含义时，需要使用 **WAI-ARIA**（Web Accessibility Initiative - Accessible Rich Internet Applications）属性来补充。

ARIA 属性的核心原则是：**能用原生 HTML 语义解决的，就不要用 ARIA**。

### ARIA 角色（role）

```html
<!-- 用 role 告诉辅助技术这个元素是什么 -->
<div role="alert">
  用户名不能为空
</div>

<!-- 自定义 Tabs 组件 -->
<div role="tablist" aria-label="标签页">
  <button role="tab" aria-selected="true"  aria-controls="panel-1">选项卡一</button>
  <button role="tab" aria-selected="false" aria-controls="panel-2">选项卡二</button>
</div>
<div role="tabpanel" id="panel-1">
  <p>选项卡一的内容</p>
</div>
<div role="tabpanel" id="panel-2" hidden>
  <p>选项卡二的内容</p>
</div>
```

```html
<!-- 自定义 Modal 弹窗 -->
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-desc"
>
  <h2 id="dialog-title">确认删除</h2>
  <p id="dialog-desc">删除后不可恢复，确定要删除这条记录吗？</p>
  <button>确认删除</button>
  <button>取消</button>
</div>
```

### ARIA 状态属性

```html
<!-- aria-hidden：对辅助技术隐藏元素 -->
<div aria-hidden="true">
  <!-- 装饰性图标，屏幕阅读器跳过 -->
  <span class="icon-star"></span>
</div>

<!-- aria-expanded：展开/收起状态 -->
<button aria-expanded="false" aria-controls="dropdown-menu">
  更多选项
  <span class="arrow-down"></span>
</button>
<ul id="dropdown-menu" hidden>
  <li><a href="#">选项一</a></li>
  <li><a href="#">选项二</a></li>
</ul>

<!-- aria-disabled：禁用状态（比 disabled 属性更灵活，仍可被聚焦） -->
<button aria-disabled="true">提交（表单未完成）</button>

<!-- aria-live：动态内容区域 -->
<div aria-live="polite" aria-atomic="true">
  <!-- 当内容变化时，屏幕阅读器会自动朗读 -->
  <p>已加载 3 条新消息</p>
</div>
```

`aria-live` 的取值：
- `polite`：等当前内容读完再播报（大多数情况用这个）
- `assertive`：立即打断当前内容播报（用于错误提示等紧急信息）
- `off`：不播报

## 表单无障碍

表单是最容易出现无障碍问题的地方。

```html
<!-- 错误做法：input 没有关联 label -->
<input type="text" placeholder="请输入邮箱">
<span>请输入邮箱</span>
<!-- 问题：屏幕阅读器无法知道这个 input 的用途 -->
<!-- placeholder 不是 label 的替代品，它消失后用户就忘了要填什么 -->
```

```html
<!-- 正确做法：用 for/id 关联 label 和 input -->
<label for="email">邮箱地址</label>
<input type="email" id="email" name="email"
       aria-required="true"
       aria-describedby="email-hint email-error">
<span id="email-hint">用于接收通知邮件</span>
<span id="email-error" role="alert" aria-live="assertive"></span>
```

### 表单验证与错误提示

```html
<!-- 完整的表单验证示例 -->
<form>
  <div class="form-group">
    <label for="username">用户名 <span aria-hidden="true">*</span></label>
    <input
      type="text"
      id="username"
      name="username"
      aria-required="true"
      aria-invalid="false"
      aria-describedby="username-error"
    >
    <span id="username-error" class="error" role="alert" hidden>
      用户名必须包含 3-20 个字符
    </span>
  </div>

  <div class="form-group">
    <label for="password">密码 <span aria-hidden="true">*</span></label>
    <input
      type="password"
      id="password"
      name="password"
      aria-required="true"
      aria-invalid="false"
      aria-describedby="password-error"
    >
    <span id="password-error" class="error" role="alert" hidden>
      密码至少 8 位，需包含字母和数字
    </span>
  </div>

  <button type="submit">注册</button>
</form>
```

```javascript
// JavaScript 验证时更新 ARIA 状态
function validateField(input, errorEl, isValid) {
  if (isValid) {
    input.setAttribute('aria-invalid', 'false');
    errorEl.hidden = true;
  } else {
    input.setAttribute('aria-invalid', 'true');
    errorEl.hidden = false;
    // 把焦点移到第一个错误字段
    input.focus();
  }
}
```

## 键盘导航

很多用户完全依赖键盘操作网页。确保所有交互元素都可以通过键盘访问。

### Tab 焦点管理

```html
<!-- tabindex 的用法 -->
<!-- tabindex="0"：按 DOM 顺序参与 Tab 导航 -->
<div tabindex="0" role="button">自定义按钮</div>

<!-- tabindex="-1"：可以通过 JS 聚焦，但不参与 Tab 导航 -->
<div tabindex="-1" id="modal-content">弹窗内容</div>

<!-- tabindex="正数"：尽量不要用，会打乱自然的 Tab 顺序 -->
<!-- 有害做法 -->
<a href="/" tabindex="1">首页</a>
<a href="/about" tabindex="3">关于</a>
<a href="/contact" tabindex="2">联系</a>
<!-- Tab 顺序变成了：首页 → 联系 → 关于，违反直觉 -->
```

### 自定义组件的键盘交互

```javascript
// 自定义下拉菜单的键盘处理
class Dropdown {
  constructor(el) {
    this.el = el;
    this.trigger = el.querySelector('[role="button"]');
    this.menu = el.querySelector('[role="menu"]');
    this.items = Array.from(el.querySelectorAll('[role="menuitem"]'));
    this.currentIndex = -1;

    this.trigger.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.open();
          this.focusItem(0);
          break;
        case 'Escape':
          this.close();
          break;
      }
    });

    this.menu.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          this.focusItem(this.currentIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          this.focusItem(this.currentIndex - 1);
          break;
        case 'Home':
          e.preventDefault();
          this.focusItem(0);
          break;
        case 'End':
          e.preventDefault();
          this.focusItem(this.items.length - 1);
          break;
        case 'Escape':
          this.close();
          this.trigger.focus();
          break;
      }
    });
  }

  focusItem(index) {
    // 循环导航
    if (index < 0) index = this.items.length - 1;
    if (index >= this.items.length) index = 0;
    this.currentIndex = index;
    this.items[index].focus();
  }

  open() {
    this.menu.hidden = false;
    this.trigger.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.menu.hidden = true;
    this.trigger.setAttribute('aria-expanded', 'false');
    this.currentIndex = -1;
  }
}
```

### 焦点陷阱（Focus Trap）

弹窗打开时，焦点应该限制在弹窗内，不能 Tab 到弹窗背后的内容。

```javascript
// Modal 的焦点陷阱实现
function trapFocus(element) {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ];

  const focusableElements = element.querySelectorAll(
    focusableSelectors.join(', ')
  );

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  element.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });

  // 打开弹窗时把焦点移到第一个可聚焦元素
  firstFocusable.focus();
}
```

## 颜色与视觉设计

### 颜色对比度

WCAG 2.0 要求文字和背景的对比度至少达到 **4.5:1**（普通文本）或 **3:1**（大文本，18px 以上或 14px 加粗）。

```css
/* 不好的对比度 - 浅灰字白底 */
.bad-example {
  color: #999;
  background: #fff;
  /* 对比度约 2.8:1，不达标 */
}

/* 好的对比度 */
.good-example {
  color: #595959;
  background: #fff;
  /* 对比度约 7:1，达标 */
}

/* 错误提示不要只靠颜色 */
.error-field {
  border-color: red;
  /* 色盲用户看不到红色边框的区别 */
}

/* 正确做法：颜色 + 图标 + 文字 */
.error-field {
  border-color: #d32f2f;
  border-width: 2px;
}
/* 配合 HTML */
/* <span class="error-icon" aria-hidden="true">!</span>
   <span class="error-text">此字段必填</span> */
```

### 焦点样式

```css
/* 不要随便移除 outline！ */
/* 很多人这样做 ↓ */
*:focus {
  outline: none;  /* 破坏了键盘可访问性 */
}

/* 正确做法：提供清晰的自定义焦点样式 */
:focus {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}

/* 如果一定要去掉默认 outline，必须提供替代样式 */
button:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(26, 115, 232, 0.4);
}

/* 对鼠标用户不需要焦点环，对键盘用户需要 */
/* 注意：focus-visible 在 2019 年还是较新的提案，浏览器支持有限 */
:focus:not(:focus-visible) {
  outline: none;
}
:focus-visible {
  outline: 2px solid #1a73e8;
  outline-offset: 2px;
}
```

## 图片的 alt 文本

```html
<!-- 信息性图片：描述图片内容 -->
<img src="chart.png" alt="2019年Q1销售额同比增长25%，从120万增至150万">

<!-- 装饰性图片：空 alt，屏幕阅读器跳过 -->
<img src="divider.png" alt="" role="presentation">

<!-- 链接中的图片：描述链接目标 -->
<a href="/products">
  <img src="product-thumb.jpg" alt="查看产品详情">
</a>

<!-- SVG 的无障碍处理 -->
<svg role="img" aria-labelledby="svg-title svg-desc">
  <title id="svg-title">销售趋势图</title>
  <desc id="svg-desc">折线图显示过去12个月的销售趋势，整体呈上升趋势</desc>
  <!-- SVG 内容 -->
</svg>
```

## 使用屏幕阅读器测试

光写代码不够，需要实际测试。macOS 自带 VoiceOver：

```bash
# macOS 开启 VoiceOver
# 快捷键：Cmd + F5（或 Touch ID 连按三次）

# Windows 免费屏幕阅读器
# 下载 NVDA：https://www.nvaccess.org/
```

基本的 VoiceOver 导航快捷键：

```
VO = Control + Option

VO + A：从头开始朗读
VO + →/←：逐个元素导航
VO + U：打开转子（Rotor），查看标题/链接/地标列表
VO + Space：激活当前元素
Tab：在可交互元素间跳转
```

测试时检查：
1. 能否只用键盘完成所有操作
2. 屏幕阅读器能否正确读出每个元素的含义
3. 动态内容变化时是否会被播报
4. 焦点顺序是否符合逻辑
5. 图片是否有正确的 alt 文本

## 小结

- 语义化 HTML 是无障碍的基础，尽量用原生标签而不是 div + ARIA
- ARIA 属性是补充手段，遵循"能用原生 HTML 就不用 ARIA"的原则
- 表单必须有关联的 label，错误提示要使用 `aria-invalid` 和 `role="alert"`
- 键盘导航是核心需求：所有交互元素必须可以通过 Tab 聚焦，用 Enter/Space 激活
- 颜色对比度要达标，不要只靠颜色传递信息
- 弹窗需要焦点陷阱，关闭后焦点回到触发元素
- 务必用屏幕阅读器实际测试，不要只在开发者工具里检查
