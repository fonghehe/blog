---
title: "Hardhat 开发工作流：智能合约工程化"
date: 2021-09-29 10:22:54
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 16
description: "从项目结构到 CI/CD 集成，构建生产级智能合约的 Hardhat 工程化实践"
wordCount: 4500
---

## Hardhat vs Truffle：为什么迁移

Truffle 曾是以太坊开发工具的事实标准，但在编译速度、测试框架和插件系统等方面存在明显局限。Truffle 的编译速度慢、测试框架基于 web3.js（缺乏类型安全）、插件系统不够灵活，且对 TypeScript 的支持不完善。

Hardhat 在这几个方面都做出了实质性改进：

- **编译速度**：Hardhat 使用 Rust 编写的 solc 编译器绑定，编译速度比 Truffle 快 2-5 倍
- **TypeScript 优先**：配置文件、测试脚本、部署脚本均原生支持 TypeScript
- **基于 ethers.js**：测试和脚本使用 ethers.js，类型安全且 API 更现代
- **内置 Hardhat Network**：一个可调试的本地 EVM，支持 Solidity 堆栈跟踪和 console.log
- **灵活的任务系统**：所有功能都是可组合的任务，插件可以扩展任务系统

迁移决策的核心驱动力是开发效率。一个典型的 DeFi 项目有 20-50 个合约文件、上百个测试用例，编译和测试的执行速度直接影响开发节奏。

## Hardhat 项目结构

```
my-project/
├── contracts/           # Solidity 合约源码
│   ├── interfaces/      # 接口定义
│   ├── libraries/       # 库合约
│   ├── tokens/          # 代币合约
│   └── MyContract.sol
├── scripts/             # 部署和工具脚本
│   ├── deploy/
│   │   ├── 01_deploy_tokens.ts
│   │   ├── 02_deploy_router.ts
│   │   └── 03_initialize.ts
│   └── utils/
├── test/                # 测试文件
│   ├── unit/
│   │   └── MyContract.test.ts
│   └── integration/
│       └── integration.test.ts
├── deployments/         # 部署记录（hardhat-deploy）
│   ├── localhost/
│   ├── goerli/
│   └── mainnet/
├── hardhat.config.ts    # 核心配置
├── .env                 # 环境变量
└── package.json
```

## hardhat.config.ts 配置

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
            runs: 200, // Gas 优化运行次数
          },
          outputSelection: {
            '*': {
              '*': ['abi', 'devdoc', 'userdoc', 'metadata', 'evm.bytecode'],
            },
          },
        },
      },
      // 支持多版本编译（依赖旧版本合约时）
      {
        version: '0.6.12',
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // 从主网 fork（用于测试）
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
  // 部署插件配置
  namedAccounts: {
    deployer: 0,       // 第一个账户为部署者
    treasury: 1,       // 第二个账户为金库
    user1: 2,
    user2: 3,
  },
  // 合约验证
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  // Gas 报告
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    gasPrice: 50, // Gwei
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showMethodSig: true,
    maxMethodDiff: 10,
  },
  // 代码覆盖率
  mocha: {
    timeout: 120000,
  },
};

export default config;
```

## 合约编译与部署

### 编译

```bash
# 编译所有合约
npx hardhat compile

# 强制重新编译
npx hardhat compile --force

# 编译后生成 types（配合 typechain）
npx hardhat typechain
```

配合 TypeChain，编译后会自动生成 TypeScript 类型定义：

```typescript
// 生成的类型文件：typechain-types/MyContract.ts
import { ethers } from 'ethers';

export class MyContract extends ethers.Contract {
  // 类型安全的方法签名
  function setValue(value: number): Promise<ethers.ContractTransaction>;
  function getValue(): Promise<number>;
  // ...
}
```

### 部署脚本

使用 hardhat-deploy 插件管理部署流程，支持部署顺序控制和部署记录：

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
    waitConfirmations: 5, // 等待 5 个区块确认
  });

  console.log('MyToken deployed to:', myToken.address);

  // 验证合约（非本地网络）
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    await hre.run('verify:verify', {
      address: myToken.address,
      constructorArguments: ['MyToken', 'MTK', 18, ethers.utils.parseEther('1000000')],
    });
  }
};

func.tags = ['Token', 'all'];
func.dependencies = []; // 无依赖

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

  // 获取已部署的 Token 地址
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
func.dependencies = ['Token']; // 依赖 Token 部署

export default func;
```

