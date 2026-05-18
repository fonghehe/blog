---
title: "Vue 2 + Element UI 中後臺快速上手"
date: 2018-03-13 10:47:28
tags:
  - Vue
readingTime: 3
description: "中後臺系統是大多數前端工程師的日常工作場景。這篇文章整理一套 Vue 2 + Element UI 的中後臺基礎架構，適合快速搭建新專案。"
---

中後臺系統是大多數前端工程師的日常工作場景。這篇文章整理一套 Vue 2 + Element UI 的中後臺基礎架構，適合快速搭建新專案。

## 專案初始化

```bash
vue init webpack my-admin
cd my-admin
npm install element-ui axios vue-router vuex
```

## 目錄結構

```
src/
├── api/            API 介面定義
│   ├── user.js
│   └── common.js
├── assets/         靜態資源
├── components/     公共元件
│   ├── Layout/
│   └── PageHeader/
├── router/         路由配置
│   └── index.js
├── store/          Vuex 狀態管理
│   ├── index.js
│   └── modules/
│       └── user.js
├── utils/          工具函式
│   ├── request.js  axios 封裝
│   └── auth.js     token 管理
├── views/          頁面元件
│   ├── Login/
│   ├── Dashboard/
│   └── Users/
└── main.js
```

## 佈局結構

```vue
{% raw %}
<!-- src/components/Layout/index.vue -->
<template>
  <el-container style="height: 100vh">
    <!-- 側邊欄 -->
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div class="logo">
        <span v-if="!collapsed">管理系統</span>
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
          <span slot="title">儀表盤</span>
        </el-menu-item>
        <el-submenu index="user">
          <template slot="title">
            <i class="el-icon-user"></i>
            <span>使用者管理</span>
          </template>
          <el-menu-item index="/users">使用者列表</el-menu-item>
          <el-menu-item index="/users/roles">角色管理</el-menu-item>
        </el-submenu>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 頂部欄 -->
      <el-header>
        <i class="el-icon-s-fold" @click="collapsed = !collapsed"></i>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span>{{ username }} <i class="el-icon-arrow-down"></i></span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="logout">退出登入</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 內容區域 -->
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

## 標準列表頁

中後臺最常見的 CRUD 頁面模式：

```vue
{% raw %}
<!-- src/views/Users/index.vue -->
<template>
  <div>
    <!-- 搜尋區域 -->
    <el-form inline @submit.native.prevent="handleSearch">
      <el-form-item label="使用者名稱">
        <el-input v-model="query.username" placeholder="請輸入" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">搜尋</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按鈕 -->
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="handleCreate">新增使用者</el-button>
    </div>

    <!-- 資料表格 -->
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="使用者名稱" />
      <el-table-column prop="email" label="郵箱" />
      <el-table-column prop="role" label="角色">
        <template slot-scope="{ row }">
          <el-tag>{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="handleEdit(row)">編輯</el-button>
          <el-button size="mini" type="danger" @click="handleDelete(row)"
            >刪除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- 分頁 -->
    <el-pagination
      :total="total"
      :page-size="query.pageSize"
      :current-page.sync="query.page"
      @current-change="fetchList"
      layout="total, prev, pager, next"
      style="margin-top: 12px; text-align: right"
    />

    <!-- 新增/編輯彈窗 -->
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
      await this.$confirm(`確認刪除使用者 ${row.username}？`, "提示", {
        type: "warning",
      });
      await deleteUser(row.id);
      this.$message.success("刪除成功");
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

## 表單彈窗

```vue
<!-- src/views/Users/UserDialog.vue -->
<template>
  <el-dialog
    :title="isEdit ? '編輯使用者' : '新增使用者'"
    :visible="true"
    @close="$emit('close')"
  >
    <el-form ref="form" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="使用者名稱" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="郵箱" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="角色" prop="role">
        <el-select v-model="form.role">
          <el-option value="admin" label="管理員" />
          <el-option value="editor" label="編輯" />
          <el-option value="viewer" label="檢視者" />
        </el-select>
      </el-form-item>
    </el-form>
    <div slot="footer">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit"
        >確定</el-button
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
        username: [{ required: true, message: "請輸入使用者名稱" }],
        email: [{ required: true, type: "email", message: "請輸入正確的郵箱" }],
        role: [{ required: true, message: "請選擇角色" }],
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
          this.$message.success("儲存成功");
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

## 小結

這套模式能覆蓋 80% 的中後臺頁面需求。核心是 **列表 + 搜尋 + 彈窗表單** 的組合，把這個模式抽象清楚後，新功能開發速度很快。
