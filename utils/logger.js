const fs = require('fs');
const path = require('path');

// Keep original console methods intact for safe internal logging and terminal display
const origLog = console.log;
const origError = console.error;
const origWarn = console.warn;
const origInfo = console.info;

const logsDir = path.join(__dirname, '../logs');

// Ensure the logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Helper to get the current date string in YYYY-MM-DD format (local time)
 */
function getLocalDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Helper to get the current date-time string in YYYY-MM-DD HH:mm:ss format
 */
function getLocalDateTimeString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Format arguments passed to console methods
 */
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

/**
 * Writes a log message to the console and to the daily log file.
 * @param {string} message 
 */
function log(message) {
    const timestamp = getLocalDateTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;

    // Print to console using original method to avoid recursion
    origLog(formattedMessage);

    // Append to file
    const logFileName = `${getLocalDateString()}.log`;
    const logFilePath = path.join(logsDir, logFileName);

    try {
        fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
    } catch (error) {
        origError(`[Logger Error] Failed to write to log file: ${error.message}`);
    }
}

/**
 * Cleans up daily log files that are older than the specified retention days.
 */
function cleanupOldLogs() {
    try {
        const clearStatus = (process.env.LOG_CLEAR_STATUS || '').toLowerCase().trim();
        if (clearStatus !== 'active') {
            log(`[Logger] LOG_CLEAR_STATUS is '${clearStatus}' (not active). Skipping log retention cleanup.`);
            return;
        }

        const expiryDays = parseInt(process.env.LOG_EXPIRY_DAYS, 10);
        
        // Safeguard if parsing fails or user inputs negative/invalid number
        if (isNaN(expiryDays) || expiryDays < 0) {
            log(`[Logger] LOG_EXPIRY_DAYS is not configured or invalid (value: ${process.env.LOG_EXPIRY_DAYS}). Retaining all logs.`);
            return;
        }

        log(`[Logger] Running log cleanup check. Retention limit: ${expiryDays} days.`);

        const files = fs.readdirSync(logsDir);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let deletedCount = 0;

        for (const file of files) {
            if (path.extname(file) === '.log') {
                const nameWithoutExt = path.basename(file, '.log');
                const fileDate = new Date(nameWithoutExt);

                if (!isNaN(fileDate.getTime())) {
                    fileDate.setHours(0, 0, 0, 0);
                    
                    // Difference in milliseconds
                    const diffMs = today.getTime() - fileDate.getTime();
                    // Convert to days
                    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

                    if (diffDays > expiryDays) {
                        const filePath = path.join(logsDir, file);
                        fs.unlinkSync(filePath);
                        deletedCount++;
                        log(`[Logger] Deleted expired log file: ${file} (Age: ${diffDays} days)`);
                    }
                }
            }
        }

        if (deletedCount > 0) {
            log(`[Logger] Cleanup completed. Deleted ${deletedCount} expired log file(s).`);
        } else {
            log(`[Logger] Cleanup completed. No expired log files found.`);
        }
    } catch (error) {
        origError(`[Logger Error] Error running log cleanup:`, error);
    }
}

/**
 * Check if call stack originates from a controller or utils file
 */
function shouldLogToFile() {
  try {
    const err = new Error();
    const stack = err.stack || '';
    const lines = stack.split('\n');

    // Check stack frames, ignoring the logger utility itself
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('logger.js')) continue;
      
      if (/[\/\\]controller(s)?[\/\\]|[\/\\]utils[\/\\]/i.test(line)) {
        return true;
      }
    }
  } catch (e) {
    return true; // fallback
  }
  return false;
}

/**
 * Initializes and schedules log cleanup task.
 */
function startLogCleanupScheduler() {
    // Run cleanup once on server startup
    cleanupOldLogs();

    // Schedule cleanup to run every 24 hours
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    setInterval(cleanupOldLogs, TWENTY_FOUR_HOURS);
    log(`[Logger] Automated log cleanup scheduler started (runs every 24 hours).`);
}

/**
 * Initializes console overrides.
 */
function initLogger() {
  // Override global console methods to append to file ONLY if from controller or utils
  console.log = function (...args) {
    origLog.apply(console, args);
    if (shouldLogToFile()) {
      const msg = formatMessage(args);
      const timestamp = getLocalDateTimeString();
      const formattedMessage = `[${timestamp}] [INFO] ${msg}`;
      const logFileName = `${getLocalDateString()}.log`;
      const logFilePath = path.join(logsDir, logFileName);
      try {
        fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
      } catch (error) {
        origError(`[Logger Error] Failed to write to log file: ${error.message}`);
      }
    }
  };

  console.info = function (...args) {
    origInfo.apply(console, args);
    if (shouldLogToFile()) {
      const msg = formatMessage(args);
      const timestamp = getLocalDateTimeString();
      const formattedMessage = `[${timestamp}] [INFO] ${msg}`;
      const logFileName = `${getLocalDateString()}.log`;
      const logFilePath = path.join(logsDir, logFileName);
      try {
        fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
      } catch (error) {
        origError(`[Logger Error] Failed to write to log file: ${error.message}`);
      }
    }
  };

  console.warn = function (...args) {
    origWarn.apply(console, args);
    if (shouldLogToFile()) {
      const msg = formatMessage(args);
      const timestamp = getLocalDateTimeString();
      const formattedMessage = `[${timestamp}] [WARN] ${msg}`;
      const logFileName = `${getLocalDateString()}.log`;
      const logFilePath = path.join(logsDir, logFileName);
      try {
        fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
      } catch (error) {
        origError(`[Logger Error] Failed to write to log file: ${error.message}`);
      }
    }
  };

  console.error = function (...args) {
    origError.apply(console, args);
    if (shouldLogToFile()) {
      const msg = formatMessage(args);
      const timestamp = getLocalDateTimeString();
      const formattedMessage = `[${timestamp}] [ERROR] ${msg}`;
      const logFileName = `${getLocalDateString()}.log`;
      const logFilePath = path.join(logsDir, logFileName);
      try {
        fs.appendFileSync(logFilePath, formattedMessage + '\n', 'utf8');
      } catch (error) {
        origError(`[Logger Error] Failed to write to log file: ${error.message}`);
      }
    }
  };

  // Start scheduler
  startLogCleanupScheduler();
}

module.exports = {
    log,
    cleanupOldLogs,
    startLogCleanupScheduler,
    initLogger
};
