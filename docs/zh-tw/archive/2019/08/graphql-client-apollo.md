---
title: "GraphQL 客戶端 Apollo Client 實戰"
date: 2019-08-12 16:38:12
tags:
  - GraphQL
readingTime: 5
description: "REST API 在複雜業務場景下經常遇到 over-fetching 和 under-fetching 的問題。GraphQL 讓前端精確宣告需要的資料結構，後端按需返回。Apollo Client 是目前最成熟的 GraphQL 客戶端，提供了快取、狀態管理、樂觀更新等開箱即用的能力。本文將以一個真實的部落格管理專"
---

REST API 在複雜業務場景下經常遇到 over-fetching 和 under-fetching 的問題。GraphQL 讓前端精確宣告需要的資料結構，後端按需返回。Apollo Client 是目前最成熟的 GraphQL 客戶端，提供了快取、狀態管理、樂觀更新等開箱即用的能力。本文將以一個真實的部落格管理專案為例，講解 Apollo Client 的完整使用流程。

## Apollo Client 安裝與初始化

```bash
npm install apollo-client apollo-cache-inmemory apollo-link-http graphql graphql-tag
npm install react-apollo
```

### 建立 Apollo Client 例項

```js
// src/apollo/client.js
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

const httpLink = new HttpLink({
  uri: 'https://your-api.com/graphql',
  headers: {
    // 在請求頭中攜帶 token
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  },
});

const cache = new InMemoryCache();

const client = new ApolloClient({
  link: httpLink,
  cache,
  // 開發環境下開啟開發者工具支援
  connectToDevTools: true,
});

export default client;
```

### 在 React 應用中接入

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

## 使用 Query 元件獲取資料

```jsx
{% raw %}
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

// 定義 GraphQL 查詢
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
        if (loading) return <div className="loading">載入中...</div>;
        if (error) return <div className="error">出錯了: {error.message}</div>;

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
              載入更多
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

## 使用 Mutation 修改資料

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
      // 樂觀更新：立即更新 UI，無需等待服務端響應
      optimisticResponse={{
        createPost: {
          __typename: 'Post',
          id: 'temp-id',
          title,
          excerpt: content.slice(0, 100),
          author: {
            __typename: 'Author',
            name: '當前使用者',
            avatar: '/default-avatar.png',
          },
          createdAt: new Date().toISOString(),
          tags: tags.split(',').map(t => t.trim()),
        },
      }}
      // 更新快取中的文章列表
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
            placeholder="文章標題"
            required
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="文章內容"
            required
          />
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="標籤（用逗號分隔）"
          />
          <button type="submit" disabled={loading}>
            {loading ? '釋出中...' : '釋出文章'}
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

## 快取管理

Apollo Client 內建了強大的 Normalized Cache，自動以 `__typename + id` 作為快取 key。

### 配置 dataIdFromObject

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

### 手動操作快取

```js
import { useApolloClient } from 'react-apollo';

function useDeletePost() {
  const client = useApolloClient();

  const deletePost = (postId) => {
    // 直接從快取中刪除
    client.cache.evict(`Post:${postId}`);
    client.cache.gc();
  };

  return deletePost;
}
```

### refetchQueries 重新整理關聯查詢

```jsx
<Mutation
  mutation={DELETE_POST}
  refetchQueries={[
    { query: GET_POSTS, variables: { page: 1, pageSize: 10 } },
  ]}
>
  {(deletePost) => (
    <button onClick={() => deletePost({ variables: { id: post.id } })}>
      刪除
    </button>
  )}
</Mutation>
```

## 使用 Hooks 風格（react-apollo 2.1+）

從 react-apollo 2.1 開始，推薦使用 Hooks API：

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
    // 發表評論後重新整理文章資料
    refetchQueries: [{ query: GET_POST, variables: { id: postId } }],
  });

  const [commentText, setCommentText] = useState('');

  if (loading) return <div>載入中...</div>;
  if (error) return <div>載入失敗: {error.message}</div>;

  const { post } = data;

  return (
    <div>
      <h1>{post.title}</h1>
      <p>作者: {post.author.name}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <h3>評論 ({post.comments.length})</h3>
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
          placeholder="寫下你的評論..."
        />
        <button type="submit" disabled={submitting || !commentText.trim()}>
          {submitting ? '提交中...' : '發表評論'}
        </button>
      </form>
    </div>
  );
}
{% endraw %}
```

## 處理認證 Token 過期

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
    // 檢查響應頭中的 token 重新整理
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

## 小結

- Apollo Client 是 React 生態中最成熟的 GraphQL 客戶端，提供了完整的資料獲取、快取、狀態管理方案
- 使用 `Query` 元件（或 `useQuery` Hook）宣告式地獲取資料，自動處理 loading 和 error 狀態
- `Mutation` 配合 `update` 和 `optimisticResponse` 可以實現樂觀更新，提升使用者體驗
- Apollo 的 Normalized Cache 自動以 `__typename + id` 管理快取，資料更新時保持一致性
- 推薦使用 Hooks 風格的 API（`useQuery`、`useMutation`），程式碼更簡潔
- 注意配置認證 token 和 token 過期重新整理邏輯，保證 API 請求的安全性
- `refetchQueries` 是最簡單的資料同步方式，但效能敏感場景應優先使用手動 cache 操作
