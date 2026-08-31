---
title: "GraphQL Client: Apollo Client in Practice"
date: 2019-08-12 16:38:12
tags:
  - GraphQL
readingTime: 4
description: "REST APIs often run into over-fetching and under-fetching problems in complex business scenarios. GraphQL lets the front end declare exactly the data shape it needs, and the back end returns just that. Apollo Client is the most mature GraphQL client available today, offering caching, state management, and optimistic updates out of the box. Using a real blog-admin project as an example, this article walks through the complete Apollo Client workflow."
wordCount: 260
---

REST APIs often run into over-fetching and under-fetching problems in complex business scenarios. GraphQL lets the front end declare exactly the data shape it needs, and the back end returns just that. Apollo Client is the most mature GraphQL client available today, offering caching, state management, and optimistic updates out of the box. Using a real blog-admin project as an example, this article walks through the complete Apollo Client workflow.

## Apollo Client Installation and Initialization

```bash
npm install apollo-client apollo-cache-inmemory apollo-link-http graphql graphql-tag
npm install react-apollo
```

### Creating the Apollo Client Instance

```js
// src/apollo/client.js
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

const httpLink = new HttpLink({
  uri: 'https://your-api.com/graphql',
  headers: {
    // 在请求头中携带 token
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  },
});

const cache = new InMemoryCache();

const client = new ApolloClient({
  link: httpLink,
  cache,
  // 开发环境下开启开发者工具支持
  connectToDevTools: true,
});

export default client;
```

### Wiring It into a React App

```jsx
// src/App.jsx
import React from 'react';
import { ApolloProvider } from 'react-apollo';
import client from './apollo/client';
import PostList from './components/PostList';

function App() {
  return (
    <ApolloProvider client={client}>
      <div className="app">
        <PostList />
      </div>
    </ApolloProvider>
  );
}

export default App;
```

## Using the Query Component to Fetch Data

```jsx
{% raw %}
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

// 定义 GraphQL 查询
const GET_POSTS = gql`
  query GetPosts($page: Int!, $pageSize: Int!) {
    posts(page: $page, pageSize: $pageSize) {
      id
      title
      excerpt
      author {
        name
        avatar
      }
      createdAt
      tags
    }
    totalPosts
  }
`;

function PostList() {
  return (
    <Query
      query={GET_POSTS}
      variables={{ page: 1, pageSize: 10 }}
    >
      {({ loading, error, data, fetchMore }) => {
        if (loading) return <div className="loading">加载中...</div>;
        if (error) return <div className="error">出错了: {error.message}</div>;

        return (
          <div>
            <h2>文章列表 (共 {data.totalPosts} 篇)</h2>
            {data.posts.map(post => (
              <article key={post.id} className="post-card">
                <h3>{post.title}</h3>
                <p>{post.excerpt}</p>
                <div className="meta">
                  <img src={post.author.avatar} alt={post.author.name} />
                  <span>{post.author.name}</span>
                  <span>{new Date(post.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="tags">
                  {post.tags.map(tag => (
                    <span key={tag} className="tag">{tag}</span>
                  ))}
                </div>
              </article>
            ))}

            <button onClick={() => loadMore(fetchMore, data)}>
              加载更多
            </button>
          </div>
        );
      }}
    </Query>
  );
}

function loadMore(fetchMore, data) {
  fetchMore({
    variables: {
      page: Math.ceil(data.posts.length / 10) + 1,
    },
    updateQuery: (prev, { fetchMoreResult }) => {
      if (!fetchMoreResult) return prev;
      return {
        ...prev,
        posts: [...prev.posts, ...fetchMoreResult.posts],
        totalPosts: fetchMoreResult.totalPosts,
      };
    },
  });
}

export default PostList;
{% endraw %}
```

## Using Mutation to Modify Data

```jsx
{% raw %}
import React, { useState } from 'react';
import { Mutation } from 'react-apollo';
import gql from 'graphql-tag';
import { GET_POSTS } from './PostList';

const CREATE_POST = gql`
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      id
      title
      excerpt
      author {
        name
        avatar
      }
      createdAt
      tags
    }
  }
`;

function CreatePost() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');

  return (
    <Mutation
      mutation={CREATE_POST}
      // 乐观更新：立即更新 UI，无需等待服务端响应
      optimisticResponse={{
        createPost: {
          __typename: 'Post',
          id: 'temp-id',
          title,
          excerpt: content.slice(0, 100),
          author: {
            __typename: 'Author',
            name: '当前用户',
            avatar: '/default-avatar.png',
          },
          createdAt: new Date().toISOString(),
          tags: tags.split(',').map(t => t.trim()),
        },
      }}
      // 更新缓存中的文章列表
      update={(cache, { data: { createPost } }) => {
        const data = cache.readQuery({
          query: GET_POSTS,
          variables: { page: 1, pageSize: 10 },
        });

        cache.writeQuery({
          query: GET_POSTS,
          variables: { page: 1, pageSize: 10 },
          data: {
            ...data,
            posts: [createPost, ...data.posts],
            totalPosts: data.totalPosts + 1,
          },
        });
      }}
    >
      {(createPost, { loading, error }) => (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createPost({
              variables: {
                input: { title, content, tags: tags.split(',').map(t => t.trim()) },
              },
            });
            setTitle('');
            setContent('');
            setTags('');
          }}
        >
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="文章标题"
            required
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="文章内容"
            required
          />
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="标签（用逗号分隔）"
          />
          <button type="submit" disabled={loading}>
            {loading ? '发布中...' : '发布文章'}
          </button>
          {error && <p className="error">{error.message}</p>}
        </form>
      )}
    </Mutation>
  );
}

export default CreatePost;
{% endraw %}
```

