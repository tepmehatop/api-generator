"use strict";
/**
 * Утилита для получения данных из Happy Path тестов
 * Версия 1.0
 *
 * Читает данные из БД (qa.api_requests) для использования в позитивных и Pairwise тестах
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchHappyPathData = fetchHappyPathData;
exports.getEndpointsWithoutHappyPathData = getEndpointsWithoutHappyPathData;
exports.extractRequiredFieldsData = extractRequiredFieldsData;
exports.extractAllFieldsData = extractAllFieldsData;
exports.generatePairwiseCombinations = generatePairwiseCombinations;
/**
 * Получает данные из Happy Path тестов для заданного эндпоинта
 *
 * @param endpoint - Endpoint (может содержать {id})
 * @param method - HTTP метод (GET, POST, PUT, DELETE)
 * @param config - Конфигурация подключения к БД
 * @returns Массив данных из Happy Path тестов
 */
async function fetchHappyPathData(endpoint, method, config) {
    const schema = config.dbSchema || 'qa';
    const samplesCount = config.samplesCount || 15;
    const sql = config.dbConnection;
    try {
        // Нормализуем endpoint (заменяем числа на {id})
        const normalizedEndpoint = endpoint.replace(/\/\d+/g, '/{id}');
        console.log(`  🔍 Ищу Happy Path данные для ${method} ${normalizedEndpoint}`);
        // Запрос к БД с нормализованным endpoint
        // Ищем записи где endpoint соответствует паттерну (с учетом {id})
        const data = await sql `
      SELECT
        id,
        endpoint,
        method,
        request_body,
        response_body,
        response_status,
        test_name
      FROM ${sql(schema + '.api_requests')}
      WHERE method = ${method}
        AND response_status >= 200 AND response_status < 300
        AND (
          endpoint = ${normalizedEndpoint}
          OR endpoint ~ ${'^' + normalizedEndpoint.replace('{id}', '\\d+')}
        )
      ORDER BY created_at DESC
      LIMIT ${samplesCount}
    `;
        if (data && data.length > 0) {
            console.log(`  ✓ Найдено ${data.length} записей Happy Path`);
            return data.map((row) => ({
                id: row.id,
                endpoint: row.endpoint,
                method: row.method,
                request_body: row.request_body,
                response_body: row.response_body,
                response_status: row.response_status,
                test_name: row.test_name
            }));
        }
        else {
            console.log(`  ⚠️  Happy Path данные не найдены для ${method} ${normalizedEndpoint}`);
            return [];
        }
    }
    catch (error) {
        console.error(`  ❌ Ошибка при получении Happy Path данных: ${error.message}`);
        return [];
    }
}
/**
 * Получает все эндпоинты без Happy Path данных
 *
 * @param config - Конфигурация подключения к БД
 * @returns Массив эндпоинтов без данных
 */
async function getEndpointsWithoutHappyPathData(config) {
    // TODO: Реализовать получение списка эндпоинтов без Happy Path данных
    // Это требует анализа всех эндпоинтов в системе и сравнения с БД
    return [];
}
/**
 * Извлекает данные для обязательных полей из Happy Path данных
 *
 * @param happyPathData - Массив Happy Path данных
 * @param requiredFields - Список обязательных полей
 * @returns Объект с данными только для обязательных полей
 */
function extractRequiredFieldsData(happyPathData, requiredFields) {
    if (happyPathData.length === 0)
        return [];
    return happyPathData.map(data => {
        const result = {};
        for (const field of requiredFields) {
            if (data.request_body && field in data.request_body) {
                result[field] = data.request_body[field];
            }
        }
        return result;
    });
}
/**
 * Извлекает данные для всех полей из Happy Path данных
 *
 * @param happyPathData - Массив Happy Path данных
 * @returns Массив объектов со всеми полями
 */
function extractAllFieldsData(happyPathData) {
    if (happyPathData.length === 0)
        return [];
    return happyPathData.map(data => data.request_body || {});
}
/**
 * Генерирует комбинации данных для Pairwise тестов
 *
 * @param happyPathData - Массив Happy Path данных
 * @param requiredFields - Список обязательных полей
 * @param optionalFields - Список необязательных полей
 * @returns Массив комбинаций данных для Pairwise тестов
 */
function generatePairwiseCombinations(happyPathData, requiredFields, optionalFields) {
    if (happyPathData.length === 0)
        return [];
    const combinations = [];
    // Берем разные записи из Happy Path для разнообразия
    for (let i = 0; i < Math.min(happyPathData.length, 10); i++) {
        const data = happyPathData[i];
        const requestBody = data.request_body || {};
        const combination = {};
        // Обязательные поля всегда включаем
        for (const field of requiredFields) {
            if (field in requestBody) {
                combination[field] = requestBody[field];
            }
        }
        // Необязательные поля - берем разные комбинации
        // Комбинация 1: 1 необязательное поле
        // Комбинация 2: 2 необязательных поля
        // Комбинация 3: 3 необязательных поля
        // и т.д.
        const optionalFieldsToInclude = optionalFields.slice(0, (i % optionalFields.length) + 1);
        for (const field of optionalFieldsToInclude) {
            if (field in requestBody) {
                combination[field] = requestBody[field];
            }
        }
        combinations.push(combination);
    }
    return combinations;
}
//# sourceMappingURL=happy-path-data-fetcher.js.map