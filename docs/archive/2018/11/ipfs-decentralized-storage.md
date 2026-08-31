---
title: "IPFS 去中心化存储：前端文件托管实践"
date: 2018-11-18 15:02:01
tags:
  - Web3
  - Blockchain
readingTime: 9
wordCount: 1688
description: "区块链的存储成本是前端工程师进入 Web3 领域后最先感受到的震撼之一。在以太坊上存储 1 MB 数据的 Gas 费用可能高达数千美元——这让图片、视频、JSON 文件等内容的链上存储完全不可行。IPFS（InterPlanetary File System）作为去中心化存储方案，成为了解决这一矛盾的关键基础设施。它的"
---

区块链的存储成本是前端工程师进入 Web3 领域后最先感受到的震撼之一。在以太坊上存储 1 MB 数据的 Gas 费用可能高达数千美元——这让图片、视频、JSON 文件等内容的链上存储完全不可行。IPFS（InterPlanetary File System）作为去中心化存储方案，成为了解决这一矛盾的关键基础设施。它的定位很明确：链上存储哈希，链下存储内容。

## IPFS 的核心概念

### 内容寻址

传统 Web 使用位置寻址（Location Addressing）——通过 URL 找到文件所在的服务器。IPFS 使用内容寻址（Content Addressing）——通过文件内容的哈希值找到文件。

```
# 位置寻址（HTTP）
https://example.com/images/photo.jpg
# 文件在哪台服务器上，由域名决定

# 内容寻址（IPFS）
/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
# 文件的哈希值，无论谁存储都返回相同内容
```

内容寻址的核心优势：

1. **不可篡改性**：哈希值由内容决定，内容变化则哈希变化
2. **去重**：相同内容只存储一份，哈希相同即内容相同
3. **抗审查**：没有中心化服务器可以被关闭，任何节点都可以提供文件

### DAG（有向无环图）

IPFS 内部使用 Merkle DAG 数据结构组织数据。文件被分割成多个块（block），每个块的大小不超过 256 KB。大文件被组织成一棵树形结构，每个父节点的哈希由子节点内容计算得出。

```
文件 (1MB)
├── Block 0 (256KB) → CID bafy...001
├── Block 1 (256KB) → CID bafy...002
├── Block 2 (256KB) → CID bafy...003
└── Block 3 (256KB) → CID bafy...004
         ↓
Root Node → CID bafy...root (包含所有子块链接)
```

这种结构支持高效的内容验证和去重——如果两个大文件有部分内容相同，相同的块只需要存储一次。

### DHT（分布式哈希表）

IPFS 使用 Kademlia DHT 来定位内容。当节点需要获取某个 CID 对应的内容时，它向 DHT 查询哪些节点存储了该内容，然后直接从最近的节点获取。

```
节点 A 想要获取 CID: QmXYZ...
  → 查询 DHT：谁有 QmXYZ...?
  → DHT 返回：节点 C 和节点 F 有 QmXYZ...
  → 节点 A 从节点 C 下载文件
  → 验证哈希是否匹配
```

## CID 的生成与版本差异

CID（Content Identifier）是 IPFS 中标识内容的唯一标识符。IPFS 同时存在两个版本的 CID：

### CIDv0

```
QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

- 以 `Qm` 开头的 46 字符 Base58 编码字符串
- 使用 SHA-256 哈希
- 对应的多哈希格式：`<sha2-256><32字节哈希>`

### CIDv1

```
bafybeiequkh kupmbcdgpys5lxgi7ofelwz2wdz4m 5p7l6n3k7wmgpvq
```

- 包含多编解码器前缀、多哈希格式和版本号
- 支持 Base32 编码（更适合 DNS）
- 自描述：可以从 CID 本身推断出哈希算法和编码方式

```javascript
const ipfs = require('ipfs');

// CID 转换
const cidV0 = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
const cid = new ipfs.CID(cidV0);

console.log(cid.version);        // 0
console.log(cid.codec);          // 'dag-pb'
console.log(cid.multihash);      // <Buffer 12 20 ...>

