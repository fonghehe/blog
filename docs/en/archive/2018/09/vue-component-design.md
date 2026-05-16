---
title: "Vue Component Design Principles"
date: 2018-09-03 14:47:08
tags:
  - Vue
readingTime: 1
description: "After two years writing Vue, I've started reflecting on how components should be designed. Here are several principles for making components more maintainable."
---

After two years writing Vue, I've started reflecting on how components should be designed. Here are several principles for making components more maintainable.

## Single Responsibility

Each component does one thing:

```javascript
// ❌ One component doing too much
// UserPage.vue: shows user info + handles permissions + manages pagination + calls APIs
export default {
  data() {
    return { user: null, permissions: [], list: [], page: 1 };
  },
  created() {
    this.fetchUser();
    this.fetchPermissions();
    this.fetchList();
  },
  // 200 lines of code...
};

// ✅ Separate concerns
// UserProfile.vue: only displays user info
// PermissionPanel.vue: permission management
// UserList.vue: list display (including pagination)
// UserPage.vue: composes the above, handles page-level logic
```

## Keep Props Atomic

```javascript
{% raw %}
// ❌ Passing the entire user object — component depends on its structure
props: { user: Object }
// In template: {{ user.profile.avatar }}

// ✅ Pass only what the component actually needs
props: {
  name: String,
  avatarUrl: String,
  role: String
}
{% endraw %}
```

Benefits: components are easier to test and their dependencies are clearer.

## Event Naming: Use Verbs

```javascript
// ❌ Vague event names
this.$emit("click");
this.$emit("change");
this.$emit("update");

// ✅ Event names describe what happened
this.$emit("user:saved", savedUser);
this.$emit("filter:changed", newFilter);
this.$emit("item:deleted", itemId);
```

## Never Mutate Props Directly

```javascript
// ❌ Mutating the prop (Vue will warn)
props: { value: String },
methods: {
  clear() { this.value = '' }  // Can't do this!
}

// ✅ Emit an event and let the parent update
props: { value: String },
methods: {
  clear() { this.$emit('update:value', '') }
}

// Parent component
<MyInput :value="text" @update:value="text = $event" />
// Or with .sync shorthand
<MyInput :value.sync="text" />
```

## Configurable Defaults

```javascript
props: {
  size: {
    type: String,
    default: 'medium',
    validator: (v) => ['small', 'medium', 'large'].includes(v)
  },
  loading: {
    type: Boolean,
    default: false
  }
}
```

## Controlled vs Uncontrolled

Controlled component: data is controlled by the parent (via v-model / props)

```javascript
// Controlled: parent controls the value
<SearchInput :value="searchText" @input="searchText = $event" />

// Uncontrolled: manages its own internal state
// Only emits results via events when needed
<DatePicker @change="handleDateSelect" />
```

Choose based on the use case — not all state needs to be lifted to the parent.
