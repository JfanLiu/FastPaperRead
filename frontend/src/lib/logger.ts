/**
 * 前端日志模块
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
}

class Logger {
  private module: string;
  private static logs: LogEntry[] = [];
  private static maxLogs = 1000;

  constructor(module: string) {
    this.module = module;
  }

  private log(level: LogLevel, message: string, data?: unknown) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.module,
      message,
      data
    };

    // 存储日志
    Logger.logs.push(entry);
    if (Logger.logs.length > Logger.maxLogs) {
      Logger.logs.shift();
    }

    // 控制台输出
    const prefix = `[${entry.timestamp.split('T')[1].split('.')[0]}] [${level.toUpperCase()}] [${this.module}]`;
    
    switch (level) {
      case 'debug':
        console.debug(`%c${prefix}`, 'color: gray', message, data || '');
        break;
      case 'info':
        console.info(`%c${prefix}`, 'color: blue', message, data || '');
        break;
      case 'warn':
        console.warn(`%c${prefix}`, 'color: orange', message, data || '');
        break;
      case 'error':
        console.error(`%c${prefix}`, 'color: red', message, data || '');
        break;
    }
  }

  debug(message: string, data?: unknown) {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown) {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown) {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown) {
    this.log('error', message, data);
  }

  // 获取所有日志
  static getLogs(): LogEntry[] {
    return [...Logger.logs];
  }

  // 清除日志
  static clearLogs() {
    Logger.logs = [];
  }

  // 导出日志
  static exportLogs(): string {
    return JSON.stringify(Logger.logs, null, 2);
  }
}

// 创建模块logger的工厂函数
export function createLogger(module: string): Logger {
  return new Logger(module);
}

// 预定义的模块logger
export const apiLogger = createLogger('API');
export const uiLogger = createLogger('UI');
export const storeLogger = createLogger('Store');

export default Logger;

