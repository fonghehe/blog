---
readingTime: 8
wordCount: 560
title: "DAO 治理前端：投票界面與提案系統"
date: 2020-10-30 14:17:09
tags:
  - Web3
  - Blockchain
  - DApp
description: "DAO（Decentralized Autonomous Organization，去中心化自治組織）是通過智能合約實現治理規則的鏈上組織。Compound 的治理系統（GovernorAlpha）發佈後，DAO 治理界面成為 DeFi 前端的一個重要細分領域。與交易或借貸界面不同，治理前端需要處理複雜的提案生命週期、"
---

## DAO 與鏈上治理

DAO（Decentralized Autonomous Organization，去中心化自治組織）是通過智能合約實現治理規則的鏈上組織。Compound 的治理系統（GovernorAlpha）發佈後，DAO 治理界面成為 DeFi 前端的一個重要細分領域。與交易或借貸界面不同，治理前端需要處理複雜的提案生命週期、投票權計算和執行流程。

Compound 治理系統（GovernorAlpha）成為了 DAO 治理合約的事實標準，後續的 Uniswap 治理、Gitcoin 治理等都在其基礎上擴展。理解 GovernorAlpha 的接口和資料結構，是構建 DAO 治理前端的基礎。

## 治理合約核心接口

### Proposal 資料結構

```solidity
struct Proposal {
    uint id;              // 提案唯一 ID
    address proposer;     // 提案發起者
    address[] targets;    // 待調用的合約地址列表
    uint[] values;        // 每個調用發送的 ETH 數量
    string[] signatures;  // 函數簽名列表
    bytes[] calldatas;    // 每個調用的 calldata
    uint startBlock;      // 投票開始區塊
    uint endBlock;        // 投票結束區塊
    uint forVotes;        // 贊成票數
    uint againstVotes;    // 反對票數
    bool canceled;        // 是否取消
    bool executed;        // 是否執行
    mapping(address => Receipt) receipts; // 投票記錄
}

struct Receipt {
    bool hasVoted;       // 是否已投票
    bool support;        // true=贊成，false=反對
    uint96 votes;        // 投票權重
}
```

### 前端 ABI 定義

```javascript
const GOVERNANCE_ABI = [
  'function propose(address[] targets, uint[] values, string[] signatures, bytes[] calldatas, string description) returns (uint)',
  'function queue(uint proposalId) returns ()',
  'function execute(uint proposalId) returns ()',
  'function cancel(uint proposalId) returns ()',
  'function castVote(uint proposalId, bool support) returns ()',
  'function castVoteWithReason(uint proposalId, bool support, string reason) returns ()',
  'function getActions(uint proposalId) view returns (address[], uint[], string[], bytes[])',
  'function proposalState(uint proposalId) view returns (uint8)',
  'function getReceipt(uint proposalId, address voter) view returns (tuple(bool hasVoted, bool support, uint96 votes))',
  'function proposals(uint proposalId) view returns (uint id, address proposer, uint eta, uint startBlock, uint endBlock, uint forVotes, uint againstVotes, bool canceled, bool executed)',
  'function proposalCount() view returns (uint)',
  'function quorumVotes() view returns (uint)',
  'function votingPeriod() view returns (uint)',
  'function votingDelay() view returns (uint)',
  'function proposalThreshold() view returns (uint)',
  'function gracePeriod() view returns (uint)',
];

// 提案狀態枚舉
const PROPOSAL_STATES = {
  0: 'Pending',
  1: 'Active',
  2: 'Canceled',
  3: 'Defeated',
  4: 'Succeeded',
  5: 'Queued',
  6: 'Expired',
  7: 'Executed',
};
```

## 前端提案列表

### 提案列表獲取與分頁

```javascript
import { ethers } from 'ethers';

async function getProposalList(provider, governanceAddress, options = {}) {
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
  const { page = 1, pageSize = 10, statusFilter = null } = options;

  const totalProposals = await contract.proposalCount();
  const total = totalProposals.toNumber();

  // 計算分頁範圍
  const startId = Math.max(1, total - (page - 1) * pageSize);
  const endId = Math.max(0, startId - pageSize);

  const proposalIds = [];
  for (let i = startId; i > endId; i--) {
    proposalIds.push(i);
  }

  // 併發獲取提案詳情
  const proposals = await Promise.all(
    proposalIds.map(id => getProposalDetail(provider, governanceAddress, id))
  );

  // 按狀態過濾
  let filtered = proposals;
  if (statusFilter) {
    filtered = proposals.filter(p => p.stateName === statusFilter);
  }

  return {
    proposals: filtered,
    total,
    page,
    pageSize,
    hasMore: endId > 0,
  };
}

async function getProposalDetail(provider, governanceAddress, proposalId) {
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);

  // 併發獲取提案數據和狀態
  const [proposal, state, actions] = await Promise.all([
    contract.proposals(proposalId),
    contract.proposalState(proposalId),
    contract.getActions(proposalId),
  ]);

  const [
    , proposer, eta, startBlock, endBlock,
    forVotes, againstVotes, canceled, executed
  ] = proposal;

  const [targets, values, signatures, calldatas] = actions;

  // 獲取當前區塊號
  const currentBlock = await provider.getBlockNumber();

  return {
    id: proposalId,
    proposer,
    eta: eta.toNumber(),
    startBlock: startBlock.toNumber(),
    endBlock: endBlock.toNumber(),
    forVotes: forVotes.toString(),
    againstVotes: againstVotes.toString(),
    canceled,
    executed,
    state: state,
    stateName: PROPOSAL_STATES[state],
    actions: targets.map((target, i) => ({
      target,
      value: values[i].toString(),
      signature: signatures[i],
      calldata: calldatas[i],
    })),
    currentBlock,
    // 計算剩餘區塊數
    blocksRemaining: endBlock.toNumber() - currentBlock,
  };
}
```

