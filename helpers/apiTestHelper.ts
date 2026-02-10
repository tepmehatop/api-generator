/**
 * Helper для генерации CURL команд и улучшенных сообщений об ошибках в API тестах
 * ВЕРСИЯ 14.1 - handleApiError с email уведомлениями
 */

import { AxiosResponse, AxiosError, AxiosRequestConfig } from 'axios';
import { generateErrorEmailHtml, ErrorNotificationData, isServerError } from '../src/utils/error-notification';

/**
 * Интерфейс для Playwright TestInfo
 */
export interface TestInfo {
  file?: string;
  title?: string;
  testId?: string;
  [key: string]: any;
}

/**
 * Параметры для handleApiError
 */
export interface HandleApiErrorParams {
  /** Axios ошибка */
  error: AxiosError;
  /** Playwright TestInfo - информация о текущем тесте */
  testInfo: TestInfo;
  /** Endpoint API */
  endpoint: string;
  /** HTTP метод */
  method: string;
  /** URL стенда */
  standUrl: string;
  /** Тело запроса (для POST/PUT/PATCH) */
  requestBody?: any;
  /** Axios конфиг с headers для авторизации */
  axiosConfig?: AxiosRequestConfig;
  /** Функция отправки email (принимает HTML строку) */
  sendEmailFn?: (html: string) => Promise<void>;
}

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

/**
 * Централизованный обработчик ошибок API тестов
 *
 * Выполняет:
 * 1. Логирование детальной информации об ошибке
 * 2. Генерацию CURL команды для воспроизведения
 * 3. Отправку email уведомления при 5xx ошибках (если передана sendEmailFn)
 *
 * @param params - Параметры обработки ошибки
 * @returns void - после логирования пробрасывает ошибку дальше
 *
 * @example
 * ```typescript
 * test('GET /api/users', async ({ page }, testInfo) => {
 *   try {
 *     const response = await axios.get(url, config);
 *   } catch (error: any) {
 *     await handleApiError({
 *       error,
 *       testInfo,
 *       endpoint: '/api/users',
 *       method: 'GET',
 *       standUrl: process.env.StandURL,
 *       axiosConfig: configApiHeaderAdmin,
 *       sendEmailFn: sendErrorMailbyApi
 *     });
 *   }
 * });
 * ```
 */
export async function handleApiError(params: HandleApiErrorParams): Promise<never> {
  const {
    error,
    testInfo,
    endpoint,
    method,
    standUrl,
    requestBody,
    axiosConfig,
    sendEmailFn
  } = params;

  const errorStatus = error.response?.status;
  const fullUrl = standUrl + endpoint;

  // 1. Логирование в консоль
  console.error('❌ Ошибка при вызове endpoint:');
  console.error('Endpoint:', endpoint);
  console.error('Method:', method);
  console.error('Full URL:', fullUrl);

  if (requestBody) {
    console.error('Request:', JSON.stringify(requestBody, null, 2));
  }

  console.error('Response status:', errorStatus);
  console.error('Response data:', JSON.stringify(error.response?.data, null, 2));

  // Детальный вывод с CURL командой
  const errorMessage = getMessageFromError(error);
  console.error(errorMessage);

  // 2. Отправка email при 5xx ошибках
  if (sendEmailFn && errorStatus && isServerError(errorStatus)) {
    const errorData: ErrorNotificationData = {
      errorCode: errorStatus,
      errorMessage: error.response?.statusText || error.message,
      endpoint: endpoint,
      method: method,
      fullUrl: fullUrl,
      testFilePath: testInfo.file,
      testTitle: testInfo.title,
      requestBody: requestBody,
      responseData: error.response?.data,
      axiosConfig: axiosConfig
    };

    try {
      const emailHtml = generateErrorEmailHtml(errorData);
      await sendEmailFn(emailHtml);
      console.log('📧 Email уведомление о 5xx ошибке отправлено');
    } catch (emailError) {
      console.error('❌ Не удалось отправить email:', emailError);
    }
  }

  // 3. Пробрасываем ошибку дальше для падения теста
  throw error;
}
