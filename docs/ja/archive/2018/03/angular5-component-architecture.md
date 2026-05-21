---
title: "Angular 5 コンポーネントアーキテクチャ：Smart/Dumb コンポーネント設計パターン"
date: 2018-03-28 16:41:01
tags:
  - Angular
readingTime: 3
description: "Angular アプリの複雑さが増すにつれて、コンポーネントの責務を適切に分割することがますます重要になります。Smart/Dumb（Container/Presentational とも呼ばれる）コンポーネントパターンは、現在最も主流な Angular コンポーネント設計の考え方です。"
wordCount: 624
---

Angular アプリの複雑さが増すにつれて、コンポーネントの責務を適切に分割することがますます重要になります。Smart/Dumb（Container/Presentational とも呼ばれる）コンポーネントパターンは、現在最も主流な Angular コンポーネント設計の考え方です。

## Smart/Dumb コンポーネントとは

**Smart コンポーネント（コンテナコンポーネント）**

- データの取得と状態管理を担当
- Service、Store と連携する
- UI の詳細は気にしない
- `@Input` で子コンポーネントにデータを渡し、子の `@Output` を監視する

**Dumb コンポーネント（プレゼンテーショナルコンポーネント）**

- UI のレンダリングのみを担当
- データはすべて `@Input` から来る
- `@Output` で上位にイベントを通知する
- 再利用可能でテストしやすい

## 例：ユーザーリスト

**Smart コンポーネント：UserListContainerComponent**

```typescript
// user-list-container.component.ts
@Component({
  selector: "app-user-list-container",
  template: `
    <app-user-list
      [users]="users$ | async"
      [loading]="loading$ | async"
      (deleteUser)="onDeleteUser($event)"
    ></app-user-list>
  `,
})
export class UserListContainerComponent implements OnInit {
  users$: Observable<User[]>;
  loading$: Observable<boolean>;

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.users$ = this.userService.getUsers();
    this.loading$ = this.userService.loading$;
  }

  onDeleteUser(userId: number) {
    this.userService.deleteUser(userId).subscribe();
  }
}
```

**Dumb コンポーネント：UserListComponent**

```typescript
{% raw %}
// user-list.component.ts
@Component({
  selector: "app-user-list",
  template: `
    <div *ngIf="loading">読み込み中...</div>
    <ul *ngIf="!loading">
      <li *ngFor="let user of users" (click)="deleteUser.emit(user.id)">
        {{ user.name }} - {{ user.email }}
      </li>
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent {
  @Input() users: User[];
  @Input() loading: boolean;
  @Output() deleteUser = new EventEmitter<number>();
}
{% endraw %}
```

## OnPush 戦略のメリット

Dumb コンポーネントに `ChangeDetectionStrategy.OnPush` を使うのは標準的な方法です。データは `@Input` からのみ来るため、Angular は Input の参照が変わったときだけ変更検知を行い、不要な再レンダリングを大幅に削減します：

```typescript
// パフォーマンス比較（100 アイテムリストのシナリオ）
// Default 戦略：毎イベントループで検査 = 毎秒数百回の検査
// OnPush 戦略：Input 参照変化時のみ検査 = 3〜5倍のパフォーマンス向上
```

## ディレクトリ構造の整理

```
src/app/users/
├── containers/
│   └── user-list-container/     # Smart
│       ├── user-list-container.component.ts
│       └── user-list-container.component.spec.ts
├── components/
│   ├── user-list/               # Dumb
│   └── user-card/               # Dumb
├── services/
│   └── user.service.ts
└── users.module.ts
```

## ルールを破るタイミング

すべてのコンポーネントが厳密に分類される必要はありません：

- ページレベルのルートコンポーネントは本質的に Smart なので、さらに Container をラップする必要はない
- 小規模アプリでの過度な分割はかえって認知的負担を増やす
- 共有 UI ライブラリのコンポーネントは Dumb を優先する

## まとめ

Smart/Dumb パターンはコンポーネントの責務を明確にし、Dumb コンポーネントに `OnPush` を組み合わせることでパフォーマンスを大幅に改善できます。このパターンは Vue や React でも同様に使えるフレームワーク非依存のフロントエンドアーキテクチャの考え方です。
