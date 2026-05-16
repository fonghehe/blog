---
title: "DAO Governance Frontend: Voting Interface and Proposal System"
date: 2020-10-30 14:17:09
tags:
  - Web3
  - Blockchain
  - DApp
---

## DAOs and On-chain Governance

A DAO (Decentralized Autonomous Organization) is an on-chain organization that implements governance rules through smart contracts. After Compound released its governance system, DAO governance interfaces became an important subdomain of DeFi frontends. Unlike trading or lending interfaces, governance frontends need to handle complex proposal lifecycles, voting power calculations, and execution flows.

Compound's governance system (GovernorAlpha) became the de facto standard for DAO governance contracts, with subsequent Uniswap governance, Gitcoin governance, and others building on top of it. Understanding GovernorAlpha's interface and data structures is foundational for building DAO governance frontends.

## Governance Contract Core Interface

### Proposal Data Structure

```solidity
struct Proposal {
    uint id;              // Unique proposal ID
    address proposer;     // Proposal creator
    address[] targets;    // List of contract addresses to call
    uint[] values;        // Amount of ETH to send with each call
    string[] signatures;  // Function signature list
    bytes[] calldatas;    // Calldata for each call
    uint startBlock;      // Voting start block
    uint endBlock;        // Voting end block
    uint forVotes;        // Votes in favor
    uint againstVotes;    // Votes against
    bool canceled;        // Whether canceled
    bool executed;        // Whether executed
    mapping(address => Receipt) receipts; // Voting records
}

struct Receipt {
    bool hasVoted;       // Whether voted
    bool support;        // true=for, false=against
    uint96 votes;        // Voting weight
}
```

### Frontend ABI Definition

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

// Proposal state enumeration
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

## Frontend Proposal List

### Proposal List Retrieval and Pagination

```javascript
import { ethers } from 'ethers';

async function getProposalList(provider, governanceAddress, options = {}) {
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
  const { page = 1, pageSize = 10, statusFilter = null } = options;

  const totalProposals = await contract.proposalCount();
  const total = totalProposals.toNumber();

  // Calculate pagination range
  const startId = Math.max(1, total - (page - 1) * pageSize);
  const endId = Math.max(0, startId - pageSize);

  const proposalIds = [];
  for (let i = startId; i > endId; i--) {
    proposalIds.push(i);
  }

  // Fetch proposal details concurrently
  const proposals = await Promise.all(
    proposalIds.map(id => getProposalDetail(provider, governanceAddress, id))
  );

  // Filter by status
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

  // Fetch proposal data and state concurrently
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

  // Get current block number
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
    // Calculate remaining blocks
    blocksRemaining: endBlock.toNumber() - currentBlock,
  };
}
```

### Proposal Status Display

```javascript
function getProposalStatusInfo(proposal, quorumVotes) {
  const { state, forVotes, againstVotes } = proposal;
  const totalVotes = forVotes.add(againstVotes);
  const quorumReached = forVotes.gte(quorumVotes);

  const statusConfig = {
    Pending: { label: 'Pending', color: '#999', description: 'Proposal has not entered voting phase' },
    Active: { label: 'Active', color: '#2196F3', description: `Approximately ${proposal.blocksRemaining} blocks remaining` },
    Canceled: { label: 'Canceled', color: '#f44336', description: 'Proposal has been canceled' },
    Defeated: { label: 'Defeated', color: '#f44336', description: forVotes.lte(againstVotes) ? 'Against votes exceed for votes' : 'Quorum not reached' },
    Succeeded: { label: 'Succeeded', color: '#4CAF50', description: 'Proposal has passed, awaiting queue' },
    Queued: { label: 'Queued', color: '#FF9800', description: 'Proposal is waiting in Timelock for execution' },
    Expired: { label: 'Expired', color: '#999', description: 'Proposal was not executed within the valid period' },
    Executed: { label: 'Executed', color: '#4CAF50', description: 'Proposal has been executed on-chain' },
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

## Voting Interaction

### Voting Power Check

Before a user votes, the frontend needs to check their voting power. Voting power is based on a snapshot of the token balance at the proposal's `startBlock`:

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

  // Get voting power at the proposal start block
  const priorVotes = await token.getPriorVotes(voterAddress, proposalStartBlock);

  // Check if delegated
  const delegatee = await token.delegates(voterAddress);
  const isDelegated = delegatee.toLowerCase() !== voterAddress.toLowerCase() &&
                      delegatee !== ethers.constants.AddressZero;

  // Get current voting power (may have changed)
  const currentVotes = await token.getCurrentVotes(voterAddress);

  return {
    priorVotes: priorVotes.toString(),    // Voting power available for this proposal
    currentVotes: currentVotes.toString(), // Current voting power
    isDelegated,
    delegatee,
    canVote: priorVotes.gt(0) && !isDelegated,
  };
}
```

### Casting a Vote

