"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupApiCollector = setupApiCollector;
exports.createCollector = createCollector;
exports.sendCollectedData = sendCollectedData;
exports.collectApiData = collectApiData;
const DEFAULT_CONFIG = {
    serviceUrl: process.env.API_COLLECTOR_URL || 'http://localhost:3000',
    endpoint: '/api/collect-data',
    urlFilters: ['/api/'],
    excludeUrls: ['/health', '/metrics', '/ping'],
    batchSize: 20,
    sendInterval: 5000,
    verbose: false
};
const testStates = new Map();
/**
 * Отправляет batch данных на сервер
 */
async function sendBatch(testId, force = false) {
    const state = testStates.get(testId);
    if (!state || state.isSending)
        return;
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
        }
        else {
            state.totalSent += batch.length;
            if (state.config.verbose) {
                const result = await response.json();
                console.log(`[API Collector] ✅ Отправлено: ${result.savedCount} записей`);
            }
        }
    }
    catch (error) {
        console.error('[API Collector] ❌ Ошибка отправки:', error);
        // Возвращаем данные обратно
        state.data = [...batch, ...state.data];
    }
    finally {
        state.isSending = false;
    }
}
/**
 * Проверяет нужно ли отправить batch
 */
function checkAndSendBatch(testId) {
    const state = testStates.get(testId);
    if (!state)
        return;
    // Если достигли размера batch, отправляем немедленно
    if (state.data.length >= state.config.batchSize) {
        sendBatch(testId, false);
    }
}
/**
 * Финальная отправка всех оставшихся данных
 */
async function sendRemainingData(testId) {
    const state = testStates.get(testId);
    if (!state)
        return;
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
function setupApiCollector(page, testInfo, config = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    const testId = `${testInfo.file}:${testInfo.title}:${Date.now()}`;
    // Инициализируем состояние
    const state = {
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
    const responseHandler = async (response) => {
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
                    }
                    catch {
                        requestBody = postData;
                    }
                }
            }
            catch (e) {
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
            }
            catch (e) {
                // Ignore
            }
            // Собираем данные
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
        }
        catch (error) {
            if (cfg.verbose) {
                console.error('[API Collector] Ошибка:', error);
            }
        }
    };
    // Подписываемся на события
    page.on('response', responseHandler);
    // Сохраняем обработчик для отписки
    page.__apiCollectorHandler = responseHandler;
    page.__apiCollectorTestId = testId;
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
        const handler = page.__apiCollectorHandler;
        if (handler) {
            page.off('response', handler);
            delete page.__apiCollectorHandler;
        }
        const currentTestId = page.__apiCollectorTestId;
        if (currentTestId) {
            await sendRemainingData(currentTestId);
            delete page.__apiCollectorTestId;
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
function createCollector(config) {
    return {
        setup: (page, testInfo) => setupApiCollector(page, testInfo, config)
    };
}
/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
async function sendCollectedData(page, testInfo) {
    console.warn('[API Collector] sendCollectedData deprecated - данные отправляются автоматически');
}
/**
 * @deprecated Используйте setupApiCollector - afterEach больше не нужен
 */
async function collectApiData(page, testInfo, config = {}) {
    setupApiCollector(page, testInfo, config);
}
//# sourceMappingURL=test-collector.js.map