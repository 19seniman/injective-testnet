import 'dotenv/config';
import { ethers } from 'ethers';
import prompt from 'prompt-sync';
import chalk from 'chalk';

const promptSync = prompt();

const logger = {
    info: (msg) => console.log(chalk.green(`[✓] ${msg}`)),
    warn: (msg) => console.log(chalk.yellow(`[⚠] ${msg}`)),
    error: (msg) => console.log(chalk.red(`[✗] ${msg}`)),
    success: (msg) => console.log(chalk.green(`[✅] ${msg}`)),
    loading: (msg) => console.log(chalk.cyan(`[⟳] ${msg}`)),
    step: (msg) => console.log(chalk.white(`[➤] ${msg}`)),
    banner: () => {
        console.log(chalk.cyan('---------------------------------------------'));
        console.log(chalk.cyan(' 🍉🍉 19Seniman From Airdrop Insider 🍉🍉 '));
        console.log(chalk.cyan('---------------------------------------------'));
        console.log();
    }
};

// ... (rest of your code remains unchanged)

async function main() {
    logger.banner();
    
    logger.step('Select swap direction:');
    console.log('1. Swap wINJ to PMX');
    console.log('2. Swap PMX to wINJ');
    const choice = promptSync('Enter 1 or 2: ');

    // ... (rest of your main function remains unchanged)
}

main().catch(error => {
    logger.error(`Fatal error: ${error.message}`);
    process.exit(1);
});
