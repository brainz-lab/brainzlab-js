/**
 * BrainzLab JS SDK Configuration
 */

export interface ProductEndpoints {
  // Reflex: Error tracking
  errors?: string;

  // Pulse: Performance and network monitoring
  performance?: string;
  network?: string;

  // Recall: Console/log capture
  console?: string;

  // Signal: Custom events/analytics
  custom?: string;
}

export interface ProductApiKeys {
  // Per-product API keys (secure ingest keys)
  errors?: string;
  performance?: string;
  network?: string;
  console?: string;
  custom?: string;
}

export interface BrainzLabConfig {
  // Product-specific endpoints (preferred)
  endpoints?: ProductEndpoints;

  // Product-specific API keys (preferred - use ingest keys)
  apiKeys?: ProductApiKeys;

  // Fallback single endpoint (legacy/Platform mode)
  endpoint?: string;

  // Fallback API key for authentication (legacy)
  apiKey?: string;

  // Project identifier
  projectId?: string;

  // Environment (production, staging, development)
  environment?: string;

  // Application/service name
  service?: string;

  // Release/version identifier
  release?: string;

  // Enable debug logging
  debug?: boolean;

  // Sample rate for performance events (0.0 - 1.0)
  sampleRate?: number;

  // Enable error tracking
  enableErrors?: boolean;

  // Enable network monitoring
  enableNetwork?: boolean;

  // Enable performance monitoring
  enablePerformance?: boolean;

  // Enable console capture
  enableConsole?: boolean;

  // URLs to ignore for network monitoring
  ignoreUrls?: (string | RegExp)[];

  // Error patterns to ignore
  ignoreErrors?: (string | RegExp)[];

  // Maximum events to buffer before sending
  maxBufferSize?: number;

  // Flush interval in milliseconds
  flushInterval?: number;
}

export const defaultConfig: Partial<BrainzLabConfig> = {
  environment: 'production',
  debug: false,
  sampleRate: 1.0,
  enableErrors: true,
  enableNetwork: true,
  enablePerformance: true,
  enableConsole: true,
  ignoreUrls: [],
  ignoreErrors: [],
  maxBufferSize: 50,
  flushInterval: 5000,
};

let globalConfig: BrainzLabConfig | null = null;

export function configure(config: BrainzLabConfig): void {
  globalConfig = { ...defaultConfig, ...config };

  if (globalConfig.debug) {
    console.log('[BrainzLab] Configured:', globalConfig);
  }
}

export function getConfig(): BrainzLabConfig {
  if (!globalConfig) {
    throw new Error('[BrainzLab] SDK not configured. Call BrainzLab.configure() first.');
  }
  return globalConfig;
}

export function isConfigured(): boolean {
  return globalConfig !== null;
}

/**
 * Get the endpoint for a specific event type
 */
export function getEndpointForType(type: 'error' | 'performance' | 'network' | 'console' | 'custom'): string | null {
  const config = getConfig();

  // Check product-specific endpoints first
  if (config.endpoints) {
    switch (type) {
      case 'error':
        if (config.endpoints.errors) return config.endpoints.errors;
        break;
      case 'performance':
        if (config.endpoints.performance) return config.endpoints.performance;
        break;
      case 'network':
        if (config.endpoints.network) return config.endpoints.network;
        break;
      case 'console':
        if (config.endpoints.console) return config.endpoints.console;
        break;
      case 'custom':
        if (config.endpoints.custom) return config.endpoints.custom;
        break;
    }
  }

  // Fall back to single endpoint (Platform mode)
  if (config.endpoint) {
    return `${config.endpoint}/api/v1/browser`;
  }

  return null;
}

/**
 * Get the API key for a specific event type
 */
export function getApiKeyForType(type: 'error' | 'performance' | 'network' | 'console' | 'custom'): string | null {
  const config = getConfig();

  // Check product-specific API keys first
  if (config.apiKeys) {
    switch (type) {
      case 'error':
        if (config.apiKeys.errors) return config.apiKeys.errors;
        break;
      case 'performance':
        if (config.apiKeys.performance) return config.apiKeys.performance;
        break;
      case 'network':
        if (config.apiKeys.network) return config.apiKeys.network;
        break;
      case 'console':
        if (config.apiKeys.console) return config.apiKeys.console;
        break;
      case 'custom':
        if (config.apiKeys.custom) return config.apiKeys.custom;
        break;
    }
  }

  // Fall back to single API key
  return config.apiKey || null;
}
