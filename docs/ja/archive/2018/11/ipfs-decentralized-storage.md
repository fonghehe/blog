---
title: "IPFS非中央集権ストレージ：フロントエンドファイルホスティングの実践"
date: 2018-11-18 15:02:01
tags:
  - Web3
  - Blockchain
---

ブロックチェーンのストレージコストは、フロントエンドエンジニアがWeb3分野に入って最初に感じるショックの一つです。Ethereum上で1MBのデータを保存するGas費用は数千ドルに達する可能性があり——これにより画像、動画、JSONファイルなどのコンテンツのオンチェーン保存は完全に実行不可となりました。IPFS（InterPlanetary File System）は非中央集権ストレージソリューションとして、この矛盾を解決する重要なインフラとなりました。その位置づけは明確です：オンチェーンにハッシュを保存し、オフチェーンにコンテンツを保存します。

## IPFSのコアコンセプト

### コンテンツアドレッシング

従来のWebは位置アドレッシング（Location Addressing）を使用します——URLを通じてファイルが存在するサーバーを見つけます。IPFSはコンテンツアドレッシング（Content Addressing）を使用します——ファイルの内容のハッシュ値を通じてファイルを見つけます。

```
# 位置アドレッシング（HTTP）
https://example.com/images/photo.jpg
# ファイルがどのサーバーにあるかはドメインで決定される

# コンテンツアドレッシング（IPFS）
/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
# ファイルのハッシュ値、誰が保存していても同じ内容が返される
```

コンテンツアドレッシングのコアの利点：

1. **改ざん不可能性**：ハッシュ値は内容で決定され、内容が変わればハッシュも変わる
2. **重複排除**：同じ内容は1つだけ保存され、ハッシュが同じなら内容も同じ
3. **検閲耐性**：中央集権的なサーバーが閉鎖されることがなく、どのノードでもファイルを提供できる

### DAG（有向非巡回グラフ）

IPFSは内部的にMerkle DAGデータ構造を使用してデータを組織化します。ファイルは複数のブロック（block）に分割され、各ブロックのサイズは256KBを超えません。大きなファイルはツリー構造に組織化され、各親ノードのハッシュは子ノードの内容から計算されます。

```
ファイル (1MB)
├── Block 0 (256KB) → CID bafy...001
├── Block 1 (256KB) → CID bafy...002
├── Block 2 (256KB) → CID bafy...003
└── Block 3 (256KB) → CID bafy...004
         ↓
Root Node → CID bafy...root（すべての子ブロックのリンクを含む）
```

この構造は効率的なコンテンツ検証と重複排除をサポートします——2つの大きなファイルに部分的に同じ内容があれば、同じブロックは1回だけ保存されます。

### DHT（分散ハッシュテーブル）

IPFSはKademlia DHTを使用してコンテンツを特定します。ノードがあるCIDに対応するコンテンツを取得する必要がある場合、DHTにクエリを送信してどのノードがそのコンテンツを保存しているかを調べ、最も近いノードから直接取得します。

```
ノードAがCID: QmXYZ...を取得したい
  → DHTにクエリ：誰がQmXYZ...を持っているか？
  → DHTが返答：ノードCとノードFがQmXYZ...を持っている
  → ノードAがノードCからファイルをダウンロード
  → ハッシュが一致するか検証
```

## CIDの生成とバージョンの違い

CID（Content Identifier）はIPFSにおいてコンテンツを識別する一意の識別子です。IPFSでは主に2つのバージョンのCIDが使用されています：

### CIDv0

```
QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

- `Qm`で始まる46文字のBase58エンコード文字列
- SHA-256ハッシュを使用
- 対応するマルチハッシュフォーマット：`<sha2-256><32バイトハッシュ>`

### CIDv1

```
bafybeiequkh kupmbcdgpys5lxgi7ofelwz2wdz4m 5p7l6n3k7wmgpvq
```

- マルチコーデックプレフィックス、マルチハッシュフォーマット、バージョン番号を含む
- Base32エンコードをサポート（DNSにより適している）
- 自己記述的：CID自体からハッシュアルゴリズムとエンコード方式を推測可能

```javascript
const ipfs = require('ipfs');