```javascript
async function castVote(provider, governanceAddress, proposalId, support, reason = null) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  // Check if already voted
  const voterAddress = await signer.getAddress();
  const receipt = await contract.getReceipt(proposalId, voterAddress);

  if (receipt.hasVoted) {
    throw new Error('You have already voted on this proposal');
  }

  // Check if proposal is in active state
  const state = await contract.proposalState(proposalId);
  if (state !== 1) { // Active
    throw new Error('This proposal is not open for voting');
  }

  let tx;
  if (reason && reason.trim().length > 0) {
    tx = await contract.castVoteWithReason(proposalId, support, reason);
  } else {
    tx = await contract.castVote(proposalId, support);
  }

  const receiptTx = await tx.wait();

  // Parse vote result from events
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

## Proposal Creation

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

  // Check proposal threshold
  const threshold = await contract.proposalThreshold();
  const token = new ethers.Contract(TOKEN_ADDRESS, COMP_ABI, provider);
  const votes = await token.getPriorVotes(
    proposerAddress,
    (await provider.getBlockNumber()) - 1
  );

  if (votes.lt(threshold)) {
    throw new Error(`Insufficient voting power. A minimum of ${ethers.utils.formatEther(threshold)} tokens of voting power is required`);
  }

  // Create proposal
  const tx = await contract.propose(
    targets,
    values,
    signatures,
    calldatas,
    description
  );

  const receipt = await tx.wait();

  // Extract proposal ID
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

  throw new Error('Failed to determine proposal ID');
}
```

## Proposal Execution and Queueing

Passed proposals need to first be queued into the Timelock contract and can only be executed after the grace period:

```javascript
async function queueProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 4) { // Succeeded
    throw new Error('This proposal cannot be queued at this time');
  }

  const tx = await contract.queue(proposalId);
  return await tx.wait();
}

async function executeProposal(provider, governanceAddress, proposalId) {
  const signer = provider.getSigner();
  const contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, signer);

  const state = await contract.proposalState(proposalId);
  if (state !== 5) { // Queued
    throw new Error('This proposal cannot be executed at this time');
  }

  const tx = await contract.execute(proposalId);
  const receipt = await tx.wait();

  // Verify execution result
  const newState = await contract.proposalState(proposalId);
  if (newState !== 7) { // Executed
    throw new Error(`Abnormal state after execution: ${PROPOSAL_STATES[newState]}`);
  }

  return receipt;
}
```

## Governance Parameters Display

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
    votingPeriodHours: (votingPeriod.toNumber() * 13) / 3600, // Assuming 13 sec/block
    votingDelay: votingDelay.toNumber(),
    votingDelayHours: (votingDelay.toNumber() * 13) / 3600,
    proposalThreshold: ethers.utils.formatEther(proposalThreshold),
    gracePeriod: gracePeriod.toNumber(),
    gracePeriodDays: gracePeriod.toNumber() / 86400,
  };
}
```

## Frontend State Synchronization: Real-time Updates

DAO governance requires real-time synchronization of on-chain state. Here's an event subscription-based real-time update solution:

```javascript
class GovernanceWatcher {
  constructor(provider, governanceAddress) {
    this.provider = provider;
    this.contract = new ethers.Contract(governanceAddress, GOVERNANCE_ABI, provider);
    this.subscribers = new Set();
    this.proposalCache = new Map();
  }

  start() {
    // Listen for new blocks
    this.provider.on('block', (blockNumber) => {
      this.checkActiveProposals(blockNumber);
    });

    // Listen for proposal creation events
    this.contract.on('ProposalCreated', (id, proposer) => {
      this.notify('proposalCreated', { id: id.toString(), proposer });
    });

    // Listen for vote events
    this.contract.on('VoteCast', (voter, proposalId, support, votes) => {
      this.updateVoteCount(proposalId.toString(), support, votes);
      this.notify('voteCast', {
        voter,
        proposalId: proposalId.toString(),
        support,
        votes: votes.toString(),
      });
    });

    // Listen for proposal execution
    this.contract.on('ProposalExecuted', (id) => {
      this.updateProposalState(id.toString(), 7); // Executed
      this.notify('proposalExecuted', { id: id.toString() });
    });
  }

  async checkActiveProposals(blockNumber) {
    for (const [id, proposal] of this.proposalCache) {
      if (proposal.stateName === 'Active') {
        // Check if voting has ended
        if (blockNumber >= proposal.endBlock) {
          const newState = await this.contract.proposalState(id);
          this.updateProposalState(id, newState);
        }

        // Update remaining blocks
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

## Voting Interface Component

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
      {/* Vote progress bar */}
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
          <span>For: {statusInfo.forPercentage.toFixed(1)}%</span>
          <span>Against: {statusInfo.againstPercentage.toFixed(1)}%</span>
        </div>
      </div>

      {/* Voting actions */}
      {proposal.stateName === 'Active' && (
        <div className="vote-actions">
          {!canVote && (
            <p className="vote-warning">
              {votingPower?.isDelegated
                ? 'Your voting power has been delegated to another address'
                : 'You did not have voting power at the time of this proposal snapshot'}
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
                  For
                </button>
                <button
                  className={selectedVote === false ? 'active' : ''}
                  onClick={() => setSelectedVote(false)}
                  disabled={submitting}
                >
                  Against
                </button>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for voting (optional)"
                disabled={submitting}
              />
              <button
                onClick={handleVote}
                disabled={selectedVote === null || submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Vote'}
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

## Summary

The core of DAO governance frontend development lies in **transforming complex on-chain governance processes into understandable and operable interfaces**. A proposal's full lifecycle (create -> vote -> queue -> execute) involves multiple states and conditional checks, and the frontend needs to accurately synchronize these states and provide timely feedback to users.

The greatest challenge facing governance frontends is balancing information density—parameters such as voting power, quorum, voting period, and execution delay are critical for user decisions, yet most users do not understand these concepts. An excellent governance frontend should enable ordinary users to make informed voting decisions through visualization and progressive information disclosure. At the same time, real-time state synchronization (via event listening or polling) ensures the accuracy of voting data, which is critical for governance fairness.
