---
title: "Hardhat Development Workflow: Smart Contract Engineering"
date: 2021-09-29 10:22:54
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 16
description: "From project structure to CI/CD integration, engineering practices for building production-grade smart contracts with Hardhat"
wordCount: 4500
---

## Hardhat vs Truffle: Why Migrate

Truffle was once the de facto standard for Ethereum development tools, but it eventually showed clear limitations. Truffle's compilation was slow, the testing framework was based on web3.js (lacking type safety), the plugin system was inflexible, and TypeScript support was incomplete.

Hardhat has made substantial improvements in every one of these areas:

- **Compilation speed**: Hardhat uses Rust-written solc compiler bindings, making compilation 2-5x faster than Truffle
- **TypeScript first**: Configuration files, test scripts, and deployment scripts all natively support TypeScript
- **Based on ethers.js**: Tests and scripts use ethers.js, offering type safety and a more modern API
- **Built-in Hardhat Network**: A debuggable local EVM with Solidity stack traces and console.log support
- **Flexible task system**: All functionality is composable tasks; plugins can extend the task system

The core driver behind the migration decision is development efficiency. A typical DeFi project has 20-50 contract files and hundreds of test cases—the speed of compilation and test execution directly impacts the development cadence.

## Hardhat Project Structure

```
my-project/
├── contracts/           # Solidity contract sources
│   ├── interfaces/      # Interface definitions
│   ├── libraries/       # Library contracts
│   ├── tokens/          # Token contracts
│   └── MyContract.sol
├── scripts/             # Deployment and utility scripts
│   ├── deploy/
│   │   ├── 01_deploy_tokens.ts
│   │   ├── 02_deploy_router.ts
│   │   └── 03_initialize.ts
│   └── utils/
├── test/                # Test files
│   ├── unit/
│   │   └── MyContract.test.ts
│   └── integration/
│       └── integration.test.ts
├── deployments/         # Deployment records (hardhat-deploy)
│   ├── localhost/
│   ├── goerli/
│   └── mainnet/
├── hardhat.config.ts    # Core configuration
├── .env                 # Environment variables
└── package.json
```

## hardhat.config.ts Configuration

```typescript
import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';
import 'hardhat-deploy';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import dotenv from 'dotenv';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200, // Gas optimization runs
          },
          outputSelection: {
            '*': {
              '*': ['abi', 'devdoc', 'userdoc', 'metadata', 'evm.bytecode'],
            },
          },
        },
      },
      // Support multi-version compilation (for dependencies on older contract versions)
      {
        version: '0.6.12',
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // Fork from mainnet (for testing)
      // forking: {
      //   url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      //   blockNumber: 14000000,
      // },
      accounts: {
        count: 20,
        accountsBalance: '10000000000000000000000', // 10000 ETH per account
      },
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: process.env.GOERLI_PRIVATE_KEY
        ? [process.env.GOERLI_PRIVATE_KEY]
        : [],
      chainId: 5,
    },
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: process.env.MAINNET_PRIVATE_KEY
        ? [process.env.MAINNET_PRIVATE_KEY]
        : [],
      chainId: 1,
      gasPrice: 'auto',
    },
    polygon: {
      url: 'https://polygon-rpc.com',
      accounts: process.env.POLYGON_PRIVATE_KEY
        ? [process.env.POLYGON_PRIVATE_KEY]
        : [],
      chainId: 137,
      gasPrice: 30000000000,
    },
  },
  // Deployment plugin configuration
  namedAccounts: {
    deployer: 0,       // First account is the deployer
    treasury: 1,       // Second account is the treasury
    user1: 2,
    user2: 3,
  },
  // Contract verification
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  // Gas reporting
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    gasPrice: 50, // Gwei
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showMethodSig: true,
    maxMethodDiff: 10,
  },
  // Code coverage
  mocha: {
    timeout: 120000,
  },
};

export default config;
```

## Contract Compilation and Deployment

### Compilation

```bash
# Compile all contracts
npx hardhat compile

# Force recompilation
npx hardhat compile --force

# Generate types after compilation (with typechain)
npx hardhat typechain
```

With TypeChain, TypeScript type definitions are automatically generated after compilation:

