/* eslint-disable no-console -- 日志封装类，刻意调用 console */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** DevTools `%c` 样式：仅作用于级别标签 */
const LEVEL_TAG_STYLE: Record<LogLevel, string> = {
  debug:
    'background:#64748b;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;',
  info: 'background:#2563eb;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;',
  warn: 'background:#ca8a04;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;',
  error:
    'background:#dc2626;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;',
};

/** DevTools `%c` 样式：`projectName` 前缀标签，固定浅色底 */
const PROJECT_NAME_TAG_STYLE =
  'background:#FF55FF;color:#fff;padding:1px 5px;border-radius:3px;font-weight:600;';

export interface LoggerOptions {
  /** 输出的最低级别；低于该级别的日志会被忽略 */
  level?: LogLevel;
  /** 每条日志前的项目名称前缀，例如 `my-extension` → `[my-extension]` */
  projectName?: string;
}

export class Logger {
  private minPriority: number;
  private prefix: string;

  public constructor(options: LoggerOptions = {}) {
    this.minPriority = LEVEL_PRIORITY[options.level ?? 'debug'];
    const name = options.projectName?.trim();
    this.prefix = name ? `[${name}]` : '';
  }

  /** 运行时调整最低输出级别 */
  public setLevel(level: LogLevel): void {
    this.minPriority = LEVEL_PRIORITY[level];
  }

  /** 运行时调整项目名称前缀；传入空字符串则去掉前缀 */
  public setProjectName(projectName: string | undefined): void {
    const name = projectName?.trim();
    this.prefix = name ? `[${name}]` : '';
  }

  public debug(...args: unknown[]): void {
    this.emit('debug', args);
  }

  public info(...args: unknown[]): void {
    this.emit('info', args);
  }

  public warn(...args: unknown[]): void {
    this.emit('warn', args);
  }

  public error(...args: unknown[]): void {
    this.emit('error', args);
  }

  private emit(level: LogLevel, args: unknown[]): void {
    if (LEVEL_PRIORITY[level] < this.minPriority) {
      return;
    }

    const levelTag = `[${level.toUpperCase()}]`;
    const tagStyle = LEVEL_TAG_STYLE[level];
    const format =
      this.prefix.length > 0
        ? `%c${this.prefix}%c %c${levelTag}%c`
        : `%c${levelTag}%c`;
    const prefixStyles =
      this.prefix.length > 0
        ? [PROJECT_NAME_TAG_STYLE, '', tagStyle, '']
        : [tagStyle, ''];

    switch (level) {
      case 'debug':
        console.debug(format, ...prefixStyles, ...args);
        break;
      case 'info':
        console.info(format, ...prefixStyles, ...args);
        break;
      case 'warn':
        console.warn(format, ...prefixStyles, ...args);
        break;
      case 'error':
        console.error(format, ...prefixStyles, ...args);
        break;
    }
  }
}

export const defaultLogger = new Logger({ projectName: 'ClawTab' });
