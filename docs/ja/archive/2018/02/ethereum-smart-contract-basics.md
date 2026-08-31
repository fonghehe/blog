---
title: "Ethereumスマートコントラクト開発入門：Solidityからデプロイまで"
date: 2018-02-14 19:07:01
tags:
  - Web3
  - Ethereum
  - Smart Contract
readingTime: 9
wordCount: 2366
description: "イーサリアムのスマートコントラクト開発では、フロントエンドエンジニアが新しい思考モデルを身につける必要があります。状態の不変性、Gas経済学、そして非同期トランザクションモデルです。本記事ではツールチェーン、Solidityの基礎、コントラクトのデプロイとフロントエンドからの呼び出しを通して、開発から本番運用までの全体"
---

イーサリアムのスマートコントラクト開発では、フロントエンドエンジニアが新しい思考モデルを身につける必要があります。状態の不変性、Gas経済学、そして非同期トランザクションモデルです。本記事ではツールチェーン、Solidityの基礎、コントラクトのデプロイとフロントエンドからの呼び出しを通して、開発から本番運用までの全体像を整理します。

## Ethereum開発エコシステムの概要

Ethereum 開発エコシステムは、主に以下の要素で構成されています。

- **Solidity**：主流のスマートコントラクトプログラミング言語。構文はJavaScriptとC++の混合体に似ています
- **Remix**：ブラウザベースのIDE。コンパイル、デプロイ、デバッグをサポートし、ローカル環境が不要です
- **Truffle**：プロジェクト管理とビルドツール。コントラクトのコンパイル、マイグレーション、テスト機能を提供します
- **Ganache**：Ethereum チェーンのローカルシミュレーションツール。かつての testrpc の後継です
- **web3.js**：JavaScriptとEthereumの相互作用の中核ライブラリ
- **MetaMask**：ブラウザウォレット拡張。DAppとブロックチェーン間のブリッジとして機能します

このツールチェーンは従来のフロントエンド開発とは異なる特徴を持ちますが、開発からデプロイまでの基本的なサイクルを備えています。

## Solidity言語の基礎

### コントラクト構造

Solidity のコントラクト（Contract）は、オブジェクト指向言語のクラスに似ており、状態変数、関数、イベント、モディファイアなどのメンバーを含みます。

```solidity
pragma solidity ^0.4.18;

contract SimpleStorage {
    // 状態変数 —— ブロックチェーン上に永続的に保存
    uint256 public storedData;

    // イベント —— フロントエンドのリスニング用
    event ValueChanged(uint256 newValue, address changer);

    // モディファイア —— デコレータに似ており、関数の前提条件チェックに使用
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this");
        _;
    }

    // コンストラクタ
    function SimpleStorage() public {
        storedData = 0;
    }

    // 書き込み関数 —— Gasを消費します
    function set(uint256 x) public {
        storedData = x;
        ValueChanged(x, msg.sender);
    }

    // 読み取り関数 —— viewキーワードは状態を変更しないことを示し、Gasを消費しません
    function get() public view returns (uint256) {
        return storedData;
    }
}
```

### 状態変数

状態変数はコントラクト内で永続化されるデータであり、ブロックチェーンのstorageに保存されます。各状態変数の書き込みにはGasが消費されます。すべてのノードが各自のストレージを更新する必要があるからです。

Solidity 0.4.xでは、`uint`は実際には`uint256`のエイリアスです。適切な型サイズを選択することでGasを節約できます——例えば、値の範囲が2^8を超えない場合、`uint8`を使用する方が経済的です。ただし、storage内では複数の小さな型の変数が同じ32バイトのスロットにパッキングされますが、memory内ではパッキングされないことに注意が必要です。

### 関数の可視性

Solidity は 4 種類の関数の可視性を提供します。

- **public**：内部と外部の両方から呼び出し可能
- **private**：現在のコントラクト内でのみ呼び出し可能（ただし、ブロックチェーン上のすべてのデータは公開されています。privateは論理的な制限にすぎません）
- **internal**：現在のコントラクトおよび子コントラクトから呼び出し可能
- **external**：外部からのみ呼び出し可能

### 関数モディファイア

モディファイア（Modifier）は、Solidity において再利用可能な前処理ロジックを実装する仕組みです。

```solidity
contract Ownable {
    address public owner;

    function Ownable() public {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;  // プレースホルダー、修飾される関数のコードの挿入位置を示す
    }
}

contract MyContract is Ownable {
    function withdraw() public onlyOwner {
        // ownerのみが呼び出し可能
        owner.transfer(this.balance);
    }
}
```

## Remix IDEの使用

Remix（旧名 Browser-Solidity）は最も手軽なコントラクト開発ツールの一つであり、インストールが不要で、ブラウザを開くだけでコントラクトの作成、コンパイル、デプロイが可能です。

使用フローは以下の通りです。

1. remix.ethereum.orgにアクセス
2. エディタでSolidityコードを記述
3. 右側で自動コンパイルされ、コンパイル後のbytecodeとABIを確認可能
4. Runパネルで環境を選択：JavaScript VM（ローカルシミュレーション）、Injected Web3（MetaMask）、Web3 Provider（リモートノード）
5. Deployをクリックしてコントラクトをデプロイ
6. デプロイ後、下でコントラクトメソッドを呼び出し可能

