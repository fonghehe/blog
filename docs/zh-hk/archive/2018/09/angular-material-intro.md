---
title: "Angular Material 入門：構建企業級 UI 組件庫"
date: 2018-09-01 17:34:02
tags:
  - Angular
readingTime: 2
description: "Angular Material 是 Angular 官方出品的 Material Design UI 組件庫，開箱即用、可訪問性良好，適合快速構建企業管理系統。"
wordCount: 170
---

Angular Material 是 Angular 官方出品的 Material Design UI 組件庫，開箱即用、可訪問性良好，適合快速構建企業管理系統。

## 安裝與配置

```bash
ng add @angular/material
# 選擇一個預置主題，或自定義
# 是否添加 BrowserAnimationsModule？Yes
# 是否添加全局字體和圖標？Yes
```

`ng add` 會自動修改 `angular.json`、`AppModule` 等配置，無需手動處理。

## 按需引入模塊

Angular Material 遵循模塊化原則，用什麼引什麼：

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

## 數據表格 + 分頁 + 排序

企業應用最常見的場景：

```typescript
{% raw %}
@Component({
  template: `
    <mat-table [dataSource]="dataSource" matSort>
      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef mat-sort-header
          >姓名</mat-header-cell
        >
        <mat-cell *matCellDef="let row">{{ row.name }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="email">
        <mat-header-cell *matHeaderCellDef>郵箱</mat-header-cell>
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

## 對話框 Dialog

```typescript
{% raw %}
// 打開對話框
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

// 對話框組件
@Component({
  template: `
    <h2 mat-dialog-title>確認刪除</h2>
    <mat-dialog-content>確定要刪除 {{ data.name }} 嗎？</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">取消</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">刪除</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name: string }) {}
}
{% endraw %}
```

## 自定義主題

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

## 總結

Angular Material 覆蓋了企業應用 90% 的 UI 需求，搭配 Angular CDK 能處理更復雜的交互場景。關鍵是建立一個共享的 `MaterialModule`，避免在各個 feature module 裏重複引入。
