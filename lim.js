require('dotenv').config();
const { ethers } = require('ethers');

// --- PENGATURAN KONFIGURASI ---
const config = {
    // Jumlah wINJ yang akan di-swap di setiap transaksi. Ubah sesuai kebutuhan.
    amountToSwap: '0.001', 
    // Jeda waktu minimum antara siklus transaksi (dalam milidetik). 30 detik = 30000
    delayMinMs: 30000, 
    // Jeda waktu maksimum antara siklus transaksi (dalam milidetik). 1 menit = 60000
    delayMaxMs: 60000,
};
// ------------------------------

// DIUBAH: Definisi warna baru ditambahkan (magenta, blue, gray)
const colors = {
    reset: "\x1b[0m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    white: "\x1b[37m",
    bold: "\x1b[1m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
    gray: "\x1b[90m",
};

// DIUBAH: Logger baru sesuai permintaan Anda
const logger = {
    info: (msg) => console.log(`${colors.cyan}[i] ${msg}${colors.reset}`),
    warn: (msg) => console.log(`${colors.yellow}[!] ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}[x] ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}[+] ${msg}${colors.reset}`),
    loading: (msg) => console.log(`${colors.magenta}[*] ${msg}${colors.reset}`),
    step: (msg) => console.log(`${colors.blue}[>] ${colors.bold}${msg}${colors.reset}`),
    critical: (msg) => console.log(`${colors.red}${colors.bold}[FATAL] ${msg}${colors.reset}`),
    summary: (msg) => console.log(`${colors.green}${colors.bold}[SUMMARY] ${msg}${colors.reset}`),
    banner: () => {
        const border = `${colors.blue}${colors.bold}╔═════════════════════════════════════════╗${colors.reset}`;
        const title = `${colors.blue}${colors.bold}║     🍉 19Seniman From Insider 🍉      ║${colors.reset}`;
        const bottomBorder = `${colors.blue}${colors.bold}╚═════════════════════════════════════════╝${colors.reset}`;
        
        console.log(`\n${border}`);
        console.log(`${title}`);
        console.log(`${bottomBorder}\n`);
    },
    section: (msg) => {
        const line = '─'.repeat(41);
        console.log(`\n${colors.gray}${line}${colors.reset}`);
        if (msg) console.log(`${colors.white}${colors.bold}  ${msg} ${colors.reset}`);
        console.log(`${colors.gray}${line}${colors.reset}\n`);
    },
    countdown: (msg) => process.stdout.write(`\r${colors.blue}[⏰] ${msg}${colors.reset}`),
};

const RPC_URL = 'https://k8s.testnet.json-rpc.injective.network';
const ROUTER_ADDRESS = '0x4069f8Ada1a4d3B705e6a82F9A3EB8624Cd4Cb1E';
const WINJ_ADDRESS = '0x5Ae9B425f58B78e0d5e7e5a7A75c5f5B45d143B7';
const PMX_ADDRESS = '0xeD0094eE59492cB08A5602Eb8275acb00FFb627d';

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
    logger.critical('Tidak ada private key yang ditemukan di file .env');
    process.exit(1);
}

const delay = (ms) => new Promise(res => setTimeout(res, ms));

// BARU: Fungsi untuk menampilkan countdown di terminal
const countdownDelay = async (durationMs) => {
    const endTime = Date.now() + durationMs;
    while (Date.now() < endTime) {
        const timeLeft = Math.round((endTime - Date.now()) / 1000);
        logger.countdown(`Jeda siklus berikutnya, sisa waktu: ${timeLeft} detik... `);
        await delay(1000);
    }
    process.stdout.write('\r' + ' '.repeat(60) + '\r'); // Membersihkan baris countdown
};

const randomDelay = () => {
    const time = Math.floor(Math.random() * (config.delayMaxMs - config.delayMinMs + 1)) + config.delayMinMs;
    return countdownDelay(time);
};

async function approveToken(wallet, tokenAddress, spender, amount) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
    const allowance = await tokenContract.allowance(wallet.address, spender);
    if (allowance < amount) {
        logger.step(`Approval diperlukan untuk ${ethers.formatEther(amount)} token.`);
        const tx = await tokenContract.approve(spender, amount);
        logger.loading(`Menunggu transaksi approval: ${tx.hash}`);
        await tx.wait();
        logger.success(`Token berhasil di-approve.`);
    }
}

