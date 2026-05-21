---
title: "GraphQL in Practice: Real Experience Migrating from REST"
date: 2019-03-16 09:35:25
tags:
  - GraphQL
readingTime: 1
description: "My team tried GraphQL on a new project. After two months, here are my honest thoughts — not all good, not all bad."
wordCount: 87
---

My team tried GraphQL on a new project. After two months, here are my honest thoughts — not all good, not all bad.

## Why We Tried GraphQL

Our REST API had a few pain points:

1. Over-fetching / under-fetching: the fields the frontend needed didn't match what the endpoint returned — either too much or not enough
2. Endpoint explosion: a single page required 5–6 API calls
3. Painful API documentation maintenance

GraphQL's core idea: the frontend decides what data it wants.

## Basic Queries

```graphql
# Query language
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    orders(first: 5) {   # related data, fetched in one query
      id
      total
      status
      items {
        name
        quantity
      }
    }
  }
}

# Variables
{
  "id": "user-123"
}
```

```javascript
// React + Apollo Client
import { useQuery, gql } from "@apollo/client";

const GET_USER = gql`
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      orders(first: 5) {
        id
        total
      }
    }
  }
`;

function UserProfile({ userId }) {
  const { data, loading, error } = useQuery(GET_USER, {
    variables: { id: userId },
  });

  if (loading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <div>{data.user.name}</div>;
}
```

## Mutation: Modifying Data

```graphql
mutation CreateOrder($input: CreateOrderInput!) {
  createOrder(input: $input) {
    id
    status
    total
  }
}
```

```javascript
import { useMutation } from "@apollo/client";

const CREATE_ORDER = gql`
  mutation CreateOrder($input: CreateOrderInput!) {
    createOrder(input: $input) {
      id
      status
    }
  }
`;

function OrderForm() {
```
