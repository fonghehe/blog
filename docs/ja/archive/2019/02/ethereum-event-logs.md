---
title: "Ethereumイベントログ：Eventからフロントエンドデータ同期まで"
date: 2019-02-25 10:13:14
tags:
  - Web3
  - Ethereum
  - Smart Contract
readingTime: 16
wordCount: 3120
description: "Ethereumのスマートコントラクトは本質的に状態機械です——外部トランザクションが状態遷移をトリガーし、ブロック確定後に状態は不可逆になります。しかしコントラクト内部の状態変数は外部から直接読み取ることができず（public変数が自動生成するGetterを除く）、状態変化の履歴を追跡することもできません。Event"
---

Ethereumのスマートコントラクトは本質的に状態機械です——外部トランザクションが状態遷移をトリガーし、ブロック確定後に状態は不可逆になります。しかしコントラクト内部の状態変数は外部から直接読み取ることができず（`public`変数が自動生成するGetterを除く）、状態変化の履歴を追跡することもできません。Eventメカニズムがこの空白を埋めました：コントラクトから外部世界へ「ブロードキャスト」する唯一のチャネルであり、フロントエンドDAppが状態同期を実現するためのコアのデータソースでもあります。

## Solidity eventの宣言とemitキーワード

### Eventの宣言

Eventはコントラクト内で`event`キーワードで宣言され、関数シグネチャに似ていますが呼び出し不可能です：

```solidity
pragma solidity ^0.4.24;

contract Token {
    // 基本イベント宣言
    event Transfer(address indexed from, address indexed to, uint256 value);

    // 非索引パラメータを含むイベント
    event Approval(address indexed owner, address indexed spender, uint256 value);

    // 文字列説明を持つイベント
    event Deposit(address indexed account, uint256 amount, string message, uint256 timestamp);

    // 複数索引パラメータイベント
    event OrderCreated(
        bytes32 indexed orderId,
        address indexed trader,
        uint256 indexed price,
        uint256 amount,
        uint8 orderType  // 0=buy, 1=sell
    );
}
```

### emitキーワード

Solidity 0.4.21から`emit`キーワードが導入され、イベントをトリガーするようになりました（旧バージョンではイベント名を直接呼び出し）：

```solidity
function transfer(address _to, uint256 _value) public returns (bool) {
    require(balances[msg.sender] >= _value);

    balances[msg.sender] -= _value;
    balances[_to] += _value;

    // イベントをトリガー（Solidity 0.4.21+）
    emit Transfer(msg.sender, _to, _value);

    // 旧記法（非推奨、0.5.0+はコンパイルエラー）
    // Transfer(msg.sender, _to, _value);

    return true;
}
```

`emit`キーワードの導入はシンタックスシュガーではありません——イベント呼び出しと関数呼び出しを明確に区別し、デベロッパーがイベント名を誤って関数呼び出しとして使用することを防ぎ、静的解析ツールがイベントトリガー箇所をより正確に識別できるようにします。

## indexedパラメータとトピック（topics）の索引メカニズム

Eventのパラメータは2種類に分類されます：**indexed**と**non-indexed**。両者の保存位置と検索方式は全く異なります。

### indexedパラメータ

`indexed`パラメータはログの`topics`配列にエンコードされ、効率的に検索できます。1つのイベントには最大3つの`indexed`パラメータを持てます（`anonymous`イベントは4つまで）：

```solidity
event Transfer(
    address indexed from,    // topic[1]
    address indexed to,      // topic[2]
    uint256 indexed tokenId, // topic[3]
    uint256 value            // data（非索引）
);
// topic[0]はイベントシグネチャのkeccak256ハッシュ
```

`topics[0]`はイベントシグネチャのハッシュ値で固定されます：

```
topics[0] = keccak256("Transfer(address,address,uint256,uint256)")
          = 0xe192daff...
```

値型（address, uint256, bytes32など）の場合、`indexed`パラメータの値は直接topicに保存されます。しかし参照型（string, bytes, array）の場合、keccak256ハッシュ値のみが保存されます：

```solidity
event FileUploaded(
    address indexed uploader,
    string indexed fileName,  // ハッシュのみ保存、ログから元の値は復元できない
    string fileHash           // 非索引、dataに保存、復元可能
);
```

