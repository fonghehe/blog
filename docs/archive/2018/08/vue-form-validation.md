---
title: "Vue 表单验证最佳实践"
date: 2018-08-07 09:32:38
tags:
  - Vue
readingTime: 2
description: "表单验证是后台系统里最频繁的需求，用 Element UI 做了不少，整理一下最佳实践。"
---

表单验证是后台系统里最频繁的需求，用 Element UI 做了不少，整理一下最佳实践。

## Element UI 的基础验证

```html
<el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
  <el-form-item label="用户名" prop="username">
    <el-input v-model="form.username" />
  </el-form-item>

  <el-form-item label="邮箱" prop="email">
    <el-input v-model="form.email" type="email" />
  </el-form-item>

  <el-form-item label="密码" prop="password">
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
    // 自定义验证器
    const validatePassword = (rule, value, callback) => {
      if (!value) {
        callback(new Error("请输入密码"));
      } else if (value.length < 8) {
        callback(new Error("密码至少8位"));
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        callback(new Error("密码须包含大小写字母和数字"));
      } else {
        callback();
      }
    };

    return {
      form: { username: "", email: "", password: "" },
      rules: {
        username: [
          { required: true, message: "请输入用户名", trigger: "blur" },
          { min: 2, max: 20, message: "长度 2-20 个字符", trigger: "blur" },
        ],
        email: [
          { required: true, message: "请输入邮箱", trigger: "blur" },
          { type: "email", message: "请输入合法邮箱", trigger: "blur" },
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

## 联动验证：确认密码

```javascript
data() {
  const validateConfirm = (rule, value, callback) => {
    if (value !== this.form.password) {
      callback(new Error('两次输入密码不一致'))
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
  // 修改密码时，触发确认密码的重新验证
  'form.password'() {
    if (this.form.confirmPassword) {
      this.$refs.formRef.validateField('confirmPassword')
    }
  }
}
```

## 动态增减表单项

```html
<el-form :model="form">
  <div v-for="(item, index) in form.items" :key="index">
    <el-form-item
      :prop="'items.' + index + '.value'"
      :rules="{ required: true, message: '不能为空' }"
    >
      <el-input v-model="item.value" />
      <el-button @click="removeItem(index)">删除</el-button>
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

## 异步验证（检查用户名是否已存在）

```javascript
const validateUsername = async (rule, value, callback) => {
  if (!value) {
    callback(new Error("请输入用户名"));
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
    callback(new Error("验证失败，请重试"));
  }
};
```

## 小结

- `validate` 验证全部，`validateField` 验证单个字段
- 自定义验证器：调用 `callback()` 表示通过，`callback(new Error())` 表示失败
- 联动验证：watch 被依赖字段，手动触发 `validateField`
- 异步验证：自定义验证器里用 async/await
- `resetFields` 重置表单到初始状态