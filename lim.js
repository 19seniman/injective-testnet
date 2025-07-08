require('dotenv').config();
const { ethers } = require('ethers');
const prompt = require('prompt-sync')();

const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m"
};

const logger = {
    info: (msg) => console.log(`${colors.green}[✓] ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[⚠] ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[✗] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[✅] ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.cyan}[⟳] ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.white}[➤] ${msg}${colors.reset}`),
    banner: () => {
        console.log(`${colors.cyan}${colors.bold}`);
        console.log(`---------------------------------------------`);
        console.log(` 🍉🍉 19Seniman From Insider 🍉🍉 `);
        console.log(`---------------------------------------------${colors.reset}`);
        console.log();
    }
};

const RPC_URL = 'https://k8s.testnet.json-rpc.injective.network';
const ROUTER_ADDRESS = '0x4069f8Ada1a4d3B705e6a82F9A3EB8624Cd4Cb1E';
const WINJ_ADDRESS = '0xe1c64DDE0A990ac2435B05DCdac869a17fE06Bd2';
const PMX_ADDRESS = '0xeD0094eE59492cB08A5602Eb8275acb00FFb627d';
const PAIR_ADDRESS = '0x54Ba382CED996738c2A0793247F66dE86C441987';
const ROUTER_ADDRESS = '0x4069f8ada1a4d3b705e6a82f9a3eb8624cd4cb1e';
const USDC_ADDRESS = '0x1d4403f5ac128daf548c5ba707d1047b475fdad2';

const ROUTER_ABI = [
    'function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address tokenIn, address tokenOut, bool stable)[] memory routes, address to, uint256 deadline) external returns (uint256[] memory amounts)',
    'function getAmountsOut(uint256 amountIn, (address tokenIn, address tokenOut, bool stable)[] memory routes) external view returns (uint256[] memory amounts)'
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)'
];

const provider = new ethers.JsonRpcProvider(RPC_URL);

const privateKeys = Object.keys(process.env)
    .filter(key => key.startsWith('PRIVATE_KEY_'))
    .map(key => process.env[key]);

if (privateKeys.length === 0) {
    logger.error('No private keys found in .env file');
    process.exit(1);
}

logger.banner();

async function approveToken(wallet, tokenAddress, spender, amount) {
    if (!wallet) {
        throw new Error('Wallet is not defined in approveToken');
    }
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await tokenContract.allowance(wallet.address, spender);
    if (allowance < amount) {
        logger.step(`Approving ${ethers.formatEther(amount)} tokens for ${spender}`);
        const tx = await tokenContract.approve(spender, amount);
        logger.loading(`Waiting for approval transaction: ${tx.hash}`);
        await tx.wait();
        logger.success(`Token approved for ${spender}`);
    } else {
        logger.info(`Sufficient allowance already exists for ${spender}`);
    }
}

async function getExpectedOutput(amountIn, tokenIn, tokenOut) {
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
    const routes = [{ tokenIn, tokenOut, stable: false }];
    const amountsOut = await routerContract.getAmountsOut(amountIn, routes);
    return amountsOut[1]; 
}

