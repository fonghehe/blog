---
title: "Angular Material入門：エンタープライズUIコンポーネントライブラリの構築"
date: 2018-09-01 17:34:02
tags:
  - Angular
readingTime: 2
description: "Angular Materialは、AngularオフィシャルのMaterial Design UIコンポーネントライブラリです。すぐに使えてアクセシビリティも良好で、企業の管理システムを素早く構築するのに適しています。"
wordCount: 299
---

Angular Materialは、AngularオフィシャルのMaterial Design UIコンポーネントライブラリです。すぐに使えてアクセシビリティも良好で、企業の管理システムを素早く構築するのに適しています。

## インストールと設定

```bash
ng add @angular/material
# プリセットテーマを選択するか、カスタマイズ
# BrowserAnimationsModuleを追加しますか？Yes
# グローバルフォントとアイコンを追加しますか？Yes
```

`ng add`が自動的に`angular.json`、`AppModule`などの設定を変更してくれます。手動での設定は不要です。

## モジュールのオンデマンドインポート

Angular Materialはモジュール化の原則に従い、使うものだけインポートします：

```typescript
// shared/material.module.ts
import { NgModule } from "@angular/core";
import {
  MatButtonModule,
  MatInputModule,
  MatTableModule,
  MatPaginatorModule,
  MatSortModule,
  MatDialogModule,
  MatSnackBarModule,
  MatIconModule,
  MatToolbarModule,
  MatSidenavModule,
} from "@angular/material";

const MATERIAL_MODULES = [
  MatButtonModule,
  MatInputModule,
  MatTableModule,
  MatPaginatorModule,
  MatSortModule,
  MatDialogModule,
  MatSnackBarModule,
  MatIconModule,
  MatToolbarModule,
  MatSidenavModule,
];

@NgModule({
  imports: MATERIAL_MODULES,
  exports: MATERIAL_MODULES,
})
export class MaterialModule {}
```

## データテーブル + ページネーション + ソート

企業アプリで最も一般的なシナリオ：

```typescript
{% raw %}
@Component({
  template: `
    <mat-table [dataSource]="dataSource" matSort>
      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef mat-sort-header>名前</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.name }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="email">
        <mat-header-cell *matHeaderCellDef>メール</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.email }}</mat-cell>
      </ng-container>
      <mat-header-row *matHeaderRowDef="displayedColumns"></mat-header-row>
      <mat-row *matRowDef="let row; columns: displayedColumns"></mat-row>
    </mat-table>
    <mat-paginator
      [pageSizeOptions]="[10, 25, 50]"
      showFirstLastButtons
    ></mat-paginator>
  `,
})
export class UserTableComponent implements AfterViewInit {
  displayedColumns = ["name", "email"];
  dataSource = new MatTableDataSource<User>();

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }
}
{% endraw %}
```

## ダイアログ

```typescript
{% raw %}
// ダイアログを開く
constructor(private dialog: MatDialog) {}

openConfirm(item: User) {
  const ref = this.dialog.open(ConfirmDialogComponent, {
    width: '400px',
    data: { name: item.name }
  });
  ref.afterClosed().subscribe(confirmed => {
    if (confirmed) this.deleteUser(item.id);
  });
}

// ダイアログコンポーネント
@Component({
  template: `
    <h2 mat-dialog-title>削除の確認</h2>
    <mat-dialog-content>{{ data.name }} を削除してもよろしいですか？</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">キャンセル</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">削除</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name: string }) {}
}
{% endraw %}
```

## カスタムテーマ

```scss
// styles/theme.scss
@import "~@angular/material/theming";
@include mat-core();

$primary: mat-palette($mat-indigo);
$accent: mat-palette($mat-pink, A200);
$warn: mat-palette($mat-red);

$theme: mat-light-theme($primary, $accent, $warn);
@include angular-material-theme($theme);
```

## まとめ

Angular Materialは企業アプリのUI要件の90%をカバーしています。Angular CDKと組み合わせれば、より複雑なインタラクションシナリオにも対応できます。重要なのは共有の`MaterialModule`を構築して、各featureモジュールでの重複インポートを避けることです。