これはよくある落とし穴です：ログから完全な文字列値を取得する必要がある場合、それを`indexed`に設定しないでください。

### non-indexedパラメータ

非索引パラメータはABIエンコード後、ログの`data`フィールドに保存されます。`data`フィールドは索引に参加しませんが、完全な元の値を含みます：

```solidity
event UserRegistered(
    address indexed userAddress,  // topic[1]、検索可能
    uint256 indexed timestamp,    // topic[2]、検索可能
    string name,                  // data、完全な値
    string email,                 // data、完全な値
    uint8 role                    // data、完全な値
);
```

## anonymousイベント

`anonymous`イベントは`topics[0]`にイベントシグネチャハッシュを保存せず、その分`indexed`パラメータのスロットを1つ多く確保できます：

```solidity
event LogSomething(
    address indexed a,
    address indexed b,
    uint256 indexed c,
    uint256 indexed d  // anonymousイベントは4つのindexedパラメータを持てる
) anonymous;
```

匿名イベントは`topics[0]`の32バイトのストレージを省略し、理論上よりGasを節約できます。ただし代償としてイベントシグネチャでフィルタリングできず——匿名イベントの検索時には他のindexedパラメータでしか位置を特定できません。実際のプロジェクトで匿名イベントが使用されることは極めて稀です。可読性と保守性の損失が微小なGas節約を遥かに上回るからです。

## log構造

Ethereumブロック内の各トランザクションのレシート（receipt）には`logs`配列が含まれます。各logの構造は以下の通りです：

```json
{
    "address": "0x1234...contract_address",
    "topics": [
        "0xe192daff...",  // topics[0]: イベントシグネチャハッシュ
        "0x000...000abcd", // topics[1]: from（addressを32バイトにゼロパディング）
        "0x000...000efgh", // topics[2]: to
        "0x000...000042"   // topics[3]: tokenId
    ],
    "data": "0x000...000000064",  // ABIエンコードされた非索引パラメータ
    "blockNumber": "0x4b3",       // ブロック番号
    "transactionHash": "0x...",   // このイベントをトリガーしたトランザクションハッシュ
    "transactionIndex": "0x0",
    "blockHash": "0x...",
    "logIndex": "0x0",            // ブロック内のログシーケンス番号
    "removed": false              // チェーン再編成により削除されたかどうか
}
```

log構造を理解することは手動でイベントデータを解析する際に重要です——web3.jsのABIデコードが失敗した場合や、生のログから情報を抽出する必要がある場合、`topics`と`data`を直接操作する必要があります。

```javascript
// log dataを手動解析
const web3 = new Web3(provider);

// イベントがTransfer(address,address,uint256,uint256)と仮定
// 非索引パラメータvalueはdataにエンコードされている
function parseTransferData(dataHex) {
    // dataはABIエンコード、32バイトごとに1つのパラメータ
    const value = web3.utils.hexToNumberString('0x' + dataHex.slice(2, 66));
    return { value };
}

// topicからaddressを解析
function parseAddressFromTopic(topicHex) {
    // topic内のaddressは32バイトにゼロパディングされ、後ろ20バイトを取得
    return '0x' + topicHex.slice(26);
}

// 完全なイベントを解析
function parseTransferLog(log) {
    return {
        contract: log.address,
        from: parseAddressFromTopic(log.topics[1]),
        to: parseAddressFromTopic(log.topics[2]),
        tokenId: web3.utils.hexToNumberString(log.topics[3]),
        value: parseTransferData(log.data).value,
        blockNumber: web3.utils.hexToNumber(log.blockNumber),
        txHash: log.transactionHash
    };
}
```

## web3.eth.getPastEventsで履歴イベントをクエリ

履歴イベントのクエリはフロントエンドDAppのコア要件です——コントラクトデプロイ以来発生したすべてのTransferイベントからユーザー残高や取引履歴などの状態を再構築します。

