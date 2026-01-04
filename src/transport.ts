/**
 * Transport layer for sending events to BrainzLab API
 */
import { getConfig } from './config';

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

    try {
      const response = await fetch(`${config.endpoint}/api/v1/browser`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
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

      if (config.debug) {
        console.log(`[BrainzLab] Flushed ${events.length} events`);
      }
    } catch (error) {
      // Re-queue events on failure
      this.queue = [...events, ...this.queue];

      if (config.debug) {
        console.error('[BrainzLab] Flush failed:', error);
      }
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
