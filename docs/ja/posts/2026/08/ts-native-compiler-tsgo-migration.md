---
title: "ネイティブ TypeScript コンパイラ tsgo 移行実践：Monorepo で tsc から Go コンパイラへの完全記録"
date: 2026-08-11 09:47:12
tags:
  - TypeScript
readingTime: 11
description: "中規模 Monorepo を tsc から Go ネイティブコンパイラ tsgo に移行した全過程を記録。実際に高速化した場面、設定・API 層の破壊的変更、CI パイプラインの調整、ロールバック戦略、そしてそのまま再利用できる移行チェックリストを提供する。"
wordCount: 2813
---

TypeScript 7.x シリーズがリリースされた後、コミュニティで最も議論されたのは型システムの新機能ではなく、Go で書き直されたネイティブコンパイラ tsgo だった。Microsoft は TypeScript 7.0 で tsgo をオプションのコンパイラバックエンドとして正式に提供し、大規模プロジェクトの型チェック速度を一桁向上させることを目指している。筆者はチームの中規模 Monorepo（約 40 万行の TS/TSX、12 個の packages）で tsc から tsgo への移行を完了した。本記事では実際の移行プロセスで直面した高速化、障害、トレードオフを記録する。

## 何が速くなり、何が変わらなかったか

まず結論から述べる：tsgo の型チェックは確かに速いが、あらゆる場面の銀の弾丸ではない。

| 操作 | tsc 所要時間 | tsgo 所要時間 | 高速化比 |
|------|---------|----------|--------|
| フル型チェック（`--noEmit`） | 48s | 6.2s | ~7.7x |
| インクリメンタル型チェック（単一ファイル変更） | 3.8s | 0.4s | ~9.5x |
| フル emit（.js + .d.ts 生成） | 52s | 48s | ~1.1x |
| IDE プロジェクト初回読み込み | 12s | 2.1s | ~5.7x |
| IDE 編集時の診断遅延 | 800ms | 90ms | ~8.9x |

型チェックとエディタ体験の向上は顕著である――これこそが tsgo の設計上の重点だ。Go 実装のコンパイラは並列型チェックとより効率的なメモリレイアウトを活用しており、大規模コードベースでの優位性が特に際立つ。

しかし emit（コード生成）フェーズはほとんど高速化していない。tsgo は現時点では型チェックパイプラインのみを置き換えており、emit は従来の TypeScript コンパイラロジックをそのまま使用する。ボトルネックがビルド成果物の生成而非型チェックにある場合、tsgo による改善はほとんど見込めない。我々の本番ビルドでは esbuild/Rolldown で emit を行い、tsc/tsgo は型の検証にのみ使用しているため、この制限の影響は限定的だった。

## 設定と API 層の破壊的変更

移行はコマンドライン引数を変更するだけでは済まない。tsgo は一部の tsconfig オプションや Compiler API のサポートに差異がある。

### Module Resolution のエッジケース