```javascript
const contract = new web3.eth.Contract(abi, contractAddress);

// すべてのTransferイベントをクエリ
const allEvents = await contract.getPastEvents('Transfer', {
    fromBlock: 0,
    toBlock: 'latest'
});

// fromアドレスでフィルタ
const sentEvents = await contract.getPastEvents('Transfer', {
    filter: { from: '0xUserAddress' },
    fromBlock: 0,
    toBlock: 'latest'
});

// fromとtoで同時にフィルタ
const specificTransfers = await contract.getPastEvents('Transfer', {
    filter: {
        from: '0xUserA',
        to: '0xUserB'
    },
    fromBlock: 5000000,
    toBlock: 'latest'
});

// ブロック範囲でクエリ
const recentEvents = await contract.getPastEvents('Transfer', {
    fromBlock: web3.utils.toHex(currentBlock - 1000),
    toBlock: 'latest'
});

// すべてのイベントタイプをクエリ
const allEventTypes = await contract.getPastEvents('allEvents', {
    fromBlock: currentBlock - 100,
    toBlock: 'latest'
});
```

### パフォーマンスの考慮

`getPastEvents`の低レベルRPC呼び出しは`eth_getLogs`で、そのパフォーマンスは以下に依存します：

1. **クエリ範囲**：スキャンするブロック数が多いほどレスポンスが遅い。一部のノード（Infuraなど）は単一クエリのブロック範囲に制限がある（通常5,000〜10,000ブロック）
2. **フィルタ条件**：`indexed`フィルタ条件のあるクエリは、ないクエリよりはるかに速い——ノードはBloom Filterを利用して対象イベントを含まないブロックを高速にスキップできる
3. **イベント数**：大量のイベントを返すとJSONレスポンスが大きくなり、ノードのレスポンスサイズ制限に抵触する可能性がある

```javascript
// 大範囲のイベントをチャンクでクエリ
async function getEventsInChunks(contract, eventName, filter, fromBlock, toBlock, chunkSize = 2000) {
    const allEvents = [];
    let currentBlock = fromBlock;

    while (currentBlock <= toBlock) {
        const endBlock = Math.min(currentBlock + chunkSize - 1, toBlock);

        try {
            const events = await contract.getPastEvents(eventName, {
                filter: filter,
                fromBlock: currentBlock,
                toBlock: endBlock
            });
            allEvents.push(...events);
        } catch (error) {
            // 範囲を狭めてリトライ
            if (error.message.includes('query returned more than') || error.message.includes('limit')) {
                return getEventsInChunks(contract, eventName, filter, currentBlock, endBlock, chunkSize / 2);
            }
            throw error;
        }

        currentBlock = endBlock + 1;
    }

    return allEvents;
}
```

## イベントサブスクリプション：WebSocketリアルタイムリスニング vs ポーリング

### WebSocketリアルタイムリスニング

```javascript
// WebSocket Provider経由でイベントをサブスクライブ
const web3ws = new Web3(new Web3.providers.WebsocketProvider('wss://ropsten.infura.io/ws'));

const wsContract = new web3ws.eth.Contract(abi, contractAddress);

// Transferイベントをサブスクライブ
const subscription = wsContract.events.Transfer({
    filter: { to: '0xUserAddress' },  // ユーザーアドレスへの転入のみリスニング
    fromBlock: 'latest'                // 最新ブロックから開始
})
.on('data', function(event) {
    console.log('Transfer received!');
    console.log('From:', event.returnValues.from);
    console.log('To:', event.returnValues.to);
    console.log('Value:', event.returnValues.value);
    console.log('Block:', event.blockNumber);
    console.log('TxHash:', event.transactionHash);

    // フロントエンド状態を更新
    updateUI(event.returnValues);
})
.on('changed', function(event) {
    // チェーン再編成によりイベントが削除された
    console.log('Event removed due to reorg:', event.transactionHash);
    rollbackState(event);
})
.on('error', function(error) {
    console.error('Subscription error:', error);
    // 再接続ロジック
    reconnectWebSocket();
});

// サブスクリプションを解除
function stopListening() {
    subscription.unsubscribe(function(error, success) {
        if (success) console.log('Unsubscribed');
    });
}
```

WebSocketサブスクリプションの利点はリアルタイム性です——イベントがブロック確定後にほぼ即座にフロントエンドにプッシュされます。ただしWebSocket接続の安定性が主要な問題です：InfuraのWSエンドポイントは頻繁に切断され、ネットワーク切り替えやスリープしたラップトップでも接続が切断されます。

### ポーリング

