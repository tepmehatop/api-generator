"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApiCollector = setupApiCollector;
exports.sendCollectedData = sendCollectedData;
exports.createCollector = createCollector;
exports.collectApiData = collectApiData;
const DEFAULT_CONFIG = {
    serviceUrl: process.env.API_COLLECTOR_URL || 'http://localhost:3000',
    endpoint: '/api/collect-data',
    urlFilters: ['/api/'],
    excludeUrls: ['/health', '/metrics', '/ping'],
    verbose: false
};
const testDataStorage = new Map();
const testConfigStorage = new Map();
/**
 * Настраивает сбор API данных с фронта
 * Вызывать в test.beforeEach()
 */
function setupApiCollector(page, testInfo, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const testId = `${testInfo.file}:${testInfo.title}`;
    testDataStorage.set(testId, []);
    testConfigStorage.set(testId, cfg);
    if (cfg.verbose) {
        console.log(`[API Collector] 🔍 Начинаю сбор для: ${testInfo.title}`);
    }
    const responseHandler = async (response) => {
        try {
            const request = response.request();
            const url = request.url();
            const method = request.method();
            const shouldCollect = cfg.urlFilters.some(filter => url.includes(filter));
            const shouldExclude = cfg.excludeUrls.some(exclude => url.includes(exclude));
            if (!shouldCollect || shouldExclude) {
                return;
            }
            const apiMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
            if (!apiMethods.includes(method)) {
                return;
            }
            const urlObj = new URL(url);
            const endpoint = urlObj.pathname;
            let requestBody = null;
            try {
                const postData = request.postData();
                if (postData) {
                    try {
                        requestBody = JSON.parse(postData);
                    }
                    catch {
                        requestBody = postData;
                    }
                }
            }
            catch (e) {
                // Ignore
            }
            let responseBody = null;
            const responseStatus = response.status();
            try {
                const contentType = response.headers()['content-type'] || '';
                if (contentType.includes('application/json')) {
                    responseBody = await response.json();
                }
            }
            catch (e) {
                if (cfg.verbose) {
                    console.log(`[API Collector] Не JSON: ${endpoint}`);
                }
            }
            const data = {
                endpoint,
                method,
                requestBody,
                responseBody,
                responseStatus,
                timestamp: new Date().toISOString(),
                testName: testInfo.title,
                testFile: testInfo.file
            };
            const storage = testDataStorage.get(testId);
            if (storage) {
                storage.push(data);
                if (cfg.verbose) {
                    console.log(`[API Collector] ✓ ${method} ${endpoint} -> ${responseStatus}`);
                }
            }
        }
        catch (error) {
            if (cfg.verbose) {
                console.error('[API Collector] Ошибка:', error);
            }
        }
    };
    page.on('response', responseHandler);
    page.__apiCollectorHandler = responseHandler;
}
/**
 * Отправляет собранные данные на сервер
 * Вызывать в test.afterEach()
 */
async function sendCollectedData(page, testInfo) {
    const testId = `${testInfo.file}:${testInfo.title}`;
    const collectedData = testDataStorage.get(testId) || [];
    const cfg = testConfigStorage.get(testId) || DEFAULT_CONFIG;
    const handler = page.__apiCollectorHandler;
    if (handler) {
        page.off('response', handler);
        delete page.__apiCollectorHandler;
    }
    if (collectedData.length === 0) {
        if (cfg.verbose) {
            console.log(`[API Collector] Нет данных`);
        }
        testDataStorage.delete(testId);
        testConfigStorage.delete(testId);
        return;
    }
    testInfo.attach('collected-api-data', {
        body: JSON.stringify(collectedData, null, 2),
        contentType: 'application/json'
    });
    try {
        const serviceEndpoint = `${cfg.serviceUrl}${cfg.endpoint}`;
        if (cfg.verbose) {
            console.log(`[API Collector] 📤 Отправляю ${collectedData.length} записей...`);
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
            const text = await response.text();
            console.error(`[API Collector] ❌ Ошибка ${response.status}: ${text}`);
        }
        else {
            if (cfg.verbose) {
                const result = await response.json();
                console.log(`[API Collector] ✅ Отправлено: ${result.savedCount} записей`);
            }
        }
    }
    catch (error) {
        console.error('[API Collector] ❌ Ошибка отправки:', error);
    }
    testDataStorage.delete(testId);
    testConfigStorage.delete(testId);
}
/**
 * Создаёт коллектор с конфигурацией
 */
function createCollector(config) {
    return {
        setup: (page, testInfo) => setupApiCollector(page, testInfo, config),
        send: (page, testInfo) => sendCollectedData(page, testInfo)
    };
}
/**
 * @deprecated Используйте setupApiCollector + sendCollectedData
 */
async function collectApiData(page, testInfo, config = {}) {
    setupApiCollector(page, testInfo, config);
}
//# sourceMappingURL=test-collector.js.map