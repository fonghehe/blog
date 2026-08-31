---
title: "Hardhat 開發工作流：智能合約工程化"
date: 2021-09-29 10:22:54
tags:
  - Web3
  - Solidity
  - Smart Contract
readingTime: 8
description: "從項目結構到 CI/CD 集成，構建生產級智能合約的 Hardhat 工程化實踐"
wordCount: 768
---

## Hardhat vs Truffle：為什麼遷移

Truffle 曾是以太坊開發工具的事實標準，但它在編譯速度、測試框架和 TypeScript 支援等方面顯現出明顯的侷限性。Truffle 的編譯速度慢、測試框架基於 web3.js（缺乏類型安全）、插件系統不夠靈活，且對 TypeScript 的支援不完善。

Hardhat 在這幾個方面都做出了實質性改進：

- **編譯速度**：Hardhat 使用 Rust 編寫的 solc 編譯器綁定，編譯速度比 Truffle 快 2-5 倍
- **TypeScript 優先**：配置文件、測試腳本、部署腳本均原生支援 TypeScript
- **基於 ethers.js**：測試和腳本使用 ethers.js，類型安全且 API 更現代
- **內置 Hardhat Network**：一個可調試的本地 EVM，支援 Solidity 堆疊跟蹤和 console.log
- **靈活的任務系統**：所有功能都是可組合的任務，插件可以擴展任務系統

遷移決策的核心驅動力是開發效率。一個典型的 DeFi 項目有 20-50 個合約檔案、上百個測試用例，編譯和測試的執行速度直接影響開發節奏。

## Hardhat 項目結構

```
my-project/
├── contracts/           # Solidity 合約源碼
│   ├── interfaces/      # 接口定義
│   ├── libraries/       # 庫合約
│   ├── tokens/          # 代幣合約
│   └── MyContract.sol
├── scripts/             # 部署和工具腳本
│   ├── deploy/
│   │   ├── 01_deploy_tokens.ts
│   │   ├── 02_deploy_router.ts
│   │   └── 03_initialize.ts
│   └── utils/
├── test/                # 測試文件
│   ├── unit/
│   │   └── MyContract.test.ts
│   └── integration/
│       └── integration.test.ts
├── deployments/         # 部署記錄（hardhat-deploy）
│   ├── localhost/
│   ├── goerli/
│   └── mainnet/
├── hardhat.config.ts    # 核心配置
├── .env                 # 環境變量
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
            runs: 200, // Gas 優化運行次數
          },
          outputSelection: {
            '*': {
              '*': ['abi', 'devdoc', 'userdoc', 'metadata', 'evm.bytecode'],
            },
          },
        },
      },
      // 支持多版本編譯（依賴舊版本合約時）
      {
        version: '0.6.12',
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat: {
      chainId: 31337,
      // 從主網 fork（用於測試）
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
    deployer: 0,       // 第一個賬户為部署者
    treasury: 1,       // 第二個賬户為金庫
    user1: 2,
    user2: 3,
  },
  // 合約驗證
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  // Gas 報告
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true',
    currency: 'USD',
    gasPrice: 50, // Gwei
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    showMethodSig: true,
    maxMethodDiff: 10,
  },
  // 代碼覆蓋率
  mocha: {
    timeout: 120000,
  },
};

export default config;
```

## 合約編譯與部署

### 編譯

```bash
# 編譯所有合約
npx hardhat compile

# 強制重新編譯
npx hardhat compile --force

# 編譯後生成 types（配合 typechain）
npx hardhat typechain
```

配合 TypeChain，編譯後會自動生成 TypeScript 類型定義：

```typescript
// 生成的類型文件：typechain-types/MyContract.ts
import { ethers } from 'ethers';

export class MyContract extends ethers.Contract {
  // 類型安全的方法簽名
  function setValue(value: number): Promise<ethers.ContractTransaction>;
  function getValue(): Promise<number>;
  // ...
}
```

### 部署腳本

