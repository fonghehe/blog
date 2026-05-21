---
title: "Angular Material 入门：构建企业级 UI 组件库"
date: 2018-09-01 17:34:02
tags:
  - Angular
readingTime: 2
description: "Angular Material 是 Angular 官方出品的 Material Design UI 组件库，开箱即用、可访问性良好，适合快速构建企业管理系统。"
wordCount: 170
---

Angular Material 是 Angular 官方出品的 Material Design UI 组件库，开箱即用、可访问性良好，适合快速构建企业管理系统。

## 安装与配置

```bash
ng add @angular/material
# 选择一个预置主题，或自定义
# 是否添加 BrowserAnimationsModule？Yes
# 是否添加全局字体和图标？Yes
```

`ng add` 会自动修改 `angular.json`、`AppModule` 等配置，无需手动处理。

## 按需引入模块

Angular Material 遵循模块化原则，用什么引什么：

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

## 数据表格 + 分页 + 排序

企业应用最常见的场景：

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
        <mat-header-cell *matHeaderCellDef>邮箱</mat-header-cell>
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

## 对话框 Dialog

```typescript
{% raw %}
// 打开对话框
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

// 对话框组件
@Component({
  template: `
    <h2 mat-dialog-title>确认删除</h2>
    <mat-dialog-content>确定要删除 {{ data.name }} 吗？</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">取消</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">删除</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name: string }) {}
}
{% endraw %}
```

## 自定义主题

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

## 总结

Angular Material 覆盖了企业应用 90% 的 UI 需求，搭配 Angular CDK 能处理更复杂的交互场景。关键是建立一个共享的 `MaterialModule`，避免在各个 feature module 里重复引入。
