import { Controller } from '@hotwired/stimulus';
import { configure, getConfig, isConfigured, BrainzLabConfig } from '../config';
import { sendEvent, getSessionId, flushEvents } from '../transport';
import { setupErrorTracking, teardownErrorTracking } from '../utils/errors';
import { setupNetworkTracking, teardownNetworkTracking } from '../utils/network';
import { setupPerformanceTracking, teardownPerformanceTracking } from '../utils/performance';
import { setupConsoleTracking, teardownConsoleTracking } from '../utils/console';

/**
 * BrainzLab Stimulus Controller
 *
 * Main controller for initializing BrainzLab monitoring.
 * Add to your application layout to enable full-stack observability.
 *
 * Usage:
 * <body data-controller="brainzlab"
 *       data-brainzlab-endpoint-value="https://platform.brainzlab.ai"
 *       data-brainzlab-api-key-value="your-api-key"
 *       data-brainzlab-environment-value="production">
 */
export default class BrainzlabController extends Controller {
  static values = {
    endpoint: String,
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
    // Build config from data attributes
    const config: BrainzLabConfig = {
      endpoint: this.endpointValue,
      apiKey: this.apiKeyValue,
      projectId: this.projectIdValue,
      environment: this.environmentValue,
      service: this.serviceValue,
      release: this.releaseValue,
      debug: this.debugValue,
      sampleRate: this.sampleRateValue,
      enableErrors: this.enableErrorsValue,
      enableNetwork: this.enableNetworkValue,
      enablePerformance: this.enablePerformanceValue,
      enableConsole: this.enableConsoleValue,
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
