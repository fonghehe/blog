---
title: "Angular Material Intro: Building Enterprise-Grade UI"
date: 2018-09-01 17:34:02
tags:
  - Angular
readingTime: 2
description: "Angular Material is Angular's official Material Design UI component library — ready to use out of the box with good accessibility, ideal for rapidly building en"
wordCount: 111
---

Angular Material is Angular's official Material Design UI component library — ready to use out of the box with good accessibility, ideal for rapidly building enterprise admin systems.

## Installation and Setup

```bash
ng add @angular/material
# Choose a preset theme, or customize
# Add BrowserAnimationsModule? Yes
# Add global fonts and icons? Yes
```

`ng add` automatically modifies `angular.json`, `AppModule`, etc. — no manual setup needed.

## Import Modules on Demand

Angular Material follows the modular principle — import only what you use:

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

## Data Table + Pagination + Sorting

The most common scenario in enterprise apps:

```typescript
{% raw %}
@Component({
  template: `
    <mat-table [dataSource]="dataSource" matSort>
      <ng-container matColumnDef="name">
        <mat-header-cell *matHeaderCellDef mat-sort-header>Name</mat-header-cell>
        <mat-cell *matCellDef="let row">{{ row.name }}</mat-cell>
      </ng-container>
      <ng-container matColumnDef="email">
        <mat-header-cell *matHeaderCellDef>Email</mat-header-cell>
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

## Dialog

```typescript
{% raw %}
// Open a dialog
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

// Dialog component
@Component({
  template: `
    <h2 mat-dialog-title>Confirm Delete</h2>
    <mat-dialog-content>Are you sure you want to delete {{ data.name }}?</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">Delete</button>
    </mat-dialog-actions>
  `
})
export class ConfirmDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: { name: string }) {}
}
{% endraw %}
```

## Custom Theme

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

## Summary

Angular Material covers 90% of enterprise UI needs. Combined with Angular CDK it handles more complex interaction scenarios. The key is to set up a shared `MaterialModule` to avoid repeated imports in every feature module.
