---
title: "DApp フロントエンドリアルタイムデータ購読アーキテクチャ：WebSocket、Reorg、マルチタブ同期"
date: 2026-08-29 13:19:38
tags:
  - Web3
readingTime: 11
description: "dApp フロントエンドのリアルタイムデータは WebSocket を繋ぐだけでは済まない。本記事では WS provider 購読 vs ポーリング vs indexing service の選定、切断再接続・再購読戦略、チェーン上の reorg の UI 状態での処理、BroadcastChannel によるマルチタブ同期、そして TanStack Query による購読と REST スナップショットの統合パターンを網羅する。"
wordCount: 2480
---

DeFi ダッシュボードのフロントエンド開発で最も頭を悩ませるのは UI の複雑さではなく、データのリアルタイム性と一貫性だ。ユーザーの保有資産、未確認トランザクション、プールの TVL はすべて絶えず変化しており、REST ポーリングに頼ると遅延が大きすぎるかリクエスト量が爆発するかのどちらかだ。WebSocket 購読が答えのように見えるが、実際に導入すると切断再接続、チェーン上の reorg による状態巻き戻り、ユーザーが 3 つのタブを開いてそれぞれ独立した状態を維持しているといった問題に直面する。

本記事は DeFi ダッシュボードプロジェクトでリアルタイムデータ層を構築した完全な経験を整理する。技術スタックは React + viem + TanStack Query だが、考え方は他のフレームワークにも等しく適用できる。

## 3 種類のリアルタイムデータ取得方法のトレードオフ

| 方法 | 遅延 | サーバー負荷 | 実装複雑度 | 適用シーン |
|------|------|-----------|-----------|---------|
| REST ポーリング | 秒レベル | 高（頻繁なリクエスト） | 低 | 低頻度更新、フォールバック方案 |
| WebSocket Provider | ミリ秒レベル | 低（プッシュ） | 中 | ブロックヘッダー、pending tx、イベント監視 |
| Indexing Service (Subgraph) | 秒〜分レベル | 低（クエリ） | 高 | 集計データ、履歴クエリ、複雑なフィルタ |

**WebSocket Provider**（Alchemy/Infura/セルフホストノードの `eth_subscribe`）は即時応答が必要なシーンに適している：新ブロック到着、pending transaction の状態変化、コントラクトイベント。欠点は接続が不安定なことで、単一ノードのデータは不完全な場合がある。

**Indexing Service**（The Graph / Goldsky / セルフホスト indexer）は集計やフィルタが必要なシーンに適している：あるアドレスの全 swap 履歴、あるトークンの保有ランキング。チェーン上の生データを前処理して構造化クエリインターフェースに変換する。欠点はインデックス遅延があり、「起きた直後に見たい」シーンには不向きなことだ。

**REST ポーリング**を完全に捨てるべきではない。WebSocket が利用不能な時のフォールバック方案であり、購読データの一貫性を検証する基準でもある。

我々のアーキテクチャ選択は：コアリアルタイムデータは WebSocket、集計データは Subgraph、REST はフォールバック兼検証ソースとした。

## WebSocket 購読の再接続と再購読

本番環境では WebSocket の切断は異常ではなく常態だ。ネットワーク変動、プロキシタイムアウト、ノード再起動はいずれも切断を引き起こす。単純な reconnect では不十分だ――以前購読していた全 topic を再購読する必要がある。

```typescript
class ResilientWsSubscriber {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, SubscriptionConfig> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30_000;
  private onEvent: (subId: string, data: unknown) => void;

  constructor(
    private url: string,
    onEvent: (subId: string, data: unknown) => void,
  ) {
    this.onEvent = onEvent;
  }

  subscribe(config: SubscriptionConfig): string {
    const id = crypto.randomUUID();
    this.subscriptions.set(id, config);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(id, config);
    }
    // まだ接続されていない場合、connect() 確立後に全登録済み subscription が自動購読される
    return id;
  }

  unsubscribe(id: string) {
    this.subscriptions.delete(id);
    // eth_unsubscribe を送信...
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      // 再接続後に全アクティブ subscription を再購読
      for (const [id, config] of this.subscriptions) {
        this.sendSubscribe(id, config);
      }
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === 'eth_subscription') {
        this.onEvent(msg.params.subscription, msg.params.result);
      }
    };

    this.ws.onclose = () => {
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose は onerror の後に発火するため、ここではログのみ
      console.error('[WS] Connection error');
    };
  }

  private scheduleReconnect() {
    // 指数バックオフ + ジッター、雷雨群効果を回避
    const baseDelay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    const jitter = Math.random() * baseDelay * 0.3;
    const delay = baseDelay + jitter;

    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  private sendSubscribe(id: string, config: SubscriptionConfig) {
    this.ws?.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      method: 'eth_subscribe',
      params: config.params,
    }));
  }
}
```

いくつかの重要な設計ポイント：

