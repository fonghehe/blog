---
title: "NFT 前端开发：ERC-721 合约与展示"
date: 2020-05-06 09:48:51
tags:
  - Web3
  - NFT
  - Ethereum
readingTime: 8
wordCount: 905
description: "ERC-721 标准在 EIP-721 中定义了非同质化代币（Non-Fungible Token）的接口规范。与 ERC-20 的\"每枚代币完全等价\"不同，ERC-721 的每个代币拥有唯一的 tokenId，可以代表独一无二的数字资产。"
---

## ERC-721 标准与非同质化代币

ERC-721 标准在 EIP-721 中定义了非同质化代币（Non-Fungible Token）的接口规范。与 ERC-20 的"每枚代币完全等价"不同，ERC-721 的每个代币拥有唯一的 tokenId，可以代表独一无二的数字资产。

NFT 生态涵盖加密艺术（CryptoArt）、虚拟土地（Decentraland）、游戏资产等场景，对前端展示和交互提出了新的要求。与 ERC-20 前端只需显示余额和转账不同，NFT 前端需要处理图片渲染、metadata 解析、属性展示等富媒体内容。

## ERC-721 标准接口解析

ERC-721 标准包含两个接口：核心接口和元数据扩展接口。

### 核心接口

```solidity
interface IERC721 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool approved) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
```

### 元数据扩展接口（EIP-721 Metadata Extension）

```solidity
interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

`tokenURI` 是 NFT 前端的核心——它返回指向该 NFT metadata 的 URI，前端通过这个 URI 获取 NFT 的名称、图片和属性。

### 枚举扩展接口（EIP-721 Enumerable Extension）

```solidity
interface IERC721Enumerable {
    function totalSupply() external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}
```

枚举接口允许前端遍历所有 NFT 或查询特定地址持有的 NFT 列表。并非所有 ERC-721 合约都实现了这个扩展，但它对前端展示非常重要。

## 前端读取 NFT 数据

### 单个 NFT 数据读取

```javascript
import { ethers } from 'ethers';

const ERC721_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function tokenByIndex(uint256 index) view returns (uint256)',
];

async function getNFTMetadata(provider, contractAddress, tokenId) {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);

  // 并发读取链上数据
  const [tokenURI, owner, name, symbol] = await Promise.all([
    contract.tokenURI(tokenId),
    contract.ownerOf(tokenId),
    contract.name(),
    contract.symbol(),
  ]);

  // 获取 off-chain metadata
  const metadata = await fetchNFTMetadata(tokenURI);

  return {
    contractAddress,
    tokenId: tokenId.toString(),
    name,
    symbol,
    owner,
    tokenURI,
    metadata,
  };
}
```

### 获取用户持有的所有 NFT

```javascript
async function getNFTsByOwner(provider, contractAddress, ownerAddress) {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const balance = await contract.balanceOf(ownerAddress);

  if (balance.isZero()) return [];

  // 检查合约是否支持枚举接口
  const supportsEnumerable = await supportsInterface(provider, contractAddress, '0x780e9d63');

  if (supportsEnumerable) {
    // 使用 tokenOfOwnerByIndex 逐个查询
    const tokenIds = [];
    for (let i = 0; i < balance.toNumber(); i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
      tokenIds.push(tokenId);
    }

    // 并发获取所有 metadata
    const metadataPromises = tokenIds.map(id =>
      contract.tokenURI(id).then(uri => fetchNFTMetadata(uri))
    );
    const metadataList = await Promise.all(metadataPromises);

    return tokenIds.map((id, i) => ({
      tokenId: id.toString(),
      metadata: metadataList[i],
    }));
  } else {
    // 不支持枚举接口，需要通过事件日志查询
    return await getNFTsByEventLogs(provider, contractAddress, ownerAddress);
  }
}

