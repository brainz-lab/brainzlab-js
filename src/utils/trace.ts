/**
 * W3C Trace Context support for distributed tracing
 * Links browser events to server-side traces
 *
 * Format: traceparent = version-traceid-spanid-flags
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 */

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  sampled: boolean;
}

// Generate a random hex string of specified length
function randomHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

// Generate a new trace ID (32 hex chars = 128 bits)
export function generateTraceId(): string {
  return randomHex(32);
}

// Generate a new span ID (16 hex chars = 64 bits)
export function generateSpanId(): string {
  return randomHex(16);
}

// Current trace context (set from server config or generated)
let currentContext: TraceContext | null = null;

/**
 * Initialize trace context from server-provided config
 */
export function initTraceContext(config: {
  traceId?: string;
  parentSpanId?: string;
  sampled?: boolean;
}): TraceContext {
  currentContext = {
    traceId: config.traceId || generateTraceId(),
    spanId: generateSpanId(), // Browser gets its own span
    parentSpanId: config.parentSpanId,
    sampled: config.sampled !== false,
  };
  return currentContext;
}

/**
 * Get current trace context
 */
export function getTraceContext(): TraceContext | null {
  return currentContext;
}

/**
 * Create a child span context (for sub-operations)
 */
export function createChildContext(): TraceContext | null {
  if (!currentContext) return null;

  return {
    traceId: currentContext.traceId,
    spanId: generateSpanId(),
    parentSpanId: currentContext.spanId,
    sampled: currentContext.sampled,
  };
}

/**
 * Format trace context as W3C traceparent header
 * Format: version-traceid-spanid-flags
 */
export function formatTraceparent(ctx?: TraceContext): string | null {
  const context = ctx || currentContext;
  if (!context) return null;

  const version = '00';
  const flags = context.sampled ? '01' : '00';
  return `${version}-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Parse W3C traceparent header
 */
export function parseTraceparent(header: string): TraceContext | null {
  const parts = header.split('-');
  if (parts.length < 4) return null;

  const [version, traceId, spanId, flags] = parts;

  // Validate version
  if (version !== '00') return null;

  // Validate trace ID (32 hex chars)
  if (!/^[a-f0-9]{32}$/i.test(traceId)) return null;
  if (traceId === '0'.repeat(32)) return null;

  // Validate span ID (16 hex chars)
  if (!/^[a-f0-9]{16}$/i.test(spanId)) return null;
  if (spanId === '0'.repeat(16)) return null;

  const sampled = (parseInt(flags, 16) & 0x01) === 1;

  return {
    traceId,
    spanId,
    parentSpanId: undefined,
    sampled,
  };
}

/**
 * Get headers to inject into outgoing requests
 */
export function getTraceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  const traceparent = formatTraceparent();
  if (traceparent) {
    headers['traceparent'] = traceparent;
  }

  return headers;
}
