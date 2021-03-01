---
title: "JavaScript 常用设计模式实战"
date: 2019-06-20 17:03:37
tags:
  - JavaScript
---

设计模式不是后端专属，前端开发中同样大量使用。掌握这些模式，代码会更优雅、更易维护。

## 单例模式（Singleton）

保证一个类只有一个实例，全局共享同一个对象。前端最常见的场景：全局状态管理、弹窗管理、登录态管理。

```javascript
// 实现1：闭包方式
const Singleton = (function () {
    let instance;

    function createInstance(options) {
        return {
            name: options.name,
            log() {
                console.log(`实例名称: ${this.name}`);
            },
        };
    }

    return {
        getInstance(options) {
            if (!instance) {
                instance = createInstance(options);
            }
            return instance;
        },
    };
})();

// 使用
const s1 = Singleton.getInstance({ name: 'app' });
const s2 = Singleton.getInstance({ name: 'other' });
console.log(s1 === s2); // true，始终是同一个实例
```

```javascript
// 实现2：ES6 class + 静态方法
class ModalManager {
    static instance = null;

    constructor() {
        this.modals = [];
    }

    static getInstance() {
        if (!ModalManager.instance) {
            ModalManager.instance = new ModalManager();
        }
        return ModalManager.instance;
    }

    open(config) {
        const modal = { id: Date.now(), ...config, visible: true };
        this.modals.push(modal);
        console.log(`打开弹窗: ${config.title}, 当前共 ${this.modals.length} 个`);
        return modal.id;
    }

    close(id) {
        const index = this.modals.findIndex(m => m.id === id);
        if (index > -1) {
            this.modals.splice(index, 1);
            console.log(`关闭弹窗, 剩余 ${this.modals.length} 个`);
        }
    }

    closeAll() {
        this.modals = [];
        console.log('关闭所有弹窗');
    }
}

// 任意位置获取的都是同一个管理器实例
const manager1 = ModalManager.getInstance();
const manager2 = ModalManager.getInstance();
console.log(manager1 === manager2); // true

manager1.open({ title: '确认删除', content: '确定要删除吗？' });
manager2.open({ title: '提示', content: '操作成功' });
console.log(manager1.modals.length); // 2
```

```javascript
// 实现3：通用单例装饰器（最实用）
function singleton(Constructor) {
    let instance;
    return function (...args) {
        if (!instance) {
            instance = new Constructor(...args);
        }
        return instance;
    };
}

// 使用
class EventBus {
    constructor() {
        this.events = {};
    }

    on(event, handler) {
        if (!this.events[event]) this.events[event] = [];
        this.events[event].push(handler);
    }

    emit(event, data) {
        (this.events[event] || []).forEach(handler => handler(data));
    }
}

// 整个项目只有一个 EventBus 实例
const createEventBus = singleton(EventBus);
const bus1 = new createEventBus();
const bus2 = new createEventBus();
console.log(bus1 === bus2); // true
```

## 工厂模式（Factory）

不直接使用 `new` 创建对象，而是通过工厂函数根据条件创建不同类型的对象。前端常见场景：创建不同类型的弹窗、表单组件、消息通知等。

```javascript
// 通知工厂：根据类型创建不同的通知对象
class Notification {
    constructor(options) {
        this.title = options.title;
        this.message = options.message;
        this.duration = options.duration || 3000;
    }

    show() {
        throw new Error('子类必须实现 show 方法');
    }
}

class SuccessNotification extends Notification {
    show() {
        console.log(`[成功] ${this.title}: ${this.message}`);
        return { type: 'success', el: '<div class="toast success">...</div>' };
    }
}

class ErrorNotification extends Notification {
    show() {
        console.log(`[错误] ${this.title}: ${this.message}`);
        return { type: 'error', el: '<div class="toast error">...</div>' };
    }
}

class WarningNotification extends Notification {
    show() {
        console.log(`[警告] ${this.title}: ${this.message}`);
        return { type: 'warning', el: '<div class="toast warning">...</div>' };
    }
}

// 工厂函数
function createNotification(type, options) {
    switch (type) {
        case 'success':
            return new SuccessNotification(options);
        case 'error':
            return new ErrorNotification(options);
        case 'warning':
            return new WarningNotification(options);
        default:
            throw new Error(`未知的通知类型: ${type}`);
    }
}

// 使用：调用者不需要知道具体的类
const notify = createNotification('success', {
    title: '保存成功',
    message: '数据已保存到服务器',
});
notify.show();
// [成功] 保存成功: 数据已保存到服务器
```