### 提案狀態展示

```javascript
function getProposalStatusInfo(proposal, quorumVotes) {
  const { state, forVotes, againstVotes } = proposal;
  const totalVotes = forVotes.add(againstVotes);
  const quorumReached = forVotes.gte(quorumVotes);

  const statusConfig = {
    Pending: { label: '待開始', color: '#999', description: '提案尚未進入投票階段' },
    Active: { label: '投票中', color: '#2196F3', description: `剩餘約 ${proposal.blocksRemaining} 個區塊` },
    Canceled: { label: '已取消', color: '#f44336', description: '提案被取消' },
    Defeated: { label: '未通過', color: '#f44336', description: forVotes.lte(againstVotes) ? '反對票多於贊成票' : '未達到法定人數' },
    Succeeded: { label: '已通過', color: '#4CAF50', description: '提案已通過，等待排隊' },
    Queued: { label: '已排隊', color: '#FF9800', description: '提案在 Timelock 中等待執行' },
    Expired: { label: '已過期', color: '#999', description: '提案未在有效期內執行' },
    Executed: { label: '已執行', color: '#4CAF50', description: '提案已鏈上執行' },
  };

  const config = statusConfig[proposal.stateName];
  const forPercentage = totalVotes.isZero()
    ? 0
    : Number(forVotes.mul(10000).div(totalVotes)) / 100;

  return {
    ...config,
    forPercentage,
    againstPercentage: 100 - forPercentage,
    quorumReached,
    totalVotes: totalVotes.toString(),
  };
}
```

## 投票交互

### 投票權檢查

用戶投票前，前端需要檢查其投票權。投票權基於提案 `startBlock` 時的代幣餘額快照：

```javascript
const COMP_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function getCurrentVotes(address) view returns (uint96)',
  'function getPriorVotes(address account, uint blockNumber) view returns (uint96)',
  'function delegates(address) view returns (address)',
  'function delegate(address) returns ()',
];

async function getVotingPower(provider, tokenAddress, voterAddress, proposalStartBlock) {
  const token = new ethers.Contract(tokenAddress, COMP_ABI, provider);

  // 獲取提案開始區塊時的投票權
  const priorVotes = await token.getPriorVotes(voterAddress, proposalStartBlock);

  // 檢查是否已委託
  const delegatee = await token.delegates(voterAddress);
  const isDelegated = delegatee.toLowerCase() !== voterAddress.toLowerCase() &&
                      delegatee !== ethers.constants.AddressZero;

  // 獲取當前投票權（可能已變化）
  const currentVotes = await token.getCurrentVotes(voterAddress);

  return {
    priorVotes: priorVotes.toString(),    // 本提案可用的投票權
    currentVotes: currentVotes.toString(), // 當前投票權
    isDelegated,
    delegatee,
    canVote: priorVotes.gt(0) && !isDelegated,
  };
}
```

### 執行投票

```javascript
async function castVote(provider, governanceAddress, proposalId, support, reason = null) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  // 檢查是否已投票
  const voterAddress = await signer.getAddress();
  const receipt = await contract.getReceipt(proposalId, voterAddress);

  if (receipt.hasVoted) {
    throw new Error('您已對此提案投票');
  }

  // 檢查提案是否在活躍狀態
  const state = await contract.proposalState(proposalId);
  if (state !== 1) { // Active
    throw new Error('提案當前不可投票');
  }

  let tx;
  if (reason && reason.trim().length > 0) {
    tx = await contract.castVoteWithReason(proposalId, support, reason);
  } else {
    tx = await contract.castVote(proposalId, support);
  }

  const receiptTx = await tx.wait();

  // 從事件中解析投票結果
  const voteEvent = parseVoteEvent(receiptTx, governanceAddress);

  return {
    txHash: receiptTx.transactionHash,
    votes: voteEvent.votes,
    support: voteEvent.support,
  };
}

function parseVoteEvent(receipt, governanceAddress) {
  const iface = new ethers.utils.Interface([
    'event VoteCast(address indexed voter, uint proposalId, bool support, uint votes)',
  ]);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === governanceAddress.toLowerCase()) {
      try {
        const event = iface.parseLog(log);
        if (event.name === 'VoteCast') {
          return {
            voter: event.args.voter,
            proposalId: event.args.proposalId.toString(),
            support: event.args.support,
            votes: event.args.votes.toString(),
          };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}
```