// CID変換
const cidV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const cid = new ipfs.CID(cidV0);

console.log(cid.version);        // 0
console.log(cid.codec);          // 'dag-pb'
console.log(cid.multihash);      // <Buffer 12 20 ...>

// v1に変換
const cidV1 = cid.toV1();
console.log(cidV1.toString());   // bafy...
```

実際のプロジェクトではCIDv1の使用がより推奨されます。自己記述的でDNS-linkをサポートしているからです。ただし、多くのツールとゲートウェイが依然としてCIDv0をサポートしており、両者の混用が一般的です。

## js-ipfsのブラウザでの使用

js-ipfsはIPFSの純粋なJavaScript実装で、ブラウザで直接実行できます：

### インストールと初期化

```html
<!-- CDN経由で導入 -->
<script src="https://unpkg.com/ipfs/dist/index.min.js"></script>
```

```javascript
// またはnpm経由
const IPFS = require('ipfs');

// ノードを作成
const node = await IPFS.create({
    config: {
        Addresses: {
            Swarm: [
                '/dns4/wss-star.bootstrap.libp2p.io/tcp/443/wss/p2p-websocket-star'
            ]
        },
        Bootstrap: [
            '/dns4/ipfs.io/tcp/443/wss/p2p/QmZ5Rd...bootstrap-node'
        ]
    },
    preload: {
        enabled: true,
        addresses: [
            '/dns4/node0.preload.ipfs.io/tcp/443/wss'
        ]
    }
});

// ノードの準備完了を待機
node.on('ready', () => {
    console.log('IPFS node is ready');
    console.log('Node ID:', node.id());
});
```

ブラウザ内のIPFSノードはWebSocketとWebRTCを使用して通信し、ブラウザ拡張のサポートを必要としません。ただしブラウザのサンドボックスの制限により、データはIndexedDBに保存され、ブラウザを閉じるとノードはオフラインになります。

## ファイルのアップロードとダウンロードAPI

### ファイルのアップロード

```javascript
// ファイル内容をアップロード
async function uploadToIPFS(fileData) {
    // fileDataはBuffer、String、またはUint8Arrayが可能
    const results = await node.add({
        content: fileData,
        path: 'myfile.txt'
    });

    const result = results[0];
    console.log('CID:', result.hash);
    console.log('Size:', result.size);
    console.log('Path:', result.path);

    return result.hash;
}

// 複数ファイルのアップロード（ディレクトリ）
async function uploadDirectory(files) {
    const filesToAdd = files.map(file => ({
        path: file.name,
        content: file.content
    }));

    const results = await node.add(filesToAdd, { wrapWithDirectory: true });

    // 最後の結果がルートディレクトリのCID
    const rootDir = results[results.length - 1];
    console.log('Directory CID:', rootDir.hash);

    // /ipfs/<rootDir.hash>/<filename>でファイルにアクセス
    return rootDir.hash;
}

