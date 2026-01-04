# @brainzlab/js

JavaScript SDK for BrainzLab - Full-stack observability for JavaScript/TypeScript applications with Stimulus controllers.

## Installation

```bash
npm install @brainzlab/js
# or
yarn add @brainzlab/js
```

## Usage with Stimulus (Rails)

### 1. Register the controller

```javascript
// app/javascript/controllers/index.js
import { application } from "./application"
import { BrainzlabController } from "@brainzlab/js"

application.register("brainzlab", BrainzlabController)
```

### 2. Add to your layout

```erb
<body data-controller="brainzlab"
      data-brainzlab-endpoint-value="<%= ENV['BRAINZLAB_PLATFORM_URL'] %>"
      data-brainzlab-api-key-value="<%= ENV['BRAINZLAB_API_KEY'] %>"
      data-brainzlab-environment-value="<%= Rails.env %>"
      data-brainzlab-service-value="my-app"
      data-brainzlab-debug-value="<%= Rails.env.development? %>">
```

## Configuration Options

| Data Attribute | Description | Default |
|----------------|-------------|---------|
| `endpoint-value` | BrainzLab API endpoint | Required |
| `api-key-value` | Your BrainzLab API key | Required |
| `environment-value` | Environment name | `production` |
| `service-value` | Service/app name | - |
| `release-value` | Release/version | - |
| `debug-value` | Enable debug logging | `false` |
| `sample-rate-value` | Performance event sample rate (0-1) | `1.0` |
| `enable-errors-value` | Track JavaScript errors | `true` |
| `enable-network-value` | Track fetch/XHR requests | `true` |
| `enable-performance-value` | Track Web Vitals | `true` |
| `enable-console-value` | Track console output | `true` |

## Standalone Usage

```javascript
import { init } from "@brainzlab/js"

init({
  endpoint: "https://platform.brainzlab.ai",
  apiKey: "your-api-key",
  environment: "production",
  service: "my-app",
  debug: false,
})
```

## Features

### Error Tracking
- Captures `window.onerror` events
- Captures unhandled promise rejections
- Manual error capture with `captureError(error)`

### Network Monitoring
- Intercepts `fetch()` requests
- Intercepts `XMLHttpRequest` requests
- Tracks request duration, status, and errors

### Performance Monitoring
- Core Web Vitals (LCP, FID, CLS, INP)
- Navigation timing (TTFB, FCP)
- Long task detection
- Slow resource detection

### Console Tracking
- Captures `console.log`, `console.warn`, `console.error`
- Truncates long messages automatically

## Manual Event Tracking

```javascript
// Track custom events via Stimulus actions
<button data-action="brainzlab#track"
        data-brainzlab-name-param="button_click"
        data-brainzlab-button-param="signup">
  Sign Up
</button>

// Track page views (useful for SPA)
<div data-action="turbo:load->brainzlab#pageView"></div>

// Identify users
<div data-controller="brainzlab"
     data-action="login:success->brainzlab#identify"
     data-brainzlab-user-id-param="123"
     data-brainzlab-traits-param='{"email":"user@example.com"}'>
</div>
```

## License

MIT