```javascript
// ポーリングで新イベントをクエリ
class EventPoller {
    constructor(contract, eventName, filter, interval = 5000) {
        this.contract = contract;
        this.eventName = eventName;
        this.filter = filter;
        this.interval = interval;
        this.lastBlock = 0;
        this.timer = null;
        this.callbacks = [];
    }

    async start() {
        this.lastBlock = await web3.eth.getBlockNumber();
        this.timer = setInterval(() => this.poll(), this.interval);
    }

    stop() {
        clearInterval(this.timer);
    }

    on(callback) {
        this.callbacks.push(callback);
    }

    async poll() {
        try {
            const currentBlock = await web3.eth.getBlockNumber();

            if (currentBlock <= this.lastBlock) return;

            const events = await this.contract.getPastEvents(this.eventName, {
                filter: this.filter,
                fromBlock: this.lastBlock + 1,
                toBlock: currentBlock
            });

            events.forEach(event => {
                this.callbacks.forEach(cb => cb(event));
            });

            this.lastBlock = currentBlock;
        } catch (error) {
            console.error('Polling error:', error);
        }
    }
}

// 使用
const poller = new EventPoller(
    contract,
    'Transfer',
    { to: userAddress },
    5000
);
poller.on(event => updateBalance(event));
poller.start();
```

### 2つのモードの比較

| 特性 | WebSocket | ポーリング |
|------|-----------|------|
| リアルタイム性 | 高い（秒単位） | 低い（間隔に依存） |
| 安定性 | 低い（切断されやすい） | 高い（HTTPリクエスト） |
| リソース消費 | 低い（サーバープッシュ） | 中（定期的リクエスト） |
| 実装の複雑さ | 中（再接続処理が必要） | 低い |
| チェーン再編成の処理 | サポート（changedイベント） | 手動処理が必要 |
| Infura互換性 | 限定的 | 良い |

## フロントエンド状態同期戦略：イベントログからの状態再構築

これはEventメカニズムの最も重要なユースケースです——イベントログを通じてコントラクトの現在の状態を再構築します。

### 問題の背景

コントラクトは状態変数（`balances` mappingなど）を保存していますが、フロントエンドは特定のユーザーのすべての取引履歴を効率的にクエリできません。フロントエンドが「ユーザーのすべてのトークン転送記録」や「オーダーブックの現在の状態」を表示する必要がある場合、履歴イベントを走査して再構築するしかありません。

### 状同期モジュール

```javascript
// state-sync.js —— イベントログからフロントエンド状態を再構築

class StateSynchronizer {
    constructor(web3, contractAddress, abi) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(abi, contractAddress);
        this.syncedBlock = 0;
        this.state = {
            balances: {},      // { address: balance }
            transfers: [],     // 転送履歴
            allowances: {}     // { owner: { spender: amount } }
        };
    }

    async sync(fromBlock = 0) {
        const latestBlock = await this.web3.eth.getBlockNumber();
        const chunkSize = 2000;

        // チャンクで履歴イベントを同期
        for (let start = fromBlock; start <= latestBlock; start += chunkSize) {
            const end = Math.min(start + chunkSize - 1, latestBlock);

            const events = await this.contract.getPastEvents('allEvents', {
                fromBlock: start,
                toBlock: end
            });

            this.processEvents(events);
        }

        this.syncedBlock = latestBlock;
        return this.state;
    }

    processEvents(events) {
        events.forEach(event => {
            switch (event.event) {
                case 'Transfer':
                    this.handleTransfer(event);
                    break;
                case 'Approval':
                    this.handleApproval(event);
                    break;
                case 'Deposit':
                    this.handleDeposit(event);
                    break;
            }
        });
    }

    handleTransfer(event) {
        const { from, to, value } = event.returnValues;
        const amount = BigInt(value);

        // 残高を更新
        if (from !== '0x0000000000000000000000000000000000000000') {
            this.state.balances[from] = (BigInt(this.state.balances[from] || 0) - amount).toString();
        }
        this.state.balances[to] = (BigInt(this.state.balances[to] || 0) + amount).toString();

        // 転送履歴を記録
        this.state.transfers.push({
            from,
            to,
            value: amount.toString(),
            blockNumber: event.blockNumber,
            txHash: event.transactionHash,
            timestamp: event.blockTimestamp  // ブロック情報の追加取得が必要
        });
    }

    handleApproval(event) {
        const { owner, spender, value } = event.returnValues;

        if (!this.state.allowances[owner]) {
            this.state.allowances[owner] = {};
        }
        this.state.allowances[owner][spender] = value;
    }

    handleDeposit(event) {
        const { account, amount } = event.returnValues;
        this.state.balances[account] = (BigInt(this.state.balances[account] || 0) + BigInt(amount)).toString();
    }

    // 新規イベントの増分同期
    async syncNewEvents() {
        const latestBlock = await this.web3.eth.getBlockNumber();

        if (latestBlock <= this.syncedBlock) return;

        const events = await this.contract.getPastEvents('allEvents', {
            fromBlock: this.syncedBlock + 1,
            toBlock: latestBlock
        });

        this.processEvents(events);
        this.syncedBlock = latestBlock;

        return events;
    }

    // チェーン再編成の処理
    async handleReorg(reorgBlock) {
        // 再編成ポイントの前の状態にロールバックし、再同期
        this.syncedBlock = reorgBlock - 1;
        // 実際の実装ではロールバックをサポートするための状態スナップショットの保存が必要
        await this.sync(reorgBlock);
    }

    getState() {
        return this.state;
    }

    getBalance(address) {
        return this.state.balances[address] || '0';
    }

    getTransferHistory(address) {
        return this.state.transfers.filter(
            t => t.from === address || t.to === address
        );
    }
}
```