// EIP-165 接口支持检测
async function supportsInterface(provider, contractAddress, interfaceId) {
  const abi = ['function supportsInterface(bytes4) view returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  try {
    return await contract.supportsInterface(interfaceId);
  } catch {
    return false; // 合约未实现 EIP-165
  }
}
```

## Metadata JSON 结构与解析

EIP-721 规范建议 metadata JSON 遵循以下结构：

```json
{
  "name": "Token Name #42",
  "description": "A description of the token",
  "image": "https://example.com/image/42.png",
  "external_url": "https://example.com/token/42",
  "attributes": [
    { "trait_type": "Color", "value": "Blue" },
    { "trait_type": "Rarity", "value": "Rare" },
    { "display_type": "number", "trait_type": "Level", "value": 5 },
    { "display_type": "boost_number", "trait_type": "Power", "value": 30 },
    { "display_type": "date", "trait_type": "Birthday", "value": 1563408000 }
  ]
}
```

前端解析 metadata 的实现：

```javascript
async function fetchNFTMetadata(tokenURI) {
  // 处理不同的 URI scheme
  let url;
  if (tokenURI.startsWith('ipfs://')) {
    // IPFS 协议转换为 HTTP 网关
    const cid = tokenURI.replace('ipfs://', '');
    url = `https://ipfs.io/ipfs/${cid}`;
  } else if (tokenURI.startsWith('data:application/json')) {
    // 链上 base64 编码的 metadata
    const encoded = tokenURI.split(',')[1];
    const decoded = atob(encoded);
    return JSON.parse(decoded);
  } else {
    url = tokenURI;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata: ${response.status}`);
  }

  const metadata = await response.json();

  // 规范化图片 URL
  if (metadata.image && metadata.image.startsWith('ipfs://')) {
    const cid = metadata.image.replace('ipfs://', '');
    metadata.image = `https://ipfs.io/ipfs/${cid}`;
  }

  return metadata;
}

// 解析属性展示类型
function formatAttributeValue(attribute) {
  if (attribute.display_type === 'date') {
    return new Date(attribute.value * 1000).toLocaleDateString();
  }
  if (attribute.display_type === 'number' || attribute.display_type === 'boost_number') {
    return String(attribute.value);
  }
  return String(attribute.value);
}
```

## 图片资源处理：IPFS vs HTTP vs On-chain SVG

NFT 的图片存储方式直接影响前端的加载策略和用户体验：

### IPFS 存储

```javascript
// 多网关回退策略
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

function resolveIPFSImage(uri) {
  if (!uri.startsWith('ipfs://')) return uri;
  const cid = uri.replace('ipfs://', '').replace(/\/$/, '');
  // 返回第一个网关，加载失败时前端切换
  return `${IPFS_GATEWAYS[0]}${cid}`;
}

// React 组件中的图片加载回退
function NFTImage({ src, alt }) {
  const [gatewayIndex, setGatewayIndex] = useState(0);
  const [resolvedSrc, setResolvedSrc] = useState(src);

  useEffect(() => {
    if (src.startsWith('ipfs://')) {
      const cid = src.replace('ipfs://', '');
      setResolvedSrc(`${IPFS_GATEWAYS[gatewayIndex]}${cid}`);
    } else {
      setResolvedSrc(src);
    }
  }, [src, gatewayIndex]);

  const handleError = () => {
    if (gatewayIndex < IPFS_GATEWAYS.length - 1) {
      setGatewayIndex(gatewayIndex + 1);
    }
  };

  return <img src={resolvedSrc} alt={alt} onError={handleError} loading="lazy" />;
}
```

### 链上 SVG

部分 NFT 将 SVG 图片直接存储在合约中，前端无需外部请求即可渲染：

```javascript
// 从合约读取链上 SVG
async function getOnChainSVG(provider, contractAddress, tokenId) {
  const abi = ['function tokenURI(uint256) view returns (string)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const uri = await contract.tokenURI(tokenId);

  if (uri.startsWith('data:image/svg+xml')) {
    // 直接作为 img src 使用
    return uri;
  } else if (uri.startsWith('data:application/json;base64')) {
    // base64 编码的 JSON，内含 SVG
    const decoded = JSON.parse(atob(uri.split(',')[1]));
    if (decoded.image && decoded.image.startsWith('data:image/svg+xml')) {
      return decoded.image;
    }
  }
  return null;
}
```

## NFT 铸造前端流程

```javascript
const MINT_ABI = [
  'function mint() payable returns (uint256)',
  'function mintTo(address to) payable returns (uint256)',
  'function mintPrice() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function maxPerTx() view returns (uint256)',
  'function saleActive() view returns (bool)',
];

async function mintNFT(provider, contractAddress, quantity = 1) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, MINT_ABI, signer);

  // 前置检查
  const [saleActive, mintPrice, totalSupply, maxSupply, maxPerTx] = await Promise.all([
    contract.saleActive(),
    contract.mintPrice(),
    contract.totalSupply(),
    contract.maxSupply(),
    contract.maxPerTx(),
  ]);

  if (!saleActive) throw new Error('Mint 尚未开始');
  if (quantity > maxPerTx.toNumber()) throw new Error(`单次最多 mint ${maxPerTx} 个`);
  if (totalSupply.add(quantity) > maxSupply) throw new Error('已售罄');

  // 计算总价
  const totalPrice = mintPrice.mul(quantity);

  // 执行 mint
  const tx = await contract.mint(quantity, { value: totalPrice });
  const receipt = await tx.wait();

  // 从事件日志中提取 mint 的 tokenId
  const iface = new ethers.utils.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  ]);

  const mintedTokens = receipt.logs
    .filter(log => log.address.toLowerCase() === contractAddress.toLowerCase())
    .map(log => iface.parseLog(log))
    .filter(event => event.name === 'Transfer' && event.args.from === ethers.constants.AddressZero)
    .map(event => event.args.tokenId.toString());

  return { receipt, mintedTokens };
}
```

## NFT 转移与市场交易

### 直接转移

```javascript
async function transferNFT(provider, contractAddress, tokenId, toAddress) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, signer);
  const fromAddress = await signer.getAddress();

  // safeTransferFrom 会检查接收方是否实现了 IERC721Receiver
  const tx = await contract['safeTransferFrom(address,address,uint256)'](
    fromAddress,
    toAddress,
    tokenId
  );
  return await tx.wait();
}
```

### 市场挂单前端交互

```javascript
const MARKET_ABI = [
  'function listItem(address nftAddress, uint256 tokenId, uint256 price) returns (bytes32)',
  'function buyItem(address nftAddress, uint256 tokenId) payable',
  'function cancelListing(address nftAddress, uint256 tokenId)',
  'function getListing(address nftAddress, uint256 tokenId) view returns (tuple(address seller, uint256 price, bool active))',
];