```javascript
// 表单字段工厂：动态生成不同类型的表单控件
function createFormField(config) {
    const { type, name, label, value, options } = config;

    const base = {
        name,
        label,
        value: value || '',
        required: config.required || false,
    };

    switch (type) {
        case 'input':
            return {
                ...base,
                type: 'input',
                inputType: config.inputType || 'text',
                placeholder: config.placeholder || '',
                render() {
                    return `<input type="${this.inputType}" name="${this.name}"
                            placeholder="${this.placeholder}" value="${this.value}">`;
                },
            };

        case 'select':
            return {
                ...base,
                type: 'select',
                options: options || [],
                render() {
                    const opts = this.options
                        .map(o => `<option value="${o.value}">${o.label}</option>`)
                        .join('');
                    return `<select name="${this.name}">${opts}</select>`;
                },
            };

        case 'textarea':
            return {
                ...base,
                type: 'textarea',
                rows: config.rows || 3,
                render() {
                    return `<textarea name="${this.name}" rows="${this.rows}">${this.value}</textarea>`;
                },
            };

        case 'checkbox':
            return {
                ...base,
                type: 'checkbox',
                checked: config.checked || false,
                render() {
                    const checkedAttr = this.checked ? 'checked' : '';
                    return `<input type="checkbox" name="${this.name}" ${checkedAttr}>`;
                },
            };

        default:
            throw new Error(`不支持的字段类型: ${type}`);
    }
}

// 使用
const fields = [
    createFormField({ type: 'input', name: 'username', label: '用户名', required: true }),
    createFormField({ type: 'input', name: 'email', label: '邮箱', inputType: 'email' }),
    createFormField({
        type: 'select', name: 'role', label: '角色',
        options: [{ value: 'admin', label: '管理员' }, { value: 'user', label: '普通用户' }],
    }),
    createFormField({ type: 'checkbox', name: 'agree', label: '同意协议', checked: false }),
];

fields.forEach(f => console.log(f.render()));
```

## 观察者模式 / 发布订阅（Observer / PubSub）

这是前端最常用的模式之一，Vue 的响应式、Redux 的 subscribe、DOM 事件都是这个模式的应用。

```javascript
// 发布订阅中心
class PubSub {
    constructor() {
        // 存储事件和对应的回调函数列表
        this.handlers = {};
    }

    // 订阅
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
        // 返回取消订阅的函数
        return () => this.off(event, handler);
    }

    // 发布（触发事件）
    emit(event, ...args) {
        const handlers = this.handlers[event] || [];
        handlers.forEach(handler => handler(...args));
    }

    // 取消订阅
    off(event, handler) {
        if (!this.handlers[event]) return;
        if (!handler) {
            // 不传 handler 则移除该事件的所有监听
            delete this.handlers[event];
            return;
        }
        this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }

    // 只订阅一次
    once(event, handler) {
        const wrapper = (...args) => {
            handler(...args);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
}

// 使用
const pubsub = new PubSub();

// 场景1：组件间通信
const unsub1 = pubsub.on('user:login', (user) => {
    console.log(`更新导航栏: 欢迎 ${user.name}`);
});

const unsub2 = pubsub.on('user:login', (user) => {
    console.log(`加载用户数据: ${user.id}`);
});

pubsub.emit('user:login', { id: 1, name: '张三' });
// 更新导航栏: 欢迎 张三
// 加载用户数据: 1

// 取消订阅
unsub1();

// 场景2：once 只触发一次
pubsub.once('page:loaded', () => {
    console.log('页面首次加载完成，显示引导弹窗');
});

pubsub.emit('page:loaded'); // 显示引导弹窗
pubsub.emit('page:loaded'); // 不会再触发
```

