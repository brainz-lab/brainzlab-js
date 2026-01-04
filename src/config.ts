/**
 * BrainzLab JS SDK Configuration
 */
export interface BrainzLabConfig {
  // API endpoint for sending events
  endpoint: string;

  // API key for authentication
  apiKey: string;

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
