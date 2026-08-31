---
title: "フロントエンド契約テスト：Consumer-Driven Contract で API ドリフトを終結させる"
date: 2026-08-25 09:26:47
tags:
  - テスト
readingTime: 12
description: "mock 単体テストと手動統合テストがバックエンド API の変更を繰り返し見逃すとき、Consumer-Driven Contract Testing は契約の定義権をフロントエンドに委ねる。本記事では Pact と OpenAPI の 2 つの路線から、4 フロントエンドが BFF を共有するチームでの導入過程、落とし穴、そして成果を記録する。"
wordCount: 3141
---

我々のチームには 4 つのフロントエンドアプリケーション（管理画面、C 端 H5、ミニプログラム、運用ツール）が 1 つの BFF を共有している。過去 2 年間、本番障害のおよそ 3 分の 1 は「フロントエンドはフィールドが残っていると思っていたが、バックエンドはすでに変更していた」ことに起因していた。Mock データは単体テストにハードコードされており、テストは通る。統合テストは人が手動でドキュメントと突き合わせて確認し、これも通る。リリースして初めてホワイトスクリーンが発覚する。問題はテストの量が足りないことではなく、テストが検証しているものが実際の契約と一致していないことだ。

Consumer-Driven Contract Testing（CDCT）のコアアイデアは、契約の定義権をバックエンドからフロントエンドに移すことだ――API を消費する側が期待するインタラクション形式を宣言し、バックエンドは CI で自身がその期待を満たしているかを検証する。これは既存のテストを置き換えるものではなく、単体テストと E2E の間に、インターフェースドリフトを専門的に捕捉するセーフティネットを追加するものだ。

## Mock と手動突合ではなぜ不十分なのか

Mock の問題は偽物であることではなく、自動更新されないことにある。バックエンドが `user.avatar` を `user.avatarUrl` に変更しても、フロントエンドの mock ファイルは誰も修正せず、単体テストは依然としてグリーンだ。結合テストやリリース時に初めて露呈する。

手動突合は人がドキュメントを確認しフィールドを比較することを前提とする。4 つのフロントエンドが各自メンタルモデルを維持し、BFF がリリースするたびに 4 グループに通知が必要だ。一つでも漏れれば障害になる。

| 検出手段 | 何を捕らえられるか | 何を捕らえられないか |
|---------|-----------|-----------|
| Mock 単体テスト | コンポーネントロジック、状態遷移 | API 構造変更、フィールド名変更 |
| 手動結合テスト | 現行バージョンの互換性問題 | 次回リリースの破壊的変更 |
| E2E テスト | 完全なユーザーフロー | 非コアパスの API 変更 |
| 契約テスト | インターフェース構造、フィールド型、必須項目の変更 | ビジネスロジックエラー |

契約テストが埋めるのは「インターフェース構造の一貫性」という特定の隙間だ。ビジネスが正しいかどうかを検証するのではなく、双方のデータ形式に関する約束が破られていないかを検証する。

## Pact：Consumer が契約を定義し、Provider が検証する

Pact は CDCT の最も成熟した実装である。ワークフローは 3 ステップに分かれる：

1. **Consumer 側**でインタラクション期待を記述し、pact ファイルを生成する
2. **Pact Broker**が契約を保存・バージョニングする
3. **Provider 側**が CI で契約を取得し検証する

```typescript
// consumer: フロントエンド注文一覧ページの契約
import { PactV3, MatchersV3 } from '@pact-foundation/pact';

const provider = new PactV3({
  consumer: 'admin-dashboard',
  provider: 'bff-order-service',
});

describe('GET /api/orders', () => {
  it('ページネーション付き注文一覧を返す', async () => {
    const { like, eachLike, integer, string } = MatchersV3;

    await provider
      .given('3 件の注文が存在する')
      .uponReceiving('注文一覧取得リクエスト')
      .withRequest({
        method: 'GET',
        path: '/api/orders',
        query: { page: '1', pageSize: '20' },
      })
      .willRespondWith({
        status: 200,
        body: {
          total: integer(3),
          items: eachLike({
            id: string('ORD-20260801-001'),
            status: string('confirmed'),
            amount: like(9900),           // 金額単位は分
            createdAt: string('2026-08-01T10:00:00Z'),
            buyer: {
              name: string('張三'),
              phone: string('138****1234'),
            },
          }),
        },
      });

    // 実際のリクエストを実行し、レスポンスが契約にマッチするか検証
    const interaction = await provider.executeTest(async (mockserver) => {
      const res = await fetch(`${mockserver.url}/api/orders?page=1&pageSize=20`);
      return res.json();
    });

    expect(interaction.items).toHaveLength(3);
    expect(typeof interaction.items[0].amount).toBe('number');
  });
});
```

