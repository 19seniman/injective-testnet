const loggerTheme = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  bgGray: "\x1b[100m",
};

const fancyBox = (title, subtitle) => {
  console.log(`${loggerTheme.cyan}${loggerTheme.bold}`);
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  ${title.padEnd(42)}  ║`);
  if (subtitle) {
    console.log(`║  ${subtitle.padEnd(42)}  ║`);
  }
  console.log('╚══════════════════════════════════════════════╝');
  console.log(loggerTheme.reset);
};

const logger = {
  info: (msg) => console.log(`${loggerTheme.blue}[ ℹ INFO ] → ${msg}${loggerTheme.reset}`),
  warn: (msg) => console.log(`${loggerTheme.yellow}[ ⚠ WARNING ] → ${msg}${loggerTheme.reset}`),
  error: (msg) => console.log(`${loggerTheme.red}[ ✖ ERROR ] → ${msg}${loggerTheme.reset}`),
  success: (msg) => console.log(`${loggerTheme.green}[ ✔ DONE ] → ${msg}${loggerTheme.reset}`),
  loading: (msg) => console.log(`${loggerTheme.cyan}[ ⌛ LOADING ] → ${msg}${loggerTheme.reset}`),
  step: (msg) => console.log(`${loggerTheme.magenta}[ ➔ STEP ] → ${msg}${loggerTheme.reset}`),
  banner: () => fancyBox(' 🍉🍉 Free Plestine 🍉🍉', '— 19Seniman From Insider 🏴‍☠️ —'),
};



hii.... How are you today???
