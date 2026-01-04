import { Controller } from '@hotwired/stimulus';
import { configure, getConfig, BrainzLabConfig, ProductEndpoints } from '../config';
import { sendEvent, getSessionId, flushEvents } from '../transport';
import { setupErrorTracking, teardownErrorTracking } from '../utils/errors';
import { setupNetworkTracking, teardownNetworkTracking } from '../utils/network';
import { setupPerformanceTracking, teardownPerformanceTracking } from '../utils/performance';
import { setupConsoleTracking, teardownConsoleTracking } from '../utils/console';

// Extend Window to include BrainzLabConfig
declare global {
  interface Window {
    BrainzLabConfig?: Partial<BrainzLabConfig> & {
      endpoints?: ProductEndpoints;
    };
  }
}

/**
 * BrainzLab Stimulus Controller
 *
 * Main controller for initializing BrainzLab monitoring.
 * Add to your application layout to enable full-stack observability.
 *
 * Configuration can come from:
 * 1. window.BrainzLabConfig (set by brainzlab_js_config helper)
 * 2. Data attributes on the element
 *
 * Usage with Ruby helper (recommended):
 *   <%= brainzlab_js_config %>
 *   <body data-controller="brainzlab">
 *
 * Usage with data attributes:
 *   <body data-controller="brainzlab"
 *         data-brainzlab-reflex-endpoint-value="http://localhost:4003/api/v1/browser"
 *         data-brainzlab-pulse-endpoint-value="http://localhost:4004/api/v1/browser"
 *         data-brainzlab-api-key-value="your-api-key">
 */
export default class BrainzlabController extends Controller {
  static values = {
    // Legacy single endpoint (Platform mode)
    endpoint: String,

    // Product-specific endpoints
    reflexEndpoint: String,   // errors → Reflex
    pulseEndpoint: String,    // performance, network → Pulse
    recallEndpoint: String,   // console → Recall
    signalEndpoint: String,   // custom → Signal

    // Common config
    apiKey: String,
    projectId: String,
    environment: { type: String, default: 'production' },
    service: String,
    release: String,
    debug: { type: Boolean, default: false },
    sampleRate: { type: Number, default: 1.0 },
    enableErrors: { type: Boolean, default: true },
    enableNetwork: { type: Boolean, default: true },
    enablePerformance: { type: Boolean, default: true },
    enableConsole: { type: Boolean, default: true },
  };

  declare endpointValue: string;
  declare reflexEndpointValue: string;
  declare pulseEndpointValue: string;
  declare recallEndpointValue: string;
  declare signalEndpointValue: string;
  declare apiKeyValue: string;
  declare projectIdValue: string;
  declare environmentValue: string;
  declare serviceValue: string;
  declare releaseValue: string;
  declare debugValue: boolean;
  declare sampleRateValue: number;
  declare enableErrorsValue: boolean;
  declare enableNetworkValue: boolean;
  declare enablePerformanceValue: boolean;
  declare enableConsoleValue: boolean;

  connect(): void {
    this.initializeBrainzLab();
  }

  disconnect(): void {
    this.teardownBrainzLab();
  }

  private initializeBrainzLab(): void {
    // Start with window config if available (from brainzlab_js_config helper)
    const windowConfig = window.BrainzLabConfig || {};

    // Build endpoints from data attributes or window config
    const endpoints: ProductEndpoints = windowConfig.endpoints || {};

    // Override with data attributes if provided
    if (this.reflexEndpointValue) {
      endpoints.errors = this.reflexEndpointValue;
    }
    if (this.pulseEndpointValue) {
      endpoints.performance = this.pulseEndpointValue;
      endpoints.network = this.pulseEndpointValue;
    }
    if (this.recallEndpointValue) {
      endpoints.console = this.recallEndpointValue;
    }
    if (this.signalEndpointValue) {
      endpoints.custom = this.signalEndpointValue;
    }

    // Build config, preferring data attributes over window config
    const config: BrainzLabConfig = {
      // Use endpoints if any are configured, otherwise fall back to single endpoint
      endpoints: Object.keys(endpoints).length > 0 ? endpoints : undefined,
      endpoint: this.endpointValue || windowConfig.endpoint,

      apiKey: this.apiKeyValue || windowConfig.apiKey || '',
      projectId: this.projectIdValue || windowConfig.projectId,
      environment: this.environmentValue || windowConfig.environment || 'production',
      service: this.serviceValue || windowConfig.service,
      release: this.releaseValue || windowConfig.release,
      debug: this.debugValue || windowConfig.debug || false,
      sampleRate: this.sampleRateValue || windowConfig.sampleRate || 1.0,
      enableErrors: this.hasValue('enableErrors') ? this.enableErrorsValue : (windowConfig.enableErrors ?? true),
      enableNetwork: this.hasValue('enableNetwork') ? this.enableNetworkValue : (windowConfig.enableNetwork ?? true),
      enablePerformance: this.hasValue('enablePerformance') ? this.enablePerformanceValue : (windowConfig.enablePerformance ?? true),
      enableConsole: this.hasValue('enableConsole') ? this.enableConsoleValue : (windowConfig.enableConsole ?? true),
    };

    // Initialize SDK
    configure(config);

    // Setup monitoring modules
    if (config.enableErrors) {
      setupErrorTracking();
    }

    if (config.enableNetwork) {
      setupNetworkTracking();
    }

    if (config.enablePerformance) {
      setupPerformanceTracking();
    }

    if (config.enableConsole) {
      setupConsoleTracking();
    }

    // Send session start event
    sendEvent('custom', {
      name: 'session.start',
      sessionId: getSessionId(),
      referrer: document.referrer,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    if (config.debug) {
      console.log('[BrainzLab] Initialized with session:', getSessionId());
    }
  }

  private hasValue(name: string): boolean {
    return this.element.hasAttribute(`data-brainzlab-${name.replace(/([A-Z])/g, '-$1').toLowerCase()}-value`);
  }

  private teardownBrainzLab(): void {
    // Flush any pending events
    flushEvents();

    // Teardown monitoring modules
    teardownErrorTracking();
    teardownNetworkTracking();
    teardownPerformanceTracking();
    teardownConsoleTracking();
  }

  // Public methods for manual event tracking

  /**
   * Track a custom event
   */
  track(event: CustomEvent): void {
    const { name, ...data } = event.detail;
    sendEvent('custom', { name, ...data });
  }

  /**
   * Track page view (useful for SPA navigation)
   */
  pageView(event?: CustomEvent): void {
    sendEvent('custom', {
      name: 'page.view',
      path: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      ...(event?.detail || {}),
    });
  }

  /**
   * Identify user
   */
  identify(event: CustomEvent): void {
    const { userId, traits } = event.detail;
    sendEvent('custom', {
      name: 'user.identify',
      userId,
      traits,
    });
  }

  /**
   * Track user interaction
   */
  interaction(event: CustomEvent): void {
    const { action, element, value } = event.detail;
    sendEvent('custom', {
      name: 'user.interaction',
      action,
      element,
      value,
    });
  }
}