## 提案創建

```javascript
async function createProposal(
  provider,
  governanceAddress,
  targets,
  values,
  signatures,
  calldatas,
  description
) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);
  const proposerAddress = await signer.getAddress();

  // 檢查提案門檻
  const threshold = await contract.proposalThreshold();
  const token = new ethers.Contract(TOKEN_ADDRESS, COMP_ABI, provider);
  const votes = await token.getPriorVotes(
    proposerAddress,
    (await provider.getBlockNumber()) - 1
  );

  if (votes.lt(threshold)) {
    throw new Error(`投票權不足。需要至少 ${ethers.utils.formatEther(threshold)} 個代幣的投票權`);
  }

  // 創建提案
  const tx = await contract.propose(
    targets,
    values,
    signatures,
    calldatas,
    description
  );

  const receipt = await tx.wait();

  // 提取提案 ID
  const iface = new ethers.utils.Interface([
    'event ProposalCreated(uint id, address proposer, address[] targets, uint[] values, string[] signatures, bytes[] calldatas, uint startBlock, uint endBlock, string description)',
  ]);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() === governanceAddress.toLowerCase()) {
      try {
        const event = iface.parseLog(log);
        if (event.name === 'ProposalCreated') {
          return { proposalId: event.args.id.toString(), txHash: receipt.transactionHash };
        }
      } catch {
        continue;
      }
    }
  }

  throw new Error('無法確定提案 ID');
}
```

## 提案執行與排隊

通過的提案需要先排隊（queue）到 Timelock 合約，等待 grace period 後才能執行（execute）：

```javascript
async function queueProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 4) { // Succeeded
    throw new Error('提案當前不可排隊');
  }

  const tx = await contract.queue(proposalId);
  return await tx.wait();
}

async function executeProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 5) { // Queued
    throw new Error('提案當前不可執行');
  }

  const tx = await contract.execute(proposalId);
  const receipt = await tx.wait();

  // 驗證執行結果
  const newState = await contract.proposalState(proposalId);
  if (newState !== 7) { // Executed
    throw new Error(`執行後狀態異常: ${PROPOSAL_STATES[newState]}`);
  }

  return receipt;
}
```

## 治理參數展示

```javascript
async function getGovernanceParams(provider, governanceAddress) {
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);

  const [quorumVotes, votingPeriod, votingDelay, proposalThreshold, gracePeriod] = await Promise.all([
    contract.quorumVotes(),
    contract.votingPeriod(),
    contract.votingDelay(),
    contract.proposalThreshold(),
    contract.gracePeriod(),
  ]);

  return {
    quorum: ethers.utils.formatEther(quorumVotes),
    quorumRaw: quorumVotes.toString(),
    votingPeriod: votingPeriod.toNumber(),
    votingPeriodHours: (votingPeriod.toNumber() * 13) / 3600, // 假設 13 秒/塊
    votingDelay: votingDelay.toNumber(),
    votingDelayHours: (votingDelay.toNumber() * 13) / 3600,
    proposalThreshold: ethers.utils.formatEther(proposalThreshold),
    gracePeriod: gracePeriod.toNumber(),
    gracePeriodDays: gracePeriod.toNumber() / 86400,
  };
}
```

## 前端狀態同步：實時更新

DAO 治理需要實時同步鏈上狀態。以下是一個基於事件訂閱的實時更新方案：