// ブラウザのFile APIからアップロード
async function handleFileUpload(fileInput) {
    const file = fileInput.files[0];
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
        reader.onload = async function(event) {
            try {
                const buffer = Buffer.from(event.target.result);
                const cid = await uploadToIPFS(buffer);
                resolve(cid);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}
```

### ファイルのダウンロード

```javascript
// CID経由でファイルを読み取り
async function readFromIPFS(cid) {
    const chunks = [];
    for await (const chunk of node.cat(cid)) {
        chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);
    return data;
}

// テキストの読み取り
async function readText(cid) {
    const data = await readFromIPFS(cid);
    return data.toString('utf8');
}

// JSONの読み取り
async function readJSON(cid) {
    const text = await readText(cid);
    return JSON.parse(text);
}

// 大きなファイルの読み取り（ストリーミング）
async function streamFile(cid, onData, onEnd) {
    for await (const chunk of node.cat(cid)) {
        onData(chunk);
    }
    onEnd();
}

// ファイルのステータス情報を取得
async function getFileInfo(cid) {
    const stats = await node.files.stat(`/ipfs/${cid}`);
    console.log('Size:', stats.size);
    console.log('Type:', stats.type);  // 'file' または 'directory'
    console.log('Blocks:', stats.blocks);
    return stats;
}
```

## IPFSゲートウェイの使用と独自構築

IPFSゲートウェイはIPFSコンテンツにアクセスするためのHTTPインターフェースを提供するサーバーです。ゲートウェイを通じて、IPFSノードを実行することなく、どのブラウザでもHTTP URL経由でIPFS上のコンテンツにアクセスできます：

```
https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://gateway.ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://cloudflare-ipfs.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

### フロントエンドでのゲートウェイの使用

```javascript
const GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.infura.io/ipfs/'
];

async function fetchFromGateway(cid) {
    for (const gateway of GATEWAYS) {
        try {
            const response = await fetch(gateway + cid, {
                timeout: 5000
            });
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn(`Gateway ${gateway} failed:`, error.message);
            // 次のゲートウェイを試行
            continue;
        }
    }
    throw new Error('All gateways failed');
}
```

### 独自ゲートウェイの構築

```bash
# go-ipfsノードを実行しゲートウェイを有効化
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs daemon
```

独自ゲートウェイはpinningノードとして設定でき、重要なコンテンツがGCによって削除されないようにできます。DAppアーキテクチャにおいて、独自ゲートウェイはコンテンツの永続性とアクセス速度の保障を提供します。

## Ethereumとの組み合わせ：オンチェーンにハッシュを保存、オフチェーンにコンテンツを保存

これはIPFSのDAppにおける最も古典的な用法です——コンテンツをIPFSに保存し、そのCIDをEthereumコントラクトに保存します：

```solidity
// contracts/FileRegistry.sol
pragma solidity ^0.4.24;

contract FileRegistry {
    struct File {
        string ipfsHash;
        address owner;
        uint256 timestamp;
        string fileName;
    }

    mapping(address => File[]) public userFiles;
    mapping(string => address) public fileOwner;

    event FileUploaded(address indexed owner, string ipfsHash, string fileName, uint256 timestamp);

    function uploadFile(string _ipfsHash, string _fileName) public {
        require(bytes(_ipfsHash).length > 0, "IPFS hash required");
        require(fileOwner[_ipfsHash] == address(0), "File already exists");

        File memory newFile = File({
            ipfsHash: _ipfsHash,
            owner: msg.sender,
            timestamp: block.timestamp,
            fileName: _fileName
        });

        userFiles[msg.sender].push(newFile);
        fileOwner[_ipfsHash] = msg.sender;

        emit FileUploaded(msg.sender, _ipfsHash, _fileName, block.timestamp);
    }

    function getUserFiles(address _user) public view returns (File[]) {
        return userFiles[_user];
    }

    function getFileCount(address _user) public view returns (uint256) {
        return userFiles[_user].length;
    }
}
```

### フロントエンドアップロードモジュール

```javascript
// ipfs-eth-bridge.js
const IPFS = require('ipfs');
const Web3 = require('web3');

const FileRegistryABI = require('./abi.json');

class IPFSEthBridge {
    constructor(web3Provider, contractAddress) {
        this.web3 = new Web3(web3Provider);
        this.contract = new this.web3.eth.Contract(FileRegistryABI, contractAddress);
        this.ipfs = null;
    }

    async initIPFS() {
        this.ipfs = await IPFS.create();
        return new Promise((resolve) => {
            this.ipfs.on('ready', resolve);
        });
    }

    async uploadAndRegister(fileBuffer, fileName) {
        const accounts = await this.web3.eth.getAccounts();
        const account = accounts[0];

        // ステップ1：ファイルをIPFSにアップロード
        const results = await this.ipfs.add({
            content: fileBuffer,
            path: fileName
        });
        const ipfsHash = results[0].hash;

        // ステップ2：ハッシュをEthereumコントラクトに書き込み
        const receipt = await this.contract.methods
            .uploadFile(ipfsHash, fileName)
            .send({
                from: account,
                gas: 200000
            });

        console.log('IPFS Hash:', ipfsHash);
        console.log('Transaction:', receipt.transactionHash);

        return {
            ipfsHash,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber
        };
    }

    async getUserFiles(userAddress) {
        const count = await this.contract.methods
            .getFileCount(userAddress)
            .call();

        const files = [];
        for (let i = 0; i < count; i++) {
            const file = await this.contract.methods
                .userFiles(userAddress, i)
                .call();
            files.push(file);
        }
        return files;
    }

    async retrieveFile(ipfsHash) {
        // ローカルIPFSノード経由での取得を優先
        try {
            const chunks = [];
            for await (const chunk of this.ipfs.cat(ipfsHash)) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            // パブリックゲートウェイにフォールバック
            return this.fetchFromGateway(ipfsHash);
        }
    }

    async fetchFromGateway(cid) {
        const gateways = [
            'https://ipfs.io/ipfs/',
            'https://cloudflare-ipfs.com/ipfs/'
        ];

        for (const gateway of gateways) {
            try {
                const response = await fetch(gateway + cid);
                if (response.ok) {
                    return Buffer.from(await response.arrayBuffer());
                }
            } catch (e) {
                continue;
            }
        }
        throw new Error('Failed to retrieve file');
    }
}

module.exports = IPFSEthBridge;
```

## NFT metadataのIPFSストレージ方案

ERC721 NFTの`tokenURI`はmetadata JSONファイルを指します。metadataをIPFSに保存することで、改ざん不可能性を保ちつつ、高額なオンチェーンストレージコストを回避できます：

```javascript
// NFTのmetadataを生成してアップロード
async function createNFTMetadata(name, description, imageCID, attributes) {
    const metadata = {
        name: name,
        description: description,
        image: `ipfs://${imageCID}`,
        attributes: attributes  // [{ trait_type: "Color", value: "Blue" }]
    };

    // metadata JSONをIPFSにアップロード
    const results = await ipfs.add({
        content: JSON.stringify(metadata),
        path: 'metadata.json'
    });

    const metadataCID = results[0].hash;
    return `ipfs://${metadataCID}`;
}

