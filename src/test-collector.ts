/**
 * Модуль для сбора API request/response данных с фронта во время UI тестов
 * 
 * Использование в beforeEach (БЕЗ afterEach!):
 * ```typescript
 * import { setupApiCollector } from '@your-company/api-codegen/test-helpers';
 * 
 * test.beforeEach(async ({ page }, testInfo) => {
 *   await getReportData(page, testInfo); // Ваш существующий метод
 *   setupApiCollector(page, testInfo);   // Всё! Больше ничего не нужно
 * });
 * 
 * // afterEach НЕ НУЖЕН - данные отправляются автоматически!
 * ```
 * 
 * Особенности:
 * - Автоматическая отправка порциями (каждые N запросов или каждые N секунд)
 * - Финальная отправка остатков после завершения теста
 * - Нет проблем с "entity too large"
 * - Не нужен afterEach
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
   * URL сервиса для отправки данных (если не используется Kafka)
   * @default 'http://localhost:3000'
   */
  serviceUrl?: string;
  
  /**
   * Эндпоинт для отправки данных (если не используется Kafka)
   * @default '/api/collect-data'
   */
  endpoint?: string;
  
  /**
   * Использовать Kafka вместо HTTP
   * @default false
   */
  useKafka?: boolean;
  
  /**
   * Kafka topic для отправки данных
   * @default 'api-collector-topic'
   */
  kafkaTopic?: string;
  
  /**
   * Функция для отправки в Kafka (должна быть предоставлена из автотестов)
   */
  kafkaSendFunction?: (topic: string, message: any) => Promise<void>;
  
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
   * Размер batch для отправки (количество запросов)
   * @default 10
   */
  batchSize?: number;
  
  /**
   * Интервал отправки в миллисекундах
   * @default 3000
   */
  sendInterval?: number;
  
  /**
   * Максимальный размер batch в байтах
   * @default 5242880 (5MB)
   */
  maxBatchBytes?: number;
  
  /**
   * Включить детальное логирование
   */
  verbose?: boolean;
}

const DEFAULT_CONFIG: Required<Omit<CollectorConfig, 'kafkaSendFunction'>> = {
  serviceUrl: process.env.API_COLLECTOR_URL || 'http://localhost:3000',
  endpoint: '/api/collect-data',
  useKafka: false,
  kafkaTopic: process.env.KAFKA_TOPIC || 'api-collector-topic',
  urlFilters: ['/api/'],
  excludeUrls: ['/health', '/metrics', '/ping'],
  batchSize: 10,
  sendInterval: 3000,
  maxBatchBytes: 5242880,
  verbose: false
};

// Хранилище для каждого теста
interface TestCollectorState {
  data: ApiRequestData[];
  config: Required<Omit<CollectorConfig, 'kafkaSendFunction'>> & { kafkaSendFunction?: (topic: string, message: any) => Promise<void> };
  testInfo: TestInfo;
  sendTimer: NodeJS.Timeout | null;
  isSending: boolean;
  totalSent: number;
  currentBatchSize: number;
}

const testStates = new Map<string, TestCollectorState>();

/**
 * Обрезает большие объекты до заданного размера
 */

/**
 * Вычисляет размер данных в байтах
 */
function getDataSize(data: ApiRequestData[]): number {
  try {
    return JSON.stringify(data).length;
  } catch {
    return 0;
  }
}

/**
 * Отправляет batch данных на сервер или в Kafka
 */
async function sendBatch(testId: string, force: boolean = false): Promise<void> {
  const state = testStates.get(testId);
  if (!state || state.isSending) return;
  
  if (state.data.length === 0 || (!force && state.data.length < 3)) {
    return;
  }
  
  state.isSending = true;
  
  const batch = [...state.data];
  state.data = [];
  state.currentBatchSize = 0;
  
  const batchSizeKB = (getDataSize(batch) / 1024).toFixed(2);
  
  try {
    if (state.config.useKafka) {
      // Отправка в Kafka
      await sendToKafka(state, batch, batchSizeKB);
    } else {
      // Отправка через HTTP
      await sendToHttp(state, batch, batchSizeKB);
    }
  } catch (error) {
    console.error('[API Collector] ❌ Ошибка отправки:', error);
    state.data = [...batch, ...state.data];
    state.currentBatchSize = getDataSize(state.data);
  } finally {
    state.isSending = false;
  }
}

/**
 * Отправка в Kafka
 */