```javascript
class GovernanceWatcher {
  constructor(provider, governanceAddress) {
    this.provider = provider;
    this.contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
    this.subscribers = new Set();
    this.proposalCache = new Map();
  }

  start() {
    // 監聽新區塊
    this.provider.on('block', (blockNumber) => {
      this.checkActiveProposals(blockNumber);
    });

    // 監聽提案創建事件
    this.contract.on('ProposalCreated', (id, proposer) => {
      this.notify('proposalCreated', { id: id.toString(), proposer });
    });

    // 監聽投票事件
    this.contract.on('VoteCast', (voter, proposalId, support, votes) => {
      this.updateVoteCount(proposalId.toString(), support, votes);
      this.notify('voteCast', {
        voter,
        proposalId: proposalId.toString(),
        support,
        votes: votes.toString(),
      });
    });

    // 監聽提案執行
    this.contract.on('ProposalExecuted', (id) => {
      this.updateProposalState(id.toString(), 7); // Executed
      this.notify('proposalExecuted', { id: id.toString() });
    });
  }

  async checkActiveProposals(blockNumber) {
    for (const [id, proposal] of this.proposalCache) {
      if (proposal.stateName === 'Active') {
        // 檢查投票是否已結束
        if (blockNumber >= proposal.endBlock) {
          const newState = await this.contract.proposalState(id);
          this.updateProposalState(id, newState);
        }

        // 更新剩餘區塊數
        proposal.blocksRemaining = Math.max(0, proposal.endBlock - blockNumber);
        this.notify('proposalUpdated', proposal);
      }
    }
  }

  updateVoteCount(proposalId, support, votes) {
    const proposal = this.proposalCache.get(proposalId);
    if (!proposal) return;

    if (support) {
      proposal.forVotes = proposal.forVotes.add(votes);
    } else {
      proposal.againstVotes = proposal.againstVotes.add(votes);
    }
    this.notify('proposalUpdated', proposal);
  }

  updateProposalState(proposalId, newState) {
    const proposal = this.proposalCache.get(proposalId);
    if (!proposal) return;

    proposal.state = newState;
    proposal.stateName = PROPOSAL_STATES[newState];
    this.notify('proposalUpdated', proposal);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notify(event, data) {
    this.subscribers.forEach(cb => cb({ event, data }));
  }

  stop() {
    this.provider.removeAllListeners('block');
    this.contract.removeAllListeners();
  }
}
```

## 投票界面組件

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';

function ProposalVotePanel({ provider, governanceAddress, tokenAddress, proposal }) {
  const [votingPower, setVotingPower] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function loadVotingPower() {
      const signer = provider.getSigner();
      const voterAddress = await signer.getAddress();
      const power = await getVotingPower(
        provider, tokenAddress, voterAddress, proposal.startBlock
      );
      setVotingPower(power);
    }
    loadVotingPower();
  }, [provider, proposal]);

  const statusInfo = useMemo(() => {
    return getProposalStatusInfo(proposal, ethers.BigNumber.from(proposal.quorumVotes || '0'));
  }, [proposal]);

  async function handleVote() {
    if (selectedVote === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await castVote(
        provider, governanceAddress, proposal.id, selectedVote, reason
      );
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const canVote = votingPower?.canVote && proposal.stateName === 'Active';

  return (
    <div className="vote-panel">
      {/* 投票進度條 */}
      <div className="vote-progress">
        <div className="vote-bar">
          <div
            className="vote-bar__for"
            style={{ width: `${statusInfo.forPercentage}%` }}
          />
          <div
            className="vote-bar__against"
            style={{ width: `${statusInfo.againstPercentage}%` }}
          />
        </div>
        <div className="vote-stats">
          <span>贊成: {statusInfo.forPercentage.toFixed(1)}%</span>
          <span>反對: {statusInfo.againstPercentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* 投票操作 */}
      {proposal.stateName === 'Active' && (
        <div className="vote-actions">
          {!canVote && (
            <p className="vote-warning">
              {votingPower?.isDelegated
                ? '您的投票權已委託給其他地址'
                : '您在此提案快照時沒有投票權'}
            </p>
          )}
          {canVote && (
            <>
              <div className="vote-buttons">
                <button
                  className={selectedVote === true ? 'active' : ''}
                  onClick={() => setSelectedVote(true)}
                  disabled={submitting}
                >
                  贊成
                </button>
                <button
                  className={selectedVote === false ? 'active' : ''}
                  onClick={() => setSelectedVote(false)}
                  disabled={submitting}
                >
                  反對
                </button>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="投票理由（可選）"
                disabled={submitting}
              />
              <button
                onClick={handleVote}
                disabled={selectedVote === null || submitting}
              >
                {submitting ? '提交中...' : '提交投票'}
              </button>
            </>
          )}
        </div>
      )}

      {error && <div className="vote-error">{error}</div>}
    </div>
  );
}
```

## 小結

DAO 治理前端的核心在於**將複雜的鏈上治理流程轉化為可理解、可操作的界面**。提案的完整生命週期（創建→投票→排隊→執行）涉及多個狀態和條件判斷，前端需要準確同步這些狀態並及時反饋給用戶。

治理前端面臨的最大挑戰是資訊密度的平衡——投票權、法定人數、投票週期、執行延遲等參數對用戶決策至關重要，但大多數用戶並不理解這些概念。優秀的治理前端應該通過視覺化和漸進式資訊展示，讓普通用戶也能做出知情投票決策。同時，實時狀態同步（通過事件監聽或輪詢）確保了投票資料的準確性，這對治理公平性至關重要。