使用 hardhat-deploy 插件管理部署流程，支援部署順序控制和部署記錄：

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
    waitConfirmations: 5, // 等待 5 個區塊確認
  });

  console.log('MyToken deployed to:', myToken.address);

  // 驗證合約（非本地網絡）
  if (hre.network.name !== 'hardhat' && hre.network.name !== 'localhost') {
    await hre.run('verify:verify', {
      address: myToken.address,
      constructorArguments: ['MyToken', 'MTK', 18, ethers.utils.parseEther('1000000')],
    });
  }
};

func.tags = ['Token', 'all'];
func.dependencies = []; // 無依賴

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

  // 獲取已部署的 Token 地址
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
func.dependencies = ['Token']; // 依賴 Token 部署

export default func;
```

### 執行部署

```bash
# 部署到本地網絡
npx hardhat deploy --network localhost --tags all

# 部署到 Goerli 測試網
npx hardhat deploy --network goerli --tags Token

# 部署到主網
npx hardhat deploy --network mainnet --tags all

# 查看部署記錄
npx hardhat deployments --network goerli
```

## Hardhat Network

### 內置開發網絡

Hardhat Network 是一個在進程內運行的 EVM 實現，提供了 Truffle/Ganache 沒有的調試能力：

```typescript
// 測試中使用 console.log
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

測試運行時，Solidity 的 `console.log` 輸出會顯示在終端中，這對於調試複雜合約邏輯非常有用。

### Fork 主網

```typescript
// 測試中使用主網 fork
describe('MyContract - Forked Mainnet', () => {
  let mainnetProvider: ethers.providers.JsonRpcProvider;

  before(async () => {
    // Hardhat 配置中啓用 forking
    // 或在命令行指定：npx hardhat test --fork
  });

  it('should interact with real Uniswap', async () => {
    const uniswapRouter = await ethers.getContractAt(
      'IUniswapV2Router02',
      '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
    );

    // 在 fork 主網上調用真實的 Uniswap 合約
    const amounts = await uniswapRouter.getAmountsOut(
      ethers.utils.parseEther('1'),
      [WETH_ADDRESS, USDC_ADDRESS]
    );
    expect(amounts[1]).to.be.gt(0);
  });
});
```

### 本地節點

```bash
# 啓動本地節點（類似於 ganache-cli）
npx hardhat node

# 啓動時自動部署合約
npx hardhat node --deploy

# 另一個終端運行部署
npx hardhat deploy --network localhost
```

## 測試：ethers.js + Waffle + Chai

### 測試結構

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
      const amount = ethers.utils.parseEther('1000000000'); // 超過總供應量
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

## 插件生態

### hardhat-deploy

管理部署腳本和部署記錄，支援確定性部署（CREATE2）和多鏈部署管理：

```typescript
// 確定性部署（跨鏈地址一致）
const deployResult = await deploy('MyContract', {
  from: deployer,
  args: [],
  deterministicDeployment: ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes('MyContract-v1')
  ),
});
```

### hardhat-gas-reporter

生成合約函數的 Gas 使用報告：

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

生成測試覆蓋率報告：

```bash
npx hardhat coverage
```

輸出 HTML 報告，顯示每個合約檔案的行覆蓋率和分支覆蓋率。

## 與前端項目的工程化集成

### 共享 ABI 和類型

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

### 前端使用生成的類型

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

## 小結

Hardhat 通過 TypeScript 優先的設計、基於 ethers.js 的測試框架、內置可調試 EVM 和靈活的插件系統，為智能合約開發提供了現代化的工程化體驗。從 Truffle 遷移到 Hardhat 的主要動力是開發效率——更快的編譯速度、更好的類型安全和更強的調試能力。

智能合約工程化的核心在於將合約開發納入與前端開發相同的工程化標準：類型安全、自動化測試、CI/CD 流水線、代碼覆蓋率監控。Hardhat 的插件生態和任務系統使得這種工程化集成變得自然且可維護。對於任何嚴肅的智能合約項目，建立完整的 Hardhat 工程化流程是必要的基礎投入。