```typescript
// Generated type file: typechain-types/MyContract.ts
import { ethers } from 'ethers';

export class MyContract extends ethers.Contract {
  // Type-safe method signatures
  function setValue(value: number): Promise<ethers.ContractTransaction>;
  function getValue(): Promise<number>;
  // ...
}
```

### Deployment Scripts

Use the hardhat-deploy plugin to manage the deployment process, with support for deployment order control and deployment records:

```typescript
// scripts/deploy/01_deploy_token.ts
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  console.log('Deploying MyToken with account:', deployer);

  const myToken = await deploy('MyToken', {
    from: deployer,
    args: ['MyToken', 'MTK', 18, ethers.utils.parseEther('1000000')],
    log: true,
    gasLimit: 3000000,
    waitConfirmations: 5, // Wait for 5 block confirmations
  });

  console.log('MyToken deployed to:', myToken.address);

  // Verify contract (non-local networks)
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    await hre.run('verify:verify', {
      address: myToken.address,
      constructorArguments: ['MyToken', 'MTK', 18, ethers.utils.parseEther('1000000')],
    });
  }
};

func.tags = ['Token', 'all'];
func.dependencies = []; // No dependencies

export default func;
```

```typescript
// scripts/deploy/02_deploy_exchange.ts
import { DeployFunction } from 'hardhat-deploy/types';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  // Get the deployed Token address
  const myToken = await deployments.get('MyToken');

  const exchange = await deploy('Exchange', {
    from: deployer,
    args: [myToken.address],
    log: true,
    libraries: {
      SafeMath: (await deployments.get('SafeMath')).address,
    },
  });

  console.log('Exchange deployed to:', exchange.address);
};

func.tags = ['Exchange', 'all'];
func.dependencies = ['Token']; // Depends on Token deployment

export default func;
```

### Executing Deployments

```bash
# Deploy to local network
npx hardhat deploy --network localhost --tags all

# Deploy to Goerli testnet
npx hardhat deploy --network goerli --tags Token

# Deploy to mainnet
npx hardhat deploy --network mainnet --tags all

# View deployment records
npx hardhat deployments --network goerli
```

## Hardhat Network

### Built-in Development Network

Hardhat Network is an EVM implementation that runs in-process, providing debugging capabilities that Truffle/Ganache lack:

```typescript
// Using console.log in tests
// contracts/MyContract.sol
contract MyContract {
  function complexLogic(uint256 amount) external {
    console.log("Input amount:", amount);
    uint256 result = amount * 2;
    console.log("Calculated result:", result);
    // ...
  }
}
```

When running tests, Solidity's `console.log` output is displayed in the terminal, which is very useful for debugging complex contract logic.

### Forking Mainnet

```typescript
// Using mainnet fork in tests
describe('MyContract - Forked Mainnet', () => {
  let mainnetProvider: ethers.providers.JsonRpcProvider;

  before(async () => {
    // Enable forking in Hardhat config
    // Or specify via command line: npx hardhat test --fork
  });

  it('should interact with real Uniswap', async () => {
    const uniswapRouter = await ethers.getContractAt(
      'IUniswapV2Router02',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
    );

    // Call the real Uniswap contract on the forked mainnet
    const amounts = await uniswapRouter.getAmountsOut(
      ethers.utils.parseEther('1'),
      [WETH_ADDRESS, USDC_ADDRESS]
    );
    expect(amounts[1]).to.be.gt(0);
  });
});
```

### Local Node

```bash
# Start a local node (similar to ganache-cli)
npx hardhat node

# Auto-deploy contracts on startup
npx hardhat node --deploy

# Run deployment in another terminal
npx hardhat deploy --network localhost
```

## Testing: ethers.js + Waffle + Chai

### Test Structure

