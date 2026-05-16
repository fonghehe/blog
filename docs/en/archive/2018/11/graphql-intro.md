---
title: "Getting Started with GraphQL: From REST to GraphQL"
date: 2018-11-13 17:09:11
tags:
  - GraphQL
readingTime: 2
description: "I've been studying GraphQL lately. Many people say it's a replacement for REST. After giving it a try, here's my understanding."
---

I've been studying GraphQL lately. Many people say it's a replacement for REST. After giving it a try, here's my understanding.

## Pain Points of REST

```
GET /users/1
→ { id: 1, name, email, avatar, phone, address, preferences... }
// Returns 50 fields, but the page only needs name and avatar (over-fetching)

GET /users/1          → user info
GET /users/1/orders   → order list
GET /users/1/orders/100/items → order details
// One page requires 3 requests (under-fetching)
```

## GraphQL's Solution

The client describes exactly what data it needs:

```graphql
# Query
query GetUserWithOrders {
  user(id: 1) {
    name # only need name
    avatar # only need avatar
    orders(limit: 5) {
      id
      total
      items {
        name
        price
      }
    }
  }
}
```

One request, returning exactly the data needed.

## Core Concepts

```graphql
# Schema: type definitions
type User {
  id: ID! # ! means non-nullable
  name: String!
  email: String!
  orders: [Order!]
}

type Order {
  id: ID!
  total: Float!
  items: [OrderItem!]
}

# Query: read operations
type Query {
  user(id: ID!): User
  users(limit: Int, offset: Int): [User!]!
}

# Mutation: write operations
type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
}

# Subscription: real-time push
type Subscription {
  orderUpdated(userId: ID!): Order!
}
```

## Using GraphQL in the Frontend (Apollo Client)

```javascript
import ApolloClient, { gql } from "apollo-boost";

const client = new ApolloClient({
  uri: "https://api.example.com/graphql",
  headers: {
    authorization: `Bearer ${getToken()}`,
  },
});

// Query
const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      name
      email
      avatar
    }
  }
`;

client
  .query({
    query: GET_USER,
    variables: { id: "1" },
  })
  .then(({ data }) => {
    console.log(data.user.name);
  });

// Mutation (write operation)
const CREATE_POST = gql`
  mutation CreatePost($title: String!, $content: String!) {
    createPost(title: $title, content: $content) {
      id
      title
    }
  }
`;

client.mutate({
  mutation: CREATE_POST,
  variables: { title: "Title", content: "Content" },
});
```

## Using GraphQL in Vue (vue-apollo)

```javascript
// main.js
import VueApollo from "vue-apollo";
Vue.use(VueApollo);

const apolloProvider = new VueApollo({ defaultClient: client });
new Vue({ apolloProvider, render: (h) => h(App) }).$mount("#app");

// Component
export default {
  apollo: {
    user: {
      query: GET_USER,
      variables() {
        return { id: this.userId };
      },
    },
  },
  props: ["userId"],
};
// Use the user variable directly in the template — loading and error states are managed automatically
```

## When to Choose GraphQL vs REST

**GraphQL is a good fit when:**

- Multiple clients (Web/Mobile/Mini-apps) have different data needs
- Data relationships are complex and the frontend needs flexible composition
- The product is rapidly iterating and APIs change frequently

**Stick with REST when:**

- Simple CRUD with stable data structures
- The team is unfamiliar with GraphQL
- You need file uploads (GraphQL makes this complicated)

## Summary

- GraphQL solves REST's over-fetching and multiple-request problems
- The client precisely describes the data it needs; the server returns exactly that
- Apollo Client is currently the most mature GraphQL client
- Not every project needs GraphQL — evaluate before adopting
