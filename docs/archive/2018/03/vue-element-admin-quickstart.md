---
title: "Vue 2 + Element UI 中后台快速上手"
date: 2018-03-13 10:47:28
tags:
  - Vue
readingTime: 3
description: "中后台系统是大多数前端工程师的日常工作场景。这篇文章整理一套 Vue 2 + Element UI 的中后台基础架构，适合快速搭建新项目。"
---

中后台系统是大多数前端工程师的日常工作场景。这篇文章整理一套 Vue 2 + Element UI 的中后台基础架构，适合快速搭建新项目。

## 项目初始化

```bash
vue init webpack my-admin
cd my-admin
npm install element-ui axios vue-router vuex
```

## 目录结构

```
src/
├── api/            API 接口定义
│   ├── user.js
│   └── common.js
├── assets/         静态资源
├── components/     公共组件
│   ├── Layout/
│   └── PageHeader/
├── router/         路由配置
│   └── index.js
├── store/          Vuex 状态管理
│   ├── index.js
│   └── modules/
│       └── user.js
├── utils/          工具函数
│   ├── request.js  axios 封装
│   └── auth.js     token 管理
├── views/          页面组件
│   ├── Login/
│   ├── Dashboard/
│   └── Users/
└── main.js
```

## 布局结构

```vue
{% raw %}
<!-- src/components/Layout/index.vue -->
<template>
  <el-container style="height: 100vh">
    <!-- 侧边栏 -->
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div class="logo">
        <span v-if="!collapsed">管理系统</span>
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
          <span slot="title">仪表盘</span>
        </el-menu-item>
        <el-submenu index="user">
          <template slot="title">
            <i class="el-icon-user"></i>
            <span>用户管理</span>
          </template>
          <el-menu-item index="/users">用户列表</el-menu-item>
          <el-menu-item index="/users/roles">角色管理</el-menu-item>
        </el-submenu>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶部栏 -->
      <el-header>
        <i class="el-icon-s-fold" @click="collapsed = !collapsed"></i>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span>{{ username }} <i class="el-icon-arrow-down"></i></span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="logout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 内容区域 -->
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

## 标准列表页

中后台最常见的 CRUD 页面模式：

```vue
{% raw %}
<!-- src/views/Users/index.vue -->
<template>
  <div>
    <!-- 搜索区域 -->
    <el-form inline @submit.native.prevent="handleSearch">
      <el-form-item label="用户名">
        <el-input v-model="query.username" placeholder="请输入" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">搜索</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>

    <!-- 操作按钮 -->
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="handleCreate">新增用户</el-button>
    </div>

    <!-- 数据表格 -->
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户名" />
      <el-table-column prop="email" label="邮箱" />
      <el-table-column prop="role" label="角色">
        <template slot-scope="{ row }">
          <el-tag>{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="handleEdit(row)">编辑</el-button>
          <el-button size="mini" type="danger" @click="handleDelete(row)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      :total="total"
      :page-size="query.pageSize"
      :current-page.sync="query.page"
      @current-change="fetchList"
      layout="total, prev, pager, next"
      style="margin-top: 12px; text-align: right"
    />

    <!-- 新增/编辑弹窗 -->
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
      await this.$confirm(`确认删除用户 ${row.username}？`, "提示", {
        type: "warning",
      });
      await deleteUser(row.id);
      this.$message.success("删除成功");
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

## 表单弹窗

```vue
<!-- src/views/Users/UserDialog.vue -->
<template>
  <el-dialog
    :title="isEdit ? '编辑用户' : '新增用户'"
    :visible="true"
    @close="$emit('close')"
  >
    <el-form ref="form" :model="form" :rules="rules" label-width="80px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="邮箱" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="角色" prop="role">
        <el-select v-model="form.role">
          <el-option value="admin" label="管理员" />
          <el-option value="editor" label="编辑" />
          <el-option value="viewer" label="查看者" />
        </el-select>
      </el-form-item>
    </el-form>
    <div slot="footer">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit"
        >确定</el-button
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
        username: [{ required: true, message: "请输入用户名" }],
        email: [{ required: true, type: "email", message: "请输入正确的邮箱" }],
        role: [{ required: true, message: "请选择角色" }],
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
          this.$message.success("保存成功");
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

## 小结

这套模式能覆盖 80% 的中后台页面需求。核心是 **列表 + 搜索 + 弹窗表单** 的组合，把这个模式抽象清楚后，新功能开发速度很快。
