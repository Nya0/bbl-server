const fs = require('fs');
const path = require('path');
const util = require('util');

// Get process-specific log file name
const LOG_DIR = path.join(process.cwd(), 'logs');
const PROCESS_NAME = process.env.PROCESS_NAME || 'default';
const TIMESTAMP = new Date().toISOString().replace(/:/g, '-');
const LOG_FILE = path.join(LOG_DIR, `${PROCESS_NAME}-${TIMESTAMP}.log`);

// Console colors
const levelStyles = {
  client: '\x1b[34m\x1b[1m', // Blue and bold
  server: '\x1b[32m\x1b[1m', // Green and bold
  error: '\x1b[31m\x1b[1m',  // Red and bold
  info: '\x1b[36m\x1b[1m',   // Cyan and bold
  debug: '\x1b[36m',         // Cyan (not bold)
  reset: '\x1b[0m'           // Reset
};

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create or open the log file
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

function formatError(error) {
  if (!(error instanceof Error)) return String(error);
  return `${error.stack || error.message}\n` +
         `Context: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`;
}

function formatArgs(...args) {
  return args.map(arg => {
    if (arg instanceof Error) return formatError(arg);
    if (typeof arg === 'object') return util.inspect(arg, { depth: null, colors: false });
    return String(arg);
  }).join(' ');
}

function log(level, ...args) {
  const levelName = level.toLowerCase();
  if (!levelStyles[levelName]) {
    throw new Error(`Unknown log level: ${level}`);
  }

  // Skip debug messages unless DEBUG is true
  if (levelName === 'debug' && process.env.DEBUG !== 'true') {
    return;
  }

  const timestamp = new Date().toISOString();
  const formattedMessage = formatArgs(...args);
  
  // Console output (with colors)
  console.log(`${timestamp} ${levelStyles[levelName]}[${levelName}]${levelStyles.reset} : ${formattedMessage}`);
  
  // File output (without colors)
  logStream.write(`${timestamp} [${levelName}] : ${formattedMessage}\n`);
  
  // For errors, also log stack trace
  if (levelName === 'error') {
    const stack = new Error().stack;
    logStream.write(`${timestamp} [${levelName}] STACK TRACE:\n${stack}\n\n`);
  }
}

// Handle process termination
process.on('SIGINT', () => {
  logStream.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logStream.end();
  process.exit(0);
});

const logger = {
  error: (...args) => log('error', ...args),
  client: (...args) => log('client', ...args),
  server: (...args) => log('server', ...args),
  info: (...args) => log('info', ...args),
  debug: (...args) => log('debug', ...args),
  shutdown: () => logStream.end()
};

module.exports = logger;