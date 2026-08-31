---
title: "NFT Frontend Development: ERC-721 Contracts and Display"
date: 2020-05-06 09:48:51
tags:
  - Web3
  - NFT
  - Ethereum
readingTime: 8
wordCount: 602
description: "The ERC-721 standard was formally proposed in EIP-721 in January 2018, defining the interface specification for non-fungible tokens. Unlike ERC-20, where \"each "
---

## The ERC-721 Standard and Non-Fungible Tokens

The ERC-721 standard was formally proposed in EIP-721 in January 2018, defining the interface specification for non-fungible tokens. Unlike ERC-20, where "each token is completely equivalent," each ERC-721 token has a unique tokenId and can represent a unique digital asset.

The NFT ecosystem has expanded well beyond its CryptoKitties origins into broader application scenarios. CryptoArt, virtual land (Decentraland), and gaming assets place new demands on frontend display and interaction. Unlike ERC-20 frontends that only need to display balances and transfers, NFT frontends need to handle rich media content such as image rendering, metadata parsing, and attribute display.

## Parsing the ERC-721 Standard Interface

The ERC-721 standard includes two interfaces: a core interface and a metadata extension interface.

### Core Interface

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

### Metadata Extension Interface (EIP-721 Metadata Extension)

```solidity
interface IERC721Metadata {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
```

`tokenURI` is the core of NFT frontend development—it returns the URI pointing to the NFT's metadata, through which the frontend retrieves the NFT's name, image, and attributes.

### Enumerable Extension Interface (EIP-721 Enumerable Extension)

```solidity
interface IERC721Enumerable {
    function totalSupply() external view returns (uint256);
    function tokenByIndex(uint256 index) external view returns (uint256);
    function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256);
}
```

The enumerable interface allows the frontend to iterate over all NFTs or query the list of NFTs held by a specific address. Not all ERC-721 contracts implement this extension, but it is important for frontend display.

## Reading NFT Data from the Frontend

### Reading Individual NFT Data

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

  // Concurrent on-chain reads
  const [tokenURI, owner, name, symbol] = await Promise.all([
    contract.tokenURI(tokenId),
    contract.ownerOf(tokenId),
    contract.name(),
    contract.symbol(),
  ]);

  // Fetch off-chain metadata
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

### Getting All NFTs Owned by a User

```javascript
async function getNFTsByOwner(provider, contractAddress, ownerAddress) {
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, provider);
  const balance = await contract.balanceOf(ownerAddress);

  if (balance.isZero()) return [];

  // Check if the contract supports the enumerable interface
  const supportsEnumerable = await supportsInterface(provider, contractAddress, '0x780e9d63');

  if (supportsEnumerable) {
    // Use tokenOfOwnerByIndex to query one by one
    const tokenIds = [];
    for (let i = 0; i < balance.toNumber(); i++) {
      const tokenId = await contract.tokenOfOwnerByIndex(ownerAddress, i);
      tokenIds.push(tokenId);
    }

    // Concurrently fetch all metadata
    const metadataPromises = tokenIds.map(id =>
      contract.tokenURI(id).then(uri => fetchNFTMetadata(uri))
    );
    const metadataList = await Promise.all(metadataPromises);

    return tokenIds.map((id, i) => ({
      tokenId: id.toString(),
      metadata: metadataList[i],
    }));
  } else {
    // Enumerable interface not supported; query via event logs
    return await getNFTsByEventLogs(provider, contractAddress, ownerAddress);
  }
}

// EIP-165 interface support detection
async function supportsInterface(provider, contractAddress, interfaceId) {
  const abi = ['function supportsInterface(bytes4) view returns (bool)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  try {
    return await contract.supportsInterface(interfaceId);
  } catch {
    return false; // Contract does not implement EIP-165
  }
}
```

## Metadata JSON Structure and Parsing

The EIP-721 specification recommends that the metadata JSON follow this structure:

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

Frontend implementation for parsing metadata:

```javascript
async function fetchNFTMetadata(tokenURI) {
  // Handle different URI schemes
  let url;
  if (tokenURI.startsWith('ipfs://')) {
    // Convert IPFS protocol to HTTP gateway
    const cid = tokenURI.replace('ipfs://', '');
    url = `https://ipfs.io/ipfs/${cid}`;
  } else if (tokenURI.startsWith('data:application/json')) {
    // On-chain base64-encoded metadata
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

  // Normalize image URL
  if (metadata.image && metadata.image.startsWith('ipfs://')) {
    const cid = metadata.image.replace('ipfs://', '');
    metadata.image = `https://ipfs.io/ipfs/${cid}`;
  }

  return metadata;
}

// Parse attribute display types
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

## Image Resource Handling: IPFS vs HTTP vs On-chain SVG

The storage method for NFT images directly impacts the frontend's loading strategy and user experience:

### IPFS Storage