- **subscription registry**：全アクティブ購読をメモリ内 map に保存する。再接続時に map を走査して `eth_subscribe` を再送するため、ビジネス層は切断を意識する必要がない
- **指数バックオフ + ジッター**：純粋な指数バックオフは大量のクライアントが同時に切断された際に「雷雨群効果」（thundering herd）を引き起こす。ランダムジッターを追加して再接続時間を分散させる
- **メッセージバッファリング**：上記の簡易版ではメッセージバッファリングを示していない。本番環境では切断期間中の未確認状態変更をキャッシュし、再接続後に REST で最新スナップショットを 1 回取得して較正してから、購読プッシュを再開すべきだ

## チェーン上 Reorg の UI 状態での処理

Ethereum L1 では平均して 1 日に数回の小規模 reorg が発生し、L2 はより少ないがゼロではない。フロントエンドにとって、reorg は previously "confirmed" と表示されていたトランザクションが巻き戻される可能性があることを意味する。

我々は UI に 3 段階の状態モデルを導入した：

```typescript
type TxUiStatus =
  | { phase: 'pending'; submittedAt: number }
  | { phase: 'confirmed'; blockNumber: bigint; confirmations: number }
  | { phase: 'reorged'; previousBlock: bigint; reason: string }
  | { phase: 'failed'; error: string };

// 確認数を追跡し、安全閾値に達してから final とマークする
function useTransactionStatus(txHash: `0x${string}`) {
  const [status, setStatus] = useState<TxUiStatus>({ phase: 'pending', submittedAt: Date.now() });
  const safeConfirmations = 12n; // L1 の一般的な閾値；L2 は 1 に設定可能

  useEffect(() => {
    const unsub = subscriber.subscribe({
      type: 'newHeads',
      params: ['newHeads'],
    }, async (newHead) => {
      const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

      if (!receipt) {
        // トランザクションがどのブロックにもない → reorg された可能性
        if (status.phase === 'confirmed') {
          setStatus({
            phase: 'reorged',
            previousBlock: receipt?.blockNumber ?? 0n,
            reason: 'Transaction no longer in canonical chain',
          });
        }
        return;
      }

      const currentBlock = BigInt(newHead.number);
      const confirmations = currentBlock - receipt.blockNumber + 1n;

      if (confirmations >= safeConfirmations) {
        setStatus({
          phase: 'confirmed',
          blockNumber: receipt.blockNumber,
          confirmations: Number(confirmations),
        });
      } else {
        setStatus({
          phase: 'confirmed',
          blockNumber: receipt.blockNumber,
          confirmations: Number(confirmations),
        });
      }
    });

    return () => subscriber.unsubscribe(unsub);
  }, [txHash]);

  return status;
}
```

UI 層の表示ルール：

- **pending**：ローディングアニメーション + 「確認待ち」を表示
- **confirmed (confirmations < safe)**：緑のチェック + 「N/12 確認」、プログレスバーが増加
- **confirmed (confirmations >= safe)**：緑のチェック + 「確認済み」
- **reorged**：黄色の警告 + 「トランザクションが再編されました、再確認中...」、自動的に pending 監視に戻る
- **failed**：赤のバツ + エラー理由

reorg 状態の持続時間は通常非常に短い（数秒〜数十秒）ため、UI は modal でユーザーの操作を中断すべきではなく、inline banner で通知すべきだ。

## マルチタブ状態同期：BroadcastChannel

ユーザーはしばしば複数のタブで同じ dApp を開く――1 つは portfolio、1 つは swap、1 つは governance。各タブが個別に WebSocket 接続を維持するのはリソースの無駄であり、状態の不整合を引き起こす可能性もある。

BroadcastChannel API は同一オリジンのタブ間でメッセージをブロードキャストできる：

```typescript
class CrossTabSync {
  private channel: BroadcastChannel;
  private isLeader = false;
  private leaderId: string | null = null;
  private tabId = crypto.randomUUID();

  constructor(channelName: string) {
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (event) => this.handleMessage(event.data);

    // Leader election: 最初に開かれたタブが leader になる
    this.channel.postMessage({ type: 'election', tabId: this.tabId });
  }

  private handleMessage(msg: CrossTabMessage) {
    switch (msg.type) {
      case 'election':
        // シンプルな戦略：tabId の辞書順最小が leader
        if (!this.leaderId || msg.tabId < this.leaderId) {
          this.leaderId = msg.tabId;
          this.isLeader = msg.tabId === this.tabId;
        }
        break;

      case 'state-update':
        // 非 leader タブは leader からプッシュされた状態を受信
        if (!this.isLeader && msg.tabId === this.leaderId) {
          this.applyRemoteState(msg.key, msg.value);
        }
        break;

      case 'leader-heartbeat':
        if (msg.tabId === this.leaderId) {
          this.resetLeaderTimeout();
        }
        break;
    }
  }

  broadcast(key: string, value: unknown) {
    if (this.isLeader) {
      this.channel.postMessage({
        type: 'state-update',
        tabId: this.tabId,
        key,
        value,
      });
    }
  }

  // Leader は定期的にハートビートを送信、ダウンしたら他のタブが接管
  startHeartbeat(intervalMs = 3000) {
    setInterval(() => {
      if (this.isLeader) {
        this.channel.postMessage({ type: 'leader-heartbeat', tabId: this.tabId });
      }
    }, intervalMs);
  }

  private applyRemoteState(key: string, value: unknown) {
    // ローカル store/cache を更新
    window.dispatchEvent(new CustomEvent('cross-tab-state', {
      detail: { key, value },
    }));
  }
}
```

