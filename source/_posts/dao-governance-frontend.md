---
title: "DAO 治理前端：投票界面与提案系统"
date: 2020-10-30 14:17:09
tags:
  - Web3
  - Blockchain
  - DApp
---

## DAO 与链上治理

DAO（Decentralized Autonomous Organization，去中心化自治组织）是通过智能合约实现治理规则的链上组织。2020 年，Compound 的治理系统发布后，DAO 治理界面成为 DeFi 前端的一个重要细分领域。与交易或借贷界面不同，治理前端需要处理复杂的提案生命周期、投票权计算和执行流程。

Compound 治理系统（GovernorAlpha）成为了 DAO 治理合约的事实标准，后续的 Uniswap 治理、Gitcoin 治理等都在其基础上扩展。理解 GovernorAlpha 的接口和数据结构，是构建 DAO 治理前端的基础。

## 治理合约核心接口

### Proposal 数据结构

```solidity
struct Proposal {
    uint id;              // 提案唯一 ID
    address proposer;     // 提案发起者
    address[] targets;    // 待调用的合约地址列表
    uint[] values;        // 每个调用发送的 ETH 数量
    string[] signatures;  // 函数签名列表
    bytes[] calldatas;    // 每个调用的 calldata
    uint startBlock;      // 投票开始区块
    uint endBlock;        // 投票结束区块
    uint forVotes;        // 赞成票数
    uint againstVotes;    // 反对票数
    bool canceled;        // 是否取消
    bool executed;        // 是否执行
    mapping(address => Receipt) receipts; // 投票记录
}

struct Receipt {
    bool hasVoted;       // 是否已投票
    bool support;        // true=赞成，false=反对
    uint96 votes;        // 投票权重
}
```

### 前端 ABI 定义

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

// 提案状态枚举
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

### 提案列表获取与分页

```javascript
import { ethers } from 'ethers';

async function getProposalList(provider, governanceAddress, options = {}) {
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
  const { page = 1, pageSize = 10, statusFilter = null } = options;

  const totalProposals = await contract.proposalCount();
  const total = totalProposals.toNumber();

  // 计算分页范围
  const startId = Math.max(1, total - (page - 1) * pageSize);
  const endId = Math.max(0, startId - pageSize);

  const proposalIds = [];
  for (let i = startId; i > endId; i--) {
    proposalIds.push(i);
  }

  // 并发获取提案详情
  const proposals = await Promise.all(
    proposalIds.map(id => getProposalDetail(provider, governanceAddress, id))
  );

  // 按状态过滤
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

  // 并发获取提案数据和状态
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

  // 获取当前区块号
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
    // 计算剩余区块数
    blocksRemaining: endBlock.toNumber() - currentBlock,
  };
}
```

### 提案状态展示

```javascript
function getProposalStatusInfo(proposal, quorumVotes) {
  const { state, forVotes, againstVotes } = proposal;
  const totalVotes = forVotes.add(againstVotes);
  const quorumReached = forVotes.gte(quorumVotes);

  const statusConfig = {
    Pending: { label: '待开始', color: '#999', description: '提案尚未进入投票阶段' },
    Active: { label: '投票中', color: '#2196F3', description: `剩余约 ${proposal.blocksRemaining} 个区块` },
    Canceled: { label: '已取消', color: '#f44336', description: '提案被取消' },
    Defeated: { label: '未通过', color: '#f44336', description: forVotes.lte(againstVotes) ? '反对票多于赞成票' : '未达到法定人数' },
    Succeeded: { label: '已通过', color: '#4CAF50', description: '提案已通过，等待排队' },
    Queued: { label: '已排队', color: '#FF9800', description: '提案在 Timelock 中等待执行' },
    Expired: { label: '已过期', color: '#999', description: '提案未在有效期内执行' },
    Executed: { label: '已执行', color: '#4CAF50', description: '提案已链上执行' },
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

### 投票权检查

用户投票前，前端需要检查其投票权。投票权基于提案 `startBlock` 时的代币余额快照：

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

  // 获取提案开始区块时的投票权
  const priorVotes = await token.getPriorVotes(voterAddress, proposalStartBlock);

  // 检查是否已委托
  const delegatee = await token.delegates(voterAddress);
  const isDelegated = delegatee.toLowerCase() !== voterAddress.toLowerCase() &&
                      delegatee !== ethers.constants.AddressZero;

  // 获取当前投票权（可能已变化）
  const currentVotes = await token.getCurrentVotes(voterAddress);

  return {
    priorVotes: priorVotes.toString(),    // 本提案可用的投票权
    currentVotes: currentVotes.toString(), // 当前投票权
    isDelegated,
    delegatee,
    canVote: priorVotes.gt(0) && !isDelegated,
  };
}
```

### 执行投票