async function sendToKafka(
  state: TestCollectorState, 
  batch: ApiRequestData[], 
  batchSizeKB: string
): Promise<void> {
  if (!state.config.kafkaSendFunction) {
    throw new Error('Kafka send function не предоставлена в конфигурации');
  }
  
  if (state.config.verbose) {
    console.log(`[API Collector] 📤 Kafka: отправляю ${batch.length} записей, ~${batchSizeKB}KB в топик ${state.config.kafkaTopic}`);
  }
  
  // Отправляем каждую запись отдельным сообщением в Kafka
  let sentCount = 0;
  for (const item of batch) {
    try {
      await state.config.kafkaSendFunction(state.config.kafkaTopic, {
        testName: state.testInfo.title,
        testFile: state.testInfo.file,
        data: item
      });
      sentCount++;
    } catch (error) {
      console.error(`[API Collector] ❌ Kafka ошибка для ${item.method} ${item.endpoint}:`, error);
    }
  }
  
  state.totalSent += sentCount;
  
  if (state.config.verbose) {
    console.log(`[API Collector] ✅ Kafka: отправлено ${sentCount} из ${batch.length} записей`);
  }
}

/**
 * Отправка через HTTP
 */
async function sendToHttp(
  state: TestCollectorState, 
  batch: ApiRequestData[], 
  batchSizeKB: string
): Promise<void> {
  const serviceEndpoint = `${state.config.serviceUrl}${state.config.endpoint}`;
  
  if (state.config.verbose) {
    console.log(`[API Collector] 📤 HTTP: отправляю ${batch.length} записей, ~${batchSizeKB}KB на ${serviceEndpoint}`);
  }
  
  const response = await fetch(serviceEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      testName: state.testInfo.title,
      testFile: state.testInfo.file,
      data: batch
    })
  });
  
  if (!response.ok) {
    const text = await response.text();
    console.error(`[API Collector] ❌ HTTP ошибка ${response.status}: ${text}`);
    console.error(`[API Collector] 💡 Размер batch: ${batchSizeKB}KB, количество: ${batch.length}`);
    throw new Error(`HTTP ${response.status}: ${text}`);
  } else {
    state.totalSent += batch.length;
    
    if (state.config.verbose) {
      const result = await response.json();
      console.log(`[API Collector] ✅ HTTP: отправлено ${result.savedCount} записей`);
    }
  }
}

/**
 * Проверяет нужно ли отправить batch
 */
function checkAndSendBatch(testId: string): void {
  const state = testStates.get(testId);
  if (!state) return;
  
  // Если достигли размера batch по количеству, отправляем
  if (state.data.length >= state.config.batchSize) {
    if (state.config.verbose) {
      console.log(`[API Collector] 📊 Batch размер достигнут: ${state.data.length} запросов`);
    }
    sendBatch(testId, false);
    return;
  }
  
  // Если достигли размера batch в байтах, отправляем
  if (state.currentBatchSize >= state.config.maxBatchBytes) {
    if (state.config.verbose) {
      console.log(`[API Collector] 📊 Batch размер в байтах достигнут: ${(state.currentBatchSize / 1024).toFixed(2)}KB`);
    }
    sendBatch(testId, false);
    return;
  }
}

/**
 * Финальная отправка всех оставшихся данных
 */
async function sendRemainingData(testId: string): Promise<void> {
  const state = testStates.get(testId);
  if (!state) return;
  
  // Очищаем таймер
  if (state.sendTimer) {
    clearInterval(state.sendTimer);
    state.sendTimer = null;
  }
  
  // Ждём если сейчас идёт отправка
  let attempts = 0;
  while (state.isSending && attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }
  
  // Отправляем остатки
  if (state.data.length > 0) {
    await sendBatch(testId, true);
  }
  
  // Сохраняем как артефакт
  state.testInfo.attach('api-collector-summary', {
    body: JSON.stringify({
      totalCollected: state.totalSent,
      testName: state.testInfo.title,
      testFile: state.testInfo.file
    }, null, 2),
    contentType: 'application/json'
  });
  
  if (state.config.verbose) {
    console.log(`[API Collector] 🎯 Всего собрано и отправлено: ${state.totalSent} запросов`);
  }
  
  // Удаляем состояние
  testStates.delete(testId);
}

/**
 * Настраивает сбор API данных с фронта
 * Вызывать в test.beforeEach()
 * 
 * ВАЖНО: afterEach НЕ НУЖЕН! Данные отправляются автоматически:
 * - Каждые N запросов (batchSize)
 * - Каждые N секунд (sendInterval)
 * - После завершения теста (автоматически)
 * 
 * @param page Playwright Page объект
 * @param testInfo TestInfo из Playwright
 * @param config Конфигурация коллектора
 */