このコードの鍵はアサーション自体ではなく、`willRespondWith` 内の matcher にある。`like(9900)` は「ここが数値であればよい」、`string('ORD-...')` は「文字列形式」を表す。Pact が生成する契約ファイルは正確な値ではなく構造制約を記述するため、バックエンドは構造を一貫させていれば検証に通過でき、全く同じデータを返す必要はない。

Provider 側の検証は通常 Node.js または JVM テストスイートで実行される：

```typescript
// provider: BFF 側の契約検証
import { Verifier } from '@pact-foundation/pact';

describe('bff-order-service 契約検証', () => {
  it('admin-dashboard の契約を満たす', async () => {
    const verifier = new Verifier({
      providerBaseUrl: 'http://localhost:3000',
      pactBrokerUrl: process.env.PACT_BROKER_URL,
      provider: 'bff-order-service',
      consumerVersionSelectors: [
        { branch: 'main' },
        { deployedOrReleased: true },
      ],
      publishVerificationResult: true,
      providerVersion: process.env.GIT_SHA,
    });

    await verifier.verifyProvider();
  });
});
```

CI パイプラインの順序は：Consumer PR → pact 生成 → Broker にアップロード → Provider main ブランチの定期検証 + Provider PR が can-i-deploy チェックをトリガー。もし Provider の変更がある Consumer の契約を破壊した場合、PR が即座にレッドになる。

## OpenAPI 契約：Schema 駆動のもう一つの路線

Pact の強みは細粒度で consumer-driven な点だが、弱みは Broker インフラの導入と学習コストが必要な点だ。すでに OpenAPI spec を持つチームにとって、schema validator で契約チェックを行うことはより軽量な路線である。

```typescript
// OpenAPI spec ベースのリクエスト/レスポンス検証ミドルウェア
import openapiValidator from 'express-openapi-validator';
import swaggerParser from '@apidevtools/swagger-parser';

async function setupContractValidation(app: Express.Application) {
  const spec = await swaggerParser.validate('./openapi/bff-order.yaml');

  app.use(
    openapiValidator.middleware({
      apiSpec: spec,
      validateRequests: true,   // リクエストパラメータが spec に適合するか検証
      validateResponses: true,  // レスポンスが spec に適合するか検証
      validateSecurity: false,
    }),
  );

  // レスポンスが spec に適合しない場合、自動的に 500 + 詳細エラーを返す
  app.use((err: any, req: any, res: any, next: any) => {
    if (err.status && err.errors) {
      console.error('[Contract Violation]', {
        path: req.path,
        method: req.method,
        errors: err.errors,
      });
      res.status(500).json({
        error: 'SERVER_CONTRACT_VIOLATION',
        details: err.errors,
      });
    } else {
      next(err);
    }
  });
}
```

この方式の利点は契約がそのままドキュメントであり、spec 自体がフロントエンド・バックエンド共有の唯一の真実の源となる点だ。欠点は provider-centric であること――spec はバックエンドが保守し、フロントエンドは受動的な消費者に過ぎない。4 つのフロントエンドのニーズが一致しない場合、spec は最小公約数になりやすく、特定の Consumer が実際に依存するフィールドをカバーしきれないことがある。

筆者の推奨は両方の路線を組み合わせることだ：コア API は OpenAPI spec で基本検証を行い、重要な Consumer 固有の要件は Pact で補完する。

## 4 フロントエンド + 1 BFF のチームでの導入

我々の導入は 3 フェーズに分けた：

