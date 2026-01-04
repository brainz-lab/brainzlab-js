/**
 * Console Tracking Module
 * Captures console.log, console.warn, console.error output
 */
import { sendEvent } from '../transport';
import { getConfig } from '../config';

type ConsoleMethod = 'log' | 'info' | 'warn' | 'error' | 'debug';

const originalMethods: Partial<Record<ConsoleMethod, typeof console.log>> = {};

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
      if (arg instanceof Error) {
        return `${arg.name}: ${arg.message}`;
      }
      try {
        return JSON.stringify(arg, null, 0);
      } catch {
        return String(arg);
      }
    })
    .join(' ');
}

function wrapConsoleMethod(method: ConsoleMethod): void {
  const original = console[method];
  originalMethods[method] = original;

  console[method] = function (...args: unknown[]): void {
    const config = getConfig();

    // Skip our own debug messages
    const message = formatArgs(args);
    if (message.startsWith('[BrainzLab]')) {
      return original.apply(console, args);
    }

    // Truncate very long messages
    const truncatedMessage =
      message.length > 1000 ? message.substring(0, 1000) + '...' : message;

    sendEvent('console', {
      level: method,
      message: truncatedMessage,
      args: args.length > 1 ? args.slice(1) : undefined,
    });

    // Call original method
    return original.apply(console, args);
  };
}

export function setupConsoleTracking(): void {
  const methodsToTrack: ConsoleMethod[] = ['log', 'info', 'warn', 'error', 'debug'];

  for (const method of methodsToTrack) {
    wrapConsoleMethod(method);
  }

  const config = getConfig();
  if (config.debug) {
    console.log('[BrainzLab] Console tracking enabled');
  }
}

export function teardownConsoleTracking(): void {
  for (const [method, original] of Object.entries(originalMethods)) {
    if (original) {
      console[method as ConsoleMethod] = original;
    }
  }
}
