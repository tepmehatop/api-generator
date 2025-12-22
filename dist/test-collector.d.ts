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
export declare function setupApiCollector(page: Page, testInfo: TestInfo, config?: CollectorConfig): void;
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
export declare function createCollector(config: CollectorConfig): {
    setup: (page: Page, testInfo: TestInfo) => void;
};
/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
export declare function sendCollectedData(page: Page, testInfo: TestInfo): Promise<void>;
/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
export declare function collectApiData(page: Page, testInfo: TestInfo, config?: CollectorConfig): Promise<void>;
//# sourceMappingURL=test-collector.d.ts.map