## イベントリスナーと状態同期モジュール

WebSocketリアルタイムリスニングと履歴同期を組み合わせた完全なモジュール：

```javascript
// event-watcher.js
class EventWatcher {
    constructor(web3, contractAddress, abi, options = {}) {
        this.web3 = web3;
        this.contract = new web3.eth.Contract(abi, contractAddress);
        this.options = {
            wsUrl: options.wsUrl || null,
            pollInterval: options.pollInterval || 10000,
            chunkSize: options.chunkSize || 2000,
            confirmations: options.confirmations || 12
        };

        this.syncedBlock = 0;
        this.listeners = new Map();  // eventName -> callbacks[]
        this.subscription = null;
        this.pollTimer = null;
        this.useWebSocket = false;
    }

    async start() {
        // 最初に履歴イベントを同期
        await this.syncHistory();

        // WebSocketリアルタイムリスニングを試行
        if (this.options.wsUrl) {
            try {
                await this.startWebSocket();
                this.useWebSocket = true;
            } catch (error) {
                console.warn('WebSocket failed, falling back to polling:', error.message);
                this.startPolling();
            }
        } else {
            this.startPolling();
        }
    }

    async syncHistory() {
        const latestBlock = await this.web3.eth.getBlockNumber();
        console.log(`Syncing events from block 0 to ${latestBlock}...`);

        for (let start = 0; start <= latestBlock; start += this.options.chunkSize) {
            const end = Math.min(start + this.options.chunkSize - 1, latestBlock);
            const events = await this.contract.getPastEvents('allEvents', {
                fromBlock: start,
                toBlock: end
            });
            this.notifyListeners(events);
        }

        this.syncedBlock = latestBlock;
        console.log('Historical sync complete');
    }

    async startWebSocket() {
        const web3ws = new Web3(new Web3.providers.WebsocketProvider(this.options.wsUrl));
        const wsContract = new web3ws.eth.Contract(this.contract.options.jsonInterface, this.contract.options.address);

        this.subscription = wsContract.events.allEvents({
            fromBlock: this.syncedBlock + 1
        })
        .on('data', (event) => {
            this.notifyListeners([event]);
            this.syncedBlock = Math.max(this.syncedBlock, event.blockNumber);
        })
        .on('error', (error) => {
            console.error('WebSocket error:', error);
            this.subscription = null;
            this.startPolling();
        });
    }

    startPolling() {
        this.pollTimer = setInterval(async () => {
            try {
                const latestBlock = await this.web3.eth.getBlockNumber();
                const confirmedBlock = latestBlock - this.options.confirmations;

                if (confirmedBlock <= this.syncedBlock) return;

                const events = await this.contract.getPastEvents('allEvents', {
                    fromBlock: this.syncedBlock + 1,
                    toBlock: confirmedBlock
                });

                this.notifyListeners(events);
                this.syncedBlock = confirmedBlock;
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, this.options.pollInterval);
    }

    notifyListeners(events) {
        events.forEach(event => {
            const callbacks = this.listeners.get(event.event) || [];
            callbacks.forEach(cb => cb(event));

            // 'allEvents'リスナーにも通知
            const allCallbacks = this.listeners.get('*') || [];
            allCallbacks.forEach(cb => cb(event));
        });
    }

    on(eventName, callback) {
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, []);
        }
        this.listeners.get(eventName).push(callback);
    }

    off(eventName, callback) {
        const callbacks = this.listeners.get(eventName);
        if (callbacks) {
            const idx = callbacks.indexOf(callback);
            if (idx > -1) callbacks.splice(idx, 1);
        }
    }

    stop() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
        }
    }
}

module.exports = { StateSynchronizer, EventWatcher };
```

