---
title: "JavaScript 常用設計模式實戰"
date: 2019-06-20 17:03:37
tags:
  - JavaScript
readingTime: 8
description: "設計模式不是後端專屬，前端開發中同樣大量使用。掌握這些模式，程式碼會更優雅、更易維護。"
---

設計模式不是後端專屬，前端開發中同樣大量使用。掌握這些模式，程式碼會更優雅、更易維護。

## 單例模式（Singleton）

保證一個類只有一個例項，全域性共享同一個物件。前端最常見的場景：全域性狀態管理、彈窗管理、登入態管理。

```javascript
// 實現1：閉包方式
const Singleton = (function () {
    let instance;

    function createInstance(options) {
        return {
            name: options.name,
            log() {
                console.log(`例項名稱: ${this.name}`);
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
console.log(s1 === s2); // true，始終是同一個例項
```

```javascript
// 實現2：ES6 class + 靜態方法
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
        console.log(`開啟彈窗: ${config.title}, 當前共 ${this.modals.length} 個`);
        return modal.id;
    }

    close(id) {
        const index = this.modals.findIndex(m => m.id === id);
        if (index > -1) {
            this.modals.splice(index, 1);
            console.log(`關閉彈窗, 剩餘 ${this.modals.length} 個`);
        }
    }

    closeAll() {
        this.modals = [];
        console.log('關閉所有彈窗');
    }
}

// 任意位置獲取的都是同一個管理器例項
const manager1 = ModalManager.getInstance();
const manager2 = ModalManager.getInstance();
console.log(manager1 === manager2); // true

manager1.open({ title: '確認刪除', content: '確定要刪除嗎？' });
manager2.open({ title: '提示', content: '操作成功' });
console.log(manager1.modals.length); // 2
```

```javascript
// 實現3：通用單例裝飾器（最實用）
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

// 整個專案只有一個 EventBus 例項
const createEventBus = singleton(EventBus);
const bus1 = new createEventBus();
const bus2 = new createEventBus();
console.log(bus1 === bus2); // true
```

## 工廠模式（Factory）

不直接使用 `new` 建立物件，而是通過工廠函式根據條件建立不同型別的物件。前端常見場景：建立不同型別的彈窗、表單元件、訊息通知等。

```javascript
// 通知工廠：根據型別建立不同的通知物件
class Notification {
    constructor(options) {
        this.title = options.title;
        this.message = options.message;
        this.duration = options.duration || 3000;
    }

    show() {
        throw new Error('子類必須實現 show 方法');
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
        console.log(`[錯誤] ${this.title}: ${this.message}`);
        return { type: 'error', el: '<div class="toast error">...</div>' };
    }
}

class WarningNotification extends Notification {
    show() {
        console.log(`[警告] ${this.title}: ${this.message}`);
        return { type: 'warning', el: '<div class="toast warning">...</div>' };
    }
}

// 工廠函式
function createNotification(type, options) {
    switch (type) {
        case 'success':
            return new SuccessNotification(options);
        case 'error':
            return new ErrorNotification(options);
        case 'warning':
            return new WarningNotification(options);
        default:
            throw new Error(`未知的通知型別: ${type}`);
    }
}

// 使用：呼叫者不需要知道具體的類
const notify = createNotification('success', {
    title: '儲存成功',
    message: '資料已儲存到伺服器',
});
notify.show();
// [成功] 儲存成功: 資料已儲存到伺服器
```

```javascript
// 表單欄位工廠：動態生成不同型別的表單控制元件
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
            throw new Error(`不支援的欄位型別: ${type}`);
    }
}

// 使用
const fields = [
    createFormField({ type: 'input', name: 'username', label: '使用者名稱', required: true }),
    createFormField({ type: 'input', name: 'email', label: '郵箱', inputType: 'email' }),
    createFormField({
        type: 'select', name: 'role', label: '角色',
        options: [{ value: 'admin', label: '管理員' }, { value: 'user', label: '普通使用者' }],
    }),
    createFormField({ type: 'checkbox', name: 'agree', label: '同意協議', checked: false }),
];

fields.forEach(f => console.log(f.render()));
```

## 觀察者模式 / 釋出訂閱（Observer / PubSub）

這是前端最常用的模式之一，Vue 的響應式、Redux 的 subscribe、DOM 事件都是這個模式的應用。

