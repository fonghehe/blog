---
title: "Vueフォームバリデーションのベストプラクティス"
date: 2018-08-07 09:32:38
tags:
  - Vue
readingTime: 2
description: "フォームバリデーションは管理システムで最も頻繁に必要とされる機能です。Element UIを使って多くの実装をした経験からベストプラクティスをまとめます。"
wordCount: 236
---

フォームバリデーションは管理システムで最も頻繁に必要とされる機能です。Element UIを使って多くの実装をした経験からベストプラクティスをまとめます。

## Element UIの基本バリデーション

```html
<el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
  <el-form-item label="ユーザー名" prop="username">
    <el-input v-model="form.username" />
  </el-form-item>

  <el-form-item label="メール" prop="email">
    <el-input v-model="form.email" type="email" />
  </el-form-item>

  <el-form-item label="パスワード" prop="password">
    <el-input v-model="form.password" type="password" />
  </el-form-item>

  <el-form-item>
    <el-button type="primary" @click="submitForm">送信</el-button>
    <el-button @click="resetForm">リセット</el-button>
  </el-form-item>
</el-form>
```

```javascript
export default {
  data() {
    // カスタムバリデーター
    const validatePassword = (rule, value, callback) => {
      if (!value) {
        callback(new Error("パスワードを入力してください"));
      } else if (value.length < 8) {
        callback(new Error("パスワードは8文字以上必要です"));
      } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        callback(
          new Error("パスワードは大文字・小文字・数字を含む必要があります"),
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
            message: "ユーザー名を入力してください",
            trigger: "blur",
          },
          {
            min: 2,
            max: 20,
            message: "2〜20文字で入力してください",
            trigger: "blur",
          },
        ],
        email: [
          {
            required: true,
            message: "メールアドレスを入力してください",
            trigger: "blur",
          },
          {
            type: "email",
            message: "有効なメールアドレスを入力してください",
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

## 連動バリデーション：パスワード確認

```javascript
data() {
  const validateConfirm = (rule, value, callback) => {
    if (value !== this.form.password) {
      callback(new Error('パスワードが一致しません'))
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
  // パスワード変更時に、確認パスワードの再バリデーションをトリガー
  'form.password'() {
    if (this.form.confirmPassword) {
      this.$refs.formRef.validateField('confirmPassword')
    }
  }
}
```

## 動的フォーム項目

```html
<el-form :model="form">
  <div v-for="(item, index) in form.items" :key="index">
    <el-form-item
      :prop="'items.' + index + '.value'"
      :rules="{ required: true, message: '空にできません' }"
    >
      <el-input v-model="item.value" />
      <el-button @click="removeItem(index)">削除</el-button>
    </el-form-item>
  </div>
  <el-button @click="addItem">追加</el-button>
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

## 非同期バリデーション（ユーザー名の重複チェック）

```javascript
const validateUsername = async (rule, value, callback) => {
  if (!value) {
    callback(new Error("ユーザー名を入力してください"));
    return;
  }
  try {
    const { exists } = await checkUsernameExists(value);
    if (exists) {
      callback(new Error("このユーザー名はすでに使用されています"));
    } else {
      callback();
    }
  } catch (e) {
    callback(new Error("バリデーションに失敗しました。再試行してください"));
  }
};
```

## まとめ

- `validate`はすべて検証、`validateField`は単一フィールドを検証
- カスタムバリデーター：`callback()`で合格、`callback(new Error())`で失敗
- 連動バリデーション：依存フィールドをwatchして手動で`validateField`をトリガー
- 非同期バリデーション：カスタムバリデーター内でasync/awaitを使用
- `resetFields`でフォームを初期状態にリセット