```javascript
// Vue 2 响应式原理简化版（观察者模式的经典应用）
function observe(obj) {
    if (typeof obj !== 'object' || obj === null) return;

    Object.keys(obj).forEach(key => {
        defineReactive(obj, key, obj[key]);
    });
}

function defineReactive(obj, key, val) {
    const dep = []; // 依赖收集器

    observe(val); // 递归处理嵌套对象

    Object.defineProperty(obj, key, {
        get() {
            // 如果当前有正在收集的 watcher，添加到依赖中
            if (Dep.target) {
                dep.push(Dep.target);
            }
            return val;
        },
        set(newVal) {
            if (newVal === val) return;
            val = newVal;
            observe(newVal);
            // 通知所有依赖（订阅者）
            dep.forEach(watcher => watcher.update());
        },
    });
}

// 全局依赖收集器
const Dep = { target: null };

// Watcher：订阅者
class Watcher {
    constructor(obj, key, callback) {
        this.obj = obj;
        this.key = key;
        this.callback = callback;
        // 触发 get，收集自己到 dep 中
        Dep.target = this;
        this.value = obj[key];
        Dep.target = null;
    }

    update() {
        const newVal = this.obj[this.key];
        if (newVal !== this.value) {
            this.callback(newVal, this.value);
            this.value = newVal;
        }
    }
}

// 使用
const data = { name: 'Vue', version: 2 };
observe(data);

new Watcher(data, 'name', (newVal, oldVal) => {
    console.log(`name 从 "${oldVal}" 变成了 "${newVal}"`);
});

data.name = 'Vue 2.6'; // name 从 "Vue" 变成了 "Vue 2.6"
```

## 策略模式（Strategy）

定义一系列算法，把它们封装起来，使它们可以互相替换。避免大量的 `if-else` 或 `switch-case`。

```javascript
// 表单验证策略
const validationStrategies = {
    required(value, fieldName) {
        if (!value || !value.toString().trim()) {
            return `${fieldName}不能为空`;
        }
        return null;
    },

    minLength(value, fieldName, min) {
        if (value.length < min) {
            return `${fieldName}长度不能小于${min}个字符`;
        }
        return null;
    },

    maxLength(value, fieldName, max) {
        if (value.length > max) {
            return `${fieldName}长度不能超过${max}个字符`;
        }
        return null;
    },

    email(value, fieldName) {
        const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailReg.test(value)) {
            return `${fieldName}格式不正确`;
        }
        return null;
    },

    phone(value, fieldName) {
        const phoneReg = /^1[3-9]\d{9}$/;
        if (!phoneReg.test(value)) {
            return `${fieldName}格式不正确`;
        }
        return null;
    },

    pattern(value, fieldName, regex) {
        if (!regex.test(value)) {
            return `${fieldName}格式不正确`;
        }
        return null;
    },
};

// 验证器
class FormValidator {
    constructor() {
        this.rules = [];
    }

    addRule(fieldName, value, strategy, ...args) {
        this.rules.push({ fieldName, value, strategy, args });
        return this; // 链式调用
    }

    validate() {
        const errors = [];

        this.rules.forEach(({ fieldName, value, strategy, args }) => {
            const strategyFn = validationStrategies[strategy];
            if (!strategyFn) {
                console.warn(`未知的验证策略: ${strategy}`);
                return;
            }
            const error = strategyFn(value, fieldName, ...args);
            if (error) {
                errors.push({ field: fieldName, message: error });
            }
        });

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}

// 使用
const validator = new FormValidator();
validator
    .addRule('用户名', 'ab', 'required')
    .addRule('用户名', 'ab', 'minLength', 3)
    .addRule('邮箱', 'not-an-email', 'email')
    .addRule('手机号', '12345', 'phone');

const result = validator.validate();
console.log(result);
// {
//   valid: false,
//   errors: [
//     { field: '用户名', message: '用户名长度不能小于3个字符' },
//     { field: '邮箱', message: '邮箱格式不正确' },
//     { field: '手机号', message: '手机号格式不正确' }
//   ]
// }
```