// 转换为 v1
const cidV1 = cid.toV1();
console.log(cidV1.toString());   // bafy...
```

在实际项目中，CIDv1 更推荐使用，因为它是自描述的且支持 DNS-link。但在实践中，大量工具和网关仍以 CIDv0 为主，两者混用是常态。

## js-ipfs 在浏览器中的使用

js-ipfs 是 IPFS 的纯 JavaScript 实现，可以在浏览器中直接运行：

### 安装与初始化

```html
<!-- 通过 CDN 引入 -->
<script src="https://unpkg.com/ipfs/dist/index.min.js"></script>
```

```javascript
// 或通过 npm
const IPFS = require('ipfs');

// 创建节点
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

// 等待节点就绪
node.on('ready', () => {
    console.log('IPFS node is ready');
    console.log('Node ID:', node.id());
});
```

浏览器中的 IPFS 节点使用 WebSocket 和 WebRTC 进行通信，无需浏览器扩展支持。但受限于浏览器沙箱，数据存储在 IndexedDB 中，关闭浏览器后节点下线。

## 文件上传与下载 API

### 上传文件

```javascript
// 上传文件内容
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

// 上传多个文件（目录）
async function uploadDirectory(files) {
    const filesToAdd = files.map(file => ({
        path: file.name,
        content: file.content
    }));

    const results = await node.add(filesToAdd, { wrapWithDirectory: true });

    // 最后一个结果是根目录的 CID
    const rootDir = results[results.length - 1];
    console.log('Directory CID:', rootDir.hash);

    // 通过 /ipfs/<rootDir.hash>/<filename> 访问文件
    return rootDir.hash;
}

// 从浏览器 File API 上传
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

### 下载文件

```javascript
// 通过 CID 读取文件
async function readFromIPFS(cid) {
    const chunks = [];
    for await (const chunk of node.cat(cid)) {
        chunks.push(chunk);
    }

    const data = Buffer.concat(chunks);
    return data;
}

// 读取文本
async function readText(cid) {
    const data = await readFromIPFS(cid);
    return data.toString('utf8');
}

// 读取 JSON
async function readJSON(cid) {
    const text = await readText(cid);
    return JSON.parse(text);
}

// 读取大文件（流式）
async function streamFile(cid, onData, onEnd) {
    for await (const chunk of node.cat(cid)) {
        onData(chunk);
    }
    onEnd();
}

// 获取文件状态信息
async function getFileInfo(cid) {
    const stats = await node.files.stat(`/ipfs/${cid}`);
    console.log('Size:', stats.size);
    console.log('Type:', stats.type);  // 'file' 或 'directory'
    console.log('Blocks:', stats.blocks);
    return stats;
}
```

## IPFS 网关的使用与自建

IPFS 网关是提供 HTTP 接口访问 IPFS 内容的服务器。通过网关，任何浏览器都可以通过 HTTP URL 访问 IPFS 上的内容，无需运行 IPFS 节点：

```
https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://gateway.ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://cloudflare-ipfs.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

### 在前端中使用网关

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
            // 尝试下一个网关
            continue;
        }
    }
    throw new Error('All gateways failed');
}
```

### 自建网关

```bash
# 运行 go-ipfs 节点并开启网关
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs daemon
```

自建网关可以配置为 pinning 节点，确保重要内容不会因 GC 被清除。在 DApp 架构中，自建网关提供了内容持久性和访问速度的保障。

## 与以太坊结合：链上存储 hash，链下存储内容

这是 IPFS 在 DApp 中最经典的用法——将内容存储在 IPFS 上，将其 CID 存储在以太坊合约中：

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

### 前端上传模块

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

        // 步骤 1：上传文件到 IPFS
        const results = await this.ipfs.add({
            content: fileBuffer,
            path: fileName
        });
        const ipfsHash = results[0].hash;

        // 步骤 2：将 hash 写入以太坊合约
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
        // 优先通过本地 IPFS 节点获取
        try {
            const chunks = [];
            for await (const chunk of this.ipfs.cat(ipfsHash)) {
                chunks.push(chunk);
            }
            return Buffer.concat(chunks);
        } catch (error) {
            // 回退到公共网关
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

## NFT metadata 的 IPFS 存储方案

ERC721 NFT 的 `tokenURI` 指向 metadata JSON 文件。将 metadata 存储在 IPFS 上既保证了不可篡改性，又避免了高昂的链上存储成本：

```javascript
// 为 NFT 生成并上传 metadata
async function createNFTMetadata(name, description, imageCID, attributes) {
    const metadata = {
        name: name,
        description: description,
        image: `ipfs://${imageCID}`,
        attributes: attributes  // [{ trait_type: "Color", value: "Blue" }]
    };

    // 上传 metadata JSON 到 IPFS
    const results = await ipfs.add({
        content: JSON.stringify(metadata),
        path: 'metadata.json'
    });

    const metadataCID = results[0].hash;
    return `ipfs://${metadataCID}`;
}

