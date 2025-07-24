/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import * as https from 'node:https';
import { Socket } from 'node:net';

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

  logHttpRequest(url: string, method: string, headers: Record<string, string | string[]>): void {
    if (!this.isEnabled) return;

    // Mask sensitive headers for logging
    const maskedHeaders = { ...headers };
    if (maskedHeaders['api-key']) {
      maskedHeaders['api-key'] = '***MASKED***';
    }
    if (maskedHeaders['Authorization']) {
      maskedHeaders['Authorization'] = '***MASKED***';
    }

    this.log('HTTP Agent Intercept', {
      method,
      url,
      headers: maskedHeaders
    });
  }
}

/**
 * Debug HTTPS Agent that logs actual HTTP requests
 */
class DebugHttpsAgent extends https.Agent {
  private logger: DebugLogger;

  constructor(logger: DebugLogger, options?: https.AgentOptions) {
    super(options);
    this.logger = logger;
  }

  // Override the addRequest method to intercept requests
  addRequest(req: any, options: any): void {
    // Log the actual request details before adding to agent
    if (options.host && options.port) {
      const protocol = 'https:';
      const url = `${protocol}//${options.host}:${options.port}${options.path || '/'}`;
      this.logger.logHttpRequest(url, options.method || 'GET', req.getHeaders ? req.getHeaders() : {});
    }

    // Call parent method properly
    const parentAgent = Object.getPrototypeOf(Object.getPrototypeOf(this));
    parentAgent.addRequest.call(this, req, options);
  }
}

/**
 * Debug HTTP Agent that logs actual HTTP requests
 */
class DebugHttpAgent extends http.Agent {
  private logger: DebugLogger;

  constructor(logger: DebugLogger, options?: http.AgentOptions) {
    super(options);
    this.logger = logger;
  }

  // Override the addRequest method to intercept requests
  addRequest(req: any, options: any): void {
    // Log the actual request details before adding to agent
    if (options.host && options.port) {
      const protocol = 'http:';
      const url = `${protocol}//${options.host}:${options.port}${options.path || '/'}`;
      this.logger.logHttpRequest(url, options.method || 'GET', req.getHeaders ? req.getHeaders() : {});
    }

    // Call parent method properly
    const parentAgent = Object.getPrototypeOf(Object.getPrototypeOf(this));
    parentAgent.addRequest.call(this, req, options);
  }
}

export const debugLogger = new DebugLogger();

/**
 * Create debug HTTP agents for intercepting actual requests
 */
export function createDebugHttpAgents() {
  return {
    httpsAgent: new DebugHttpsAgent(debugLogger),
    httpAgent: new DebugHttpAgent(debugLogger)
  };
}