## イベントフィルタのパフォーマンス考慮

### Bloom Filter

Ethereumの各ブロックヘッダーにはBloom Filterが含まれ、そのブロックが特定のアドレスやトピックのログを含むかを素早く判断します。`eth_getLogs`はノード側でまずBloom Filterをチェックし、関連のないブロックをスキップします。これが`indexed`フィルタ条件のあるクエリがないクエリよりはるかに速い理由です。

### フロントエンドキャッシュ

頻繁にクエリされるイベントについては、フロントエンドはローカルキャッシュを実装すべきです：

```javascript
class EventCache {
    constructor() {
        this.cache = new Map();
    }

    getKey(eventName, filter, fromBlock, toBlock) {
        return `${eventName}:${JSON.stringify(filter)}:${fromBlock}:${toBlock}`;
    }

    get(eventName, filter, fromBlock, toBlock) {
        return this.cache.get(this.getKey(eventName, filter, fromBlock, toBlock));
    }

    set(eventName, filter, fromBlock, toBlock, events) {
        this.cache.set(this.getKey(eventName, filter, fromBlock, toBlock), events);
    }

    invalidate(eventName) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(eventName + ':')) {
                this.cache.delete(key);
            }
        }
    }
}
```

## The Graphなどのインデックスサービスとの比較と展望

イベントログから状態を再構築するアプローチは、コントラクトロジックがシンプルな場合は許容範囲ですが、イベントタイプが増えクエリの複雑さが上がるにつれて、フロントエンドの同期ロジックが膨張し保守が困難になります。

The Graphは別のアプローチを提案しました：イベントのインデックス作成と状態の再構築を専門のインデックスサービスに任せます。インデクサーがオンチェーンイベントをリスニングし、事前定義されたスキーマに従ってデータをデータベースに格納し、フロントエンドはGraphQLで構造化データをクエリします。

```graphql
# The Graphのクエリ方式（概念展示）
{
  transfers(where: { to: "0xUserAddress" }) {
    id
    from
    to
    value
    blockNumber
    transactionHash
  }
}
```

このアプローチは状態同期の複雑さをフロントエンドからインデックスレイヤーに移し、フロントエンドを「クエリ-表示」の伝統的モードに回帰させます。ただし代償として中央集権的なインデックスサービスへの依存を導入します——これは非中央集権の理念との間に緊張関係があります。

## まとめ

Ethereumのイベントログメカニズムはコントラクトと外部世界がコミュニケーションするコアのチャネルです。シンプルに見えます——eventを宣言し、eventをemitし、eventをリスニングする——しかし、それを中心に構築された状態同期体系はDAppフロントエンドアーキテクチャの中で最も複雑な部分の一つです。

indexedパラメータの3つ制限、参照型はハッシュのみ保存、ノードの`eth_getLogs`の範囲制限、WebSocketの不安定性、チェーン再編成によるイベントロールバック——各詳細が本番環境での潜在的な問題になり得ます。

アーキテクチャの観点から、イベント駆動の状態同期パターンは本質的にCQRS（Command Query Responsibility Segregation）です：コントラクトはコマンド処理（状態書き込み）を担当し、イベントログはクエリサイドのデータ構築を担当します。この分離は非中央集権アーキテクチャの必然的な選択です——コントラクト自体が複雑なクエリに効率的に対応できないからです。

イベントからの状態再構築のアプローチは実行可能ですがエレガントではありません。The Graphなどのインデックスサービスはまさにこの課題を解決するために設計されました。しかしイベントログの仕組みを理解することは依然として基礎です——インデックスサービスを使用する場合でも、イベント構造を理解してスキーマとマッピングロジックを正しく定義する必要があるからです。これらの低レベルの知識は上位レイヤーのツールの進歩によって失効することはありません。