// 在合约中设置 tokenURI
async function mintNFT(tokenId, metadataURI) {
    const receipt = await contract.methods
        ._setTokenURI(tokenId, metadataURI)
        .send({ from: account, gas: 100000 });
    return receipt;
}
```

metadata 的典型结构：

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

## 持久化问题：pinning 服务

IPFS 的一个根本性问题：没有节点主动存储你的内容时，内容会"消失"——节点运行 GC 后未 pin 的内容会被清除。

### 本地 Pinning

```javascript
// pin 内容确保不被 GC 清除
await ipfs.pin.add(cid);
console.log('Pinned:', cid);

// 查看已 pin 的内容
const pinnedList = await ipfs.pin.ls();
pinnedList.forEach(pin => {
    console.log(pin.hash, pin.type);  // 'direct' 或 'recursive'
});

// 取消 pin
await ipfs.pin.rm(cid);
```

### Pinning 服务

常见的公共 pinning 服务包括 Pinata 和 Infura 的 IPFS 服务：

```javascript
// 使用 Pinata API pin 内容
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

## 优缺点分析与适用场景

### 优点

- **去中心化**：内容不依赖单一服务器，抗审查
- **内容寻址**：哈希即地址，内容完整性可验证
- **节省链上存储成本**：大文件存储成本从数千美元降至零
- **去重**：相同内容自动去重，节省存储空间

### 缺点

- **持久性无保证**：没有节点 pin 的内容会被 GC 清除
- **访问速度不稳定**：依赖网络中是否有节点提供该内容
- **不可修改**：内容更新后 CID 变化，无法原地更新
- **网关单点风险**：大量 DApp 依赖 ipfs.io 网关，该网关宕机则不可访问
- **存储成本转嫁**：虽然免费，但数据持久性取决于第三方 pinning 服务

### 适用场景

| 场景 | 适合 | 原因 |
|------|------|------|
| NFT metadata | ✓ | 不可篡改性正好匹配 NFT 需求 |
| DApp 前端托管 | ✓ | 配合 ENS 可实现完全去中心化前端 |
| 用户上传的图片/文档 | ✓ | 大文件存储成本低 |
| 频繁更新的数据 | ✗ | CID 变化导致引用失效 |
| 需要搜索的数据 | ✗ | IPFS 不支持内容检索 |
| 小量关键数据 | ✗ | 直接上链更可靠 |

## 小结

IPFS 在 DApp 技术栈中扮演着"廉价存储层"的角色——以太坊负责价值传输和关键状态，IPFS 负责内容存储。这种分层架构是一种务实的去中心化存储方案。

但 IPFS 的"去中心化理想"与工程现实之间存在显著落差。内容持久性是最核心的问题——没有经济激励的存储网络无法保证长期可用性。Filecoin 的设想正是为了解决这一激励问题。Pinning 服务虽然实用，但本质上是一种中心化的妥协。

从前端工程角度，IPFS 的集成体验并不顺畅。js-ipfs 在浏览器中运行时体积大、初始化慢、连接不稳定，大多数 DApp 最终还是退化到使用公共网关作为 fallback。但内容寻址的理念是正确且重要的——它提供了一种验证内容完整性的机制，这在去中心化应用中不可或缺。

对于准备在 DApp 中使用 IPFS 的开发者，核心建议是：始终实现多网关 fallback + 本地节点的组合策略，并为关键内容使用 pinning 服务。不要依赖公共网关的持久性——今天能访问的 CID，明天可能就无人提供了。
