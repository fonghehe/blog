---
title: "Vue 2 + Element UI Admin Dashboard Quick Start"
date: 2018-03-13 10:47:28
tags:
  - Vue
readingTime: 3
description: "Admin dashboards are the everyday work environment for most frontend engineers. This article outlines a base architecture for Vue 2 + Element UI admin systems, "
---

Admin dashboards are the everyday work environment for most frontend engineers. This article outlines a base architecture for Vue 2 + Element UI admin systems, suitable for quickly bootstrapping new projects.

## Project Initialization

```bash
vue init webpack my-admin
cd my-admin
npm install element-ui axios vue-router vuex
```

## Directory Structure

```
src/
├── api/            API definitions
│   ├── user.js
│   └── common.js
├── assets/         Static assets
├── components/     Shared components
│   ├── Layout/
│   └── PageHeader/
├── router/         Route configuration
│   └── index.js
├── store/          Vuex state management
│   ├── index.js
│   └── modules/
│       └── user.js
├── utils/          Utility functions
│   ├── request.js  axios wrapper
│   └── auth.js     token management
├── views/          Page components
│   ├── Login/
│   ├── Dashboard/
│   └── Users/
└── main.js
```

## Layout Structure

```vue
{% raw %}
<!-- src/components/Layout/index.vue -->
<template>
  <el-container style="height: 100vh">
    <!-- Sidebar -->
    <el-aside :width="collapsed ? '64px' : '220px'">
      <div class="logo">
        <span v-if="!collapsed">Admin System</span>
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
          <span slot="title">Dashboard</span>
        </el-menu-item>
        <el-submenu index="user">
          <template slot="title">
            <i class="el-icon-user"></i>
            <span>User Management</span>
          </template>
          <el-menu-item index="/users">User List</el-menu-item>
          <el-menu-item index="/users/roles">Role Management</el-menu-item>
        </el-submenu>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- Header -->
      <el-header>
        <i class="el-icon-s-fold" @click="collapsed = !collapsed"></i>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span>{{ username }} <i class="el-icon-arrow-down"></i></span>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item command="logout">Logout</el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </div>
      </el-header>

      <!-- Content area -->
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

## Standard List Page

The most common CRUD page pattern in admin systems:

```vue
{% raw %}
<!-- src/views/Users/index.vue -->
<template>
  <div>
    <!-- Search area -->
    <el-form inline @submit.native.prevent="handleSearch">
      <el-form-item label="Username">
        <el-input
          v-model="query.username"
          placeholder="Enter username"
          clearable
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleSearch">Search</el-button>
        <el-button @click="handleReset">Reset</el-button>
      </el-form-item>
    </el-form>

    <!-- Action buttons -->
    <div style="margin-bottom: 12px">
      <el-button type="primary" @click="handleCreate">Add User</el-button>
    </div>

    <!-- Data table -->
    <el-table :data="tableData" v-loading="loading" border>
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="Username" />
      <el-table-column prop="email" label="Email" />
      <el-table-column prop="role" label="Role">
        <template slot-scope="{ row }">
          <el-tag>{{ row.role }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="Actions" width="150">
        <template slot-scope="{ row }">
          <el-button size="mini" @click="handleEdit(row)">Edit</el-button>
          <el-button size="mini" type="danger" @click="handleDelete(row)"
            >Delete</el-button
          >
        </template>
      </el-table-column>
    </el-table>

    <!-- Pagination -->
    <el-pagination
      :total="total"
      :page-size="query.pageSize"
      :current-page.sync="query.page"
      @current-change="fetchList"
      layout="total, prev, pager, next"
      style="margin-top: 12px; text-align: right"
    />

    <!-- Create/edit dialog -->
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
      await this.$confirm(`Delete user ${row.username}?`, "Confirm", {
        type: "warning",
      });
      await deleteUser(row.id);
      this.$message.success("Deleted successfully");
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

## Form Dialog

```vue
<!-- src/views/Users/UserDialog.vue -->
<template>
  <el-dialog
    :title="isEdit ? 'Edit User' : 'Add User'"
    :visible="true"
    @close="$emit('close')"
  >
    <el-form ref="form" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="Username" prop="username">
        <el-input v-model="form.username" />
      </el-form-item>
      <el-form-item label="Email" prop="email">
        <el-input v-model="form.email" />
      </el-form-item>
      <el-form-item label="Role" prop="role">
        <el-select v-model="form.role">
          <el-option value="admin" label="Admin" />
          <el-option value="editor" label="Editor" />
          <el-option value="viewer" label="Viewer" />
        </el-select>
      </el-form-item>
    </el-form>
    <div slot="footer">
      <el-button @click="$emit('close')">Cancel</el-button>
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
        username: [{ required: true, message: "Please enter a username" }],
        email: [
          {
            required: true,
            type: "email",
            message: "Please enter a valid email",
          },
        ],
        role: [{ required: true, message: "Please select a role" }],
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
          this.$message.success("Saved successfully");
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

## Summary

This pattern covers 80% of admin page requirements. The core is the **list + search + dialog form** combination. Once you abstract this pattern clearly, building new features becomes very fast.
