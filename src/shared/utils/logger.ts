// Enhanced logging system with beautiful console output

const LOG_STYLES = {
  header: 'background: #8b5cf6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
  success: 'background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
  error: 'background: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
  warning: 'background: #f59e0b; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
  info: 'background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold;',
  step: 'background: #6366f1; color: white; padding: 4px 8px; border-radius: 4px;',
  data: 'color: #6b7280; font-style: italic;',
};

class Logger {
  private sessionStart: number;
  private stepCounter: number = 0;

  constructor() {
    this.sessionStart = Date.now();
  }

  private getTimestamp(): string {
    const elapsed = Date.now() - this.sessionStart;
    const seconds = (elapsed / 1000).toFixed(2);
    return `[+${seconds}s]`;
  }

  header(message: string) {
    console.log(`%c 🚀 ${message} `, LOG_STYLES.header);
    console.log(`%c${this.getTimestamp()} Session started`, LOG_STYLES.data);
  }

  step(message: string, data?: unknown) {
    this.stepCounter++;
    console.log(`%c Step ${this.stepCounter}: ${message} `, LOG_STYLES.step, this.getTimestamp());
    if (data) {
      console.log('%c   ↳', LOG_STYLES.data, data);
    }
  }

  success(message: string, data?: unknown) {
    console.log(`%c ✓ ${message} `, LOG_STYLES.success, this.getTimestamp());
    if (data) {
      console.log('%c   ↳', LOG_STYLES.data, data);
    }
  }

  error(message: string, error?: unknown) {
    console.log(`%c ✗ ${message} `, LOG_STYLES.error, this.getTimestamp());
    if (error) {
      console.error('   ↳', error);
    }
  }

  warning(message: string, data?: unknown) {
    console.log(`%c ⚠ ${message} `, LOG_STYLES.warning, this.getTimestamp());
    if (data) {
      console.log('%c   ↳', LOG_STYLES.data, data);
    }
  }

  info(message: string, data?: unknown) {
    console.log(`%c ℹ ${message} `, LOG_STYLES.info, this.getTimestamp());
    if (data) {
      console.log('%c   ↳', LOG_STYLES.data, data);
    }
  }

  group(title: string, fn: () => void) {
    console.group(`%c ${title}`, LOG_STYLES.header);
    fn();
    console.groupEnd();
  }

  table(data: unknown[]) {
    console.table(data);
  }

  separator() {
    console.log('%c' + '─'.repeat(80), 'color: #d1d5db;');
  }

  summary(data: { [key: string]: unknown }) {
    this.separator();
    console.log('%c 📊 SUMMARY ', LOG_STYLES.info);
    Object.entries(data).forEach(([key, value]) => {
      console.log(`   ${key}: %c${value}`, 'font-weight: bold; color: #8b5cf6;');
    });
    this.separator();
  }
}

// Export singleton instance
export const logger = new Logger();

// Helper for timing operations
export async function timeOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = Date.now();
  logger.step(`Starting: ${name}`);

  try {
    const result = await operation();
    const duration = Date.now() - start;
    logger.success(`Completed: ${name}`, `Duration: ${duration}ms`);
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(`Failed: ${name} (after ${duration}ms)`, error);
    throw error;
  }
}

export default logger;
