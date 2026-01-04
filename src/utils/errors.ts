/**
 * Error Tracking Module
 * Captures JavaScript errors and unhandled promise rejections
 */
import { sendEvent } from '../transport';
import { getConfig } from '../config';

let originalOnError: OnErrorEventHandler | null = null;
let originalOnUnhandledRejection: ((event: PromiseRejectionEvent) => void) | null = null;

interface ErrorContext {
  filename?: string;
  lineno?: number;
  colno?: number;
  stack?: string;
  componentStack?: string;
}

function shouldIgnoreError(message: string): boolean {
  const config = getConfig();
  const ignorePatterns = config.ignoreErrors || [];

  return ignorePatterns.some((pattern) => {
    if (typeof pattern === 'string') {
      return message.includes(pattern);
    }
    return pattern.test(message);
  });
}

function extractStackTrace(error: Error | undefined): string | undefined {
  if (!error?.stack) return undefined;

  // Clean up stack trace
  return error.stack
    .split('\n')
    .slice(0, 10) // Limit to 10 frames
    .join('\n');
}

function handleError(
  message: string | Event,
  source?: string,
  lineno?: number,
  colno?: number,
  error?: Error
): boolean {
  const errorMessage = typeof message === 'string' ? message : message.type;

  if (shouldIgnoreError(errorMessage)) {
    return false;
  }

  const context: ErrorContext = {
    filename: source,
    lineno,
    colno,
    stack: extractStackTrace(error),
  };

  sendEvent('error', {
    type: 'javascript',
    message: errorMessage,
    name: error?.name || 'Error',
    ...context,
  });

  // Call original handler if it exists
  if (originalOnError) {
    return originalOnError(message, source, lineno, colno, error);
  }

  return false;
}

function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason;
  let message: string;
  let stack: string | undefined;
  let name = 'UnhandledPromiseRejection';

  if (reason instanceof Error) {
    message = reason.message;
    stack = extractStackTrace(reason);
    name = reason.name;
  } else if (typeof reason === 'string') {
    message = reason;
  } else {
    message = JSON.stringify(reason);
  }

  if (shouldIgnoreError(message)) {
    return;
  }

  sendEvent('error', {
    type: 'unhandled_rejection',
    message,
    name,
    stack,
  });

  // Call original handler if it exists
  if (originalOnUnhandledRejection) {
    originalOnUnhandledRejection(event);
  }
}

export function setupErrorTracking(): void {
  // Store original handlers
  originalOnError = window.onerror;
  originalOnUnhandledRejection = window.onunhandledrejection as ((event: PromiseRejectionEvent) => void) | null;

  // Install our handlers
  window.onerror = handleError;
  window.onunhandledrejection = handleUnhandledRejection;

  const config = getConfig();
  if (config.debug) {
    console.log('[BrainzLab] Error tracking enabled');
  }
}

export function teardownErrorTracking(): void {
  // Restore original handlers
  window.onerror = originalOnError;
  window.onunhandledrejection = originalOnUnhandledRejection as OnErrorEventHandler;

  originalOnError = null;
  originalOnUnhandledRejection = null;
}

/**
 * Manually capture an error
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  sendEvent('error', {
    type: 'captured',
    message: error.message,
    name: error.name,
    stack: extractStackTrace(error),
    ...context,
  });
}

/**
 * Capture a message as an error
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'error', context?: Record<string, unknown>): void {
  sendEvent('error', {
    type: 'message',
    level,
    message,
    ...context,
  });
}