```javascript
// 价格计算策略：电商场景
const pricingStrategies = {
    // 普通用户：原价
    normal(originalPrice) {
        return originalPrice;
    },

    // 会员用户：9 折
    vip(originalPrice) {
        return originalPrice * 0.9;
    },

    // 超级会员：7 折
    svip(originalPrice) {
        return originalPrice * 0.7;
    },

    // 满减策略
    fullReduction(originalPrice, threshold, reduction) {
        return originalPrice >= threshold
            ? originalPrice - reduction
            : originalPrice;
    },
};

function calculatePrice(originalPrice, userType, fullReductionConfig) {
    // 会员折扣
    const discountFn = pricingStrategies[userType] || pricingStrategies.normal;
    let price = discountFn(originalPrice);

    // 满减
    if (fullReductionConfig) {
        price = pricingStrategies.fullReduction(
            price,
            fullReductionConfig.threshold,
            fullReductionConfig.reduction
        );
    }

    return Math.round(price * 100) / 100;
}

// 使用
console.log(calculatePrice(100, 'normal'));          // 100
console.log(calculatePrice(100, 'vip'));              // 90
console.log(calculatePrice(100, 'svip'));             // 70
console.log(calculatePrice(100, 'vip', { threshold: 80, reduction: 10 }));  // 80
```

## 装饰器模式（Decorator）

在不修改原有对象的前提下，动态地给对象增加功能。ES7 的装饰器语法就是基于这个模式。

```javascript
// 函数装饰器：给函数添加日志和性能监控
function withLog(fn, fnName) {
    return function (...args) {
        console.log(`[LOG] 调用 ${fnName}, 参数:`, args);
        const result = fn.apply(this, args);
        console.log(`[LOG] ${fnName} 返回:`, result);
        return result;
    };
}

function withPerformance(fn, fnName) {
    return function (...args) {
        const start = performance.now();
        const result = fn.apply(this, args);
        const duration = (performance.now() - start).toFixed(2);
        console.log(`[PERF] ${fnName} 执行耗时: ${duration}ms`);
        return result;
    };
}

function withRetry(fn, maxRetries = 3) {
    return function (...args) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                console.log(`[RETRY] 第 ${i + 1} 次重试...`);
                if (i === maxRetries - 1) throw error;
            }
        }
    };
}

// 原始函数
function processData(data) {
    return data.map(item => item * 2);
}

// 装饰
const enhancedProcess = withPerformance(
    withLog(processData, 'processData'),
    'processData'
);

enhancedProcess([1, 2, 3]);
// [LOG] 调用 processData, 参数: [[1, 2, 3]]
// [LOG] processData 返回: [2, 4, 6]
// [PERF] processData 执行耗时: 0.15ms
```

```javascript
// 类装饰器（ES7 语法，需要 Babel 插件）
// 装饰器提案目前还在 Stage 3

// 给类添加 mixins 功能
function withValidation(targetClass) {
    // 在原型上添加验证方法
    targetClass.prototype.validate = function (rules) {
        const errors = [];
        Object.keys(rules).forEach(field => {
            const value = this[field];
            const fieldRules = rules[field];

            fieldRules.forEach(rule => {
                if (rule.required && (!value && value !== 0)) {
                    errors.push(`${field} 是必填项`);
                }
                if (rule.max && value && value.length > rule.max) {
                    errors.push(`${field} 不能超过 ${rule.max} 个字符`);
                }
            });
        });

        return { valid: errors.length === 0, errors };
    };

    return targetClass;
}

// 实际用法（需要 Babel 插件 @babel/plugin-proposal-decorators）
// @withValidation
// class UserForm {
//     constructor(name, email) {
//         this.name = name;
//         this.email = email;
//     }
// }

// 不用装饰器语法的等价写法
class UserForm {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }
}
withValidation(UserForm);

const form = new UserForm('', 'test@example.com');
console.log(form.validate({
    name: [{ required: true }, { max: 20 }],
    email: [{ required: true }],
}));
// { valid: false, errors: ['name 是必填项'] }
```

