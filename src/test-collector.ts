/**
 * Модуль для сбора API request/response данных с фронта во время UI тестов
 * 
 * Использование в beforeEach:
 * ```typescript
 * import { collectApiData } from '@your-company/api-codegen/test-helpers';
 * 
 * test.beforeEach(async ({ page }, testInfo) => {
 *   await getReportData(page, testInfo); // Ваш существующий метод
 *   await collectApiData(page, testInfo); // Новый метод сбора данных
 * });
 * ```
 */

import type { Page, TestInfo } from '@playwright/test';

export interface ApiRequestData {
  endpoint: string;
  method: string;
  requestBody: any;
  responseBody: any;
  responseStatus: number;
  timestamp: string;
  testName: string;
  testFile: string;
}

export interface CollectorConfig {
  /**
   * URL сервиса для отправки данных
   * @default 'http://your-vm-host:3000'
   */
  serviceUrl?: string;
  
  /**
   * Эндпоинт для отправки данных
   * @default '/api/collect-data'
   */
  endpoint?: string;
  
  /**
   * Фильтр URL - собирать данные только с этих URL
   * @example ['/api/', '/v1/']
   */
  urlFilters?: string[];
  
  /**
   * Исключить URL - не собирать данные с этих URL
   * @example ['/health', '/metrics']
   */
  excludeUrls?: string[];
  
  /**
   * Включить детальное логирование
   */
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<CollectorConfig> = {
  serviceUrl: process.env.API_COLLECTOR_URL || 'http://localhost:3000',
  endpoint: '/api/collect-data',
  urlFilters: ['/api/'],
  excludeUrls: ['/health', '/metrics', '/ping'],
  verbose: false
};

/**
 * Настраивает сбор API данных с фронта
 * 
 * @param page Playwright Page объект
 * @param testInfo TestInfo из Playwright
 * @param config Конфигурация коллектора
 */
export async function collectApiData(
  page: Page, 
  testInfo: TestInfo, 
  config: CollectorConfig = {}
): Promise<void> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Массив для хранения собранных данных
  const collectedData: ApiRequestData[] = [];
  
  if (cfg.verbose) {
    console.log(`[API Collector] Начинаю сбор данных для теста: ${testInfo.title}`);
  }
  
  // Слушаем все request/response
  page.on('response', async (response) => {
    try {
      const request = response.request();
      const url = request.url();
      const method = request.method();
      
      // Фильтруем URL
      const shouldCollect = cfg.urlFilters.some(filter => url.includes(filter));
      const shouldExclude = cfg.excludeUrls.some(exclude => url.includes(exclude));
      
      if (!shouldCollect || shouldExclude) {
        return;
      }
      
      // Только API запросы (GET, POST, PUT, DELETE, PATCH)
      const apiMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      if (!apiMethods.includes(method)) {
        return;
      }
      
      // Извлекаем endpoint из URL
      const urlObj = new URL(url);
      const endpoint = urlObj.pathname;
      
      // Получаем request body
      let requestBody = null;
      try {
        const postData = request.postData();
        if (postData) {
          requestBody = JSON.parse(postData);
        }
      } catch (e) {
        // Request body может быть не JSON
        requestBody = request.postData();
      }
      
      // Получаем response body
      let responseBody = null;
      const responseStatus = response.status();
      
      try {
        // Только для успешных ответов и JSON
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          responseBody = await response.json();
        }
      } catch (e) {
        // Response может быть не JSON
        if (cfg.verbose) {
          console.log(`[API Collector] Не удалось распарсить response: ${endpoint}`);
        }
      }
      
      // Собираем данные
      const data: ApiRequestData = {
        endpoint,
        method,
        requestBody,
        responseBody,
        responseStatus,
        timestamp: new Date().toISOString(),
        testName: testInfo.title,
        testFile: testInfo.file
      };
      
      collectedData.push(data);
      
      if (cfg.verbose) {
        console.log(`[API Collector] Собрано: ${method} ${endpoint} -> ${responseStatus}`);
      }
    } catch (error) {
      if (cfg.verbose) {
        console.error('[API Collector] Ошибка при обработке response:', error);
      }
    }
  });
  
  // После завершения теста отправляем данные
  testInfo.attach('collected-api-data', {
    body: JSON.stringify(collectedData, null, 2),
    contentType: 'application/json'
  });
  
  // Отправляем на сервис
  if (collectedData.length > 0) {
    try {
      const serviceEndpoint = `${cfg.serviceUrl}${cfg.endpoint}`;
      
      if (cfg.verbose) {
        console.log(`[API Collector] Отправляю ${collectedData.length} записей на ${serviceEndpoint}`);
      }
      
      const response = await fetch(serviceEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          testName: testInfo.title,
          testFile: testInfo.file,
          data: collectedData
        })
      });
      
      if (!response.ok) {
        console.error(`[API Collector] Ошибка отправки данных: ${response.status}`);
      } else {
        if (cfg.verbose) {
          console.log(`[API Collector] ✓ Данные успешно отправлены`);
        }
      }
    } catch (error) {
      console.error('[API Collector] Ошибка при отправке данных:', error);
    }
  }
}

/**
 * Создаёт коллектор с предустановленной конфигурацией
 * 
 * @example
 * const collector = createCollector({
 *   serviceUrl: 'http://192.168.1.100:3000',
 *   urlFilters: ['/api/v1/'],
 *   verbose: true
 * });
 * 
 * test.beforeEach(async ({ page }, testInfo) => {
 *   await collector(page, testInfo);
 * });
 */
export function createCollector(config: CollectorConfig) {
  return (page: Page, testInfo: TestInfo) => collectApiData(page, testInfo, config);
}