// コントラクトでtokenURIを設定
async function mintNFT(tokenId, metadataURI) {
    const receipt = await contract.methods
        ._setTokenURI(tokenId, metadataURI)
        .send({ from: account, gas: 100000 });
    return receipt;
}
```

metadataの典型的な構造：

```json
{
    "name": "Crypto Art #001",
    "description": "Generative art created on Ethereum",
    "image": "ipfs://QmImageHash...",
    "external_url": "https://mydapp.com/art/1",
    "attributes": [
        { "trait_type": "Background", "value": "Blue" },
        { "trait_type": "Rarity", "value": "Rare" },
        { "display_type": "number", "trait_type": "Generation", "value": 1 }
    ]
}
```

## 永続性の問題：pinningサービス

IPFSの根本的な問題：コンテンツを能動的に保存するノードがない場合、コンテンツは「消滅」します——ノードがGCを実行した後、pinされていないコンテンツは削除されます。

### ローカルPinning

```javascript
// コンテンツをpinしてGC削除を防止
await ipfs.pin.add(cid);
console.log('Pinned:', cid);

// pin済みコンテンツを確認
const pinnedList = await ipfs.pin.ls();
pinnedList.forEach(pin => {
    console.log(pin.hash, pin.type);  // 'direct' または 'recursive'
});