Remix の強みは素早いプロトタイピング検証にありますが、大規模プロジェクトの管理には不向きです。ファイル管理、バージョン管理、自動テストといったエンジニアリング機能が不足しているためです。

## コントラクトのコンパイルとRopstenテストネットへのデプロイ

### デプロイフロー

コントラクトをテストネットにデプロイするには、以下の手順が必要です。

1. **MetaMaskをインストール**しアカウントを作成
2. **Ropstenネットワークに切り替え**
3. **テストETHを取得**：Ropstenフォーセット（faucet）から取得
4. **Remixでコントラクトをコンパイル**
5. **Injected Web3環境を選択**、Remixが自動的にMetaMaskに接続
6. **Deployをクリック**、MetaMaskがトランザクション確認をポップアップ
7. **トランザクションを確認**、ブロック確定を待機

コントラクトのデプロイは本質的に特殊なトランザクションです——`to`アドレスがなく、`data`フィールドにコントラクトのbytecodeが含まれます。このトランザクションのGas消費はコントラクトのサイズとコンストラクタの複雑さに依存します。

### Gasの概念

Gas は Ethereum において計算量を測る単位です。各 EVM 命令には対応する Gas 消費があります。

- **Gas Limit**：トランザクションが支払う意思のある最大Gas量。実際の消費がこの値を超えた場合、トランザクションはロールバックされますが、すでに消費されたGasは返還されません
- **Gas Price**：単位Gasあたりの価格（Gwei単位、1 Gwei = 10^-9 ETH）
- **実際の費用** = Gas Used × Gas Price

例えば、シンプルなコントラクトをデプロイすると100,000 Gasを消費し、Gas Priceが10 Gweiの場合、費用は100,000 × 10 Gwei = 1,000,000 Gwei = 0.001 ETHとなります。

```javascript
// web3.jsでGasパラメータを設定
contract.deploy({
    data: bytecode,
    arguments: [constructorArg]
}).send({
    from: account,
    gas: 500000,        // Gas Limit
    gasPrice: web3.utils.toWei('10', 'gwei')  // Gas Price
}, function(error, transactionHash) {
    console.log('Transaction:', transactionHash);
});
```

## フロントエンドからweb3.jsでコントラクトを呼び出す

デプロイ完了後、フロントエンドは web3.js を通じてコントラクトと相互作用します。中核となる要素は、コントラクトアドレスと ABI（Application Binary Interface）です。

```javascript
// コントラクトABI —— コントラクトのインターフェースを記述
const abi = [
    {
        "constant": false,
        "inputs": [{ "name": "x", "type": "uint256" }],
        "name": "set",
        "outputs": [],
        "type": "function"
    },
    {
        "constant": true,
        "inputs": [],
        "name": "get",
        "outputs": [{ "name": "", "type": "uint256" }],
        "type": "function"
    },
    {
        "anonymous": false,
        "inputs": [
            { "indexed": false, "name": "newValue", "type": "uint256" },
            { "indexed": false, "name": "changer", "type": "address" }
        ],
        "name": "ValueChanged",
        "type": "event"
    }
];

const contractAddress = '0x1234...';

// コントラクトをインスタンス化
const contract = web3.eth.contract(abi).at(contractAddress);

// データの読み取り —— callメソッド、オンチェーンでなく、Gas消費なし
contract.get((err, result) => {
    console.log('Stored value:', result.toNumber());
});

// データの書き込み —— sendTransaction、オンチェーン、Gas消費
contract.set(42, { from: web3.eth.accounts[0] }, (err, txHash) => {
    console.log('Transaction hash:', txHash);
});
```

ここではweb3.js 0.xのAPIスタイルを使用しています。0.20.xバージョンでは、コントラクトのインスタンス化に`web3.eth.contract(abi).at(address)`構文を使用し、1.0バージョンでは`new web3.eth.Contract(abi, address)`の新しい構文が導入され、API構造も大幅に変更されました。

## まとめ

Ethereumスマートコントラクト開発エコシステムでは、Remixは最もハードルの低い入門方法を提供します。ツールを選ぶ際は、成熟した型システムがないこと、デバッグ手段が限られていること、Gas 最適化に EVM 命令の理解が必要なこと、テストネットの不安定性など、いくつかの点に注意が必要です。Solidity自体の言語設計にも注意点があります——リエントランシー攻撃や整数オーバーフローなどのセキュリティリスクは、言語レベルの制約を理解する重要性を示しています。

フロントエンドエンジニアにとって、スマートコントラクト開発への参入における最大の思考の転換は「状態の不変性」と「毎回の書き込みにはコストがかかる」ことを理解することです。これはコントラクト設計の考え方に直接影響します。すべてのロジックをオンチェーンにすべきではなく、適切なアーキテクチャではオフチェーン計算とオンチェーン状態更新を分離すべきです。

EthereumのツールチェーンはRemixやTruffleからHardhatやFoundryといったモダンなツールへと進化し続けています。どのツールを使っても、低レベルの概念を理解することは特定のツールを習得することよりも重要です——ツールはイテレーションされますが、EVMの動作原理とGas経済学は安定しているからです。
