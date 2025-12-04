/**
 * Helper для генерации CURL команд и улучшенных сообщений об ошибках в API тестах
 */

import { AxiosResponse, AxiosError } from 'axios';
import * as chalk from 'chalk';

/**
 * Генерирует CURL команду из axios response или error
 */
export function generateCurlCommand(
  url: string,
  method: string,
  headers?: Record<string, string>,
  data?: any
): string {
  const lines: string[] = [];
  
  lines.push(`curl -X ${method.toUpperCase()} '${url}' \\`);
  
  // Добавляем headers
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      lines.push(`  -H '${key}: ${value}' \\`);
    });
  }
  
  // Добавляем data если есть
  if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT' || method.toUpperCase() === 'PATCH')) {
    const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    lines.push(`  -d '${dataStr.replace(/'/g, "\\'")}'`);
  } else {
    // Убираем последний обратный слеш
    const lastLine = lines[lines.length - 1];
    lines[lines.length - 1] = lastLine.replace(' \\', '');
  }
  
  return lines.join('\n');
}

/**
 * Генерирует кастомное сообщение для expect с CURL командой
 */
export function customMessageData(
  response?: AxiosResponse,
  error?: AxiosError
): string {
  const lines: string[] = [];
  
  lines.push('\n');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('🔴 API TEST FAILED');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  if (error && error.config) {
    const config = error.config;
    
    // Информация о запросе
    lines.push('📍 Request Details:');
    lines.push(`   Method: ${config.method?.toUpperCase()}`);
    lines.push(`   URL: ${config.url}`);
    lines.push('');
    
    // Информация об ошибке
    if (error.response) {
      lines.push('📊 Response Details:');
      lines.push(`   Status: ${error.response.status} ${error.response.statusText}`);
      
      if (error.response.data) {
        const responseData = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data, null, 2);
        lines.push(`   Body: ${responseData.substring(0, 500)}`);
      }
      lines.push('');
    }
    
    // CURL команда
    lines.push('📋 CURL Command (можно скопировать и выполнить):');
    lines.push('');
    lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
    
    const curlCommand = generateCurlCommand(
      config.url || '',
      config.method || 'GET',
      config.headers as Record<string, string>,
      config.data
    );
    
    curlCommand.split('\n').forEach(line => {
      lines.push(`│ ${line.padEnd(75)} │`);
    });
    
    lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
    lines.push('');
    
  } else if (response && response.config) {
    const config = response.config;
    
    // Информация о запросе
    lines.push('📍 Request Details:');
    lines.push(`   Method: ${config.method?.toUpperCase()}`);
    lines.push(`   URL: ${config.url}`);
    lines.push('');
    
    // Информация об ответе
    lines.push('📊 Response Details:');
    lines.push(`   Status: ${response.status} ${response.statusText}`);
    lines.push('');
    
    // CURL команда
    lines.push('📋 CURL Command (можно скопировать и выполнить):');
    lines.push('');
    lines.push('┌─────────────────────────────────────────────────────────────────────────────┐');
    
    const curlCommand = generateCurlCommand(
      config.url || '',
      config.method || 'GET',
      config.headers as Record<string, string>,
      config.data
    );
    
    curlCommand.split('\n').forEach(line => {
      lines.push(`│ ${line.padEnd(75)} │`);
    });
    
    lines.push('└─────────────────────────────────────────────────────────────────────────────┘');
    lines.push('');
  }
  
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Обертка для генерации сообщения из response
 */
export function getMessageFromResponse(response: AxiosResponse): string {
  return customMessageData(response);
}

/**
 * Обертка для генерации сообщения из error
 */
export function getMessageFromError(error: AxiosError): string {
  return customMessageData(undefined, error);
}

/**
 * Генерирует сокращенное сообщение для expect (без рамок, для inline использования)
 */
export function generateExpectMessage(
  url: string,
  method: string,
  headers?: Record<string, string>,
  data?: any,
  actualStatus?: number,
  expectedStatus?: number
): string {
  const curlCommand = generateCurlCommand(url, method, headers, data);
  
  return `
Expected status: ${expectedStatus}, but got: ${actualStatus}

CURL to reproduce:
${curlCommand}
`;
}