### 执行部署

```bash
# 部署到本地网络
npx hardhat deploy --network localhost --tags all

# 部署到 Goerli 测试网
npx hardhat deploy --network goerli --tags Token

# 部署到主网
npx hardhat deploy --network mainnet --tags all

# 查看部署记录
npx hardhat deployments --network goerli
```

## Hardhat Network

### 内置开发网络

Hardhat Network 是一个在进程内运行的 EVM 实现，提供了 Truffle/Ganache 没有的调试能力：

```typescript
// 测试中使用 console.log
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

测试运行时，Solidity 的 `console.log` 输出会显示在终端中，这对于调试复杂合约逻辑非常有用。

### Fork 主网

```typescript
// 测试中使用主网 fork
describe('MyContract - Forked Mainnet', () => {
  let mainnetProvider: ethers.providers.JsonRpcProvider;

  before(async () => {
    // Hardhat 配置中启用 forking
    // 或在命令行指定：npx hardhat test --fork
  });

  it('should interact with real Uniswap', async () => {
    const uniswapRouter = await ethers.getContractAt(
      'IUniswapV2Router02',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
    );

    // 在 fork 主网上调用真实的 Uniswap 合约
    const amounts = await uniswapRouter.getAmountsOut(
      ethers.utils.parseEther('1'),
      [WETH_ADDRESS, USDC_ADDRESS]
    );
    expect(amounts[1]).to.be.gt(0);
  });
});
```

### 本地节点

```bash
# 启动本地节点（类似于 ganache-cli）
npx hardhat node

# 启动时自动部署合约
npx hardhat node --deploy

# 另一个终端运行部署
npx hardhat deploy --network localhost
```

## 测试：ethers.js + Waffle + Chai

### 测试结构

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
      const amount = ethers.utils.parseEther('1000000000'); // 超过总供应量
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

    // 部署 Mock Token
    const erc20Abi = [
      'function transfer(address,uint256) returns (bool)',
      'function balanceOf(address) view returns (uint256)',
      'function approve(address,uint256) returns (bool)',
    ];
    mockToken = await deployMockContract(owner, erc20Abi);

    // 部署 Exchange，注入 Mock Token 地址
    const Exchange = await ethers.getContractFactory('Exchange');
    exchange = await Exchange.deploy(mockToken.address);
    await exchange.deployed();
  });

  it('should handle token deposit', async () => {
    // Mock 返回值
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

## 插件生态

### hardhat-deploy

管理部署脚本和部署记录，支持确定性部署（CREATE2）和多链部署管理：

```typescript
// 确定性部署（跨链地址一致）
const deployResult = await deploy('MyContract', {
  from: deployer,
  args: [],
  deterministicDeployment: ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('MyContract-v1')
  ),
});
```

### hardhat-gas-reporter

生成合约函数的 Gas 使用报告：

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

生成测试覆盖率报告：

```bash
npx hardhat coverage
```

输出 HTML 报告，显示每个合约文件的行覆盖率和分支覆盖率。

## 与前端项目的工程化集成

### 共享 ABI 和类型

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

### 部署地址配置

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

### 前端使用生成的类型

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

## CI/CD 集成：GitHub Actions

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

## 小结

Hardhat 通过 TypeScript 优先的设计、基于 ethers.js 的测试框架、内置可调试 EVM 和灵活的插件系统，为智能合约开发提供了现代化的工程化体验。从 Truffle 迁移到 Hardhat 的主要动力是开发效率——更快的编译速度、更好的类型安全和更强的调试能力。

智能合约工程化的核心在于将合约开发纳入与前端开发相同的工程化标准：类型安全、自动化测试、CI/CD 流水线、代码覆盖率监控。Hardhat 的插件生态和任务系统使得这种工程化集成变得自然且可维护。对于任何严肃的智能合约项目，建立完整的 Hardhat 工程化流程是必要的基础投入。
