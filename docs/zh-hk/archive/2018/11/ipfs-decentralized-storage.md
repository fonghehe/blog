---
readingTime: 9
wordCount: 1686
title: "IPFS 去中心化存儲：前端文件託管實踐"
date: 2018-11-18 15:02:01
tags:
  - Web3
  - Blockchain
description: "區塊鏈的存儲成本是前端工程師進入 Web3 領域後最先感受到的震撼之一。在以太坊上存儲 1 MB 數據的 Gas 費用可能高達數千美元——這讓圖片、視頻、JSON 文件等內容的鏈上存儲完全不可行。IPFS（InterPlanetary File System）作為去中心化存儲方案，成為了解決這一矛盾的關鍵基礎設施。它的"
---

區塊鏈的存儲成本是前端工程師進入 Web3 領域後最先感受到的震撼之一。在以太坊上存儲 1 MB 數據的 Gas 費用可能高達數千美元——這讓圖片、視頻、JSON 文件等內容的鏈上存儲完全不可行。IPFS（InterPlanetary File System）作為去中心化存儲方案，成為了解決這一矛盾的關鍵基礎設施。它的定位很明確：鏈上存儲哈希，鏈下存儲內容。

## IPFS 的核心概念

### 內容尋址

傳統 Web 使用位置尋址（Location Addressing）——通過 URL 找到文件所在的伺服器。IPFS 使用內容尋址（Content Addressing）——通過文件內容的哈希值找到文件。

```
# 位置尋址（HTTP）
https://example.com/images/photo.jpg
# 文件在哪台伺服器上，由域名決定

# 內容尋址（IPFS）
/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
# 文件的哈希值，無論誰存儲都返回相同內容
```

內容尋址的核心優勢：

1. **不可篡改性**：哈希值由內容決定，內容變化則哈希變化
2. **去重**：相同內容只存儲一份，哈希相同即內容相同
3. **抗審查**：沒有中心化伺服器可以被關閉，任何節點都可以提供文件

### DAG（有向無環圖）

IPFS 內部使用 Merkle DAG 數據結構組織數據。文件被分割成多個塊（block），每個塊的大小不超過 256 KB。大文件被組織成一棵樹形結構，每個父節點的哈希由子節點內容計算得出。

```
文件 (1MB)
├── Block 0 (256KB) → CID bafy...001
├── Block 1 (256KB) → CID bafy...002
├── Block 2 (256KB) → CID bafy...003
└── Block 3 (256KB) → CID bafy...004
         ↓
Root Node → CID bafy...root (包含所有子塊鏈接)
```

這種結構支持高效的內容驗證和去重——如果兩個大文件有部分內容相同，相同的塊只需要存儲一次。

### DHT（分佈式哈希表）

IPFS 使用 Kademlia DHT 來定位內容。當節點需要獲取某個 CID 對應的內容時，它向 DHT 查詢哪些節點存儲了該內容，然後直接從最近的節點獲取。

```
節點 A 想要獲取 CID: QmXYZ...
  → 查詢 DHT：誰有 QmXYZ...?
  → DHT 返回：節點 C 和節點 F 有 QmXYZ...
  → 節點 A 從節點 C 下載文件
  → 驗證哈希是否匹配
```

## CID 的生成與版本差異

CID（Content Identifier）是 IPFS 中標識內容的唯一標識符。IPFS 同時存在兩個版本的 CID：

### CIDv0

```
QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

- 以 `Qm` 開頭的 46 字符 Base58 編碼字符串
- 使用 SHA-256 哈希
- 對應的多哈希格式：`<sha2-256><32字節哈希>`

### CIDv1

```
bafybeiequkh kupmbcdgpys5lxgi7ofelwz2wdz4m 5p7l6n3k7wmgpvq
```

- 包含多編解碼器前綴、多哈希格式和版本號
- 支持 Base32 編碼（更適合 DNS）
- 自描述：可以從 CID 本身推斷出哈希算法和編碼方式

```javascript
const ipfs = require('ipfs');

// CID 轉換
const cidV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const cid = new ipfs.CID(cidV0);

console.log(cid.version);        // 0
console.log(cid.codec);          // 'dag-pb'
console.log(cid.multihash);      // <Buffer 12 20 ...>