我々のプロジェクトには内部 packages の参照チェーンがあり、`paths` + `baseUrl` + `exports` の三層マッピングの組み合わせを使用していた。tsc は正しく解決できたが、tsgo は以下のシナリオで異なる挙動を示した：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler",
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"],
      "@app/utils": ["packages/utils/src/index.ts"] // 厳密マッピング
    }
  }
}
```

問題は厳密なパスマッピング（ワイルドカードなし）と `exports` フィールドの優先順位にあった。tsc はまず `paths` の厳密マッピングに一致させ、その後 package.json の `exports` にフォールバックする。一方 tsgo は特定の状況で `exports` の解決を優先し、ソースコードではなくコンパイル済みの `.d.ts` を指してしまうことがあった。

解決策は tsconfig で `customConditions` を明示的に指定し、tsgo が正しい解決分岐を通るようにすることである：

```jsonc
{
  "compilerOptions": {
    "customConditions": ["source"],
    "paths": {
      "@app/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

同時に、参照される側の package.json にも対応する condition を追加する：

```json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

### Transformer プラグインの非互換性

これが移行における最大の障壁だった。我々は以前 2 つのカスタム transformer を使用していた：

1. `typescript-transform-paths`：コンパイル時に絶対パスを相対パスに書き換える
2. `ts-nameof`：コンパイル時に変数名を抽出してログに使用する

tsgo は TypeScript Compiler API の `createProgram` + カスタム transformer インターフェースをサポートしていない。独自の Program API を持っているが、その表面積は極めて小さく、カスタム変換ステップを注入することはできない。

`typescript-transform-paths` については、ビルドツール側で解決することにした――Rolldown/esbuild はそれ自体でパスエイリアスを処理できるため、コンパイラの介入は不要である。

`ts-nameof` については、移行前に手動の文字列定数に置き換えた。これはトレードオフである：コンパイル時の自動抽出の利便性は失われたが、非標準のコンパイラ拡張への依存は排除された。

### Program API の制限

`ts.createProgram` に基づくカスタムツール（コードジェネレータ、ドキュメント抽出ツールなど）を持っている場合、tsgo の Program API は簡略化されたサブセットであることに注意が必要だ。以下の API は tsgo では利用できないか、挙動が異なる：

- `program.getTypeChecker()` — 利用可能だが、返される TypeChecker には一部の上級メソッドが欠けている（例：`getSymbolAtLocation` が一部のノードタイプで機能しない）
- `program.getSourceFiles()` — 利用可能
- `typeChecker.getWidenedLiteralType()` — 利用不可
- カスタム `CompilerHost` — サポートされていない

我々の内部 API ドキュメント生成ツールはこれらの API に依存していたため、移行後は `ts-morph`（依然として tsc にバインドされている）を使用して独立して実行し、tsgo とプロセスを共有しないようにした。

## CI パイプラインの改修

移行前の CI typecheck ステップ：

```yaml
# 旧設定
- name: Type Check
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

移行後：

```yaml
# 新設定
- name: Install tsgo
  run: npm install -g @typescript/native-tsgo

- name: Type Check (tsgo)
  run: tsgo --noEmit -p tsconfig.json
  timeout-minutes: 2

- name: Type Check (tsc fallback)
  if: failure()
  run: npx tsc --noEmit -p tsconfig.json
  timeout-minutes: 5
```

重要な変更点は tsc を fallback として残したことだ。移行後最初の 3 ヶ月間、tsgo は特定のエッジケース構文で誤検知（false positive）を報告することが時々あった。その際 CI は自動的に tsc 検証にフォールバックし、マージフローのブロックを回避する。我々は同時に誤検知のケースを TypeScript チームの issue tracker に提出した。

実際の効果：CI の typecheck ステップの平均所要時間は 48 秒から 7 秒に短縮された（tsgo のインストール時間約 1 秒を含む）。1 日平均 30 以上の PR を出すチームにとって、これは毎日約 20 分の CI 待ち時間の節約を意味する。

さらに二重実行比較フェーズも追加した。移行初期に tsc と tsgo を同時に実行し、両者の診断出力が一致するかを確認する：

```bash
#!/bin/bash
# scripts/typecheck-compare.sh
tsgo --noEmit 2>&1 | sort > /tmp/tsgo-out.txt
tsc --noEmit 2>&1 | sort > /tmp/tsc-out.txt
diff /tmp/tsgo-out.txt /tmp/tsc-out.txt > /tmp/diff.txt
if [ -s /tmp/diff.txt ]; then
  echo "Diagnosis mismatch detected:"
  cat /tmp/diff.txt
  exit 1
fi
echo "Both compilers agree."
```

このスクリプトは移行の最初の 1 ヶ月間 CI の必須ステップとして実行され、両者の出力が安定的に一致することを確認した後、オプションの手動トリガーに格下げした。

## ロールバック戦略

tsgo への移行は可逆的だが、事前にロールバック経路を計画しておく必要がある：

1. **tsc の依存関係を維持する**：devDependencies から typescript パッケージを削除しないこと。tsgo は独立してインストールされ、両者は共存可能である
2. **tsconfig の互換性**：`tsconfig.tsc.json` を tsc 専用設定として保持し、フォールバックが必要な場合に `-p tsconfig.tsc.json` を使用する
3. **CI スイッチ**：環境変数でどのコンパイラを使用するか制御し、ハードコードを避ける

```yaml
- name: Type Check
  run: |
    if [ "$USE_TSGO" = "true" ]; then
      tsgo --noEmit -p tsconfig.json
    else
      npx tsc --noEmit -p tsconfig.tsc.json
    fi
  env:
    USE_TSGO: ${{ vars.USE_TSGO || 'true' }}
```

4. **IDE 設定**：VS Code の TypeScript 拡張はコンパイラバージョンの選択をサポートしている。`.vscode/settings.json` で以下のように指定する：

```json
{
  "typescript.tsserver.experimental.enableProjectDiagnostics": true,
  "typescript.tsdk": "./node_modules/@typescript/native-tsgo/lib"
}
```

ロールバック時は `"./node_modules/typescript/lib"` に戻すだけでよい。

## どのプロジェクトが待つべきか

すべてのプロジェクトが今すぐ移行するのに適しているわけではない。筆者の経験に基づき、以下の状況では观望を推奨する：

**待つべきケース：**
- カスタム transformer プラグインを使用しており代替手段がないプロジェクト
- `ts.createProgram` API に依存して内部ツールを構築している monorepo
- tsconfig で `paths` + `rootDirs` + `composite` の複雑な組み合わせを多用しているプロジェクト
- TypeScript の最新構文機能をいち早く採用しているプロジェクト（tsgo の新構文への追従は通常 tsc より 1〜2 マイナーバージョン遅れる）

**安心して移行できるケース：**
- 型チェックを主用途とし（`--noEmit`）、emit は他のツールが担当している
- 標準的な ESM/CJS モジュール解決を使用し、複雑な path mapping がない
- 純粋なビジネスコードプロジェクトで、コンパイラ拡張に依存していない
- 大規模 monorepo で、型チェックの所要時間が開発体験のボトルネックになっている

## 移行チェックリスト

以下は筆者が整理した、そのまま再利用可能な移行手順である：

```markdown
## tsgo 移行チェックリスト

### 事前確認
- [ ] カスタム transformer を使用していないことの確認（または代替方案の用意）
- [ ] tsc 固有の Compiler API に依存していないことの確認
- [ ] 現在の tsconfig.json のバックアップ
- [ ] tsconfig.tsc.json をフォールバック設定として作成

### インストールと設定
- [ ] @typescript/native-tsgo のインストール
- [ ] tsgo --version が正常に出力されることの確認
- [ ] tsgo --noEmit を実行して誤検知がないかの確認
- [ ] module resolution の差異を修正（該当する場合）
- [ ] IDE で tsgo を使用するよう設定

### CI 統合
- [ ] tsgo インストールステップの追加
- [ ] typecheck コマンドの置き換え
- [ ] tsc fallback ロジックの追加
- [ ] 二重実行比較スクリプトの実行（最低 2 週間）
- [ ] 診断出力の一致を確認後に二重実行を解除

### 検証とモニタリング
- [ ] 移行前後の CI typecheck 所要時間の比較
- [ ] チームメンバーからの IDE 体験フィードバックの収集
- [ ] TypeScript release notes の tsgo 修正事項の追跡
- [ ] 1 ヶ月後に完全切り替えの評価
```

## 展望

tsgo は TypeScript エンジニアリングの重要な方向性を示している：開発者が日常的に最も頻繁に行う操作（型チェック、エディタの応答）を極限のパフォーマンスに高めつつ、エコシステムの互換性を維持することだ。現在の制限（emit の未高速化、API の不完全さ）は過渡的な問題であり、TypeScript チームはすでに今後のロードマップを明確にしている。

ほとんどのフロントエンドチームにとって、今は妥当な移行ウィンドウである――ただし、自分のプロジェクトがどの面で恩恵を受け、どの面でつまずく可能性があるかを理解していることが前提だ。新しさを求めて移行すべきでもないし、保守的すぎて本当の効率向上の機会を逃すべきでもない。まずチェックリストで評価し、次にデータで判断することだ。