async function listNFTForSale(provider, marketAddress, nftAddress, tokenId, priceInWei) {
  const signer = provider.getSigner();
  const nftContract = new ethers.Contract(nftAddress, ERC721_ABI, signer);
  const marketContract = new ethers.Contract(marketAddress, MARKET_ABI, signer);
  const seller = await signer.getAddress();

  // 1. 检查所有权
  const owner = await nftContract.ownerOf(tokenId);
  if (owner.toLowerCase() !== seller.toLowerCase()) {
    throw new Error('您不持有此 NFT');
  }

  // 2. 授权市场合约（如果尚未授权）
  const isApproved = await nftContract.isApprovedForAll(seller, marketAddress);
  if (!isApproved) {
    const approveTx = await nftContract.setApprovalForAll(marketAddress, true);
    await approveTx.wait();
  }

  // 3. 挂单
  const tx = await marketContract.listItem(nftAddress, tokenId, priceInWei);
  return await tx.wait();
}
```

## NFT 展示组件

```jsx
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

function NFTCard({ provider, contractAddress, tokenId }) {
  const [nft, setNft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadNFT() {
      try {
        setLoading(true);
        const data = await getNFTMetadata(provider, contractAddress, tokenId);
        if (!cancelled) {
          setNft(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadNFT();
    return () => { cancelled = true; };
  }, [provider, contractAddress, tokenId]);

  if (loading) return <div className="nft-card nft-card--loading">Loading...</div>;
  if (error) return <div className="nft-card nft-card--error">{error}</div>;
  if (!nft) return null;

  return (
    <div className="nft-card">
      <NFTImage src={nft.metadata.image} alt={nft.metadata.name} />
      <div className="nft-card__body">
        <h3 className="nft-card__title">{nft.metadata.name}</h3>
        {nft.metadata.description && (
          <p className="nft-card__desc">{nft.metadata.description}</p>
        )}
        {nft.metadata.attributes && (
          <div className="nft-card__attributes">
            {nft.metadata.attributes.map((attr, i) => (
              <span key={i} className="nft-attribute">
                <span className="nft-attribute__type">{attr.trait_type}</span>
                <span className="nft-attribute__value">
                  {formatAttributeValue(attr)}
                </span>
              </span>
            ))}
          </div>
        )}
        <div className="nft-card__meta">
          <span>Token ID: {nft.tokenId}</span>
          <span>{nft.symbol}</span>
        </div>
      </div>
    </div>
  );
}
```

## OpenSea 对接与 Metadata 兼容

OpenSea 是最大的 NFT 交易市场，其 metadata 标准已成为事实上的行业规范。确保 NFT metadata 兼容 OpenSea 需要注意：

1. **`image` 字段** 必须是可直接访问的图片 URL 或 data URI
2. **`attributes` 数组** 的每个元素包含 `trait_type` 和 `value`
3. **数值型属性** 可添加 `display_type`（`number`、`boost_number`、`boost_percentage`、`date`）
4. **`external_url`** 指向 NFT 的详情页面
5. **`background_color`** 可选，6 位十六进制色值（不带 `#`）

前端在展示 NFT 时，可以同时对接 OpenSea API 获取市场数据（地板价、挂单信息）：

```javascript
async function getOpenSeaData(contractAddress, tokenId) {
  const url = `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}/`;
  const response = await fetch(url, {
    headers: { 'X-API-KEY': OPENSEA_API_KEY },
  });
  const data = await response.json();

  return {
    floorPrice: data.collection?.stats?.floor_price,
    lastSale: data.last_sale?.total_price,
    sellOrders: data.sell_orders,
    collection: {
      name: data.collection?.name,
      image: data.collection?.image_url,
      totalSupply: data.collection?.stats?.total_supply,
    },
  };
}
```

## 大量 NFT 的前端加载策略

当一个用户持有大量 NFT，或者一个集合有数千个 NFT 需要展示时，前端需要考虑性能优化：

### 分页加载与虚拟滚动

```javascript
// 使用 multicall 批量查询
async function batchFetchNFTs(provider, contractAddress, tokenIds) {
  const multicallAddress = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441'; // Mainnet Multicall
  const multicallAbi = [
    'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
  ];

  const erc721Interface = new ethers.utils.Interface([
    'function tokenURI(uint256) view returns (string)',
  ]);

  const multicall = new ethers.Contract(multicallAddress, multicallAbi, provider);

  // 构造批量调用
  const calls = tokenIds.map(id => [
    contractAddress,
    erc721Interface.encodeFunctionData('tokenURI', [id]),
  ]);

  const [, returnData] = await multicall.aggregate(calls);

  // 解码结果
  const tokenURIs = returnData.map(data =>
    erc721Interface.decodeFunctionResult('tokenURI', data)[0]
  );

  // 并发获取 metadata（限制并发数）
  const metadataList = await pLimit(
    tokenURIs.map(uri => () => fetchNFTMetadata(uri)),
    5 // 最多 5 个并发
  );

  return tokenIds.map((id, i) => ({
    tokenId: id.toString(),
    metadata: metadataList[i],
  }));
}

// 并发限制工具
function pLimit(tasks, limit) {
  return new Promise((resolve) => {
    const results = [];
    let index = 0;
    let running = 0;

    function run() {
      if (index >= tasks.length && running === 0) {
        resolve(results);
        return;
      }

      while (running < limit && index < tasks.length) {
        const currentIndex = index++;
        running++;
        tasks[currentIndex]().then(result => {
          results[currentIndex] = result;
          running--;
          run();
        });
      }
    }

    run();
  });
}
```

### 使用 The Graph 索引

对于大量 NFT 的查询，直接读取链上数据效率太低。通过 The Graph 子图索引 Transfer 事件，可以快速查询用户持仓、集合统计等数据：

```graphql
# The Graph 查询：获取用户持有的所有 NFT
query GetNFTsByOwner($owner: String!) {
  accounts(id: $owner) {
    erc721Tokens {
      id
      contract {
        id
        name
        symbol
      }
      identifier
      uri
    }
  }
}
```

前端通过 GraphQL 客户端查询子图，避免直接与链上合约交互：

```javascript
import { request } from 'graphql-request';

async function getNFTsFromSubgraph(ownerAddress) {
  const query = `
    query($owner: String!) {
      transfers(where: { to: $owner }) {
        tokenId
        from
        to
        contractAddress
      }
    }
  `;
  const data = await request(SUBGRAPH_URL, query, { owner: ownerAddress.toLowerCase() });
  return data.transfers;
}
```

## 小结

NFT 前端开发的核心挑战在于**链上数据与链下 metadata 的协调**。`tokenURI` 是连接这两者的桥梁，而图片资源的加载策略、metadata 的格式兼容性、大量 NFT 的性能优化，构成了前端开发的主要工作。

ERC-721 标准虽然定义了合约接口，但 metadata 的实现方式（IPFS、HTTP、on-chain）差异很大，前端必须具备足够的容错能力。在实际项目中，建议优先考虑使用 The Graph 等索引服务来处理大量 NFT 的查询，避免直接通过 RPC 节点逐个读取，这对用户体验和 RPC 调用成本都是必要的优化。
