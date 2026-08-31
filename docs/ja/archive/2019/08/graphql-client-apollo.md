---
title: "GraphQLクライアント Apollo Client 実践"
date: 2019-08-12 16:38:12
tags:
  - GraphQL
readingTime: 5
description: "REST API 在复杂业务场景下经常遇到 over-fetching 和 under-fetching 的问题。GraphQL 让前端精确声明需要的数据结构，后端按需返回。Apollo Client 是目前最成熟的 GraphQL 客户端，提供了缓存、状态管理、乐观更新等开箱即用的能力。本文将以一个真实的博客管理项目"
wordCount: 630
---

複雑なビジネスシーンにおいて、REST APIはover-fetchingやunder-fetchingの問題に頻繁に直面する。GraphQLを使えば、フロントエンドが必要なデータ構造を正確に宣言でき、バックエンドは必要に応じてデータを返す。Apollo Clientは現在最も成熟したGraphQLクライアントであり、キャッシュ、状態管理、楽観的更新などの機能をすぐに使える形で提供している。本記事では実際のブログ管理プロジェクトを例に、Apollo Clientの完全な使い方を解説する。

## Apollo Clientのインストールと初期化

```bash
npm install apollo-client apollo-cache-inmemory apollo-link-http graphql graphql-tag
npm install react-apollo
```

### Apollo Clientインスタンスの作成

```js
// src/apollo/client.js
import ApolloClient from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { HttpLink } from 'apollo-link-http';

const httpLink = new HttpLink({
  uri: 'https://your-api.com/graphql',
  headers: {
    // リクエストヘッダーにtokenを含める
    authorization: `Bearer ${localStorage.getItem('token') || ''}`,
  },
});

const cache = new InMemoryCache();

const client = new ApolloClient({
  link: httpLink,
  cache,
  // 開発環境でDevToolsサポートを有効化
  connectToDevTools: true,
});

export default client;
```

### Reactアプリケーションへの導入

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

## Queryコンポーネントでデータ取得

```jsx
{% raw %}
import React from 'react';
import { Query } from 'react-apollo';
import gql from 'graphql-tag';

// GraphQLクエリの定義
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
        if (loading) return <div className="loading">読み込み中...</div>;
        if (error) return <div className="error">エラーが発生しました: {error.message}</div>;

        return (
          <div>
            <h2>記事一覧（全 {data.totalPosts} 件）</h2>
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
              もっと読み込む
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

## Mutationでデータを変更する

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
      // 楽観的更新：サーバー応答を待たずにUIを即時更新
      optimisticResponse={{
        createPost: {
          __typename: 'Post',
          id: 'temp-id',
          title,
          excerpt: content.slice(0, 100),
          author: {
            __typename: 'Author',
            name: '現在のユーザー',
            avatar: '/default-avatar.png',
          },
          createdAt: new Date().toISOString(),
          tags: tags.split(',').map(t => t.trim()),
        },
      }}
      // キャッシュ内の記事一覧を更新
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
            placeholder="記事タイトル"
            required
          />
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="記事内容"
            required
          />
          <input
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="タグ（カンマ区切り）"
          />
          <button type="submit" disabled={loading}>
            {loading ? '公開中...' : '記事を公開'}
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

## キャッシュ管理

Apollo Clientには強力なNormalized Cacheが組み込まれており、`__typename + id` をキャッシュキーとして自動的に使用する。

### dataIdFromObjectの設定

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

### キャッシュの手動操作

```js
import { useApolloClient } from 'react-apollo';

function useDeletePost() {
  const client = useApolloClient();

  const deletePost = (postId) => {
    // キャッシュから直接削除
    client.cache.evict(`Post:${postId}`);
    client.cache.gc();
  };

  return deletePost;
}
```

### refetchQueriesで関連クエリを更新

```jsx
<Mutation
  mutation={DELETE_POST}
  refetchQueries={[
    { query: GET_POSTS, variables: { page: 1, pageSize: 10 } },
  ]}
>
  {(deletePost) => (
    <button onClick={() => deletePost({ variables: { id: post.id } })}>
      削除
    </button>
  )}
</Mutation>
```

## Hooksスタイルの使い方（react-apollo 2.1+）

react-apollo 2.1以降では、Hooks APIの使用が推奨されている：

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
    // コメント投稿後に記事データを再取得
    refetchQueries: [{ query: GET_POST, variables: { id: postId } }],
  });

  const [commentText, setCommentText] = useState('');

  if (loading) return <div>読み込み中...</div>;
  if (error) return <div>読み込み失敗: {error.message}</div>;

  const { post } = data;

  return (
    <div>
      <h1>{post.title}</h1>
      <p>著者: {post.author.name}</p>
      <div dangerouslySetInnerHTML={{ __html: post.content }} />

      <h3>コメント ({post.comments.length})</h3>
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
          placeholder="コメントを入力..."
        />
        <button type="submit" disabled={submitting || !commentText.trim()}>
          {submitting ? '送信中...' : 'コメントを投稿'}
        </button>
      </form>
    </div>
  );
}
{% endraw %}
```

## 認証トークンの期限切れ処理

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
    // レスポンスヘッダーのtokenリフレッシュを確認
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
// client設定の更新
import { from } from 'apollo-link';
import authLink from './authLink';

const client = new ApolloClient({
  link: from([authLink, httpLink]),
  cache,
});
```

## まとめ

- Apollo ClientはReactエコシステムで最も成熟したGraphQLクライアントであり、データ取得・キャッシュ・状態管理の完全なソリューションを提供する
- `Query`コンポーネント（または `useQuery` フック）で宣言的にデータを取得し、ローディングとエラー状態を自動処理する
- `Mutation` と `update`・`optimisticResponse` を組み合わせることで楽観的更新を実現し、ユーザー体験を向上できる
- ApolloのNormalized Cacheは `__typename + id` でキャッシュを自動管理し、データ更新時の一貫性を保つ
- HooksスタイルのAPI（`useQuery`・`useMutation`）の使用を推奨する。コードがより簡潔になる
- 認証tokenとtoken期限切れ時のリフレッシュロジックを設定し、APIリクエストの安全性を確保すること
- `refetchQueries` は最もシンプルなデータ同期方法だが、パフォーマンスが重要な場面では手動キャッシュ操作を優先すべきである
