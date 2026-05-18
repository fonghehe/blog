---
readingTime: 4
wordCount: 918
title: "NFT 前端開發：ERC-721 合約與展示"
date: 2020-05-06 09:48:51
tags:
  - Web3
  - NFT
  - Ethereum
---

## ERC-721 標準與非同質化代幣

ERC-721 標準於 2018 年 1 月在 EIP-721 中正式提出，定義了非同質化代幣（Non-Fungible Token）的接口規範。與 ERC-20 的"每枚代幣完全等價"不同，ERC-721 的每個代幣擁有唯一的 tokenId，可以代表獨一無二的數字資產。

NFT 生態涵蓋加密藝術（CryptoArt）、虛擬土地（Decentraland）、遊戲資產等場景，對前端展示和交互提出了新的要求。與 ERC-20 前端只需顯示餘額和轉賬不同，NFT 前端需要處理圖片渲染、metadata 解析、屬性展示等富媒體內容。

## ERC-721 標準接口解析

ERC-721 標準包含兩個接口：核心接口和元數據擴展接口。

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

### 元數據擴展接口（EIP-721 Metadata Extension）

```solidity
interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

`tokenURI` 是 NFT 前端的核心——它返回指向該 NFT metadata 的 URI，前端通過這個 URI 獲取 NFT 的名稱、圖片和屬性。

### 枚舉擴展接口（EIP-721 Enumerable Extension）

```solidity
interface IERC721Enumerable {
    function totalSupply() external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}
```

枚舉接口允許前端遍歷所有 NFT 或查詢特定地址持有的 NFT 列表。並非所有 ERC-721 合約都實現了這個擴展，但它對前端展示非常重要。

## 前端讀取 NFT 數據

### 單個 NFT 數據讀取

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

  // 併發讀取鏈上數據
  const [tokenURI, owner, name, symbol] = await Promise.all([
    contract.tokenURI(tokenId),
    contract.ownerOf(tokenId),
    contract.name(),
    contract.symbol(),
  ]);

  // 獲取 off-chain metadata
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

### 獲取用户持有的所有 NFT

```javascript
async function getNFTsByOwner(provider, contractAddress, ownerAddress) {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const balance = await contract.balanceOf(ownerAddress);

  if (balance.isZero()) return [];

  // 檢查合約是否支持枚舉接口
  const supportsEnumerable = await supportsInterface(provider, contractAddress, '0x780e9d63');

  if (supportsEnumerable) {
    // 使用 tokenOfOwnerByIndex 逐個查詢
    const tokenIds = [];
    for (let i = 0; i < balance.toNumber(); i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
      tokenIds.push(tokenId);
    }

    // 併發獲取所有 metadata
    const metadataPromises = tokenIds.map(id =>
      contract.tokenURI(id).then(uri => fetchNFTMetadata(uri))
    );
    const metadataList = await Promise.all(metadataPromises);

    return tokenIds.map((id, i) => ({
      tokenId: id.toString(),
      metadata: metadataList[i],
    }));
  } else {
    // 不支持枚舉接口，需要通過事件日誌查詢
    return await getNFTsByEventLogs(provider, contractAddress, ownerAddress);
  }
}

// EIP-165 接口支持檢測
async function supportsInterface(provider, contractAddress, interfaceId) {
  const abi = ['function supportsInterface(bytes4) view returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  try {
    return await contract.supportsInterface(interfaceId);
  } catch {
    return false; // 合約未實現 EIP-165
  }
}
```

## Metadata JSON 結構與解析

EIP-721 規範建議 metadata JSON 遵循以下結構：

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

前端解析 metadata 的實現：

```javascript
async function fetchNFTMetadata(tokenURI) {
  // 處理不同的 URI scheme
  let url;
  if (tokenURI.startsWith('ipfs://')) {
    // IPFS 協議轉換為 HTTP 網關
    const cid = tokenURI.replace('ipfs://', '');
    url = `https://ipfs.io/ipfs/${cid}`;
  } else if (tokenURI.startsWith('data:application/json')) {
    // 鏈上 base64 編碼的 metadata
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

  // 規範化圖片 URL
  if (metadata.image && metadata.image.startsWith('ipfs://')) {
    const cid = metadata.image.replace('ipfs://', '');
    metadata.image = `https://ipfs.io/ipfs/${cid}`;
  }

  return metadata;
}

// 解析屬性展示類型
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

## 圖片資源處理：IPFS vs HTTP vs On-chain SVG

NFT 的圖片存儲方式直接影響前端的加載策略和用户體驗：

### IPFS 存儲

```javascript
// 多網關回退策略
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

function resolveIPFSImage(uri) {
  if (!uri.startsWith('ipfs://')) return uri;
  const cid = uri.replace('ipfs://', '').replace(/\/$/, '');
  // 返回第一個網關，加載失敗時前端切換
  return `${IPFS_GATEWAYS[0]}${cid}`;
}

// React 組件中的圖片加載回退
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

### 鏈上 SVG

部分 NFT 將 SVG 圖片直接存儲在合約中，前端無需外部請求即可渲染：

```javascript
// 從合約讀取鏈上 SVG
async function getOnChainSVG(provider, contractAddress, tokenId) {
  const abi = ['function tokenURI(uint256) view returns (string)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const uri = await contract.tokenURI(tokenId);

  if (uri.startsWith('data:image/svg+xml')) {
    // 直接作為 img src 使用
    return uri;
  } else if (uri.startsWith('data:application/json;base64')) {
    // base64 編碼的 JSON，內含 SVG
    const decoded = JSON.parse(atob(uri.split(',')[1]));
    if (decoded.image && decoded.image.startsWith('data:image/svg+xml')) {
      return decoded.image;
    }
  }
  return null;
}
```

## NFT 鑄造前端流程

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

  // 前置檢查
  const [saleActive, mintPrice, totalSupply, maxSupply, maxPerTx] = await Promise.all([
    contract.saleActive(),
    contract.mintPrice(),
    contract.totalSupply(),
    contract.maxSupply(),
    contract.maxPerTx(),
  ]);

  if (!saleActive) throw new Error('Mint 尚未開始');
  if (quantity > maxPerTx.toNumber()) throw new Error(`單次最多 mint ${maxPerTx} 個`);
  if (totalSupply.add(quantity) > maxSupply) throw new Error('已售罄');

  // 計算總價
  const totalPrice = mintPrice.mul(quantity);

  // 執行 mint
  const tx = await contract.mint(quantity, { value: totalPrice });
  const receipt = await tx.wait();

  // 從事件日誌中提取 mint 的 tokenId
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

## NFT 轉移與市場交易

### 直接轉移

```javascript
async function transferNFT(provider, contractAddress, tokenId, toAddress) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, signer);
  const fromAddress = await signer.getAddress();

  // safeTransferFrom 會檢查接收方是否實現了 IERC721Receiver
  const tx = await contract['safeTransferFrom(address,address,uint256)'](
    fromAddress,
    toAddress,
    tokenId
  );
  return await tx.wait();
}
```

### 市場掛單前端交互

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

  // 1. 檢查所有權
  const owner = await nftContract.ownerOf(tokenId);
  if (owner.toLowerCase() !== seller.toLowerCase()) {
    throw new Error('您不持有此 NFT');
  }

  // 2. 授權市場合約（如果尚未授權）
  const isApproved = await nftContract.isApprovedForAll(seller, marketAddress);
  if (!isApproved) {
    const approveTx = await nftContract.setApprovalForAll(marketAddress, true);
    await approveTx.wait();
  }

  // 3. 掛單
  const tx = await marketContract.listItem(nftAddress, tokenId, priceInWei);
  return await tx.wait();
}
```