// 轉換為 v1
const cidV1 = cid.toV1();
console.log(cidV1.toString());   // bafy...
```

在實際項目中，CIDv1 更推薦使用，因為它是自描述的且支持 DNS-link。但大量工具和網關仍以 CIDv0 為主，兩者混用是常態。

## js-ipfs 在瀏覽器中的使用

js-ipfs 是 IPFS 的純 JavaScript 實現，可以在瀏覽器中直接運行：

### 安裝與初始化

```html
<!-- 通過 CDN 引入 -->
<script src="https://unpkg.com/ipfs/dist/index.min.js"></script>
```

```javascript
// 或通過 npm
const IPFS = require('ipfs');

// 創建節點
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

// 等待節點就緒
node.on('ready', () => {
    console.log('IPFS node is ready');
    console.log('Node ID:', node.id());
});
```

瀏覽器中的 IPFS 節點使用 WebSocket 和 WebRTC 進行通信，無需瀏覽器擴展支持。但受限於瀏覽器沙箱，數據存儲在 IndexedDB 中，關閉瀏覽器後節點下線。

## 文件上傳與下載 API

### 上傳文件

```javascript
// 上傳文件內容
async function uploadToIPFS(fileData) {
    // fileData 可以是 Buffer、String 或 Uint8Array
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

// 上傳多個文件（目錄）
async function uploadDirectory(files) {
    const filesToAdd = files.map(file => ({
        path: file.name,
        content: file.content
    }));

    const results = await node.add(filesToAdd, { wrapWithDirectory: true });

    // 最後一個結果是根目錄的 CID
    const rootDir = results[results.length - 1];
    console.log('Directory CID:', rootDir.hash);

    // 通過 /ipfs/<rootDir.hash>/<filename> 訪問文件
    return rootDir.hash;
}

// 從瀏覽器 File API 上傳
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

### 下載文件

```javascript
// 通過 CID 讀取文件
async function readFromIPFS(cid) {
    const chunks = [];
    for await (const chunk of node.cat(cid)) {
        chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);
    return data;
}

// 讀取文本
async function readText(cid) {
    const data = await readFromIPFS(cid);
    return data.toString('utf8');
}

// 讀取 JSON
async function readJSON(cid) {
    const text = await readText(cid);
    return JSON.parse(text);
}

// 讀取大文件（流式）
async function streamFile(cid, onData, onEnd) {
    for await (const chunk of node.cat(cid)) {
        onData(chunk);
    }
    onEnd();
}

// 獲取文件狀態信息
async function getFileInfo(cid) {
    const stats = await node.files.stat(`/ipfs/${cid}`);
    console.log('Size:', stats.size);
    console.log('Type:', stats.type);  // 'file' 或 'directory'
    console.log('Blocks:', stats.blocks);
    return stats;
}
```

## IPFS 網關的使用與自建

IPFS 網關是提供 HTTP 接口訪問 IPFS 內容的伺服器。通過網關，任何瀏覽器都可以通過 HTTP URL 訪問 IPFS 上的內容，無需運行 IPFS 節點：

```
https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://gateway.ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://cloudflare-ipfs.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

### 在前端中使用網關

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
            // 嘗試下一個網關
            continue;
        }
    }
    throw new Error('All gateways failed');
}
```

### 自建網關

```bash
# 運行 go-ipfs 節點並開啓網關
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs daemon
```

自建網關可以配置為 pinning 節點，確保重要內容不會因 GC 被清除。在 DApp 架構中，自建網關提供了內容持久性和訪問速度的保障。

## 與以太坊結合：鏈上存儲 hash，鏈下存儲內容

這是 IPFS 在 DApp 中最經典的用法——將內容存儲在 IPFS 上，將其 CID 存儲在以太坊合約中：

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

### 前端上傳模塊

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

        // 步驟 1：上傳文件到 IPFS
        const results = await this.ipfs.add({
            content: fileBuffer,
            path: fileName
        });
        const ipfsHash = results[0].hash;

        // 步驟 2：將 hash 寫入以太坊合約
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
        // 優先通過本地 IPFS 節點獲取
        try {
            const chunks = [];
            for await (const chunk of this.ipfs.cat(ipfsHash)) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            // 回退到公共網關
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

## NFT metadata 的 IPFS 存儲方案

ERC721 NFT 的 `tokenURI` 指向 metadata JSON 文件。將 metadata 存儲在 IPFS 上既保證了不可篡改性，又避免了高昂的鏈上存儲成本：

```javascript
// 為 NFT 生成並上傳 metadata
async function createNFTMetadata(name, description, imageCID, attributes) {
    const metadata = {
        name: name,
        description: description,
        image: `ipfs://${imageCID}`,
        attributes: attributes  // [{ trait_type: "Color", value: "Blue" }]
    };

    // 上傳 metadata JSON 到 IPFS
    const results = await ipfs.add({
        content: JSON.stringify(metadata),
        path: 'metadata.json'
    });

    const metadataCID = results[0].hash;
    return `ipfs://${metadataCID}`;
}

