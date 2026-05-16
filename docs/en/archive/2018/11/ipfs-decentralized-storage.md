---
title: "IPFS Decentralized Storage: Frontend File Hosting in Practice"
date: 2018-11-18 15:02:01
tags:
  - Web3
  - Blockchain
---

The cost of blockchain storage is one of the first shocks frontend engineers encounter when entering the Web3 space. Storing 1 MB of data on Ethereum can cost thousands of dollars in gas fees—making on-chain storage of images, videos, JSON files, and other content entirely impractical. IPFS (InterPlanetary File System), as a decentralized storage solution, became the key infrastructure to resolve this contradiction. Its positioning is clear: store hashes on-chain, store content off-chain.

## Core Concepts of IPFS

### Content Addressing

The traditional web uses location addressing—finding the server where a file resides via a URL. IPFS uses content addressing—finding a file via the hash of its content.

```
# 位置寻址（HTTP）
https://example.com/images/photo.jpg
# 文件在哪台服务器上，由域名决定

# 内容寻址（IPFS）
/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
# 文件的哈希值，无论谁存储都返回相同内容
```

Core advantages of content addressing:

1. **Tamper resistance**: The hash is determined by the content—if the content changes, the hash changes
2. **Deduplication**: Identical content is stored only once—same hash means same content
3. **Censorship resistance**: There is no centralized server to shut down—any node can serve the file

### DAG (Directed Acyclic Graph)

IPFS internally uses a Merkle DAG data structure to organize data. Files are split into multiple blocks, each no larger than 256 KB. Large files are organized into a tree structure, where each parent node's hash is computed from its children's content.

```
文件 (1MB)
├── Block 0 (256KB) → CID bafy...001
├── Block 1 (256KB) → CID bafy...002
├── Block 2 (256KB) → CID bafy...003
└── Block 3 (256KB) → CID bafy...004
         ↓
Root Node → CID bafy...root (包含所有子块链接)
```

This structure supports efficient content verification and deduplication—if two large files share some identical content, the identical blocks only need to be stored once.

### DHT (Distributed Hash Table)

IPFS uses a Kademlia DHT to locate content. When a node needs to retrieve content corresponding to a CID, it queries the DHT for which nodes store that content, then fetches it directly from the nearest node.

```
节点 A 想要获取 CID: QmXYZ...
  → 查询 DHT：谁有 QmXYZ...?
  → DHT 返回：节点 C 和节点 F 有 QmXYZ...
  → 节点 A 从节点 C 下载文件
  → 验证哈希是否匹配
```

## CID Generation and Version Differences

A CID (Content Identifier) is the unique identifier for content in IPFS. IPFS has two coexisting CID versions:

### CIDv0

```
QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

- A 46-character Base58-encoded string starting with `Qm`
- Uses SHA-256 hashing
- Corresponding multihash format: `<sha2-256><32-byte hash>`

### CIDv1

```
bafybeiequkh kupmbcdgpys5lxgi7ofelwz2wdz4m 5p7l6n3k7wmgpvq
```

- Includes a multicodec prefix, multihash format, and version number
- Supports Base32 encoding (more DNS-friendly)
- Self-describing: the hash algorithm and encoding can be inferred from the CID itself

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

In practice, CIDv1 is recommended because it is self-describing and supports DNS-link. However, most tools and gateways still primarily use CIDv0, and mixing the two is common in existing projects.

## Using js-ipfs in the Browser

js-ipfs is a pure JavaScript implementation of IPFS that can run directly in the browser:

### Installation and Initialization

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

Browser-based IPFS nodes communicate using WebSocket and WebRTC, requiring no browser extension support. However, due to browser sandbox limitations, data is stored in IndexedDB, and the node goes offline when the browser is closed.

## File Upload and Download API

### Uploading Files

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

### Downloading Files

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

## IPFS Gateway Usage and Self-Hosting

An IPFS gateway is a server that provides HTTP access to IPFS content. Through a gateway, any browser can access content on IPFS via an HTTP URL without running an IPFS node:

```
https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://gateway.ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
https://cloudflare-ipfs.com/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG
```

### Using Gateways in the Frontend

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

### Self-Hosting a Gateway

```bash
# 运行 go-ipfs 节点并开启网关
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080
ipfs daemon
```

A self-hosted gateway can be configured as a pinning node, ensuring important content is not garbage-collected. In a DApp architecture, a self-hosted gateway provides guarantees for content persistence and access speed.

## Integrating with Ethereum: Hash On-Chain, Content Off-Chain

This is the most classic IPFS pattern in DApps—storing content on IPFS and storing its CID in an Ethereum contract:

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

### Frontend Upload Module

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

## IPFS Storage for NFT Metadata

An ERC721 NFT's `tokenURI` points to a metadata JSON file. Storing metadata on IPFS ensures tamper resistance while avoiding high on-chain storage costs:

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

Typical metadata structure:

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

## The Persistence Problem: Pinning Services

A fundamental issue with IPFS: when no node actively stores your content, the content "disappears"—unpinned content is cleared after a node runs garbage collection.

### Local Pinning

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

### Pinning Services

Public pinning service options include Pinata and Infura's IPFS service:

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

## Pros, Cons, and Use Cases

### Advantages

- **Decentralized**: Content does not depend on a single server, censorship-resistant
- **Content addressing**: Hash is the address, content integrity is verifiable
- **Saves on-chain storage costs**: Large file storage costs drop from thousands of dollars to zero
- **Deduplication**: Identical content is automatically deduplicated, saving storage space

### Disadvantages

- **No persistence guarantee**: Content not pinned by any node will be garbage-collected
- **Unstable access speed**: Depends on whether nodes in the network serve the content
- **Immutable**: Content updates change the CID, no in-place updates possible
- **Gateway single point of risk**: Many DApps rely on the ipfs.io gateway—if it goes down, content is inaccessible
- **Storage cost shifted**: Although free, data persistence depends on third-party pinning services

### Use Cases

| Scenario | Suitable | Reason |
|----------|----------|--------|
| NFT metadata | Yes | Tamper resistance matches NFT requirements |
| DApp frontend hosting | Yes | Combined with ENS enables fully decentralized frontend |
| User-uploaded images/documents | Yes | Low storage cost for large files |
| Frequently updated data | No | CID changes break references |
| Data requiring search | No | IPFS does not support content retrieval/search |
| Small critical data | No | Direct on-chain storage is more reliable |

## Summary

IPFS serves as a "cheap storage layer" in the DApp tech stack—Ethereum handles value transfer and critical state, while IPFS handles content storage. This layered architecture is the most pragmatic decentralized storage solution.

However, there is a significant gap between IPFS's "decentralization ideal" and engineering reality. Content persistence is the core issue—a storage network without economic incentives cannot guarantee long-term availability. Filecoin is designed to solve this incentive problem by rewarding storage providers economically. Pinning services, while practical, are essentially a centralized compromise.

From a frontend engineering perspective, IPFS integration is not always smooth. js-ipfs running in the browser has a large footprint, slow initialization, and unstable connections—most DApps ultimately fall back to using public gateways. But the concept of content addressing is correct and important—it provides a mechanism for verifying content integrity, which is indispensable in decentralized applications.

For developers planning to use IPFS in DApps, the core advice is: always implement a multi-gateway fallback + local node combination strategy, and use pinning services for critical content. Do not rely on the persistence of public gateways—a CID accessible today may have no provider tomorrow.
