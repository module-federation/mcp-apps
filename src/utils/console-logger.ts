// Console log collector
let consoleLogCollector: string[] = [];

const safeStringify = (obj: any): string => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    }, 2).substring(0, 200);
  } catch {
    return String(obj);
  }
};

const addToConsoleLog = (type: string, ...args: any[]) => {
  const message = `[${type.toUpperCase()}] ${args.map(a =>
    typeof a === 'object' ? safeStringify(a) : String(a)
  ).join(' ')}`;
  consoleLogCollector.push(message);
  if (consoleLogCollector.length > 50) {
    consoleLogCollector.shift();
  }
};

// Intercept console methods to collect logs
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = (...args: any[]) => {
  addToConsoleLog('log', ...args);
  originalLog(...args);
};

console.warn = (...args: any[]) => {
  addToConsoleLog('warn', ...args);
  originalWarn(...args);
};

console.error = (...args: any[]) => {
  addToConsoleLog('error', ...args);
  originalError(...args);
};

export { consoleLogCollector };