// 在合約中設置 tokenURI
async function mintNFT(tokenId, metadataURI) {
    const receipt = await contract.methods
        ._setTokenURI(tokenId, metadataURI)
        .send({ from: account, gas: 100000 });
    return receipt;
}
```

metadata 的典型結構：

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

## 持久化問題：pinning 服務

IPFS 的一個根本性問題：沒有節點主動存儲你的內容時，內容會"消失"——節點運行 GC 後未 pin 的內容會被清除。

### 本地 Pinning

```javascript
// pin 內容確保不被 GC 清除
await ipfs.pin.add(cid);
console.log('Pinned:', cid);

// 查看已 pin 的內容
const pinnedList = await ipfs.pin.ls();
pinnedList.forEach(pin => {
    console.log(pin.hash, pin.type);  // 'direct' 或 'recursive'
});

// 取消 pin
await ipfs.pin.rm(cid);
```

### Pinning 服務

公共 pinning 服務選擇有限，主要有 Pinata 和 Infura 的 IPFS 服務：

```javascript
// 使用 Pinata API pin 內容
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

## 優缺點分析與適用場景

### 優點

- **去中心化**：內容不依賴單一伺服器，抗審查
- **內容尋址**：哈希即地址，內容完整性可驗證
- **節省鏈上存儲成本**：大文件存儲成本從數千美元降至零
- **去重**：相同內容自動去重，節省存儲空間

### 缺點

- **持久性無保證**：沒有節點 pin 的內容會被 GC 清除
- **訪問速度不穩定**：依賴網絡中是否有節點提供該內容
- **不可修改**：內容更新後 CID 變化，無法原地更新
- **網關單點風險**：大量 DApp 依賴 ipfs.io 網關，該網關宕機則不可訪問
- **存儲成本轉嫁**：雖然免費，但數據持久性取決於第三方 pinning 服務

### 適用場景

| 場景 | 適合 | 原因 |
|------|------|------|
| NFT metadata | ✓ | 不可篡改性正好匹配 NFT 需求 |
| DApp 前端託管 | ✓ | 配合 ENS 可實現完全去中心化前端 |
| 用戶上傳的圖片/文檔 | ✓ | 大文件存儲成本低 |
| 頻繁更新的數據 | ✗ | CID 變化導致引用失效 |
| 需要搜索的數據 | ✗ | IPFS 不支持內容檢索 |
| 小量關鍵數據 | ✗ | 直接上鍊更可靠 |

## 小結

IPFS 在 DApp 技術棧中扮演着"廉價存儲層"的角色——以太坊負責價值傳輸和關鍵狀態，IPFS 負責內容存儲。這種分層架構是最務實的去中心化存儲方案。

但 IPFS 的"去中心化理想"與工程現實之間存在顯著落差。內容持久性是最核心的問題——沒有經濟激勵的存儲網絡無法保證長期可用性。Filecoin 的設想正是為了解決這一激勵問題。Pinning 服務雖然實用，但本質上是一種中心化的妥協。

從前端工程角度，IPFS 的集成體驗並不順暢。js-ipfs 在瀏覽器中運行時體積大、初始化慢、連接不穩定，大多數 DApp 最終還是退化到使用公共網關作為 fallback。但內容尋址的理念是正確且重要的——它提供了一種驗證內容完整性的機制，這在去中心化應用中不可或缺。

對於準備在 DApp 中使用 IPFS 的開發者，核心建議是：始終實現多網關 fallback + 本地節點的組合策略，併為關鍵內容使用 pinning 服務。不要依賴公共網關的持久性——今天能訪問的 CID，明天可能就無人提供了。