// pinを解除
await ipfs.pin.rm(cid);
```

### Pinningサービス

パブリックpinningサービスの選択肢には、代表的なものとしてPinataとInfuraのIPFSサービスがあります：

```javascript
// Pinata APIを使用してコンテンツをpin
const axios = require('axios');

async function pinToPinata(cid, name) {
    const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinByHash',
        {
            hashToPin: cid,
            pinataMetadata: {
                name: name
            }
        },
        {
            headers: {
                'pinata_api_key': 'YOUR_API_KEY',
                'pinata_secret_api_key': 'YOUR_SECRET_KEY'
            }
        }
    );
    return response.data;
}
```

## メリット・デメリット分析と適用シナリオ

### メリット

- **非中央集権**：コンテンツが単一のサーバーに依存せず、検閲に強い
- **コンテンツアドレッシング**：ハッシュがアドレスであり、コンテンツの完全性を検証可能
- **オンチェーンストレージコストの削減**：大きなファイルのストレージコストが数千ドルからゼロに
- **重複排除**：同じコンテンツは自動的に重複排除され、ストレージスペースを節約

### デメリット

- **永続性の保証がない**：pinするノードがないコンテンツはGCで削除される
- **アクセス速度が不安定**：ネットワーク上にコンテンツを提供するノードがあるかに依存
- **変更不可**：コンテンツ更新後にCIDが変わり、その場で更新できない
- **ゲートウェイの単一障害点リスク**：多くのDAppがipfs.ioゲートウェイに依存し、ゲートウェイがダウンするとアクセス不可に
- **ストレージコストの転嫁**：無料だが、データの永続性はサードパーティのpinningサービスに依存

### 適用シナリオ

| シナリオ | 適している | 理由 |
|------|------|------|
| NFT metadata | ✓ | 改ざん不可能性がNFTの要件に一致 |
| DAppフロントエンドホスティング | ✓ | ENSとの組み合わせで完全に非中央集権なフロントエンドが可能 |
| ユーザーアップロードの画像/ドキュメント | ✓ | 大きなファイルのストレージコストが低い |
| 頻繁に更新されるデータ | ✗ | CIDの変化により参照が無効になる |
| 検索が必要なデータ | ✗ | IPFSはコンテンツ検索をサポートしない |
| 少量の重要データ | ✗ | 直接オンチェーンにする方が信頼性が高い |

## まとめ

IPFSはDApp技術スタックにおいて「安価なストレージレイヤー」の役割を果たします——Ethereumが価値伝達と重要な状態を担当し、IPFSがコンテンツストレージを担当します。この階層化アーキテクチャは現実的な非中央集権ストレージ方案です。

しかしIPFSの「非中央集権の理想」とエンジニアリングの現実の間には顕著なギャップがあります。コンテンツの永続性が最もコアの問題です——経済的インセンティブのないストレージネットワークは長期的な可用性を保証できません。Filecoinの構想はまさにこのインセンティブ問題を解決するためのもので、インセンティブ付きストレージネットワークとして実現されました。Pinningサービスは実用的ですが、本質的には中央集権化への妥協です。

フロントエンドエンジニアリングの観点から、IPFSの統合体験はスムーズではありません。js-ipfsはブラウザで実行される際にサイズが大きく、初期化が遅く、接続が不安定な場合があり、多くのDAppは最終的にパブリックゲートウェイをフォールバックとして使用します。しかしコンテンツアドレッシングの理念は正しく重要です——コンテンツの完全性を検証するメカニズムを提供し、これは非中央集権アプリケーションにおいて不可欠です。

DAppでIPFSを使用する開発者へのコアのアドバイス：常にマルチゲートウェイフォールバック + ローカルノードの組み合わせ戦略を実装し、重要なコンテンツにはpinningサービスを使用すること。パブリックゲートウェイの永続性に依存しないでください——今日アクセスできるCIDが、明日には提供するノードがいなくなる可能性があります。