```typescript
// test/unit/MyToken.test.ts
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

describe('MyToken', () => {
  let myToken: any;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  beforeEach(async () => {
    [owner, alice, bob] = await ethers.getSigners();

    const MyToken = await ethers.getContractFactory('MyToken');
    myToken = await MyToken.deploy('MyToken', 'MTK', 18, ethers.utils.parseEther('1000000'));
    await myToken.deployed();
  });

  describe('Deployment', () => {
    it('should set the correct name and symbol', async () => {
      expect(await myToken.name()).to.equal('MyToken');
      expect(await myToken.symbol()).to.equal('MTK');
    });

    it('should mint total supply to deployer', async () => {
      const balance = await myToken.balanceOf(owner.address);
      expect(balance).to.equal(ethers.utils.parseEther('1000000'));
    });
  });

  describe('Transfer', () => {
    it('should transfer tokens between accounts', async () => {
      const amount = ethers.utils.parseEther('100');
      await myToken.transfer(alice.address, amount);
      expect(await myToken.balanceOf(alice.address)).to.equal(amount);
    });

    it('should emit Transfer event', async () => {
      const amount = ethers.utils.parseEther('100');
      await expect(myToken.transfer(alice.address, amount))
        .to.emit(myToken, 'Transfer')
        .withArgs(owner.address, alice.address, amount);
    });

    it('should revert on insufficient balance', async () => {
      const amount = ethers.utils.parseEther('1000000000'); // Exceeds total supply
      await expect(
        myToken.connect(alice).transfer(bob.address, amount)
      ).to.be.revertedWith('ERC20: transfer amount exceeds balance');
    });
  });

  describe('Approval', () => {
    it('should approve spending', async () => {
      const amount = ethers.utils.parseEther('100');
      await myToken.approve(alice.address, amount);
      expect(await myToken.allowance(owner.address, alice.address)).to.equal(amount);
    });

    it('should allow transferFrom after approval', async () => {
      const amount = ethers.utils.parseEther('100');
      await myToken.approve(alice.address, amount);
      await myToken.connect(alice).transferFrom(owner.address, bob.address, amount);
      expect(await myToken.balanceOf(bob.address)).to.equal(amount);
    });
  });
});
```

### Waffle Mock Contract

```typescript
// test/unit/Exchange.test.ts
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { deployMockContract } from '@ethereum-waffle/mock-contract';

describe('Exchange with Mock Token', () => {
  let exchange: any;
  let mockToken: any;

  beforeEach(async () => {
    const [owner] = await ethers.getSigners();

    // Deploy Mock Token
    const erc20Abi = [
      'function transfer(address,uint256) returns (bool)',
      'function balanceOf(address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
    ];
    mockToken = await deployMockContract(owner, erc20Abi);

    // Deploy Exchange, injecting the Mock Token address
    const Exchange = await ethers.getContractFactory('Exchange');
    exchange = await Exchange.deploy(mockToken.address);
    await exchange.deployed();
  });

  it('should handle token deposit', async () => {
    // Mock return values
    await mockToken.mock.transfer.returns(true);
    await mockToken.mock.balanceOf.returns(ethers.utils.parseEther('100'));

    await exchange.deposit(ethers.utils.parseEther('100'));

    const balance = await exchange.getBalance();
    expect(balance).to.equal(ethers.utils.parseEther('100'));
  });

  it('should revert on failed transfer', async () => {
    await mockToken.mock.transfer.returns(false);

    await expect(
      exchange.deposit(ethers.utils.parseEther('100'))
    ).to.be.revertedWith('Transfer failed');
  });
});
```

## Plugin Ecosystem

### hardhat-deploy

Manages deployment scripts and deployment records, with support for deterministic deployment (CREATE2) and multi-chain deployment management:

```typescript
// Deterministic deployment (cross-chain address consistency)
const deployResult = await deploy('MyContract', {
  from: deployer,
  args: [],
  deterministicDeployment: ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('MyContract-v1')
  ),
});
```

### hardhat-gas-reporter

Generates Gas usage reports for contract functions:

```
| Contract      | Function     | Gas    |
|---------------|-------------|--------|
| MyToken       | transfer    | 52,000 |
| MyToken       | approve     | 46,000 |
| MyToken       | balanceOf   | 2,500  |
| Exchange      | deposit     | 85,000 |
| Exchange      | withdraw    | 68,000 |
```

### solidity-coverage

Generates test coverage reports:

```bash
npx hardhat coverage
```

Outputs an HTML report showing line coverage and branch coverage for each contract file.

## Engineering Integration with Frontend Projects

### Sharing ABIs and Types

