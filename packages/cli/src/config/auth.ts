/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
import { loadEnvironment } from './settings.js';

export const validateAuthMethod = (authMethod: string): string | null => {
  loadEnvironment();
  if (
    authMethod === AuthType.LOGIN_WITH_GOOGLE ||
    authMethod === AuthType.CLOUD_SHELL
  ) {
    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    if (!process.env.GEMINI_API_KEY) {
      return 'GEMINI_API_KEY environment variable not found. Add that to your environment and try again (no reload needed if using .env)!';
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const hasVertexProjectLocationConfig =
      !!process.env.GOOGLE_CLOUD_PROJECT && !!process.env.GOOGLE_CLOUD_LOCATION;
    const hasGoogleApiKey = !!process.env.GOOGLE_API_KEY;
    if (!hasVertexProjectLocationConfig && !hasGoogleApiKey) {
      return (
        'When using Vertex AI, you must specify either:\n' +
        '• GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION environment variables.\n' +
        '• GOOGLE_API_KEY environment variable (if using express mode).\n' +
        'Update your environment and try again (no reload needed if using .env)!'
      );
    }
    return null;
  }

  if (authMethod === AuthType.USE_OPENAI) {
    if (!process.env.OPENAI_API_KEY) {
      return 'OPENAI_API_KEY environment variable not found. You can enter it interactively or add it to your .env file.';
    }
    return null;
  }

  if (authMethod === AuthType.USE_AZURE_OPENAI) {
    const requiredVars = [];
    if (!process.env.AZURE_OPENAI_ENDPOINT)
      requiredVars.push('AZURE_OPENAI_ENDPOINT');
    if (!process.env.AZURE_OPENAI_DEPLOYMENT_NAME)
      requiredVars.push('AZURE_OPENAI_DEPLOYMENT_NAME');

    // Check for either API key or AD token
    const hasApiKey = !!process.env.AZURE_OPENAI_API_KEY;
    const hasAdToken = !!process.env.AZURE_OPENAI_AD_TOKEN;

    if (!hasApiKey && !hasAdToken) {
      requiredVars.push('AZURE_OPENAI_API_KEY or AZURE_OPENAI_AD_TOKEN');
    }

    if (requiredVars.length > 0) {
      return `Azure OpenAI configuration incomplete. Missing: ${requiredVars.join(', ')}. Add these to your environment and try again.`;
    }
    return null;
  }

  if (authMethod === AuthType.USE_APIM_OPENAI) {
    const requiredVars = [];
    if (!process.env.APIM_ENDPOINT) requiredVars.push('APIM_ENDPOINT');
    if (!process.env.APIM_SUBSCRIPTION_KEY)
      requiredVars.push('APIM_SUBSCRIPTION_KEY');
    if (!process.env.APIM_DEPLOYMENT_NAME)
      requiredVars.push('APIM_DEPLOYMENT_NAME');

    if (requiredVars.length > 0) {
      return `APIM configuration incomplete. Missing: ${requiredVars.join(', ')}. Add these to your environment and try again. Note: APIM_SUBSCRIPTION_KEY should be your API key that APIM forwards to Azure OpenAI.`;
    }
    return null;
  }

  return 'Invalid auth method selected.';
};

export const setOpenAIApiKey = (apiKey: string): void => {
  process.env.OPENAI_API_KEY = apiKey;
};

export const setOpenAIBaseUrl = (baseUrl: string): void => {
  process.env.OPENAI_BASE_URL = baseUrl;
};

export const setOpenAIModel = (model: string): void => {
  process.env.OPENAI_MODEL = model;
};

export const setAzureOpenAIConfig = (config: {
  endpoint: string;
  apiKey?: string;
  adToken?: string;
  deploymentName: string;
  apiVersion?: string;
}): void => {
  process.env.AZURE_OPENAI_ENDPOINT = config.endpoint;
  if (config.apiKey) {
    process.env.AZURE_OPENAI_API_KEY = config.apiKey;
  }
  if (config.adToken) {
    process.env.AZURE_OPENAI_AD_TOKEN = config.adToken;
  }
  process.env.AZURE_OPENAI_DEPLOYMENT_NAME = config.deploymentName;
  if (config.apiVersion) {
    process.env.AZURE_OPENAI_API_VERSION = config.apiVersion;
  }
};

export const setApimOpenAIConfig = (config: {
  endpoint: string;
  subscriptionKey: string;
  deploymentName: string;
  apiVersion?: string;
}): void => {
  process.env.APIM_ENDPOINT = config.endpoint;
  process.env.APIM_SUBSCRIPTION_KEY = config.subscriptionKey;
  process.env.APIM_DEPLOYMENT_NAME = config.deploymentName;
  if (config.apiVersion) {
    process.env.APIM_API_VERSION = config.apiVersion;
  }
};