## NFT 展示組件

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

## OpenSea 對接與 Metadata 兼容

OpenSea 是最大的 NFT 交易市場，其 metadata 標準已成為事實上的行業規範。確保 NFT metadata 兼容 OpenSea 需要注意：

1. **`image` 字段** 必須是可直接訪問的圖片 URL 或 data URI
2. **`attributes` 數組** 的每個元素包含 `trait_type` 和 `value`
3. **數值型屬性** 可添加 `display_type`（`number`、`boost_number`、`boost_percentage`、`date`）
4. **`external_url`** 指向 NFT 的詳情頁面
5. **`background_color`** 可選，6 位十六進制色值（不帶 `#`）

前端在展示 NFT 時，可以同時對接 OpenSea API 獲取市場數據（地板價、掛單信息）：

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

## 大量 NFT 的前端加載策略

當一個用户持有大量 NFT，或者一個集合有數千個 NFT 需要展示時，前端需要考慮性能優化：

### 分頁加載與虛擬滾動

```javascript
// 使用 multicall 批量查詢
async function batchFetchNFTs(provider, contractAddress, tokenIds) {
  const multicallAddress = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441'; // Mainnet Multicall
  const multicallAbi = [
    'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
  ];

  const erc721Interface = new ethers.utils.Interface([
    'function tokenURI(uint256) view returns (string)',
  ]);

  const multicall = new ethers.Contract(multicallAddress, multicallAbi, provider);

  // 構造批量調用
  const calls = tokenIds.map(id => [
    contractAddress,
    erc721Interface.encodeFunctionData('tokenURI', [id]),
  ]);

  const [, returnData] = await multicall.aggregate(calls);

  // 解碼結果
  const tokenURIs = returnData.map(data =>
    erc721Interface.decodeFunctionResult('tokenURI', data)[0]
  );

  // 併發獲取 metadata（限制併發數）
  const metadataList = await pLimit(
    tokenURIs.map(uri => () => fetchNFTMetadata(uri)),
    5 // 最多 5 個併發
  );

  return tokenIds.map((id, i) => ({
    tokenId: id.toString(),
    metadata: metadataList[i],
  }));
}

// 併發限制工具
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

對於大量 NFT 的查詢，直接讀取鏈上數據效率太低。通過 The Graph 子圖索引 Transfer 事件，可以快速查詢用户持倉、集合統計等數據：

```graphql
# The Graph 查詢：獲取用户持有的所有 NFT
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

前端通過 GraphQL 客户端查詢子圖，避免直接與鏈上合約交互：

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

## 小結

NFT 前端開發的核心挑戰在於**鏈上數據與鏈下 metadata 的協調**。`tokenURI` 是連接這兩者的橋樑，而圖片資源的加載策略、metadata 的格式兼容性、大量 NFT 的性能優化，構成了前端開發的主要工作。

ERC-721 標準雖然定義了合約接口，但 metadata 的實現方式（IPFS、HTTP、on-chain）差異很大，前端必須具備足夠的容錯能力。在實際項目中，建議優先考慮使用 The Graph 等索引服務來處理大量 NFT 的查詢，避免直接通過 RPC 節點逐個讀取，這對用户體驗和 RPC 調用成本都是必要的優化。