```javascript
// Multi-gateway fallback strategy
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
];

function resolveIPFSImage(uri) {
  if (!uri.startsWith('ipfs://')) return uri;
  const cid = uri.replace('ipfs://', '').replace(/\/$/, '');
  // Return the first gateway; the frontend switches on failure
  return `${IPFS_GATEWAYS[0]}${cid}`;
}

// React component with image loading fallback
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

### On-chain SVG

Some NFTs store SVG images directly in the contract, allowing the frontend to render them without external requests:

```javascript
// Read on-chain SVG from the contract
async function getOnChainSVG(provider, contractAddress, tokenId) {
  const abi = ['function tokenURI(uint256) view returns (string)'];
  const contract = new ethers.Contract(contractAddress, abi, provider);
  const uri = await contract.tokenURI(tokenId);

  if (uri.startsWith('data:image/svg+xml')) {
    // Use directly as img src
    return uri;
  } else if (uri.startsWith('data:application/json;base64')) {
    // Base64-encoded JSON containing SVG
    const decoded = JSON.parse(atob(uri.split(',')[1]));
    if (decoded.image && decoded.image.startsWith('data:image/svg+xml')) {
      return decoded.image;
    }
  }
  return null;
}
```

## NFT Minting Frontend Flow

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

  // Pre-checks
  const [saleActive, mintPrice, totalSupply, maxSupply, maxPerTx] = await Promise.all([
    contract.saleActive(),
    contract.mintPrice(),
    contract.totalSupply(),
    contract.maxSupply(),
    contract.maxPerTx(),
  ]);

  if (!saleActive) throw new Error('Minting has not started');
  if (quantity > maxPerTx.toNumber()) throw new Error(`Maximum ${maxPerTx} per transaction`);
  if (totalSupply.add(quantity) > maxSupply) throw new Error('Sold out');

  // Calculate total price
  const totalPrice = mintPrice.mul(quantity);

  // Execute mint
  const tx = await contract.mint(quantity, { value: totalPrice });
  const receipt = await tx.wait();

  // Extract minted tokenIds from event logs
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

## NFT Transfers and Marketplace Trading

### Direct Transfer

```javascript
async function transferNFT(provider, contractAddress, tokenId, toAddress) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(contractAddress, ERC721_ABI, signer);
  const fromAddress = await signer.getAddress();

  // safeTransferFrom checks whether the recipient implements IERC721Receiver
  const tx = await contract['safeTransferFrom(address,address,uint256)'](
    fromAddress,
    toAddress,
    tokenId
  );
  return await tx.wait();
}
```

### Marketplace Listing Frontend Interaction

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

  // 1. Check ownership
  const owner = await nftContract.ownerOf(tokenId);
  if (owner.toLowerCase() !== seller.toLowerCase()) {
    throw new Error('You do not own this NFT');
  }

  // 2. Approve the marketplace contract (if not already approved)
  const isApproved = await nftContract.isApprovedForAll(seller, marketAddress);
  if (!isApproved) {
    const approveTx = await nftContract.setApprovalForAll(marketAddress, true);
    await approveTx.wait();
  }

  // 3. Create listing
  const tx = await marketContract.listItem(nftAddress, tokenId, priceInWei);
  return await tx.wait();
}
```

## NFT Display Component

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

## OpenSea Integration and Metadata Compatibility

OpenSea is the largest NFT marketplace, and its metadata standard has become the de facto industry specification. To ensure NFT metadata is compatible with OpenSea, the following should be noted:

1. The **`image` field** must be a directly accessible image URL or data URI
2. Each element of the **`attributes` array** must contain `trait_type` and `value`
3. **Numeric attributes** can include a `display_type` (`number`, `boost_number`, `boost_percentage`, `date`)
4. **`external_url`** points to the NFT's detail page
5. **`background_color`** is optional, a 6-character hex color value (without `#`)

When displaying NFTs on the frontend, you can simultaneously query the OpenSea API for market data (floor price, listing information):

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

## Loading Strategies for Large NFT Collections

When a user holds many NFTs, or a collection has thousands of NFTs to display, the frontend needs to consider performance optimization:

### Pagination and Virtual Scrolling

```javascript
// Batch query using multicall
async function batchFetchNFTs(provider, contractAddress, tokenIds) {
  const multicallAddress = '0xeefba1e63905ef1d7acba5a8513c70307c1ce441'; // Mainnet Multicall
  const multicallAbi = [
    'function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)',
  ];

  const erc721Interface = new ethers.utils.Interface([
    'function tokenURI(uint256) view returns (string)',
  ]);

  const multicall = new ethers.Contract(multicallAddress, multicallAbi, provider);

  // Construct batch calls
  const calls = tokenIds.map(id => [
    contractAddress,
    erc721Interface.encodeFunctionData('tokenURI', [id]),
  ]);

  const [, returnData] = await multicall.aggregate(calls);

  // Decode results
  const tokenURIs = returnData.map(data =>
    erc721Interface.decodeFunctionResult('tokenURI', data)[0]
  );

  // Fetch metadata concurrently (with concurrency limit)
  const metadataList = await pLimit(
    tokenURIs.map(uri => () => fetchNFTMetadata(uri)),
    5 // Maximum 5 concurrent requests
  );

  return tokenIds.map((id, i) => ({
    tokenId: id.toString(),
    metadata: metadataList[i],
  }));
}

// Concurrency limiting utility
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

### Using The Graph for Indexing

For querying large numbers of NFTs, reading on-chain data directly is too inefficient. By indexing Transfer events through The Graph subgraph, you can quickly query user holdings, collection statistics, and more:

```graphql
# The Graph query: Get all NFTs owned by a user
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

The frontend queries the subgraph via a GraphQL client, avoiding direct interaction with on-chain contracts:

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

## Summary

The core challenge of NFT frontend development lies in **coordinating on-chain data with off-chain metadata**. `tokenURI` is the bridge connecting the two, while image resource loading strategies, metadata format compatibility, and performance optimization for large NFT collections constitute the main work of frontend development.

Although the ERC-721 standard defines the contract interface, metadata implementation methods (IPFS, HTTP, on-chain) vary greatly, and the frontend must have sufficient fault tolerance. In actual projects, it's recommended to prioritize using indexing services like The Graph to handle queries for large NFT collections, avoiding direct sequential reads through RPC nodes—this is a necessary optimization for both user experience and RPC call costs.
