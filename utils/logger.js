const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// Keep original console methods intact for safe internal logging and terminal display
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
const origInfo = console.info;

const logsDir = path.join(__dirname, '../logs');

// Ensure logs directory exists
function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Get daily log file path based on current local date
function getLogFilePath() {
  ensureLogsDir();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return path.join(logsDir, `app-${yyyy}-${mm}-${dd}.log`);
}

// Format arguments passed to console methods
function formatMessage(args) {
  return args.map(arg => {
    if (arg instanceof Error) {
      return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg);
      } catch (e) {
        return String(arg);
      }
    }
    return String(arg);
  }).join(' ');
}

// Write line to current day's log file safely
function appendToLogFile(level, message) {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] [${level}] ${message}\n`;
    const filePath = getLogFilePath();
    
    fs.appendFile(filePath, logLine, (err) => {
      if (err) {
        // Silently catch to avoid recursion with console.error
      }
    });
  } catch (err) {
    // Catch any synchronous errors
  }
}

// Clean up logs older than configured days if status is active
function cleanupOldLogs() {
  const status = (process.env.LOG_CLEAR_STATUS || 'inactive').toLowerCase().trim();
  const days = parseInt(process.env.LOG_CLEAR_DAYS, 10) || 30;

  if (status !== 'active') {
    origLog(`[LOG CLEANUP] Status is '${status}' (inactive). Skipping log retention cleanup.`);
    return;
  }

  origLog(`[LOG CLEANUP] Status is 'active'. Checking for log files older than ${days} days...`);
  
  try {
    ensureLogsDir();
    const files = fs.readdirSync(logsDir);
    const nowMs = Date.now();
    const maxAgeMs = days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    files.forEach(file => {
      // only clean up files ending with .log
      if (file.endsWith('.log')) {
        const filePath = path.join(logsDir, file);
        try {
          const stats = fs.statSync(filePath);
          if (nowMs - stats.mtimeMs > maxAgeMs) {
            fs.unlinkSync(filePath);
            deletedCount++;
            origLog(`[LOG CLEANUP] Deleted old log file: ${file}`);
            appendToLogFile('INFO', `[LOG CLEANUP] Deleted old log file: ${file}`);
          }
        } catch (fileErr) {
          origError(`[LOG CLEANUP] Could not process file ${file}:`, fileErr.message);
        }
      }
    });

    if (deletedCount === 0) {
      origLog('[LOG CLEANUP] No old log files exceeded the retention period.');
    } else {
      origLog(`[LOG CLEANUP] Successfully removed ${deletedCount} old log file(s).`);
    }
  } catch (err) {
    origError('[LOG CLEANUP] Error running log cleanup:', err.message);
  }
}

// Initialize logger overrides and cleanup schedule
function initLogger() {
  ensureLogsDir();

  // Override global console methods to append to file AND display in terminal
  console.log = function (...args) {
    origLog.apply(console, args);
    appendToLogFile('INFO', formatMessage(args));
  };

  console.info = function (...args) {
    origInfo.apply(console, args);
    appendToLogFile('INFO', formatMessage(args));
  };

  console.warn = function (...args) {
    origWarn.apply(console, args);
    appendToLogFile('WARN', formatMessage(args));
  };

  console.error = function (...args) {
    origError.apply(console, args);
    appendToLogFile('ERROR', formatMessage(args));
  };

  origLog('[LOGGER] Daily rotating file logger successfully initialized.');
  appendToLogFile('INFO', '[LOGGER] Application started. Daily rotating file logger initialized.');

  // Run cleanup check shortly after startup
  setTimeout(() => {
    cleanupOldLogs();
  }, 5000);

  // Schedule cron job to run cleanup daily at midnight
  cron.schedule('0 0 * * *', () => {
    origLog('[CRON] Running scheduled daily log cleanup...');
    appendToLogFile('INFO', '[CRON] Running scheduled daily log cleanup...');
    cleanupOldLogs();
  });
}

module.exports = { initLogger, cleanupOldLogs };