この設計のコアアイデアは：**1 つのタブのみが WebSocket 接続を保持（leader）し**、他のタブは BroadcastChannel を通じて状態更新を受信することだ。RPC ノードへの接続数とリクエスト量を削減でき、マルチタブ間のデータ競合も回避できる。

BroadcastChannel は同一オリジンのタブ間でのみ動作し、クロスオリジンも Service Worker もサポートしないことに注意。より複雑なシナリオでは SharedWorker を検討できるが、ほとんどの dApp は BroadcastChannel で十分だ。

## WebSocket がブロックされた時のフォールバック

企業ネットワークや一部の地域の ISP は WebSocket をブロックする。検出と処理戦略：

```typescript
async function createTransport(): Promise<Transport> {
  // まず WebSocket を試行
  try {
    const ws = new WebSocket(wsRpcUrl);
    const connected = await Promise.race([
      new Promise<boolean>((resolve) => {
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
      }),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000)),
    ]);

    if (connected) {
      ws.close();
      return webSocket(wsRpcUrl);
    }
  } catch {
    // WebSocket 利用不可
  }

  // HTTP ポーリングにフォールバック
  console.warn('[Transport] WebSocket unavailable, falling back to HTTP polling');
  return http(httpRpcUrl, {
    retryCount: 3,
    retryDelay: 2000,
  });
}
```

フォールバック後のユーザー体験の違いは UI に反映すべきだ：ページ上部に目立たないヒント「リアルタイムデータは定期リフレッシュモードに切り替わりました」を表示し、データに数秒の遅延がある可能性があることをユーザーに知らせる。何も問題がないふりをしてはいけない――ユーザーが知らずに古いデータに基づいて取引判断を下すことこそが本当のリスクだ。

## TanStack Query 統合：購読 + REST スナップショットの融合

TanStack Query が管理するのは REST/API データであり、WebSocket がプッシュするのはインクリメンタルイベントだ。両者には橋渡しが必要だ：

```typescript
function useTokenBalance(address: Address, token: Address) {
  // REST スナップショットを基礎データとする
  const query = useQuery({
    queryKey: ['tokenBalance', address, token],
    queryFn: () => fetchBalance(address, token),
    refetchInterval: false, // 自動ポーリングを無効化、購読が更新を駆動
    staleTime: 30_000,
  });

  // WebSocket 購読がインクリメンタル更新を駆動
  useEffect(() => {
    const subId = subscriber.subscribe({
      type: 'logs',
      params: [{
        address: token,
        topics: [transferEventTopic, null, address], // Transfer to this address
      }],
    }, (log) => {
      // Transfer イベント受信時に query cache を無効化して再取得
      queryClient.invalidateQueries({
        queryKey: ['tokenBalance', address, token],
      });
    });

    return () => subscriber.unsubscribe(subId);
  }, [address, token]);

  return query;
}
```

なぜ購読データで直接 cache を更新しないのか？Transfer イベントは「転入があった」ことしか伝えなく、最新残高は含まないからだ。残高は approve/spend/rebase など他の操作の影響も受ける可能性がある。したがって購読の役割は **invalidation のトリガー**であり、実際のデータは依然として REST/RPC から読み取り、正確性を保証する。

高頻度更新のシーン（価格 ticker など）では、スロットリングを行うことができる：

```typescript
// 500ms に最大 1 回の invalidate、密集イベントが RPC を圧迫するのを防ぐ
const throttledInvalidate = useMemo(
  () => throttle(
    () => queryClient.invalidateQueries({ queryKey: ['price', pair] }),
    500,
  ),
  [pair],
);
```

この「購読が invalidation を駆動 + REST が真実を提供する」パターンは、リアルタイム性とデータ一貫性の両方を兼ね備えている。購読は「いつ更新すべきか」を担当し、REST は「何に更新するか」を担当する。

## まとめ

dApp フロントエンドのリアルタイムデータ層は 4 つの問題を解決する必要がある：接続信頼性（再接続・再購読）、データ一貫性（reorg 処理）、リソース効率（マルチタブ同期）、可用性（WS フォールバック）。単一のソリューションで全シーンをカバーできるものはなく、通常は WebSocket + REST + Indexer の組み合わせとなる。TanStack Query はこの組み合わせの中で cache 管理者かつデータ融合点の役割を果たす。最も重要な原則は：接続が安定していると決して仮定しないこと、未確認データを決して信頼しないこと、ユーザーに常に可視の状態フィードバックを提供することだ。