**フェーズ 1：最も痛い API を選んで試水。** 注文一覧を選択――4 つのフロントエンドすべてが使用し、フィールド変更が最も頻繁だった。Pact のみを使用し、admin-dashboard という 1 Consumer のみに契約を記述した。2 週間後に初めて破壊的変更を捕捉した：BFF が `buyer.phone` をオプションから削除したが（プライバシーコンプライアンスのため）、C 端 H5 がまだ電話番号のマスキング表示を行っていたことを通知していなかった。契約テストが Provider CI でレッドになり、契約を修正してからマージされた。

**フェーズ 2：他の Consumer に拡張。** 各フロントエンドアプリケーションがそれぞれの重要 API に契約を記述した。ルールを確立：コアビジネスフロー（注文、決済、返金、ユーザー情報）のみに契約を書き、内部ツール系 API には書かない。契約数は約 40 に抑え、メンテナンスコストは制御可能だった。

**フェーズ 3：OpenAPI spec をベースラインに。** BFF チームが OpenAPI spec の保守を開始し、すべての新 API はまず spec を書いてから開発することにした。spec 検証は BFF の統合テストに配置し、Pact は Consumer 固有の細粒度制約用に引き続き保持した。

導入の抵抗は主に 2 方面から来た。一つはフロントエンドの同僚が「また別の種類のテストを書くのか」と感じたことで、解決策は契約テストの記述をテンプレート化し、スキャフォールドコマンドでスケルトンコードを直接生成できるようにしたことだ。もう一つは BFF チームが契約が多すぎるとリリースペースが落ちることを懸念したことだが、breaking と non-breaking を区別することで解決した：新規フィールド追加は失敗をトリガーしない（後方互換）、フィールド削除・型変更・必須変更のみがブロックする。

## 契約テストが捕捉した典型的問題

運用開始 3 ヶ月で、契約テストは十数回の破壊的変更を阻止した。代表的なものを挙げる：

- **フィールド名変更の未同期**：`orderStatus` → `status`、3 Consumer の契約が同時にレッドに
- **戻り値の型変更**：`amount` が number から string に変更（バックエンドのシリアライゼーションフレームワークのアップグレードが原因）、Pact matcher が即座にエラー報告
- **ネスト構造のフラット化**：`buyer.name` がトップレベルの `buyerName` に引き上げられたが、Consumer はまだ `item.buyer.name` を読んでいた
- **列挙値の削除**：注文ステータスの `cancelled` が削除され `refunded` に置換されたが、C 端のステータスマッピングテーブルにこの case が欠けていた
- **ページネーションパラメータの意味変更**：`page` が 0-based から 1-based に変更されたが、ドキュメントに記載なし

これらの問題の共通点は：単体テストでは発見できない（mock は古いまま）、E2E も必ずしもカバーしない（非コアパス）、契約テストだけがコードマージ前に阻止できるということだ。

## 契約テストを使うべきでない場面

契約テストは万能ではない。以下のシナリオではむしろ負担になる：

- **内部マイクロサービス間の呼び出し**：2 つのサービスのデプロイリズムが完全に同期しており同一チームに属する場合、直接統合テストの方が効率的だ
- **サードパーティ API**：相手に自分の契約検証を実行させることはできない。ローカル mock + 定期スモークテストのみが可能
- **高度に動的な API**：GraphQL のフレキシブルクエリは従来の契約で表現するのが難しく、schema introspection + persisted queries の方が適している
- **プロトタイプ段階**：API が毎日変わるような段階では、契約を書くことは毎日の書き直しと同じだ。製品が安定してから導入すべき

判断基準はシンプルだ：2 つのチームのリリースリズムが独立しており、API 変更の履歴頻度が月 1 回を超えるなら、契約テストへの投資は価値がある。

## まとめ

契約テストが解決するのは具体的なエンジニアリングの問題だ：フロントエンドとバックエンドが独立して進化するとき、低コストでインターフェースの一貫性をどう保証するか。単体テストや E2E を置き換えるのではなく、両者の間に API 構造に対する防護層を追加する。Pact は Consumer 駆動の精緻な契約に適し、OpenAPI validator は spec 駆動のベースライン検証に適しており、両者を組み合わせて使用できる。導入時は痛点となる API 1 つから始め、徐々に拡大し、最初から全カバレッジを目指さない。最終的な衡量基準は契約の数ではなく、実際に何回のインターフェースドリフトを阻止できたかだ。
