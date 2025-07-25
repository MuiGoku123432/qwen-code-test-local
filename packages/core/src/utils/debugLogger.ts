/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

class DebugLogger {
  private logFile: string;
  private isEnabled: boolean;

  constructor() {
    this.logFile = path.join(process.cwd(), 'qwen-debug.log');
    this.isEnabled = process.env.APIM_DEBUG === 'true';
  }

  private formatTimestamp(): string {
    return new Date().toISOString().replace('T', ' ').replace('Z', '');
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  log(message: string, data?: any): void {
    if (!this.isEnabled) return;

    try {
      const timestamp = this.formatTimestamp();
      let logEntry = `[${timestamp}] APIM_DEBUG - ${message}`;
      
      if (data !== undefined) {
        if (typeof data === 'object') {
          logEntry += ` - ${JSON.stringify(data, null, 2)}`;
        } else {
          logEntry += ` - ${data}`;
        }
      }
      
      logEntry += '\n';

      fs.appendFileSync(this.logFile, logEntry, 'utf8');
    } catch (error) {
      // Don't let logging errors break the application
      console.error('Debug logging error:', error);
    }
  }

  logRequest(requestId: string, config: {
    url: string;
    headers: Record<string, string>;
    body?: any;
    clientConfig?: any;
    baseURL?: string;
    fullURL?: string;
    defaultQuery?: Record<string, string>;
  }): void {
    if (!this.isEnabled) return;

    this.log(`Request ${requestId} - Starting`);
    
    // Log base URL and full URL separately for clarity
    if (config.baseURL) {
      this.log(`Request ${requestId} - Base URL`, config.baseURL);
    }
    if (config.fullURL) {
      this.log(`Request ${requestId} - Full URL`, config.fullURL);
    } else {
      this.log(`Request ${requestId} - URL`, config.url);
    }
    
    // Log default query parameters separately
    if (config.defaultQuery) {
      this.log(`Request ${requestId} - Default Query Parameters`, config.defaultQuery);
    }
    
    // Mask sensitive headers for logging
    const maskedHeaders = { ...config.headers };
    if (maskedHeaders['api-key']) {
      maskedHeaders['api-key'] = '***MASKED***';
    }
    if (maskedHeaders['Authorization']) {
      maskedHeaders['Authorization'] = '***MASKED***';
    }
    
    this.log(`Request ${requestId} - Headers`, maskedHeaders);
    
    if (config.body) {
      this.log(`Request ${requestId} - Body`, config.body);
    }
    
    if (config.clientConfig) {
      const maskedClientConfig = { ...config.clientConfig };
      if (maskedClientConfig.apiKey) {
        maskedClientConfig.apiKey = '***MASKED***';
      }
      this.log(`Request ${requestId} - Client Config`, maskedClientConfig);
    }
  }

  logError(requestId: string, error: any): void {
    if (!this.isEnabled) return;

    this.log(`Request ${requestId} - Error`, {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      cause: error.cause
    });
  }

  logResponse(requestId: string, response: {
    status?: number;
    headers?: any;
    data?: any;
    duration?: number;
  }): void {
    if (!this.isEnabled) return;

    this.log(`Request ${requestId} - Response`, {
      status: response.status,
      headers: response.headers,
      dataPreview: response.data ? JSON.stringify(response.data).substring(0, 200) + '...' : undefined,
      duration: response.duration
    });
  }

  createRequestId(): string {
    return this.generateRequestId();
  }

  isDebugEnabled(): boolean {
    return this.isEnabled;
  }

  logFetchRequest(url: string, method: string, headers: Record<string, string | string[]>, body?: any): void {
    if (!this.isEnabled) return;

    // Mask sensitive headers for logging
    const maskedHeaders = { ...headers };
    if (maskedHeaders['api-key']) {
      maskedHeaders['api-key'] = '***MASKED***';
    }
    if (maskedHeaders['Authorization']) {
      maskedHeaders['Authorization'] = '***MASKED***';
    }

    this.log('Fetch Intercept', {
      method,
      url,
      headers: maskedHeaders,
      bodyPreview: body ? JSON.stringify(body).substring(0, 200) + '...' : undefined
    });
  }
}

/**
 * Debug Fetch Wrapper that intercepts fetch calls to log actual HTTP requests
 */
class DebugFetchWrapper {
  private logger: DebugLogger;
  private originalFetch: typeof fetch;
  private isIntercepting: boolean = false;

  constructor(logger: DebugLogger) {
    this.logger = logger;
    this.originalFetch = globalThis.fetch;
  }

  /**
   * Create a debug fetch function that logs and delegates to original fetch
   */
  private createDebugFetch(): typeof fetch {
    return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = input instanceof URL ? input.toString() : input instanceof Request ? input.url : input;
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      
      // Extract headers
      let headers: Record<string, string> = {};
      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value, key) => {
            headers[key] = value;
          });
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, value]) => {
            headers[key] = value;
          });
        } else {
          headers = { ...init.headers as Record<string, string> };
        }
      } else if (input instanceof Request) {
        input.headers.forEach((value, key) => {
          headers[key] = value;
        });
      }

      // Parse body if present
      let body: any;
      if (init?.body) {
        try {
          if (typeof init.body === 'string') {
            body = JSON.parse(init.body);
          } else {
            body = init.body;
          }
        } catch {
          body = init.body;
        }
      }

      // Log the request
      this.logger.logFetchRequest(url, method, headers, body);

      // Call original fetch
      return this.originalFetch(input, init);
    };
  }

  /**
   * Temporarily replace global fetch with debug version
   */
  startInterception(): void {
    if (this.isIntercepting) return;
    
    this.isIntercepting = true;
    globalThis.fetch = this.createDebugFetch();
    this.logger.log('Fetch interception started');
  }

  /**
   * Restore original fetch
   */
  stopInterception(): void {
    if (!this.isIntercepting) return;
    
    globalThis.fetch = this.originalFetch;
    this.isIntercepting = false;
    this.logger.log('Fetch interception stopped');
  }

  /**
   * Execute a function with fetch interception enabled
   */
  async withInterception<T>(fn: () => Promise<T>): Promise<T> {
    this.startInterception();
    try {
      return await fn();
    } finally {
      this.stopInterception();
    }
  }
}


export const debugLogger = new DebugLogger();

/**
 * Create debug fetch wrapper for intercepting actual HTTP requests
 */
export function createDebugFetchWrapper() {
  return new DebugFetchWrapper(debugLogger);
}