```javascript
// 釋出訂閱中心
class PubSub {
    constructor() {
        // 儲存事件和對應的回撥函式列表
        this.handlers = {};
    }

    // 訂閱
    on(event, handler) {
        if (!this.handlers[event]) {
            this.handlers[event] = [];
        }
        this.handlers[event].push(handler);
        // 返回取消訂閱的函式
        return () => this.off(event, handler);
    }

    // 釋出（觸發事件）
    emit(event, ...args) {
        const handlers = this.handlers[event] || [];
        handlers.forEach(handler => handler(...args));
    }

    // 取消訂閱
    off(event, handler) {
        if (!this.handlers[event]) return;
        if (!handler) {
            // 不傳 handler 則移除該事件的所有監聽
            delete this.handlers[event];
            return;
        }
        this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }

    // 只訂閱一次
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

// 場景1：元件間通訊
const unsub1 = pubsub.on('user:login', (user) => {
    console.log(`更新導航欄: 歡迎 ${user.name}`);
});

const unsub2 = pubsub.on('user:login', (user) => {
    console.log(`載入使用者資料: ${user.id}`);
});

pubsub.emit('user:login', { id: 1, name: '張三' });
// 更新導航欄: 歡迎 張三
// 載入使用者資料: 1

// 取消訂閱
unsub1();

// 場景2：once 只觸發一次
pubsub.once('page:loaded', () => {
    console.log('頁面首次載入完成，顯示引導彈窗');
});

pubsub.emit('page:loaded'); // 顯示引導彈窗
pubsub.emit('page:loaded'); // 不會再觸發
```

```javascript
// Vue 2 響應式原理簡化版（觀察者模式的經典應用）
function observe(obj) {
    if (typeof obj !== 'object' || obj === null) return;

    Object.keys(obj).forEach(key => {
        defineReactive(obj, key, obj[key]);
    });
}

function defineReactive(obj, key, val) {
    const dep = []; // 依賴收集器

    observe(val); // 遞迴處理巢狀物件

    Object.defineProperty(obj, key, {
        get() {
            // 如果當前有正在收集的 watcher，新增到依賴中
            if (Dep.target) {
                dep.push(Dep.target);
            }
            return val;
        },
        set(newVal) {
            if (newVal === val) return;
            val = newVal;
            observe(newVal);
            // 通知所有依賴（訂閱者）
            dep.forEach(watcher => watcher.update());
        },
    });
}

// 全域性依賴收集器
const Dep = { target: null };

// Watcher：訂閱者
class Watcher {
    constructor(obj, key, callback) {
        this.obj = obj;
        this.key = key;
        this.callback = callback;
        // 觸發 get，收集自己到 dep 中
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
    console.log(`name 從 "${oldVal}" 變成了 "${newVal}"`);
});

data.name = 'Vue 2.6'; // name 從 "Vue" 變成了 "Vue 2.6"
```

## 策略模式（Strategy）

定義一系列演算法，把它們封裝起來，使它們可以互相替換。避免大量的 `if-else` 或 `switch-case`。

```javascript
// 表單驗證策略
const validationStrategies = {
    required(value, fieldName) {
        if (!value || !value.toString().trim()) {
            return `${fieldName}不能為空`;
        }
        return null;
    },

    minLength(value, fieldName, min) {
        if (value.length < min) {
            return `${fieldName}長度不能小於${min}個字元`;
        }
        return null;
    },

    maxLength(value, fieldName, max) {
        if (value.length > max) {
            return `${fieldName}長度不能超過${max}個字元`;
        }
        return null;
    },

    email(value, fieldName) {
        const emailReg = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailReg.test(value)) {
            return `${fieldName}格式不正確`;
        }
        return null;
    },

    phone(value, fieldName) {
        const phoneReg = /^1[3-9]\d{9}$/;
        if (!phoneReg.test(value)) {
            return `${fieldName}格式不正確`;
        }
        return null;
    },

    pattern(value, fieldName, regex) {
        if (!regex.test(value)) {
            return `${fieldName}格式不正確`;
        }
        return null;
    },
};

// 驗證器
class FormValidator {
    constructor() {
        this.rules = [];
    }

    addRule(fieldName, value, strategy, ...args) {
        this.rules.push({ fieldName, value, strategy, args });
        return this; // 鏈式呼叫
    }

    validate() {
        const errors = [];

        this.rules.forEach(({ fieldName, value, strategy, args }) => {
            const strategyFn = validationStrategies[strategy];
            if (!strategyFn) {
                console.warn(`未知的驗證策略: ${strategy}`);
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
    .addRule('使用者名稱', 'ab', 'required')
    .addRule('使用者名稱', 'ab', 'minLength', 3)
    .addRule('郵箱', 'not-an-email', 'email')
    .addRule('手機號', '12345', 'phone');

const result = validator.validate();
console.log(result);
// {
//   valid: false,
//   errors: [
//     { field: '使用者名稱', message: '使用者名稱長度不能小於3個字元' },
//     { field: '郵箱', message: '郵箱格式不正確' },
//     { field: '手機號', message: '手機號格式不正確' }
//   ]
// }
```