async function getExpectedOutput(amountIn, tokenIn, tokenOut) {
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, provider);
    const routes = [{ tokenIn, tokenOut, stable: false }];
    const amountsOut = await routerContract.getAmountsOut(amountIn, routes);
    return amountsOut[1];
}

async function swapTokens(wallet, amountIn, tokenIn, tokenOut, tokenInName, tokenOutName) {
    const routerContract = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, wallet);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20; // 20 menit
    const routes = [{ tokenIn, tokenOut, stable: false }];

    const amountOutMinRaw = await getExpectedOutput(amountIn, tokenIn, tokenOut);
    const slippageAdjusted = (BigInt(amountOutMinRaw) * 95n) / 100n; // Slippage 5%

    await approveToken(wallet, tokenIn, ROUTER_ADDRESS, amountIn);

    logger.loading(`Memulai swap: ${ethers.formatEther(amountIn)} ${tokenInName} -> ${tokenOutName}`);
    try {
        const tx = await routerContract.swapExactTokensForTokens(
            amountIn,
            slippageAdjusted,
            routes,
            wallet.address,
            deadline
        );

        logger.loading(`Menunggu konfirmasi transaksi: ${tx.hash}`);
        await tx.wait();
        logger.success(`Swap berhasil! TxHash: ${tx.hash}`);

    } catch (error) {
        logger.error(`Swap Gagal: ${error.reason || error.message}`);
        throw new Error(`Swap Gagal: ${error.message}`);
    }
}

async function getTokenBalance(wallet, tokenAddress) {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    return await tokenContract.balanceOf(wallet.address);
}

async function processWallet(privateKey, amountInWei, tokenIn, tokenOut, tokenInName, tokenOutName) {
    try {
        const wallet = new ethers.Wallet(privateKey, provider);
        logger.step(`Memproses dompet: ${wallet.address}`);

        const balance = await getTokenBalance(wallet, tokenIn);
        
        if (balance < amountInWei) {
            logger.warn(`Saldo ${tokenInName} tidak cukup. Saldo: ${ethers.formatEther(balance)}, Dibutuhkan: ${ethers.formatEther(amountInWei)}. Melewati...`);
            return;
        }

        logger.info(`Saldo ${tokenInName} saat ini: ${ethers.formatEther(balance)}`);
        await swapTokens(wallet, amountInWei, tokenIn, tokenOut, tokenInName, tokenOutName);

    } catch (error) {
        logger.error(`Kesalahan pada dompet ${privateKey.slice(0, 10)}...`);
    }
}

async function main() {
    logger.banner();
    logger.info(`Bot Auto Swap dimulai dengan ${privateKeys.length} dompet.`);
    logger.info(`Jumlah swap per transaksi: ${config.amountToSwap}.`);
    
    const amountInWei = ethers.parseEther(config.amountToSwap);
    let txCounter = 1;

    while (true) {
        try {
            logger.section(`Siklus Transaksi #${txCounter}`);
            
            // Langkah 1: Swap wINJ -> PMX
            logger.step("Tahap 1: Swap wINJ -> PMX");
            for (const privateKey of privateKeys) {
                await processWallet(privateKey, amountInWei, WINJ_ADDRESS, PMX_ADDRESS, 'wINJ', 'PMX');
                await delay(3000); // Jeda singkat antar dompet
            }
            logger.info("Tahap 1 selesai untuk semua dompet.");
            await randomDelay();

            // Langkah 2: Swap PMX -> wINJ
            logger.step("Tahap 2: Swap PMX -> wINJ");
            for (const privateKey of privateKeys) {
                await processWallet(privateKey, amountInWei, PMX_ADDRESS, WINJ_ADDRESS, 'PMX', 'wINJ');
                await delay(3000); // Jeda singkat antar dompet
            }
            logger.summary(`Siklus Transaksi #${txCounter} Selesai`);
            txCounter++;
            
            await randomDelay();

        } catch (error) {
            logger.error(`Terjadi error pada loop utama: ${error.message}`);
            logger.warn(`Akan mencoba lagi setelah jeda...`);
            await randomDelay();
        }
    }
}

main().catch(error => {
    logger.critical(`ERROR FATAL, skrip berhenti: ${error.message}`);
    process.exit(1);
});
