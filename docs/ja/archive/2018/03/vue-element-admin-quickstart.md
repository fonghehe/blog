---
title: "Vue 2 + Element UI 管理画面クイックスタート"
date: 2018-03-13 10:47:28
tags:
  - Vue
readingTime: 3
description: "管理画面システムは多くのフロントエンドエンジニアの日常業務です。この記事では Vue 2 + Element UI を使った管理画面の基本アーキテクチャをまとめます。新規プロジェクトの素早い立ち上げに適しています。"
---

管理画面システムは多くのフロントエンドエンジニアの日常業務です。この記事では Vue 2 + Element UI を使った管理画面の基本アーキテクチャをまとめます。新規プロジェクトの素早い立ち上げに適しています。

## プロジェクト初期化

```bash
vue init webpack my-admin
cd my-admin
npm install element-ui axios vue-router vuex
```

## ディレクトリ構成

```
src/
├── api/            API 定義
│   ├── user.js
│   └── common.js
├── assets/         静的リソース
├── components/     共通コンポーネント
│   ├── Layout/
│   └── PageHeader/
├── router/         ルート設定
│   └── index.js
├── store/          Vuex 状態管理
│   ├── index.js
│   └── modules/
│       └── user.js
├── utils/          ユーティリティ関数
│   ├── request.js  axios ラッパー
│   └── auth.js     トークン管理
├── views/          ページコンポーネント
│   ├── Login/
│   ├── Dashboard/
│   └── Users/
└── main.js
```

## レイアウト構成

```vue
{% raw %}
<!-- src/components/Layout/index.vue -->
<template>
  <el-container style="height: 100vh">
    <!-- サイドバー -->
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div class="logo">
        <span v-if="!collapsed">管理システム</span>
      </div>
      <el-menu
        :default-active="$route.path"
        :collapse="collapsed"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409EFF"
      >
        <el-menu-item index="/dashboard">
          <i class="el-icon-odometer"></i>
          <span slot="title">ダッシュボード</span>
        </el-menu-item>
        <el-submenu index="user">
          <template slot="title">
            <i class="el-icon-user"></i>
            <span>ユーザー管理</span>
          </template>
          <el-menu-item index="/users">ユーザー一覧</el-menu-item>
          <el-menu-item index="/users/roles">ロール管理</el-menu-item>
        </el-submenu>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- ヘッダー -->
      <el-header>
        <i class="el-icon-s-fold" @click="collapsed = !collapsed"></i>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span>{{ username }} <i class="el-icon-arrow-down"></i></span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="logout">ログアウト</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </el-header>

      <!-- コンテンツエリア -->
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script>
export default {
  data() {
    return { collapsed: false };
  },
  computed: {
    username() {
      return this.$store.getters.username;
    },
  },
  methods: {
    handleCommand(cmd) {
      if (cmd === "logout") {
        this.$store.dispatch("user/logout");
        this.$router.push("/login");
      }
    },
  },
};
</script>
{% endraw %}
```

## 標準的な一覧ページ

管理画面で最もよく使われる CRUD ページのパターン：

