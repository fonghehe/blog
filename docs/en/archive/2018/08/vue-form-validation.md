---
title: "Vue Form Validation Best Practices"
date: 2018-08-07 09:32:38
tags:
  - Vue
readingTime: 2
description: "Form validation is one of the most frequent requirements in admin systems. After extensive use with Element UI, here's a summary of best practices."
wordCount: 88
---

Form validation is one of the most frequent requirements in admin systems. After extensive use with Element UI, here's a summary of best practices.

## Element UI Basic Validation

```html
<el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
  <el-form-item label="Username" prop="username">
    <el-input v-model="form.username" />
  </el-form-item>

  <el-form-item label="Email" prop="email">
    <el-input v-model="form.email" type="email" />
  </el-form-item>

  <el-form-item label="Password" prop="password">
    <el-input v-model="form.password" type="password" />
  </el-form-item>

  <el-form-item>
    <el-button type="primary" @click="submitForm">Submit</el-button>
    <el-button @click="resetForm">Reset</el-button>
  </el-form-item>
</el-form>
```

```javascript
export default {
  data() {
    // Custom validator
    const validatePassword = (rule, value, callback) => {
      if (!value) {
        callback(new Error("Please enter a password"));
      } else if (value.length < 8) {
        callback(new Error("Password must be at least 8 characters"));
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        callback(
          new Error(
            "Password must contain uppercase, lowercase letters and numbers",
          ),
        );
      } else {
        callback();
      }
    };

    return {
      form: { username: "", email: "", password: "" },
      rules: {
        username: [
          {
            required: true,
            message: "Please enter a username",
            trigger: "blur",
          },
          {
            min: 2,
            max: 20,
            message: "Length must be between 2 and 20 characters",
            trigger: "blur",
          },
        ],
        email: [
          { required: true, message: "Please enter an email", trigger: "blur" },
          {
            type: "email",
            message: "Please enter a valid email",
            trigger: "blur",
          },
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

## Linked Validation: Confirm Password

```javascript
data() {
  const validateConfirm = (rule, value, callback) => {
    if (value !== this.form.password) {
      callback(new Error('Passwords do not match'))
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
  // When password changes, re-trigger confirm password validation
  'form.password'() {
    if (this.form.confirmPassword) {
      this.$refs.formRef.validateField('confirmPassword')
    }
  }
}
```

## Dynamic Form Items

```html
<el-form :model="form">
  <div v-for="(item, index) in form.items" :key="index">
    <el-form-item
      :prop="'items.' + index + '.value'"
      :rules="{ required: true, message: 'Field cannot be empty' }"
    >
      <el-input v-model="item.value" />
      <el-button @click="removeItem(index)">Remove</el-button>
    </el-form-item>
  </div>
  <el-button @click="addItem">Add</el-button>
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

## Async Validation (Check If Username Already Exists)

```javascript
const validateUsername = async (rule, value, callback) => {
  if (!value) {
    callback(new Error("Please enter a username"));
    return;
  }
  try {
    const { exists } = await checkUsernameExists(value);
    if (exists) {
      callback(new Error("Username already taken"));
    } else {
      callback();
    }
  } catch (e) {
    callback(new Error("Validation failed, please try again"));
  }
};
```

## Summary

- `validate` validates all fields; `validateField` validates a single field
- Custom validators: call `callback()` to pass, `callback(new Error())` to fail
- Linked validation: watch the dependent field and manually trigger `validateField`
- Async validation: use async/await inside the custom validator
- `resetFields` resets the form to its initial state
