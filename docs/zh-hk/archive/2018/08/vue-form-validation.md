---
title: "Vue 表單驗證最佳實踐：落地路徑與實戰建議"
date: 2018-08-07 09:32:38
tags:
  - Vue
readingTime: 2
description: "表單驗證是後臺系統裏最頻繁的需求，用 Element UI 做了不少，整理一下最佳實踐。"
wordCount: 145
---

表單驗證是後臺系統裏最頻繁的需求，用 Element UI 做了不少，整理一下最佳實踐。

## Element UI 的基礎驗證

```html
<el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
  <el-form-item label="用户名" prop="username">
    <el-input v-model="form.username" />
  </el-form-item>

  <el-form-item label="郵箱" prop="email">
    <el-input v-model="form.email" type="email" />
  </el-form-item>

  <el-form-item label="密碼" prop="password">
    <el-input v-model="form.password" type="password" />
  </el-form-item>

  <el-form-item>
    <el-button type="primary" @click="submitForm">提交</el-button>
    <el-button @click="resetForm">重置</el-button>
  </el-form-item>
</el-form>
```

```javascript
export default {
  data() {
    // 自定義驗證器
    const validatePassword = (rule, value, callback) => {
      if (!value) {
        callback(new Error("請輸入密碼"));
      } else if (value.length < 8) {
        callback(new Error("密碼至少8位"));
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        callback(new Error("密碼須包含大小寫字母和數字"));
      } else {
        callback();
      }
    };

    return {
      form: { username: "", email: "", password: "" },
      rules: {
        username: [
          { required: true, message: "請輸入用户名", trigger: "blur" },
          { min: 2, max: 20, message: "長度 2-20 個字符", trigger: "blur" },
        ],
        email: [
          { required: true, message: "請輸入郵箱", trigger: "blur" },
          { type: "email", message: "請輸入合法郵箱", trigger: "blur" },
        ],
        password: [
          { required: true, validator: validatePassword, trigger: "blur" },
        ],
      },
    };
  },
  methods: {
    submitForm() {
      this.$refs.formRef.validate((valid) => {
        if (valid) {
          this.doSubmit();
        }
      });
    },
    resetForm() {
      this.$refs.formRef.resetFields();
    },
  },
};
```

## 聯動驗證：確認密碼

```javascript
data() {
  const validateConfirm = (rule, value, callback) => {
    if (value !== this.form.password) {
      callback(new Error('兩次輸入密碼不一致'))
    } else {
      callback()
    }
  }

  return {
    form: { password: '', confirmPassword: '' },
    rules: {
      confirmPassword: [
        { required: true, validator: validateConfirm, trigger: 'blur' }
      ]
    }
  }
},
watch: {
  // 修改密碼時，觸發確認密碼的重新驗證
  'form.password'() {
    if (this.form.confirmPassword) {
      this.$refs.formRef.validateField('confirmPassword')
    }
  }
}
```

## 動態增減表單項

```html
<el-form :model="form">
  <div v-for="(item, index) in form.items" :key="index">
    <el-form-item
      :prop="'items.' + index + '.value'"
      :rules="{ required: true, message: '不能為空' }"
    >
      <el-input v-model="item.value" />
      <el-button @click="removeItem(index)">刪除</el-button>
    </el-form-item>
  </div>
  <el-button @click="addItem">添加</el-button>
</el-form>
```

```javascript
methods: {
  addItem() {
    this.form.items.push({ value: '' })
  },
  removeItem(index) {
    this.form.items.splice(index, 1)
  }
}
```

## 異步驗證（檢查用户名是否已存在）

```javascript
const validateUsername = async (rule, value, callback) => {
  if (!value) {
    callback(new Error("請輸入用户名"));
    return;
  }
  try {
    const { exists } = await checkUsernameExists(value);
    if (exists) {
      callback(new Error("用户名已存在"));
    } else {
      callback();
    }
  } catch (e) {
    callback(new Error("驗證失敗，請重試"));
  }
};
```

## 小結

- `validate` 驗證全部，`validateField` 驗證單個字段
- 自定義驗證器：調用 `callback()` 表示通過，`callback(new Error())` 表示失敗
- 聯動驗證：watch 被依賴字段，手動觸發 `validateField`
- 異步驗證：自定義驗證器裏用 async/await
- `resetFields` 重置表單到初始狀態