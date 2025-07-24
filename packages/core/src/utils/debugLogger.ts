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
  }): void {
    if (!this.isEnabled) return;

    this.log(`Request ${requestId} - Starting`);
    this.log(`Request ${requestId} - URL`, config.url);
    
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
}

export const debugLogger = new DebugLogger();