async function swapTokens(wallet, amountIn, tokenIn, tokenOut, transactionNumber) {
    if (!wallet) {
        throw new Error('Wallet is not defined in swapTokens');
    }
    logger.step(`Wallet address: ${wallet.address} (Transaction ${transactionNumber})`);
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; 
    const routes = [{ tokenIn, tokenOut, stable: false }];

    const amountOutMinRaw = await getExpectedOutput(amountIn, tokenIn, tokenOut);
    const amountOutMin = BigInt(amountOutMinRaw);
    const slippageAdjusted = (amountOutMin * 95n) / 100n; 
    logger.info(`Expected output: ${ethers.formatEther(amountOutMin)} ${tokenOut === PMX_ADDRESS ? 'PMX' : 'wINJ'}`);

    await approveToken(wallet, tokenIn, ROUTER_ADDRESS, amountIn);

    logger.loading(`Initiating swap: ${ethers.formatEther(amountIn)} ${tokenIn === WINJ_ADDRESS ? 'wINJ' : 'PMX'} -> ${tokenOut === PMX_ADDRESS ? 'PMX' : 'wINJ'} (Transaction ${transactionNumber})`);
    try {
        const tx = await routerContract.swapExactTokensForTokens(
            amountIn,
            slippageAdjusted,
            routes,
            wallet.address,
            deadline,
            { gasLimit: 600000 }
        );

        logger.loading(`Waiting for transaction: ${tx.hash}`);
        const receipt = await tx.wait();
        logger.success(`Swap completed: ${tx.hash} (Transaction ${transactionNumber})`);
        logger.info(`Explorer: https://testnet.blockscout.injective.network/tx/${tx.hash}`);

        const amounts = receipt.logs
            .filter(log => log.address.toLowerCase() === PAIR_ADDRESS.toLowerCase())
            .map(log => {
                try {
                    return routerContract.interface.parseLog(log);
                } catch {
                    return null;
                }
            })
            .filter(event => event && event.name === 'Swap')
            .map(event => ({
                amount0: ethers.formatEther(event.args.amount0Out),
                amount1: ethers.formatEther(event.args.amount1Out)
            }));

        amounts.forEach(amount => {
            logger.info(`Swapped: ${amount.amount0} wINJ for ${amount.amount1} PMX or vice versa (Transaction ${transactionNumber})`);
        });
    } catch (error) {
        throw new Error(`Swap failed: ${error.message} (Transaction ${transactionNumber})`);
    }
}

async function getTokenBalance(wallet, tokenAddress, tokenName) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await tokenContract.balanceOf(wallet.address);
    logger.info(`${tokenName} balance for ${wallet.address}: ${ethers.formatEther(balance)}`);
    return balance;
}

async function main() {
    
    logger.step('Select swap direction:');
    console.log('1. Swap wINJ to PMX');
    console.log('2. Swap PMX to wINJ');
    const choice = prompt('Enter 1 or 2: ');

    let tokenIn, tokenOut, tokenInName;
    if (choice === '1') {
        tokenIn = WINJ_ADDRESS;
        tokenOut = PMX_ADDRESS;
        tokenInName = 'wINJ';
    } else if (choice === '2') {
        tokenIn = PMX_ADDRESS;
        tokenOut = WINJ_ADDRESS;
        tokenInName = 'PMX';
    } else {
        logger.error('Invalid choice. Please enter 1 or 2.');
        return;
    }

    const amountToSwap = prompt(`Enter amount of ${tokenInName} to swap per transaction: `);
    const amountInWei = ethers.parseEther(amountToSwap);

    if (isNaN(amountToSwap) || amountToSwap <= 0) {
        logger.error('Invalid amount entered');
        return;
    }

    const numTransactions = prompt('Enter number of transactions to perform: ');
    const transactionCount = parseInt(numTransactions);

    if (isNaN(transactionCount) || transactionCount <= 0) {
        logger.error('Invalid number of transactions entered');
        return;
    }

    for (const privateKey of privateKeys) {
        try {
            const wallet = new ethers.Wallet(privateKey, provider);
            if (!wallet.address) {
                logger.error(`Invalid wallet for private key: ${privateKey.slice(0, 6)}...`);
                continue;
            }
            logger.step(`Processing swaps for wallet: ${wallet.address}`);

            const balance = await getTokenBalance(wallet, tokenIn, tokenInName);
            const totalRequired = amountInWei * BigInt(transactionCount);
            if (balance < totalRequired) {
                logger.error(`Insufficient ${tokenInName} balance for ${wallet.address}: ${ethers.formatEther(balance)} ${tokenInName} (Required: ${ethers.formatEther(totalRequired)})`);
                continue;
            }

            for (let i = 1; i <= transactionCount; i++) {
                try {
                    logger.step(`Executing transaction ${i} of ${transactionCount}`);
                    await swapTokens(wallet, amountInWei, tokenIn, tokenOut, i);
                } catch (error) {
                    logger.error(`Error in transaction ${i}: ${error.message}`);
                    continue; 
                }
            }
        } catch (error) {
            logger.error(`Error for wallet: ${error.message}`);
        }
    }
}

main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
