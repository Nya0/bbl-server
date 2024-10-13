// Define custom colors and styles for different log levels
const levelStyles = {
  client: '\x1b[34m\x1b[1m', // Blue and bold
  server: '\x1b[32m\x1b[1m', // Green and bold
  error: '\x1b[31m\x1b[1m',  // Red and bold
  info: '\x1b[36m\x1b[1m',   // Cyan and bold
  reset: '\x1b[0m'           // Reset
};

// Function to format messages with color and bold
function formatMessage(level, message) {
  const color = levelStyles[level] || levelStyles.reset;
  return `${color}${message}${levelStyles.reset}`;
}

// Function to get the current timestamp
function getTimestamp() {
  return new Date().toISOString();
}

// Custom logger function
function customLogger(level, ...args) {
  const levelName = level.toLowerCase();
  const message = args.join(' ');
  const timestamp = getTimestamp();
  
  if (!levelStyles[levelName]) {
    throw new Error(`Unknown log level: ${level}`);
  }

  // Format and output the log with bold level name
  console.log(`${timestamp} ${formatMessage(levelName, `[${levelName}]`)} : ${message}`);
}

// Define custom logger methods
const logger = {
  error: (...args) => customLogger('error', ...args),
  client: (...args) => customLogger('client', ...args),
  server: (...args) => customLogger('server', ...args),
  info: (...args) => customLogger('info', ...args),
};

module.exports = logger;