```typescript
// scripts/export-abis.ts
import fs from 'fs';
import path from 'path';
import { task } from 'hardhat/config';

task('export-abis', 'Export contract ABIs to frontend').setAction(
  async (_, hre) => {
    const allDeployments = await hre.deployments.all();
    const exportDir = path.resolve(__dirname, '../frontend/src/abis');

    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const indexContent: string[] = [];

    for (const [name, deployment] of Object.entries(allDeployments)) {
      const abi = deployment.abi;
      const filePath = path.join(exportDir, `${name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(abi, null, 2));

      indexContent.push(
        `export const ${name}ABI = require('./${name}.json');`
      );

      console.log(`Exported ${name} ABI`);
    }

    fs.writeFileSync(
      path.join(exportDir, 'index.ts'),
      indexContent.join('\n')
    );

    console.log('All ABIs exported successfully');
  }
);
```

### Deployment Address Configuration

```typescript
// scripts/generate-addresses.ts
import fs from 'fs';
import path from 'path';
import { task } from 'hardhat/config';

task('generate-addresses', 'Generate contract addresses config').setAction(
  async (_, hre) => {
    const allDeployments = await hre.deployments.all();
    const addresses: Record<string, string> = {};

    for (const [name, deployment] of Object.entries(allDeployments)) {
      addresses[name] = deployment.address;
    }

    const configContent = `// Auto-generated by Hardhat
export const CONTRACT_ADDRESSES = ${JSON.stringify(addresses, null, 2)} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;
`;

    const outputPath = path.resolve(
      __dirname,
      '../frontend/src/config/addresses.ts'
    );
    fs.writeFileSync(outputPath, configContent);

    console.log('Addresses config generated');
  }
);
```

### Using Generated Types in the Frontend

```typescript
// frontend/src/hooks/useMyContract.ts
import { ethers } from 'ethers';
import { MyTokenABI, ExchangeABI } from '@/abis';
import { CONTRACT_ADDRESSES } from '@/config/addresses';

export function useMyToken(provider: ethers.providers.Provider) {
  const contract = new ethers.Contract(
    CONTRACT_ADDRESSES.MyToken,
    MyTokenABI,
    provider
  );
  return contract;
}
```

## CI/CD Integration: GitHub Actions

```yaml
# .github/workflows/contract-ci.yml
name: Contract CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Compile contracts
        run: npx hardhat compile

      - name: Run tests
        run: npx hardhat test
        env:
          REPORT_GAS: 'true'

      - name: Run coverage
        run: npx hardhat coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info

      - name: Upload gas report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: gas-report
          path: ./gas-report.txt

  deploy-goerli:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Compile contracts
        run: npx hardhat compile

      - name: Deploy to Goerli
        run: npx hardhat deploy --network goerli
        env:
          GOERLI_PRIVATE_KEY: ${{ secrets.GOERLI_PRIVATE_KEY }}
          INFURA_KEY: ${{ secrets.INFURA_KEY }}
          ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}

      - name: Export ABIs
        run: npx hardhat export-abis

      - name: Commit ABIs and addresses
        run: |
          git config --local user.email "ci@github.com"
          git config --local user.name "CI"
          git add frontend/src/abis/ frontend/src/config/addresses.ts
          git commit -m "chore: update ABIs and addresses [skip ci]" || echo "No changes"
          git push

  deploy-mainnet:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: mainnet
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Compile contracts
        run: npx hardhat compile

      - name: Dry run deployment
        run: npx hardhat deploy --network hardhat --dry-run

      - name: Deploy to Mainnet
        run: npx hardhat deploy --network mainnet
        env:
          MAINNET_PRIVATE_KEY: ${{ secrets.MAINNET_PRIVATE_KEY }}
          INFURA_KEY: ${{ secrets.INFURA_KEY }}
          ETHERSCAN_API_KEY: ${{ secrets.ETHERSCAN_API_KEY }}
```

## Summary

Hardhat provides a modern engineering experience for smart contract development through its TypeScript-first design, ethers.js-based testing framework, built-in debuggable EVM, and flexible plugin system. The main motivation for migrating from Truffle to Hardhat is development efficiency—faster compilation speeds, better type safety, and stronger debugging capabilities.

The core of smart contract engineering lies in applying the same engineering standards to contract development as frontend development: type safety, automated testing, CI/CD pipelines, and code coverage monitoring. Hardhat's plugin ecosystem and task system make this engineering integration natural and maintainable. For any serious smart contract project, establishing a complete Hardhat engineering workflow is a necessary foundational investment.
