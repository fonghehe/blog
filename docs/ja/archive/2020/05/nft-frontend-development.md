---
title: "NFT フロントエンド開発：ERC-721 コントラクトと表示"
date: 2020-05-06 09:48:51
tags:
  - Web3
  - NFT
  - Ethereum
readingTime: 11
wordCount: 1576
description: "ERC-721 標準は 2018 年 1 月に EIP-721 として正式に提案され、非代替性トークン（Non-Fungible Token）のインターフェース仕様を定義した。ERC-20 の「各トークンが完全に等価」であるのとは異なり、ERC-721 の各トークンは一意の tokenId を持ち、唯一無二のデジタルア"
---

## ERC-721 標準と非代替性トークン

ERC-721 標準は 2018 年 1 月に EIP-721 として正式に提案され、非代替性トークン（Non-Fungible Token）のインターフェース仕様を定義した。ERC-20 の「各トークンが完全に等価」であるのとは異なり、ERC-721 の各トークンは一意の tokenId を持ち、唯一無二のデジタルアセットを表現できます。

NFT エコシステムでは、暗号アート（CryptoArt）、バーチャルランド（Decentraland）、ゲームアセットなどの場面がフロントエンドの表示や連携に新たな要件をもたらしている。ERC-20 フロントエンドが残高と送金を表示するだけでよいのとは異なり、NFT フロントエンドは画像レンダリング、metadata 解析、属性表示などのリッチメディアコンテンツを処理する必要があります。

## ERC-721 標準インターフェースの解析

ERC-721 標準は、コアインターフェースとメタデータ拡張インターフェースの 2 つから構成される。

### コアインターフェース

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

### メタデータ拡張インターフェース（EIP-721 Metadata Extension）

```solidity
interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

`tokenURI` は NFT フロントエンドの要であり、その NFT の metadata への URI を返す。フロントエンドはこの URI を通じて NFT の名称・画像・属性を取得する。

### 列挙拡張インターフェース（EIP-721 Enumerable Extension）

```solidity
interface IERC721Enumerable {
    function totalSupply() external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}
```

列挙インターフェースにより、フロントエンドはすべての NFT を走査したり、特定のアドレスが保有する NFT 一覧を照会したりできる。すべての ERC-721 コントラクトがこの拡張を実装しているわけではないが、フロントエンドでの表示においては非常に重要だ。

## フロントエンドでの NFT データ読み取り

### 単一 NFT データの読み取り

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

### ユーザーが保有するすべての NFT の取得

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

## Metadata JSON 構造と解析

EIP-721 仕様は metadata JSON が以下の構造に従うことを推奨しています：

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

フロントエンドで metadata を解析する実装：

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

## 画像リソースの処理：IPFS vs HTTP vs オンチェーン SVG

NFT の画像の保存方式は、フロントエンドの読み込み戦略とユーザー体験に直結する：

### IPFS 保存

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

### オンチェーン SVG

一部の NFT は SVG 画像をコントラクトに直接保存しており、フロントエンドは外部リクエストなしで描画できる：

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

## NFT ミントのフロントエンドフロー

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

## NFT 転移とマーケット取引

### 直接転移

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

### マーケット出品のフロントエンド連携

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

## NFT 表示コンポーネント

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

## OpenSea 連携と Metadata 互換性

OpenSea は最大の NFT 取引市場であり、その metadata の標準は事実上の業界規範となっている。NFT metadata の OpenSea 互換性を確保するには以下の点に注意する：

1. **`image` フィールド**は直接アクセス可能な画像 URL または data URI でなければなりません
2. **`attributes` 配列**の各要素に `trait_type` と `value` を含めます
3. **数値型属性**には `display_type`（`number`、`boost_number`、`boost_percentage`、`date`）を追加できます
4. **`external_url`**は NFT の詳細ページを指します
5. **`background_color`**はオプション、6桁の16進数カラーコード（`#` なし）

フロントエンドで NFT を表示する際、OpenSea API と連携してマーケットデータ（フロアプライス、出品情報）を取得できます：

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

## 大量 NFT のフロントエンド読み込み戦略

ユーザーが大量の NFT を保有していたり、コレクションに数千の NFT を表示したりする場合、フロントエンドではパフォーマンスの最適化を考える必要がある：

### ページネーション読み込みと仮想スクロール

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

### The Graph インデックスの使用

大量の NFT を照会する場合、オンチェーンデータを直接読むのは効率が悪すぎる。The Graph のサブグラフで Transfer イベントをインデックスすれば、ユーザーの保有ポジションやコレクション統計といったデータを高速に照会できる：

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

フロントエンドは GraphQL クライアントでサブグラフを照会し、オンチェーンコントラクトとの直接的な連携を回避します：

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

## まとめ

NFT フロントエンド開発の本質的な課題は、**オンチェーンデータとオフチェーンメタデータの連携**にある。`tokenURI` がこの2つを繋ぐブリッジであり、画像リソースの読み込み戦略、metadata のフォーマット互換性、大数量 NFT のパフォーマンス最適化がフロントエンド開発の主な作業を構成します。

ERC-721 標準はコントラクトインターフェースを定義しているが、metadata の実装方式（IPFS・HTTP・オンチェーン）には大きな差があり、フロントエンドには十分なフォールトトレランスが求められる。実際のプロジェクトでは、大量の NFT 照会を処理するときに The Graph のようなインデックスサービスの利用を優先し、RPC ノードから個別に読むのは避けるほうが、ユーザー体験と RPC 呼び出しコストの両面で望ましい。
