/**
 * Performance Monitoring Module
 * Captures Web Vitals and other performance metrics
 */
import { sendEvent } from '../transport';
import { getConfig } from '../config';

let performanceObserver: PerformanceObserver | null = null;

interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Get rating for Core Web Vitals metrics
 */
function getVitalRating(
  name: string,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const thresholds: Record<string, [number, number]> = {
    // [good threshold, poor threshold]
    LCP: [2500, 4000],
    FID: [100, 300],
    CLS: [0.1, 0.25],
    FCP: [1800, 3000],
    TTFB: [800, 1800],
    INP: [200, 500],
  };

  const [good, poor] = thresholds[name] || [1000, 3000];

  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report a Web Vital metric
 */
function reportVital(metric: WebVitalsMetric): void {
  sendEvent('performance', {
    type: 'web_vital',
    metric: metric.name,
    value: metric.value,
    rating: metric.rating,
  });

  const config = getConfig();
  if (config.debug) {
    console.log(`[BrainzLab] ${metric.name}: ${metric.value} (${metric.rating})`);
  }
}

/**
 * Observe Largest Contentful Paint (LCP)
 */
function observeLCP(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };

      if (lastEntry) {
        const value = lastEntry.startTime;
        reportVital({
          name: 'LCP',
          value,
          rating: getVitalRating('LCP', value),
        });
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (e) {
    // LCP not supported
  }
}

/**
 * Observe First Input Delay (FID)
 */
function observeFID(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as (PerformanceEntry & {
        processingStart: number;
        startTime: number;
      })[];

      for (const entry of entries) {
        const value = entry.processingStart - entry.startTime;
        reportVital({
          name: 'FID',
          value,
          rating: getVitalRating('FID', value),
        });
      }
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (e) {
    // FID not supported
  }
}

/**
 * Observe Cumulative Layout Shift (CLS)
 */
function observeCLS(): void {
  if (!('PerformanceObserver' in window)) return;

  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[];

      for (const entry of entries) {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      }
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    // Report CLS when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && clsValue > 0) {
        reportVital({
          name: 'CLS',
          value: clsValue,
          rating: getVitalRating('CLS', clsValue),
        });
      }
    });
  } catch (e) {
    // CLS not supported
  }
}

/**
 * Observe Interaction to Next Paint (INP)
 */
function observeINP(): void {
  if (!('PerformanceObserver' in window)) return;

  const interactions: number[] = [];

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as (PerformanceEntry & {
        duration: number;
        interactionId: number;
      })[];

      for (const entry of entries) {
        if (entry.interactionId) {
          interactions.push(entry.duration);
        }
      }
    });

    observer.observe({ type: 'event', buffered: true });

    // Report INP when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && interactions.length > 0) {
        // INP is the 98th percentile of interactions
        interactions.sort((a, b) => a - b);
        const index = Math.min(
          interactions.length - 1,
          Math.floor(interactions.length * 0.98)
        );
        const value = interactions[index];

        reportVital({
          name: 'INP',
          value,
          rating: getVitalRating('INP', value),
        });
      }
    });
  } catch (e) {
    // INP not supported
  }
}

/**
 * Capture navigation timing metrics
 */
function captureNavigationTiming(): void {
  if (!window.performance?.timing) return;

  // Wait for page load to complete
  window.addEventListener('load', () => {
    // Use setTimeout to ensure all timing data is available
    setTimeout(() => {
      const timing = performance.timing;
      const navigation = performance.getEntriesByType(
        'navigation'
      )[0] as PerformanceNavigationTiming;

      if (navigation) {
        // Time to First Byte
        const ttfb = navigation.responseStart - navigation.requestStart;
        if (ttfb > 0) {
          reportVital({
            name: 'TTFB',
            value: ttfb,
            rating: getVitalRating('TTFB', ttfb),
          });
        }

        // First Contentful Paint
        const fcpEntries = performance.getEntriesByName('first-contentful-paint');
        if (fcpEntries.length > 0) {
          const fcp = fcpEntries[0].startTime;
          reportVital({
            name: 'FCP',
            value: fcp,
            rating: getVitalRating('FCP', fcp),
          });
        }

        // Send full navigation timing
        sendEvent('performance', {
          type: 'navigation',
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          tcp: navigation.connectEnd - navigation.connectStart,
          ssl:
            navigation.secureConnectionStart > 0
              ? navigation.connectEnd - navigation.secureConnectionStart
              : 0,
          ttfb,
          download: navigation.responseEnd - navigation.responseStart,
          domParsing: navigation.domInteractive - navigation.responseEnd,
          domInteractive: navigation.domInteractive,
          domComplete: navigation.domComplete,
          loadEvent: navigation.loadEventEnd - navigation.loadEventStart,
          totalDuration: navigation.loadEventEnd - navigation.fetchStart,
        });
      }
    }, 0);
  });
}

/**
 * Observe long tasks (blocking the main thread > 50ms)
 */
function observeLongTasks(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();

      for (const entry of entries) {
        sendEvent('performance', {
          type: 'long_task',
          duration_ms: entry.duration,
          startTime: entry.startTime,
          name: entry.name,
        });
      }
    });

    observer.observe({ type: 'longtask', buffered: true });
    performanceObserver = observer;
  } catch (e) {
    // Long tasks not supported
  }
}

/**
 * Track resource loading performance
 */
function observeResources(): void {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries() as PerformanceResourceTiming[];
      const config = getConfig();

      for (const entry of entries) {
        // Skip very small resources and brainzlab endpoints
        if (entry.duration < 10) continue;

        // Skip our own endpoints
        let isOwnEndpoint = false;
        if (config.endpoint && entry.name.includes(config.endpoint)) {
          isOwnEndpoint = true;
        }
        if (config.endpoints) {
          const endpoints = Object.values(config.endpoints).filter(Boolean) as string[];
          for (const endpoint of endpoints) {
            if (entry.name.includes(endpoint)) {
              isOwnEndpoint = true;
              break;
            }
          }
        }
        if (isOwnEndpoint) continue;

        // Only report slow resources (> 500ms)
        if (entry.duration > 500) {
          sendEvent('performance', {
            type: 'slow_resource',
            name: entry.name,
            initiatorType: entry.initiatorType,
            duration_ms: entry.duration,
            transferSize: entry.transferSize,
            decodedBodySize: entry.decodedBodySize,
          });
        }
      }
    });

    observer.observe({ type: 'resource', buffered: true });
  } catch (e) {
    // Resource timing not supported
  }
}

export function setupPerformanceTracking(): void {
  // Core Web Vitals
  observeLCP();
  observeFID();
  observeCLS();
  observeINP();

  // Navigation timing
  captureNavigationTiming();

  // Additional performance metrics
  observeLongTasks();
  observeResources();

  const config = getConfig();
  if (config.debug) {
    console.log('[BrainzLab] Performance tracking enabled');
  }
}

export function teardownPerformanceTracking(): void {
  if (performanceObserver) {
    performanceObserver.disconnect();
    performanceObserver = null;
  }
}