export function setupApiCollector(
  page: Page, 
  testInfo: TestInfo, 
  config: CollectorConfig = {}
): void {
  const cfg = { ...DEFAULT_CONFIG, ...config, kafkaSendFunction: config.kafkaSendFunction };
  const testId = `${testInfo.file}:${testInfo.title}:${Date.now()}`;
  
  // Инициализируем состояние
  const state: TestCollectorState = {
    data: [],
    config: cfg as any,
    testInfo,
    sendTimer: null,
    isSending: false,
    totalSent: 0,
    currentBatchSize: 0
  };
  
  testStates.set(testId, state);
  
  if (cfg.verbose) {
    console.log(`[API Collector] 🔍 Начинаю сбор для: ${testInfo.title}`);
    console.log(`[API Collector] ⚙️  Режим: ${cfg.useKafka ? 'Kafka' : 'HTTP'}`);
    console.log(`[API Collector] ⚙️  Batch: ${cfg.batchSize} запросов, интервал: ${cfg.sendInterval}ms`);
    if (cfg.useKafka) {
      console.log(`[API Collector] ⚙️  Kafka топик: ${cfg.kafkaTopic}`);
    }
  }
  
  // Создаём обработчик response
  const responseHandler = async (response: any) => {
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
      
      // Только API запросы
      const apiMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
      if (!apiMethods.includes(method)) {
        return;
      }
      
      // Извлекаем endpoint из URL
      const urlObj = new URL(url);
      const endpoint = urlObj.pathname;
      
      // Получаем request body (БЕЗ обрезки - полные данные!)
      let requestBody = null;
      try {
        const postData = request.postData();
        if (postData) {
          try {
            requestBody = JSON.parse(postData);
          } catch {
            requestBody = postData;
          }
        }
      } catch (e) {
        // Ignore
      }
      
      // Получаем response body (БЕЗ обрезки - полные данные!)
      let responseBody = null;
      const responseStatus = response.status();
      
      try {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('application/json')) {
          responseBody = await response.json();
        }
      } catch (e) {
        // Ignore
      }
      
      // Собираем данные (ПОЛНЫЕ, без обрезки)
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
      
      // Добавляем в buffer
      const currentState = testStates.get(testId);
      if (currentState) {
        currentState.data.push(data);
        
        // Обновляем размер batch
        currentState.currentBatchSize = getDataSize(currentState.data);
        
        if (cfg.verbose) {
          const sizeKB = (currentState.currentBatchSize / 1024).toFixed(2);
          console.log(`[API Collector] ✓ ${method} ${endpoint} -> ${responseStatus} (buffer: ${currentState.data.length}, ~${sizeKB}KB)`);
        }
        
        // Проверяем нужно ли отправить batch
        checkAndSendBatch(testId);
      }
    } catch (error) {
      if (cfg.verbose) {
        console.error('[API Collector] Ошибка:', error);
      }
    }
  };
  
  // Подписываемся на события
  page.on('response', responseHandler);
  
  // Сохраняем обработчик для отписки
  (page as any).__apiCollectorHandler = responseHandler;
  (page as any).__apiCollectorTestId = testId;
  
  // Запускаем таймер периодической отправки
  state.sendTimer = setInterval(() => {
    sendBatch(testId, false);
  }, cfg.sendInterval);
  
  // Регистрируем cleanup при закрытии страницы
  page.on('close', async () => {
    await sendRemainingData(testId);
  });
  
  // Хук на завершение теста через Playwright
  // Используем setTimeout с достаточной задержкой
  const originalTimeout = testInfo.timeout;
  const cleanupDelay = Math.min(5000, originalTimeout / 10); // 5 сек или 10% от timeout
  
  // Регистрируем финальную отправку
  setTimeout(async () => {
    const handler = (page as any).__apiCollectorHandler;
    if (handler) {
      page.off('response', handler);
      delete (page as any).__apiCollectorHandler;
    }
    
    const currentTestId = (page as any).__apiCollectorTestId;
    if (currentTestId) {
      await sendRemainingData(currentTestId);
      delete (page as any).__apiCollectorTestId;
    }
  }, testInfo.timeout - cleanupDelay);
}

/**
 * Создаёт коллектор с предустановленной конфигурацией
 * 
 * @example
 * const collector = createCollector({
 *   serviceUrl: 'http://192.168.1.100:3000',
 *   batchSize: 50,
 *   sendInterval: 10000,
 *   verbose: true
 * });
 * 
 * test.beforeEach(async ({ page }, testInfo) => {
 *   collector.setup(page, testInfo);
 * });
 * 
 * // afterEach НЕ НУЖЕН!
 */
export function createCollector(config: CollectorConfig) {
  return {
    setup: (page: Page, testInfo: TestInfo) => setupApiCollector(page, testInfo, config)
  };
}

/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
export async function sendCollectedData(page: Page, testInfo: TestInfo): Promise<void> {
  console.warn('[API Collector] sendCollectedData deprecated - данные отправляются автоматически');
}

/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
export async function collectApiData(
  page: Page, 
  testInfo: TestInfo, 
  config: CollectorConfig = {}
): Promise<void> {
  setupApiCollector(page, testInfo, config);
}