```javascript
async function castVote(provider, governanceAddress, proposalId, support, reason = null) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  // 检查是否已投票
  const voterAddress = await signer.getAddress();
  const receipt = await contract.getReceipt(proposalId, voterAddress);

  if (receipt.hasVoted) {
    throw new Error('您已对此提案投票');
  }

  // 检查提案是否在活跃状态
  const state = await contract.proposalState(proposalId);
  if (state !== 1) { // Active
    throw new Error('提案当前不可投票');
  }

  let tx;
  if (reason && reason.trim().length > 0) {
    tx = await contract.castVoteWithReason(proposalId, support, reason);
  } else {
    tx = await contract.castVote(proposalId, support);
  }

  const receiptTx = await tx.wait();

  // 从事件中解析投票结果
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

## 提案创建

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

  // 检查提案门槛
  const threshold = await contract.proposalThreshold();
  const token = new ethers.Contract(TOKEN_ADDRESS, COMP_ABI, provider);
  const votes = await token.getPriorVotes(
    proposerAddress,
    (await provider.getBlockNumber()) - 1
  );

  if (votes.lt(threshold)) {
    throw new Error(`投票权不足。需要至少 ${ethers.utils.formatEther(threshold)} 个代币的投票权`);
  }

  // 创建提案
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

  throw new Error('无法确定提案 ID');
}
```

## 提案执行与排队

通过的提案需要先排队（queue）到 Timelock 合约，等待 grace period 后才能执行（execute）：

```javascript
async function queueProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 4) { // Succeeded
    throw new Error('提案当前不可排队');
  }

  const tx = await contract.queue(proposalId);
  return await tx.wait();
}

async function executeProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 5) { // Queued
    throw new Error('提案当前不可执行');
  }

  const tx = await contract.execute(proposalId);
  const receipt = await tx.wait();

  // 验证执行结果
  const newState = await contract.proposalState(proposalId);
  if (newState !== 7) { // Executed
    throw new Error(`执行后状态异常: ${PROPOSAL_STATES[newState]}`);
  }

  return receipt;
}
```

## 治理参数展示

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
    votingPeriodHours: (votingPeriod.toNumber() * 13) / 3600, // 假设 13 秒/块
    votingDelay: votingDelay.toNumber(),
    votingDelayHours: (votingDelay.toNumber() * 13) / 3600,
    proposalThreshold: ethers.utils.formatEther(proposalThreshold),
    gracePeriod: gracePeriod.toNumber(),
    gracePeriodDays: gracePeriod.toNumber() / 86400,
  };
}
```

## 前端状态同步：实时更新

DAO 治理需要实时同步链上状态。以下是一个基于事件订阅的实时更新方案：

```javascript
class GovernanceWatcher {
  constructor(provider, governanceAddress) {
    this.provider = provider;
    this.contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
    this.subscribers = new Set();
    this.proposalCache = new Map();
  }

  start() {
    // 监听新区块
    this.provider.on('block', (blockNumber) => {
      this.checkActiveProposals(blockNumber);
    });

    // 监听提案创建事件
    this.contract.on('ProposalCreated', (id, proposer) => {
      this.notify('proposalCreated', { id: id.toString(), proposer });
    });

    // 监听投票事件
    this.contract.on('VoteCast', (voter, proposalId, support, votes) => {
      this.updateVoteCount(proposalId.toString(), support, votes);
      this.notify('voteCast', {
        voter,
        proposalId: proposalId.toString(),
        support,
        votes: votes.toString(),
      });
    });

    // 监听提案执行
    this.contract.on('ProposalExecuted', (id) => {
      this.updateProposalState(id.toString(), 7); // Executed
      this.notify('proposalExecuted', { id: id.toString() });
    });
  }

  async checkActiveProposals(blockNumber) {
    for (const [id, proposal] of this.proposalCache) {
      if (proposal.stateName === 'Active') {
        // 检查投票是否已结束
        if (blockNumber >= proposal.endBlock) {
          const newState = await this.contract.proposalState(id);
          this.updateProposalState(id, newState);
        }

        // 更新剩余区块数
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

## 投票界面组件

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
      {/* 投票进度条 */}
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
          <span>赞成: {statusInfo.forPercentage.toFixed(1)}%</span>
          <span>反对: {statusInfo.againstPercentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* 投票操作 */}
      {proposal.stateName === 'Active' && (
        <div className="vote-actions">
          {!canVote && (
            <p className="vote-warning">
              {votingPower?.isDelegated
                ? '您的投票权已委托给其他地址'
                : '您在此提案快照时没有投票权'}
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
                  赞成
                </button>
                <button
                  className={selectedVote === false ? 'active' : ''}
                  onClick={() => setSelectedVote(false)}
                  disabled={submitting}
                >
                  反对
                </button>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="投票理由（可选）"
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

## 小结

DAO 治理前端的核心在于**将复杂的链上治理流程转化为可理解、可操作的界面**。提案的完整生命周期（创建→投票→排队→执行）涉及多个状态和条件判断，前端需要准确同步这些状态并及时反馈给用户。

治理前端面临的最大挑战是信息密度的平衡——投票权、法定人数、投票周期、执行延迟等参数对用户决策至关重要，但大多数用户并不理解这些概念。优秀的治理前端应该通过可视化和渐进式信息展示，让普通用户也能做出知情投票决策。同时，实时状态同步（通过事件监听或轮询）确保了投票数据的准确性，这对治理公平性至关重要。