```javascript
// 價格計算策略：電商場景
const pricingStrategies = {
    // 普通使用者：原價
    normal(originalPrice) {
        return originalPrice;
    },

    // 會員使用者：9 折
    vip(originalPrice) {
        return originalPrice * 0.9;
    },

    // 超級會員：7 折
    svip(originalPrice) {
        return originalPrice * 0.7;
    },

    // 滿減策略
    fullReduction(originalPrice, threshold, reduction) {
        return originalPrice >= threshold
            ? originalPrice - reduction
            : originalPrice;
    },
};

function calculatePrice(originalPrice, userType, fullReductionConfig) {
    // 會員折扣
    const discountFn = pricingStrategies[userType] || pricingStrategies.normal;
    let price = discountFn(originalPrice);

    // 滿減
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

## 裝飾器模式（Decorator）

在不修改原有物件的前提下，動態地給物件增加功能。ES7 的裝飾器語法就是基於這個模式。

```javascript
// 函式裝飾器：給函式新增日誌和效能監控
function withLog(fn, fnName) {
    return function (...args) {
        console.log(`[LOG] 呼叫 ${fnName}, 引數:`, args);
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
        console.log(`[PERF] ${fnName} 執行耗時: ${duration}ms`);
        return result;
    };
}

function withRetry(fn, maxRetries = 3) {
    return function (...args) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                return fn.apply(this, args);
            } catch (error) {
                console.log(`[RETRY] 第 ${i + 1} 次重試...`);
                if (i === maxRetries - 1) throw error;
            }
        }
    };
}

// 原始函式
function processData(data) {
    return data.map(item => item * 2);
}

// 裝飾
const enhancedProcess = withPerformance(
    withLog(processData, 'processData'),
    'processData'
);

enhancedProcess([1, 2, 3]);
// [LOG] 呼叫 processData, 引數: [[1, 2, 3]]
// [LOG] processData 返回: [2, 4, 6]
// [PERF] processData 執行耗時: 0.15ms
```

```javascript
// 類裝飾器（ES7 語法，需要 Babel 外掛）
// 裝飾器提案目前還在 Stage 3

// 給類新增 mixins 功能
function withValidation(targetClass) {
    // 在原型上新增驗證方法
    targetClass.prototype.validate = function (rules) {
        const errors = [];
        Object.keys(rules).forEach(field => {
            const value = this[field];
            const fieldRules = rules[field];

            fieldRules.forEach(rule => {
                if (rule.required && (!value && value !== 0)) {
                    errors.push(`${field} 是必填項`);
                }
                if (rule.max && value && value.length > rule.max) {
                    errors.push(`${field} 不能超過 ${rule.max} 個字元`);
                }
            });
        });

        return { valid: errors.length === 0, errors };
    };

    return targetClass;
}

// 實際用法（需要 Babel 外掛 @babel/plugin-proposal-decorators）
// @withValidation
// class UserForm {
//     constructor(name, email) {
//         this.name = name;
//         this.email = email;
//     }
// }

// 不用裝飾器語法的等價寫法
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
// { valid: false, errors: ['name 是必填項'] }
```

## 模組模式（Module）

利用閉包和 IIFE 實現私有變數和方法，這是 ES6 Module 出現之前最常用的封裝方式。

```javascript
// IIFE 模組模式
const ApiClient = (function () {
    // 私有變數
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

    // 公開 API
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

        // 外部無法直接修改 baseUrl 和 token
    };
})();

// 使用
ApiClient.init({ baseUrl: 'https://api.example.com', token: 'xxx' });
ApiClient.get('/users').then(data => console.log(data));
ApiClient.post('/users', { name: '張三' });
console.log(ApiClient.getRequestCount()); // 2
// console.log(ApiClient.baseUrl); // undefined，無法直接訪問私有變數
```

```javascript
// ES6 Module 方式（推薦）
// utils/math.js
const _cache = new Map(); // 模組私有變數，外部無法直接訪問

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

// 只匯出需要公開的方法
export { factorial, fibonacci, clearCache };
// _cache 是模組私有的，外部無法訪問
```

## 各模式在前端中的應用場景

```
模式              典型應用場景
─────────────────────────────────────────────────
單例模式          Vuex/Redux Store, 全域性 EventBus, 登入態管理
工廠模式          元件動態建立, 表單欄位生成, 通知彈窗系統
觀察者模式        Vue 響應式, DOM 事件, Redux subscribe, RxJS
策略模式          表單驗證, 價格計算, 許可權判斷, 排序演算法選擇
裝飾器模式        React HOC, 日誌/效能監控, 許可權校驗, 快取
模組模式          工具函式封裝, API 客戶端, 配置管理
```

## 小結

- **單例模式**適合全域性唯一的例項，用閉包或靜態屬性實現最簡單
- **工廠模式**把建立邏輯和使用邏輯分離，新增型別時只需改工廠函式
- **觀察者/釋出訂閱**是前端最核心的模式，Vue 響應式、DOM 事件、元件通訊都離不開它
- **策略模式**消滅 if-else 地獄，讓演算法獨立於使用它的客戶端
- **裝飾器模式**在不改原始碼的情況下增強功能，React HOC 就是它的應用
- **模組模式**封裝私有狀態，ES6 Module 是現代 JavaScript 的標準做法
- 設計模式不是銀彈，不要為了用模式而用模式，解決實際問題才是目的