```vue
{% raw %}
<!-- src/views/Users/index.vue -->
<template>
  <div>
    <!-- 検索エリア -->
    <el-form inline @submit.native.prevent="handleSearch">
      <el-form-item label="ユーザー名">
        <el-input
          v-model="query.username"
          placeholder="入力してください"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">検索</el-button>
        <el-button @click="handleReset">リセット</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作ボタン -->
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="handleCreate">ユーザー追加</el-button>
    </div>

    <!-- データテーブル -->
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="ユーザー名" />
      <el-table-column prop="email" label="メール" />
      <el-table-column prop="role" label="ロール">
        <template slot-scope="{ row }">
          <el-tag>{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="handleEdit(row)">編集</el-button>
          <el-button size="mini" type="danger" @click="handleDelete(row)"
            >削除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- ページネーション -->
    <el-pagination
      :total="total"
      :page-size="query.pageSize"
      :current-page.sync="query.page"
      @current-change="fetchList"
      layout="total, prev, pager, next"
      style="margin-top: 12px; text-align: right"
    />

    <!-- 追加/編集ダイアログ -->
    <UserDialog
      v-if="dialogVisible"
      :data="currentRow"
      @close="dialogVisible = false"
      @success="handleSuccess"
    />
  </div>
</template>

<script>
import { getUserList, deleteUser } from "@/api/user";

export default {
  data() {
    return {
      loading: false,
      tableData: [],
      total: 0,
      query: { page: 1, pageSize: 20, username: "" },
      dialogVisible: false,
      currentRow: null,
    };
  },
  created() {
    this.fetchList();
  },
  methods: {
    async fetchList() {
      this.loading = true;
      try {
        const { list, total } = await getUserList(this.query);
        this.tableData = list;
        this.total = total;
      } finally {
        this.loading = false;
      }
    },
    handleSearch() {
      this.query.page = 1;
      this.fetchList();
    },
    handleReset() {
      this.query = { page: 1, pageSize: 20, username: "" };
      this.fetchList();
    },
    handleCreate() {
      this.currentRow = null;
      this.dialogVisible = true;
    },
    handleEdit(row) {
      this.currentRow = { ...row };
      this.dialogVisible = true;
    },
    async handleDelete(row) {
      await this.$confirm(`ユーザー ${row.username} を削除しますか？`, "確認", {
        type: "warning",
      });
      await deleteUser(row.id);
      this.$message.success("削除しました");
      this.fetchList();
    },
    handleSuccess() {
      this.dialogVisible = false;
      this.fetchList();
    },
  },
};
</script>
{% endraw %}
```

## フォームダイアログ

```vue
<!-- src/views/Users/UserDialog.vue -->
<template>
  <el-dialog
    :title="isEdit ? 'ユーザー編集' : 'ユーザー追加'"
    :visible="true"
    @close="$emit('close')"
  >
    <el-form ref="form" :model="form" :rules="rules" label-width="120px">
      <el-form-item label="ユーザー名" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="メール" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="ロール" prop="role">
        <el-select v-model="form.role">
          <el-option value="admin" label="管理者" />
          <el-option value="editor" label="編集者" />
          <el-option value="viewer" label="閲覧者" />
        </el-select>
      </el-form-item>
    </el-form>
    <div slot="footer">
      <el-button @click="$emit('close')">キャンセル</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit"
        >OK</el-button
      >
    </div>
  </el-dialog>
</template>

<script>
import { createUser, updateUser } from "@/api/user";

export default {
  props: {
    data: Object,
  },
  data() {
    return {
      submitting: false,
      form: {
        username: this.data?.username || "",
        email: this.data?.email || "",
        role: this.data?.role || "viewer",
      },
      rules: {
        username: [{ required: true, message: "ユーザー名を入力してください" }],
        email: [
          {
            required: true,
            type: "email",
            message: "正しいメールアドレスを入力してください",
          },
        ],
        role: [{ required: true, message: "ロールを選択してください" }],
      },
    };
  },
  computed: {
    isEdit() {
      return !!this.data?.id;
    },
  },
  methods: {
    handleSubmit() {
      this.$refs.form.validate(async (valid) => {
        if (!valid) return;
        this.submitting = true;
        try {
          if (this.isEdit) {
            await updateUser(this.data.id, this.form);
          } else {
            await createUser(this.form);
          }
          this.$message.success("保存しました");
          this.$emit("success");
        } finally {
          this.submitting = false;
        }
      });
    },
  },
};
</script>
```

## まとめ

このパターンで管理画面の要件の 80% をカバーできます。核心は**一覧 + 検索 + ダイアログフォーム**の組み合わせです。このパターンを抽象化できれば、新機能の開発スピードが大幅に向上します。