## Cache Management

Apollo Client ships with a powerful normalized cache that uses `__typename + id` as the cache key by default.

### Configuring dataIdFromObject

```js
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';

const cache = new InMemoryCache({
  dataIdFromObject: object => {
    switch (object.__typename) {
      case 'Post':
        return `Post:${object.id}`;
      case 'Comment':
        return `Comment:${object.id}`;
      default:
        return defaultDataIdFromObject(object);
    }
  },
});
```

### Manipulating the Cache Manually

```js
import { useApolloClient } from 'react-apollo';

function useDeletePost() {
  const client = useApolloClient();

  const deletePost = (postId) => {
    // 直接从缓存中删除
    client.cache.evict(`Post:${postId}`);
    client.cache.gc();
  };

  return deletePost;
}
```

### Refreshing Related Queries with refetchQueries

```jsx
<Mutation
  mutation={DELETE_POST}
  refetchQueries={[
    { query: GET_POSTS, variables: { page: 1, pageSize: 10 } },
  ]}
>
  {(deletePost) => (
    <button onClick={() => deletePost({ variables: { id: post.id } })}>
      删除
    </button>
  )}
</Mutation>
```

## Using Hooks Style (react-apollo 2.1+)

Starting with react-apollo 2.1, the Hooks API is the recommended approach:

```jsx
{% raw %}
import { useQuery, useMutation } from 'react-apollo';
import gql from 'graphql-tag';

const GET_POST = gql`
  query GetPost($id: ID!) {
    post(id: $id) {
      id
      title
      content
      author { name }
      comments {
        id
        content
        author { name }
        createdAt
      }
    }
  }
`;

const ADD_COMMENT = gql`
  mutation AddComment($postId: ID!, $content: String!) {
    addComment(postId: $postId, content: $content) {
      id
      content
      author { name }
      createdAt
    }
  }
`;

function PostDetail({ postId }) {
  const { loading, error, data } = useQuery(GET_POST, {
    variables: { id: postId },
  });

  const [addComment, { loading: submitting }] = useMutation(ADD_COMMENT, {
    // 发表评论后刷新文章数据
    refetchQueries: [{ query: GET_POST, variables: { id: postId } }],
  });

  const [commentText, setCommentText] = useState('');

  if (loading) return <div>加载中...</div>;
  if (error) return <div>加载失败: {error.message}</div>;

  const { post } = data;

  return (
    <div>
      <h1>{post.title}</h1>
      <p>作者: {post.author.name}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <h3>评论 ({post.comments.length})</h3>
      {post.comments.map(comment => (
        <div key={comment.id} className="comment">
          <strong>{comment.author.name}</strong>
          <p>{comment.content}</p>
          <time>{new Date(comment.createdAt).toLocaleString()}</time>
        </div>
      ))}

      <form onSubmit={async (e) => {
        e.preventDefault();
        await addComment({
          variables: { postId, content: commentText },
        });
        setCommentText('');
      }}>
        <textarea
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="写下你的评论..."
        />
        <button type="submit" disabled={submitting || !commentText.trim()}>
          {submitting ? '提交中...' : '发表评论'}
        </button>
      </form>
    </div>
  );
}
{% endraw %}
```

## Handling Authentication Token Expiration

```js
// src/apollo/authLink.js
import { ApolloLink } from 'apollo-link';

const authLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('token');

  operation.setContext({
    headers: {
      authorization: token ? `Bearer ${token}` : '',
    },
  });

  return forward(operation).map(response => {
    // 检查响应头中的 token 刷新
    const context = operation.getContext();
    const newToken = context.response?.headers?.get('x-refreshed-token');

    if (newToken) {
      localStorage.setItem('token', newToken);
    }

    return response;
  });
});

export default authLink;
```

```js
// 更新 client 配置
import { from } from 'apollo-link';
import authLink from './authLink';

const client = new ApolloClient({
  link: from([authLink, httpLink]),
  cache,
});
```

## Summary

- Apollo Client is the most mature GraphQL client in the React ecosystem, providing a complete solution for data fetching, caching, and state management.
- Use the `Query` component (or the `useQuery` Hook) to fetch data declaratively, with loading and error states handled automatically.
- Pair `Mutation` with `update` and `optimisticResponse` to implement optimistic updates and improve perceived performance.
- Apollo's normalized cache manages data automatically by `__typename + id`, keeping things consistent when data changes.
- Prefer the Hooks-style API (`useQuery`, `useMutation`) for cleaner code.
- Configure the auth token and token-refresh-on-expiry logic to keep API requests secure.
- `refetchQueries` is the simplest way to sync data, but for performance-sensitive cases prefer manual cache manipulation.
