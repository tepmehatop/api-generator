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
/**
 * Настраивает сбор API данных с фронта
 *
 * @param page Playwright Page объект
 * @param testInfo TestInfo из Playwright
 * @param config Конфигурация коллектора
 */
export declare function collectApiData(page: Page, testInfo: TestInfo, config?: CollectorConfig): Promise<void>;
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
export declare function createCollector(config: CollectorConfig): (page: Page, testInfo: TestInfo) => Promise<void>;
//# sourceMappingURL=test-collector.d.ts.map