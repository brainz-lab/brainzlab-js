/**
 * Transport layer for sending events to BrainzLab products
 *
 * Routes events to the appropriate product endpoint:
 * - error → Reflex
 * - performance, network → Pulse
 * - console → Recall
 * - custom → Signal
 */
import { getConfig, getEndpointForType, getApiKeyForType } from './config';

export type EventType = 'error' | 'network' | 'performance' | 'console' | 'custom';

export interface BrowserEvent {
  type: EventType;
  timestamp: string;
  url: string;
  userAgent: string;
  sessionId: string;
  requestId?: string;
  data: Record<string, unknown>;
}

interface QueuedEvent extends BrowserEvent {
  id: string;
}

// Group events by their target endpoint
interface EventsByEndpoint {
  [endpoint: string]: QueuedEvent[];
}

class Transport {
  private queue: QueuedEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupFlushTimer();
    this.setupBeforeUnload();
  }

  private generateSessionId(): string {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }

  getSessionId(): string {
    return this.sessionId;
  }

  send(type: EventType, data: Record<string, unknown>, requestId?: string): void {
    const config = getConfig();

    // Apply sample rate for performance events
    if (type === 'performance' && Math.random() > (config.sampleRate || 1.0)) {
      return;
    }

    // Check if we have an endpoint for this event type
    const endpoint = getEndpointForType(type);
    if (!endpoint) {
      if (config.debug) {
        console.warn(`[BrainzLab] No endpoint configured for event type: ${type}`);
      }
      return;
    }

    const event: QueuedEvent = {
      id: this.generateEventId(),
      type,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.sessionId,
      requestId,
      data,
    };

    this.queue.push(event);

    if (config.debug) {
      console.log('[BrainzLab] Event queued:', event);
    }

    // Flush if buffer is full
    if (this.queue.length >= (config.maxBufferSize || 50)) {
      this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;

    const config = getConfig();
    const events = [...this.queue];
    this.queue = [];

    // Group events by their target endpoint (only if we have both endpoint and API key)
    const eventsByEndpoint: EventsByEndpoint = {};
    const skippedEvents: QueuedEvent[] = [];

    for (const event of events) {
      const endpoint = getEndpointForType(event.type);
      const apiKey = getApiKeyForType(event.type) || config.apiKey;

      if (!endpoint || !apiKey) {
        skippedEvents.push(event);
        continue;
      }

      if (!eventsByEndpoint[endpoint]) {
        eventsByEndpoint[endpoint] = [];
      }
      eventsByEndpoint[endpoint].push(event);
    }

    if (skippedEvents.length > 0 && config.debug) {
      console.warn(`[BrainzLab] Skipped ${skippedEvents.length} events (no endpoint or API key configured)`);
    }

    // Send to each endpoint independently (don't fail all if one fails)
    const results = await Promise.allSettled(
      Object.entries(eventsByEndpoint).map(([endpoint, endpointEvents]) =>
        this.sendToEndpoint(endpoint, endpointEvents)
      )
    );

    // Check results and re-queue failed events
    const failedEvents: QueuedEvent[] = [];
    let successCount = 0;

    results.forEach((result, index) => {
      const [endpoint, endpointEvents] = Object.entries(eventsByEndpoint)[index];
      if (result.status === 'rejected') {
        failedEvents.push(...endpointEvents);
        if (config.debug) {
          console.error(`[BrainzLab] Failed to send to ${endpoint}:`, result.reason);
        }
      } else {
        successCount += endpointEvents.length;
      }
    });

    if (failedEvents.length > 0) {
      this.queue = [...failedEvents, ...this.queue];
    }

    if (config.debug && successCount > 0) {
      console.log(`[BrainzLab] Flushed ${successCount} events to ${Object.keys(eventsByEndpoint).length} endpoints`);
    }
  }

  private async sendToEndpoint(endpoint: string, events: QueuedEvent[]): Promise<void> {
    const config = getConfig();

    // Get API key for this event type (use first event's type)
    const eventType = events[0]?.type || 'custom';
    const apiKey = getApiKeyForType(eventType) || config.apiKey;

    // Skip if no API key (shouldn't happen since we filter in flush, but just in case)
    if (!apiKey) {
      if (config.debug) {
        console.warn(`[BrainzLab] No API key for event type: ${eventType}, skipping`);
      }
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-BrainzLab-Session': this.sessionId,
      },
      body: JSON.stringify({
        events,
        context: {
          projectId: config.projectId,
          environment: config.environment,
          service: config.service,
          release: config.release,
        },
      }),
      // Use keepalive for beforeunload
      keepalive: true,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  private setupFlushTimer(): void {
    const config = getConfig();
    const interval = config.flushInterval || 5000;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, interval);
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      this.flush();
    });

    // Also flush on visibility change (tab switch, minimize)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// Singleton instance
let transportInstance: Transport | null = null;

export function getTransport(): Transport {
  if (!transportInstance) {
    transportInstance = new Transport();
  }
  return transportInstance;
}

export function sendEvent(type: EventType, data: Record<string, unknown>, requestId?: string): void {
  getTransport().send(type, data, requestId);
}

export function flushEvents(): Promise<void> {
  return getTransport().flush();
}

export function getSessionId(): string {
  return getTransport().getSessionId();
}