## 模块模式（Module）

利用闭包和 IIFE 实现私有变量和方法，这是 ES6 Module 出现之前最常用的封装方式。

```javascript
// IIFE 模块模式
const ApiClient = (function () {
    // 私有变量
    let baseUrl = '';
    let token = '';
    let requestCount = 0;

    // 私有方法
    function buildHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    function logRequest(method, url) {
        requestCount++;
        console.log(`[API #${requestCount}] ${method} ${url}`);
    }

    // 公开 API
    return {
        init(config) {
            baseUrl = config.baseUrl;
            token = config.token || '';
        },

        async get(path) {
            const url = `${baseUrl}${path}`;
            logRequest('GET', url);
            const res = await fetch(url, { headers: buildHeaders() });
            return res.json();
        },

        async post(path, data) {
            const url = `${baseUrl}${path}`;
            logRequest('POST', url);
            const res = await fetch(url, {
                method: 'POST',
                headers: buildHeaders(),
                body: JSON.stringify(data),
            });
            return res.json();
        },

        getRequestCount() {
            return requestCount;
        },

        // 外部无法直接修改 baseUrl 和 token
    };
})();

// 使用
ApiClient.init({ baseUrl: 'https://api.example.com', token: 'xxx' });
ApiClient.get('/users').then(data => console.log(data));
ApiClient.post('/users', { name: '张三' });
console.log(ApiClient.getRequestCount()); // 2
// console.log(ApiClient.baseUrl); // undefined，无法直接访问私有变量
```

```javascript
// ES6 Module 方式（推荐）
// utils/math.js
const _cache = new Map(); // 模块私有变量，外部无法直接访问

function factorial(n) {
    if (n <= 1) return 1;
    if (_cache.has(n)) return _cache.get(n);
    const result = n * factorial(n - 1);
    _cache.set(n, result);
    return result;
}

function fibonacci(n) {
    if (n <= 1) return n;
    if (_cache.has(`fib_${n}`)) return _cache.get(`fib_${n}`);
    const result = fibonacci(n - 1) + fibonacci(n - 2);
    _cache.set(`fib_${n}`, result);
    return result;
}

function clearCache() {
    _cache.clear();
}

// 只导出需要公开的方法
export { factorial, fibonacci, clearCache };
// _cache 是模块私有的，外部无法访问
```

## 各模式在前端中的应用场景

```
模式              典型应用场景
─────────────────────────────────────────────────
单例模式          Vuex/Redux Store, 全局 EventBus, 登录态管理
工厂模式          组件动态创建, 表单字段生成, 通知弹窗系统
观察者模式        Vue 响应式, DOM 事件, Redux subscribe, RxJS
策略模式          表单验证, 价格计算, 权限判断, 排序算法选择
装饰器模式        React HOC, 日志/性能监控, 权限校验, 缓存
模块模式          工具函数封装, API 客户端, 配置管理
```

## 小结

- **单例模式**适合全局唯一的实例，用闭包或静态属性实现最简单
- **工厂模式**把创建逻辑和使用逻辑分离，新增类型时只需改工厂函数
- **观察者/发布订阅**是前端最核心的模式，Vue 响应式、DOM 事件、组件通信都离不开它
- **策略模式**消灭 if-else 地狱，让算法独立于使用它的客户端
- **装饰器模式**在不改源码的情况下增强功能，React HOC 就是它的应用
- **模块模式**封装私有状态，ES6 Module 是现代 JavaScript 的标准做法
- 设计模式不是银弹，不要为了用模式而用模式，解决实际问题才是目的
