/**
 * Модуль для сбора API request/response данных с фронта во время UI тестов
 *
 * Использование в beforeEach/afterEach:
 * ```typescript
 * import { setupApiCollector, sendCollectedData } from '@your-company/api-codegen/test-helpers';
 *
 * test.beforeEach(async ({ page }, testInfo) => {
 *   await getReportData(page, testInfo); // Ваш существующий метод
 *   setupApiCollector(page, testInfo);   // Настройка коллектора
 * });
 *
 * test.afterEach(async ({ page }, testInfo) => {
 *   await sendCollectedData(page, testInfo); // Отправка данных
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
    serviceUrl?: string;
    endpoint?: string;
    urlFilters?: string[];
    excludeUrls?: string[];
    verbose?: boolean;
}
/**
 * Настраивает сбор API данных с фронта
 * Вызывать в test.beforeEach()
 */
export declare function setupApiCollector(page: Page, testInfo: TestInfo, config?: CollectorConfig): void;
/**
 * Отправляет собранные данные на сервер
 * Вызывать в test.afterEach()
 */
export declare function sendCollectedData(page: Page, testInfo: TestInfo): Promise<void>;
/**
 * Создаёт коллектор с конфигурацией
 */
export declare function createCollector(config: CollectorConfig): {
    setup: (page: Page, testInfo: TestInfo) => void;
    send: (page: Page, testInfo: TestInfo) => Promise<void>;
};
/**
 * @deprecated Используйте setupApiCollector + sendCollectedData
 */
export declare function collectApiData(page: Page, testInfo: TestInfo, config?: CollectorConfig): Promise<void>;
//# sourceMappingURL=test-collector.d.ts.map