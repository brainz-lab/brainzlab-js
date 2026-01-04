/**
 * BrainzLab JavaScript SDK
 * Full-stack observability for JavaScript/TypeScript applications
 */

// Configuration
export {
  configure,
  getConfig,
  isConfigured,
  type BrainzLabConfig,
} from './config';

// Transport
export {
  sendEvent,
  flushEvents,
  getSessionId,
  type EventType,
  type BrowserEvent,
} from './transport';

// Error tracking
export {
  setupErrorTracking,
  teardownErrorTracking,
  captureError,
  captureMessage,
} from './utils/errors';

// Network monitoring
export {
  setupNetworkTracking,
  teardownNetworkTracking,
} from './utils/network';

// Performance monitoring
export {
  setupPerformanceTracking,
  teardownPerformanceTracking,
} from './utils/performance';

// Console tracking
export {
  setupConsoleTracking,
  teardownConsoleTracking,
} from './utils/console';

// Stimulus Controller
export { default as BrainzlabController } from './controllers/brainzlab_controller';

/**
 * Initialize BrainzLab with all monitoring features
 */
import { configure, type BrainzLabConfig } from './config';
import { sendEvent, getSessionId } from './transport';
import { setupErrorTracking } from './utils/errors';
import { setupNetworkTracking } from './utils/network';
import { setupPerformanceTracking } from './utils/performance';
import { setupConsoleTracking } from './utils/console';

export function init(config: BrainzLabConfig): void {
  configure(config);

  if (config.enableErrors !== false) {
    setupErrorTracking();
  }

  if (config.enableNetwork !== false) {
    setupNetworkTracking();
  }

  if (config.enablePerformance !== false) {
    setupPerformanceTracking();
  }

  if (config.enableConsole !== false) {
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

// Default export
export default {
  init,
  configure,
  getSessionId,
  sendEvent,
  flushEvents,
  captureError: () => import('./utils/errors').then((m) => m.captureError),
  captureMessage: () => import('./utils/errors').then((m) => m.captureMessage),
};
