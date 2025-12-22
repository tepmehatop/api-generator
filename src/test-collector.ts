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
   * URL сервиса для отправки данных
   * @default 'http://localhost:3000'
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
   * Размер batch для отправки (количество запросов)
   * При достижении этого количества данные отправляются автоматически
   * @default 20
   */
  batchSize?: number;
  
  /**
   * Интервал отправки в миллисекундах
   * Данные отправляются каждые N мс даже если batch не заполнен
   * @default 5000 (5 секунд)
   */
  sendInterval?: number;
  
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
  batchSize: 20,
  sendInterval: 5000,
  verbose: false
};

// Хранилище для каждого теста
interface TestCollectorState {
  data: ApiRequestData[];
  config: Required<CollectorConfig>;
  testInfo: TestInfo;
  sendTimer: NodeJS.Timeout | null;
  isSending: boolean;
  totalSent: number;
}

const testStates = new Map<string, TestCollectorState>();

/**
 * Отправляет batch данных на сервер
 */
async function sendBatch(testId: string, force: boolean = false): Promise<void> {
  const state = testStates.get(testId);
  if (!state || state.isSending) return;
  
  // Если batch пустой или слишком мал (и не force), пропускаем
  if (state.data.length === 0 || (!force && state.data.length < 3)) {
    return;
  }
  
  state.isSending = true;
  
  const batch = [...state.data];
  state.data = []; // Очищаем buffer
  
  try {
    const serviceEndpoint = `${state.config.serviceUrl}${state.config.endpoint}`;
    
    if (state.config.verbose) {
      console.log(`[API Collector] 📤 Отправляю batch: ${batch.length} записей (всего: ${state.totalSent + batch.length})`);
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
      console.error(`[API Collector] ❌ Ошибка ${response.status}: ${text}`);
      
      // Возвращаем данные обратно если ошибка
      state.data = [...batch, ...state.data];
    } else {
      state.totalSent += batch.length;
      
      if (state.config.verbose) {
        const result = await response.json();
        console.log(`[API Collector] ✅ Отправлено: ${result.savedCount} записей`);
      }
    }
  } catch (error) {
    console.error('[API Collector] ❌ Ошибка отправки:', error);
    
    // Возвращаем данные обратно
    state.data = [...batch, ...state.data];
  } finally {
    state.isSending = false;
  }
}

/**
 * Проверяет нужно ли отправить batch
 */
function checkAndSendBatch(testId: string): void {
  const state = testStates.get(testId);
  if (!state) return;
  
  // Если достигли размера batch, отправляем немедленно
  if (state.data.length >= state.config.batchSize) {
    sendBatch(testId, false);
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
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const testId = `${testInfo.file}:${testInfo.title}:${Date.now()}`;
  
  // Инициализируем состояние
  const state: TestCollectorState = {
    data: [],
    config: cfg,
    testInfo,
    sendTimer: null,
    isSending: false,
    totalSent: 0
  };
  
  testStates.set(testId, state);
  
  if (cfg.verbose) {
    console.log(`[API Collector] 🔍 Начинаю сбор для: ${testInfo.title}`);
    console.log(`[API Collector] ⚙️  Batch: ${cfg.batchSize} запросов, интервал: ${cfg.sendInterval}ms`);
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
      
      // Получаем request body
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
      
      // Получаем response body
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
      
      // Добавляем в buffer
      const currentState = testStates.get(testId);
      if (currentState) {
        currentState.data.push(data);
        
        if (cfg.verbose) {
          console.log(`[API Collector] ✓ ${method} ${endpoint} -> ${responseStatus} (buffer: ${currentState.data.length})`);
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
