"use strict";
/**
 * Генератор Happy Path API тестов
 * ВЕРСИЯ 14.5.7 - ИСПРАВЛЕНИЕ МАССИВОВ В REQUEST BODY
 *
 * ИСПРАВЛЕНИЯ:
 * 1. Конфигурируемый импорт test/expect (testImportPath)
 * 2. В apiErrorCodes только 200-ые коды
 * 3. Описание теста с рандомным номером
 * 4. Запросы через catch с детальным выводом
 * 5. Применены deepCompareObjects, generateTypeValidationCode, findDtoForEndpoint
 * 6. generateTypeValidationCode на основе DTO
 * 7. normalizeDbDataByDto на основе типов из DTO
 * 8. Исправлен mergeDuplicateTests (нормализация endpoint)
 * 9. createSeparateDataFiles - нормализация во внешнем файле
 * 10. Импорт DTO в тест
 * 11. Динамический импорт compareDbWithResponse из NPM пакета (packageName)
 * 12. Реальный endpoint с подставленными ID вместо {id}
 * 13. Улучшенный вывод различий с цветами (блочный формат)
 * 14. Дедупликация тестов (Идея 1 + 2)
 * 15. Валидация данных (Стратегия 1 - проверка актуальности)
 * 16. v14.2: Уникальные поля для POST запросов (uniqueFields, uniqueFieldsUpperCase)
 *     - Генерация уникальных суффиксов для избежания 400 "Уже существует"
 *     - Отдельная проверка уникальных полей (response === request)
 *     - Исключение уникальных полей из основного сравнения
 *     - Поддержка CAPS полей (code → CODE_SUFFIX)
 * 17. НОВОЕ v14.3: Тесты на валидацию (422 ошибки)
 *     - Сбор 422 ответов с детальными сообщениями во время валидации
 *     - Пропуск "Bad Request" без детализации (логирование в отдельный JSON)
 *     - Генерация тестов в отдельную папку с проверкой статуса и сообщения
 *     - Тестовые данные в папке test-data (как Happy Path)
 * 18. НОВОЕ v14.4: Тесты на дубликаты (400 ошибки)
 *     - Негативный тест: оригинальные данные → 400 + проверка ТОЧНОГО сообщения
 *     - ИСПРАВЛЕНИЕ v14.5.5: Позитивные тесты убраны (нестабильны)
 *     - 3 независимые папки: happy-path, validation-tests (422), negative-400
 *     - Сообщение берётся из реального response (не хардкод!)
 * 19. НОВОЕ v14.5.6: Pattern matching для excludeEndpoints
 *     - Поддержка wildcard (*) в любом месте пути
 *     - Поддержка path параметров типа {id}, {param}
 *     - Комбинация нескольких паттернов в одном пути
 * 20. ИСПРАВЛЕНИЕ v14.5.7: Массивы в request body
 *     - Массив [324234] больше не превращается в объект {"0": 324234}
 *     - Корректная копия данных: Array.isArray проверка перед spread
 *     - prepareUniqueFields возвращает массив без изменений
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HappyPathTestGenerator = void 0;
exports.generateHappyPathTests = generateHappyPathTests;
exports.reActualizeHappyPathTests = reActualizeHappyPathTests;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dto_finder_1 = require("./utils/dto-finder");
const data_comparison_1 = require("./utils/data-comparison");
const test_deduplication_1 = require("./utils/test-deduplication");
const data_validation_1 = require("./utils/data-validation");
const test_helpers_generator_1 = require("./utils/test-helpers-generator");
const axios_1 = __importDefault(require("axios"));
/**
 * НОВОЕ v13.0: Рекурсивный поиск файла в директории
 */
function findFileRecursively(dir, fileName, maxDepth = 5, currentDepth = 0) {
    if (currentDepth > maxDepth)
        return null;
    try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
            // Пропускаем node_modules, .git и другие служебные папки
            if (item === 'node_modules' || item === '.git' || item.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(dir, item);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isFile()) {
                    // Проверяем имя файла (без расширения и с расширениями .ts/.js)
                    const baseName = path.basename(item, path.extname(item));
                    if (baseName === fileName || item === fileName || item === `${fileName}.ts` || item === `${fileName}.js`) {
                        return fullPath;
                    }
                }
                else if (stat.isDirectory()) {
                    // Рекурсивно ищем в поддиректориях
                    const found = findFileRecursively(fullPath, fileName, maxDepth, currentDepth + 1);
                    if (found)
                        return found;
                }
            }
            catch (err) {
                // Пропускаем файлы/папки к которым нет доступа
                continue;
            }
        }
    }
    catch (err) {
        return null;
    }
    return null;
}
/**
 * НОВОЕ v13.0: Умный поиск axios конфига с несколькими стратегиями
 */
async function findAndLoadAxiosConfig(configPath, configName, debug = false) {
    const searchPaths = [];
    const cwd = process.cwd();
    if (debug) {
        console.log(`🐛 Текущая рабочая директория: ${cwd}`);
        console.log(`🐛 Ищем axios конфиг: ${configName}`);
    }
    // Стратегия 1: Попробовать указанный путь как есть
    if (configPath) {
        searchPaths.push(configPath);
        // Стратегия 2: Попробовать путь относительно cwd
        const absolutePath = path.isAbsolute(configPath)
            ? configPath
            : path.join(cwd, configPath);
        searchPaths.push(absolutePath);
        // Добавляем варианты с расширениями
        searchPaths.push(absolutePath + '.ts');
        searchPaths.push(absolutePath + '.js');
    }
    // Стратегия 3: Поиск по имени файла
    const fileNameFromPath = configPath
        ? path.basename(configPath, path.extname(configPath))
        : 'axiosHelpers';
    if (debug) {
        console.log(`🐛 Имя файла для поиска: ${fileNameFromPath}`);
        console.log(`🐛 Стратегии поиска:`);
        console.log(`   1. Указанный путь: ${configPath || 'не указан'}`);
        console.log(`   2. Относительно cwd: ${cwd}`);
        console.log(`   3. Рекурсивный поиск по имени: ${fileNameFromPath}`);
    }
    // Пробуем каждый путь
    for (const searchPath of searchPaths) {
        if (debug) {
            console.log(`🐛 Пробую путь: ${searchPath}`);
        }
        try {
            const module = await Promise.resolve(`${searchPath}`).then(s => __importStar(require(s)));
            if (module[configName]) {
                if (debug) {
                    console.log(`✓ Найден конфиг по пути: ${searchPath}`);
                }
                return module[configName];
            }
            else {
                if (debug) {
                    console.log(`   ⚠️  Файл найден, но не содержит '${configName}'`);
                    console.log(`   Доступные экспорты:`, Object.keys(module));
                }
            }
        }
        catch (error) {
            if (debug && !error.message.includes('Cannot find module')) {
                console.log(`   ⚠️  Ошибка загрузки: ${error.message}`);
            }
        }
    }
    // Стратегия 4: Рекурсивный поиск файла
    if (debug) {
        console.log(`🐛 Начинаю рекурсивный поиск файла '${fileNameFromPath}' в ${cwd}...`);
    }
    const foundPath = findFileRecursively(cwd, fileNameFromPath);
    if (foundPath) {
        if (debug) {
            console.log(`🐛 Файл найден: ${foundPath}`);
        }
        // Пробуем разные способы загрузки
        const pathsToTry = [foundPath];
        // Если это .ts файл, ищем скомпилированную .js версию
        if (foundPath.endsWith('.ts')) {
            const jsPath = foundPath.replace(/\.ts$/, '.js');
            pathsToTry.push(jsPath);
            // Также пробуем в dist/build папках
            const dirName = path.dirname(foundPath);
            const baseName = path.basename(foundPath, '.ts');
            pathsToTry.push(path.join(dirName, '..', 'dist', baseName + '.js'));
            pathsToTry.push(path.join(dirName, '..', 'build', baseName + '.js'));
            pathsToTry.push(path.join(dirName, 'dist', baseName + '.js'));
        }
        for (const tryPath of pathsToTry) {
            if (!fs.existsSync(tryPath))
                continue;
            if (debug) {
                console.log(`🐛 Пробую загрузить: ${tryPath}`);
            }
            try {
                // Способ 1: Динамический import с file:// протоколом
                let module;
                try {
                    // Правильный формат file:// URL для разных платформ
                    const fileUrl = new URL('file://' + (tryPath.startsWith('/') ? '' : '/') + tryPath.replace(/\\/g, '/')).href;
                    if (debug) {
                        console.log(`🐛   Пробую import с URL: ${fileUrl}`);
                    }
                    module = await Promise.resolve(`${fileUrl}`).then(s => __importStar(require(s)));
                }
                catch (importError) {
                    if (debug) {
                        console.log(`🐛   Import не сработал: ${importError.message}`);
                    }
                    // Способ 2: Используем require (для CommonJS)
                    try {
                        if (debug) {
                            console.log(`🐛   Пробую require: ${tryPath}`);
                        }
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        module = require(tryPath);
                    }
                    catch (requireError) {
                        if (debug) {
                            console.log(`🐛   Require не сработал: ${requireError.message}`);
                        }
                        continue;
                    }
                }
                // Проверяем наличие конфига
                if (module && module[configName]) {
                    if (debug) {
                        console.log(`✓ Конфиг '${configName}' найден в файле: ${tryPath}`);
                    }
                    return module[configName];
                }
                else if (module && module.default && module.default[configName]) {
                    // Проверяем default export
                    if (debug) {
                        console.log(`✓ Конфиг '${configName}' найден в default export файла: ${tryPath}`);
                    }
                    return module.default[configName];
                }
                else {
                    if (debug) {
                        const availableKeys = module ? Object.keys(module) : [];
                        console.log(`⚠️  Файл загружен, но не содержит '${configName}'`);
                        console.log(`   Доступные экспорты:`, availableKeys);
                        if (module?.default) {
                            console.log(`   Экспорты в default:`, Object.keys(module.default));
                        }
                    }
                }
            }
            catch (error) {
                if (debug) {
                    console.log(`❌ Ошибка при загрузке ${tryPath}: ${error.message}`);
                }
            }
        }
    }
    else {
        if (debug) {
            console.log(`⚠️  Файл '${fileNameFromPath}' не найден в проекте`);
        }
    }
    return null;
}
/**
 * НОВОЕ v14.0: Определяет категорию из пути endpoint
 * /api/v1/orders/place -> orders
 * /api/v2/users/{id}/profile -> users
 * /api/v1/finance/reports/summary -> finance
 */
function getCategoryFromEndpoint(endpoint) {
    // Стратегия 1: Извлекаем из пути после /api/v1/ или /api/v2/
    // /api/v1/orders/place -> orders
    const versionedMatch = endpoint.match(/^\/api\/v\d+\/([^/]+)/);
    if (versionedMatch) {
        return versionedMatch[1].toLowerCase();
    }
    // Стратегия 2: Извлекаем из пути после /api/ (без версии)
    // /api/orders/search -> orders
    const simpleMatch = endpoint.match(/^\/api\/([^/]+)/);
    if (simpleMatch && !simpleMatch[1].match(/^v\d+$/)) {
        return simpleMatch[1].toLowerCase();
    }
    // Стратегия 3: Первый значимый сегмент пути
    const segments = endpoint.split('/').filter(s => s && !s.match(/^(api|v\d+|\{[^}]+\})$/));
    if (segments.length > 0) {
        return segments[0].toLowerCase();
    }
    return 'other';
}
// НОВОЕ v14.0: Проверяет нужно ли исключить endpoint
// ОБНОВЛЕНИЕ v14.5.6: Поддержка паттернов с wildcard (*) и path параметрами ({id})
// Примеры: "/api/v1/orders", "/api/v1/orders/*", "/api/v1/order/*/create", "/api/v1/order/{id}/create"
function shouldExcludeEndpoint(endpoint, excludePatterns) {
    if (!excludePatterns || excludePatterns.length === 0)
        return false;
    for (const pattern of excludePatterns) {
        // Проверяем содержит ли паттерн wildcard (*) или path параметры ({...})
        const hasWildcard = pattern.includes('*');
        const hasPathParam = /\{[^}]+\}/.test(pattern);
        if (hasWildcard || hasPathParam) {
            // Конвертируем паттерн в регулярное выражение
            const regexPattern = patternToRegex(pattern);
            if (regexPattern.test(endpoint))
                return true;
        }
        else {
            // Точное совпадение или префикс
            if (endpoint === pattern || endpoint.startsWith(pattern + '/')) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Конвертирует паттерн endpoint в регулярное выражение
 * - * заменяется на [^/]+ (любой сегмент пути, кроме /)
 * - {param} заменяется на [^/]+ (любой сегмент пути)
 * - Остальные символы экранируются
 */
function patternToRegex(pattern) {
    // Экранируем специальные символы regex, кроме * и {}
    let regexStr = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Экранируем спец. символы
        .replace(/\\\{[^}]+\\\}/g, '[^/]+') // {param} -> [^/]+
        .replace(/\*/g, '[^/]+'); // * -> [^/]+
    // Добавляем якоря для точного совпадения всего пути
    return new RegExp(`^${regexStr}$`);
}
/**
 * НОВОЕ v14.0: Проверяет нужно ли исключить HTTP метод
 */
function shouldExcludeMethod(method, excludeMethods) {
    if (!excludeMethods || excludeMethods.length === 0)
        return false;
    return excludeMethods.map(m => m.toUpperCase()).includes(method.toUpperCase());
}
class HappyPathTestGenerator {
    /**
     * @param config - Конфигурация генератора
     * @param sqlConnection - Подключение к БД для ОБРАТНОЙ СОВМЕСТИМОСТИ
     *                        Предпочтительнее использовать config.dbDataConnection и config.dbStandConnection
     */
    constructor(config, sqlConnection) {
        // Читаем package.json для получения названия пакета
        let defaultPackageName = '@your-company/api-codegen';
        try {
            const packageJsonPath = path.join(__dirname, '../../package.json');
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                defaultPackageName = packageJson.name || defaultPackageName;
            }
        }
        catch (error) {
            console.warn('⚠️  Не удалось прочитать package.json, используется название по умолчанию');
        }
        this.config = {
            // Основные параметры
            endpointFilter: [],
            methodFilter: [],
            excludeEndpoints: [], // НОВОЕ v14.0
            excludeMethods: [], // НОВОЕ v14.0
            maxTestsPerEndpoint: 5,
            onlySuccessful: true,
            testTag: '@apiHappyPath',
            force: false,
            groupByCategory: true, // НОВОЕ v14.0: Группировка по категориям
            // Подключения к БД
            dbSchema: 'qa', // deprecated
            dbDataSchema: 'qa', // НОВОЕ v14.0
            dbStandSchema: 'public', // НОВОЕ v14.0
            dbConnectionMethod: '', // deprecated
            dbDataConnection: undefined, // НОВОЕ v14.0
            dbStandConnection: undefined, // НОВОЕ v14.0
            // Настройки тестов
            standUrlEnvVar: 'StandURL',
            axiosConfigName: 'configApiHeaderAdmin',
            axiosConfigPath: '../../../helpers/axiosHelpers',
            apiTestHelperPath: '../../../helpers/apiTestHelper', // НОВОЕ v14.0
            emailHelperPath: '', // НОВОЕ v14.1
            emailHelperMethodName: 'sendErrorMailbyApi', // НОВОЕ v14.1
            send5xxEmailNotification: false, // НОВОЕ v14.1
            apiGeneratedPath: '',
            createSeparateDataFiles: false,
            mergeDuplicateTests: true,
            testImportPath: '@playwright/test',
            packageName: defaultPackageName,
            debug: false,
            // НОВОЕ v14.2: Уникальные поля для POST запросов
            uniqueFields: ['name', 'code', 'title'],
            uniqueFieldsUpperCase: ['code'],
            enableUniqueFieldGeneration: true,
            // НОВОЕ v14.5.4: Управление сравнением полей в response
            skipCompareFields: ['id', 'created_at', 'updated_at', 'createdAt', 'updatedAt'],
            ignoreFieldValues: [],
            ...config,
            // НОВОЕ v12.0: Дефолтные настройки дедупликации
            deduplication: {
                enabled: true,
                ignoreFields: ['id', '*_id', 'created_at', 'updated_at', 'modified_at', 'deleted_at', 'timestamp', '*_timestamp', 'uuid', 'guid'],
                significantFields: ['status', 'state', 'type', 'role', 'category', 'kind'],
                detectEdgeCases: true,
                maxTestsPerEndpoint: 2, // Максимум 2 теста на эндпоинт (как указал пользователь)
                preserveTaggedTests: ['[KEEP]', '[IMPORTANT]'],
                ...(config.deduplication || {})
            },
            // НОВОЕ v12.0: Дефолтные настройки валидации
            dataValidation: {
                enabled: true,
                validateBeforeGeneration: true,
                onStaleData: 'delete', // Удаляем устаревшие (как указал пользователь)
                staleIfChanged: ['status', 'state', 'type', 'role', 'category'],
                allowChanges: ['updated_at', 'modified_at', '*_timestamp', '*_at'],
                validateInDatabase: false, // По умолчанию выключено (нужна настройка)
                logChanges: true,
                logPath: './happy-path-validation-logs',
                // НОВОЕ v14.1: Логирование ошибок валидации
                clientErrorsLogPath: './validation-errors/4xx-client-errors.json',
                serverErrorsLogPath: './validation-errors/5xx-server-errors.json',
                sendServerErrorEmail: false,
                // НОВОЕ v14.5.4: Количество повторных вызовов для POST/PUT/PATCH
                validationRetries: 1,
                ...(config.dataValidation || {})
            },
            // НОВОЕ v14.3: Дефолтные настройки генерации тестов на валидацию (422)
            // ИСПРАВЛЕНИЕ v14.5.1: Убраны пустые паттерны, добавлены реальные паттерны пропуска
            validationTests: {
                enabled: false, // По умолчанию выключено
                outputDir: '../validation-tests',
                badRequestSkipLogPath: './validation-errors/422-bad-request-skipped.json',
                createSeparateDataFiles: true,
                groupByCategory: true,
                testTag: '@apiValidation',
                maxTestsPerEndpoint: 3,
                skipMessagePatterns: [], // Пустой - собираем все сообщения кроме пустых
                ...(config.validationTests || {})
            },
            // НОВОЕ v14.4: Дефолтные настройки генерации тестов на 400 дубликаты
            // ИСПРАВЛЕНИЕ v14.5.1: Убраны пустые паттерны
            duplicateTests: {
                enabled: false, // По умолчанию выключено
                outputDir: './tests/api/negative-400',
                badRequestSkipLogPath: './validation-errors/400-bad-request-skipped.json',
                createSeparateDataFiles: true,
                groupByCategory: true,
                testTag: '@negative400Validation',
                maxTestsPerEndpoint: 2,
                skipMessagePatterns: [], // Пустой - собираем все сообщения кроме пустых
                ...(config.duplicateTests || {})
            }
        };
        // НОВОЕ v14.0: Поддержка двух подключений к БД
        // Приоритет: config.dbDataConnection > sqlConnection (для обратной совместимости)
        this.sql = config.dbDataConnection || sqlConnection;
        // Подключение к БД стенда для валидации (опционально)
        this.sqlStand = config.dbStandConnection || null;
        if (!this.sql) {
            console.warn('⚠️  Подключение к БД не настроено! Передайте sqlConnection или config.dbDataConnection');
        }
        if (this.config.dataValidation.validateInDatabase && !this.sqlStand) {
            console.warn('⚠️  validateInDatabase=true, но dbStandConnection не настроен');
        }
    }
    /**
     * НОВОЕ v14.1: Загружает функцию отправки email для уведомлений об ошибках
     */
    async loadEmailSendFunction() {
        if (!this.config.emailHelperPath || !this.config.send5xxEmailNotification) {
            return undefined;
        }
        try {
            const emailHelperPath = this.config.emailHelperPath;
            const methodName = this.config.emailHelperMethodName || 'sendErrorMailbyApi';
            // Пытаемся найти и загрузить модуль
            const possiblePaths = [
                path.resolve(process.cwd(), emailHelperPath),
                path.resolve(process.cwd(), emailHelperPath + '.ts'),
                path.resolve(process.cwd(), emailHelperPath + '.js'),
                path.resolve(process.cwd(), 'src', emailHelperPath),
                path.resolve(process.cwd(), 'src', emailHelperPath + '.ts')
            ];
            for (const tryPath of possiblePaths) {
                if (fs.existsSync(tryPath)) {
                    try {
                        const module = require(tryPath);
                        if (module[methodName] && typeof module[methodName] === 'function') {
                            if (this.config.debug) {
                                console.log(`🐛 Email функция '${methodName}' загружена из ${tryPath}`);
                            }
                            return module[methodName];
                        }
                    }
                    catch (e) {
                        // Продолжаем поиск
                    }
                }
            }
            console.warn(`⚠️  Не удалось загрузить email функцию '${methodName}' из '${emailHelperPath}'`);
            return undefined;
        }
        catch (error) {
            console.warn(`⚠️  Ошибка при загрузке email функции:`, error);
            return undefined;
        }
    }
    async generate() {
        console.log('🔍 Подключаюсь к БД и собираю данные...');
        console.log(this.config.force ? '⚠️  FORCE режим' : 'ℹ️  Инкрементальный режим');
        if (this.config.debug) {
            console.log('🐛 DEBUG MODE: Включен детальный вывод');
            console.log('🐛 Конфигурация:', JSON.stringify({
                standUrlEnvVar: this.config.standUrlEnvVar,
                standUrl: process.env[this.config.standUrlEnvVar],
                axiosConfigName: this.config.axiosConfigName,
                axiosConfigPath: this.config.axiosConfigPath,
                dbSchema: this.config.dbSchema
            }, null, 2));
        }
        let uniqueRequests = await this.fetchUniqueRequests();
        console.log(`📊 Найдено ${uniqueRequests.length} уникальных запросов`);
        // НОВОЕ v12.0: Валидация данных (проверка актуальности)
        if (this.config.dataValidation.enabled && this.config.dataValidation.validateBeforeGeneration) {
            try {
                // НОВОЕ v13.0: Умная загрузка axios конфига с автопоиском
                let axiosConfigObject = undefined;
                if (this.config.axiosConfigName) {
                    console.log(`\n🔍 Поиск axios конфига '${this.config.axiosConfigName}'...`);
                    const loadedAxiosConfig = await findAndLoadAxiosConfig(this.config.axiosConfigPath, this.config.axiosConfigName, this.config.debug);
                    if (loadedAxiosConfig) {
                        console.log(`✓ Axios конфиг '${this.config.axiosConfigName}' загружен успешно`);
                        // Проверяем: это axios instance или просто объект конфигурации?
                        const isAxiosInstance = typeof loadedAxiosConfig?.get === 'function';
                        if (isAxiosInstance) {
                            // Это axios instance - извлекаем конфиг
                            axiosConfigObject = loadedAxiosConfig.defaults;
                            if (this.config.debug) {
                                console.log(`🐛 Загружен axios instance`);
                                console.log(`🐛 Конфиг содержит:`, {
                                    hasHeaders: !!axiosConfigObject?.headers,
                                    hasAuth: !!axiosConfigObject?.headers?.Authorization,
                                    baseURL: axiosConfigObject?.baseURL
                                });
                            }
                        }
                        else {
                            // Это просто объект конфигурации
                            axiosConfigObject = loadedAxiosConfig;
                            if (this.config.debug) {
                                console.log(`🐛 Загружен объект конфигурации`);
                                console.log(`🐛 Конфиг содержит:`, {
                                    hasHeaders: !!axiosConfigObject?.headers,
                                    hasAuth: !!axiosConfigObject?.headers?.authorization || !!axiosConfigObject?.headers?.Authorization,
                                    hasHttpsAgent: !!axiosConfigObject?.httpsAgent
                                });
                            }
                        }
                        // Показываем все заголовки в debug режиме
                        if (this.config.debug && axiosConfigObject?.headers) {
                            console.log(`🐛 Все заголовки:`, JSON.stringify(axiosConfigObject.headers, null, 2));
                        }
                    }
                    else {
                        console.warn(`⚠️  Не удалось найти axios конфиг '${this.config.axiosConfigName}'`);
                        console.warn(`⚠️  Продолжаю без авторизации (могут быть 401 ошибки)`);
                    }
                }
                // Получаем URL стенда из переменной окружения
                const standUrl = process.env[this.config.standUrlEnvVar];
                if (!standUrl) {
                    console.warn(`⚠️  Переменная окружения ${this.config.standUrlEnvVar} не установлена`);
                    if (this.config.debug) {
                        console.log(`🐛 Доступные env переменные:`, Object.keys(process.env).filter(k => k.includes('URL')));
                    }
                }
                else if (this.config.debug) {
                    console.log(`🐛 Stand URL: ${standUrl}`);
                }
                // Обновляем конфиг валидации с правильными настройками
                // НОВОЕ v14.0: Используем основные настройки axios из конфига (без дублирования)
                // НОВОЕ v14.1: Добавляем логирование ошибок и email для 5xx
                // НОВОЕ v14.3: Добавляем сбор 422 ошибок для генерации тестов валидации
                const validationConfig = {
                    ...this.config.dataValidation,
                    standUrl: standUrl,
                    axiosConfig: axiosConfigObject,
                    // НОВОЕ v14.1: Передаём функцию отправки email если настроена
                    emailSendFunction: this.config.send5xxEmailNotification && this.config.emailHelperPath
                        ? await this.loadEmailSendFunction()
                        : undefined,
                    // НОВОЕ v14.3: Сбор 422 ошибок
                    collect422Errors: this.config.validationTests.enabled,
                    badRequestSkipLogPath: this.config.validationTests.badRequestSkipLogPath,
                    skipMessagePatterns: this.config.validationTests.skipMessagePatterns,
                    // НОВОЕ v14.5.2: Пропуск пустых response для 422
                    skipEmptyResponse422: this.config.validationTests.skipEmptyResponse !== false,
                    // НОВОЕ v14.4: Сбор 400 ошибок для парных тестов
                    collect400Errors: this.config.duplicateTests.enabled,
                    badRequest400SkipLogPath: this.config.duplicateTests.badRequestSkipLogPath,
                    skip400MessagePatterns: this.config.duplicateTests.skipMessagePatterns,
                    // НОВОЕ v14.5.2: Пропуск пустых response для 400
                    skipEmptyResponse400: this.config.duplicateTests.skipEmptyResponse !== false
                };
                if (this.config.debug) {
                    console.log(`🐛 Конфиг валидации:`, {
                        enabled: validationConfig.enabled,
                        validateBeforeGeneration: validationConfig.validateBeforeGeneration,
                        standUrl: validationConfig.standUrl,
                        hasAxiosConfig: !!validationConfig.axiosConfig,
                        hasAuthHeader: !!validationConfig.axiosConfig?.headers?.authorization || !!validationConfig.axiosConfig?.headers?.Authorization,
                        clientErrorsLogPath: validationConfig.clientErrorsLogPath,
                        serverErrorsLogPath: validationConfig.serverErrorsLogPath,
                        sendServerErrorEmail: validationConfig.sendServerErrorEmail
                    });
                }
                // ВАЖНО: Передаем настоящий axios, а конфиг - отдельно в validationConfig
                const validationResult = await (0, data_validation_1.validateRequests)(uniqueRequests, validationConfig, axios_1.default // ← Настоящий axios, не конфиг!
                );
                uniqueRequests = validationResult.validRequests;
                console.log(`\n✅ Валидация завершена:`);
                console.log(`   Осталось запросов: ${uniqueRequests.length}`);
                if (validationResult.updatedCount > 0) {
                    console.log(`   Обновлено: ${validationResult.updatedCount}`);
                }
                if (validationResult.deletedCount > 0) {
                    console.log(`   Удалено устаревших: ${validationResult.deletedCount}`);
                }
                if (validationResult.skippedCount > 0) {
                    console.log(`   Пропущено: ${validationResult.skippedCount}`);
                }
                // НОВОЕ v14.3: Генерируем тесты на валидацию (422 ошибки)
                if (this.config.debug || validationResult.validation422Errors.length > 0 || validationResult.duplicate400Errors.length > 0) {
                    console.log(`\n📋 Собранные ошибки для генерации тестов:`);
                    console.log(`   422 ошибок: ${validationResult.validation422Errors.length} (генерация: ${this.config.validationTests.enabled ? 'ВКЛ' : 'ВЫКЛ'})`);
                    console.log(`   400 ошибок: ${validationResult.duplicate400Errors.length} (генерация: ${this.config.duplicateTests.enabled ? 'ВКЛ' : 'ВЫКЛ'})`);
                }
                if (this.config.validationTests.enabled && validationResult.validation422Errors.length > 0) {
                    await this.generateValidation422Tests(validationResult.validation422Errors);
                }
                else if (this.config.validationTests.enabled && validationResult.validation422Errors.length === 0) {
                    console.log(`   ⚠️  422 тесты включены, но ошибок не найдено`);
                }
                // НОВОЕ v14.4: Генерируем парные тесты на дубликаты (400 ошибки)
                if (this.config.duplicateTests.enabled && validationResult.duplicate400Errors.length > 0) {
                    await this.generate400DuplicateTests(validationResult.duplicate400Errors);
                }
                else if (this.config.duplicateTests.enabled && validationResult.duplicate400Errors.length === 0) {
                    console.log(`   ⚠️  400 тесты включены, но ошибок не найдено`);
                }
            }
            catch (error) {
                console.error('❌ Ошибка при валидации данных:', error.message);
                if (this.config.debug) {
                    console.error('🐛 Полная ошибка:', error);
                }
                console.log('⚠️  Продолжаю без валидации');
            }
        }
        const grouped = this.config.mergeDuplicateTests
            ? this.groupByStructure(uniqueRequests)
            : this.groupByEndpoint(uniqueRequests);
        console.log(`📁 Сгруппировано по ${Object.keys(grouped).length} endpoints\n`);
        let totalTests = 0;
        let newTests = 0;
        for (const [endpoint, requests] of Object.entries(grouped)) {
            const { total, added } = await this.generateTestsForEndpoint(endpoint, requests);
            totalTests += total;
            newTests += added;
        }
        console.log(`\n✨ Генерация завершена!`);
        console.log(`   Всего тестов: ${totalTests}`);
        console.log(`   Новых тестов: ${newTests}`);
    }
    /**
     * ИСПРАВЛЕНИЕ 8: Правильная группировка - заменяем числа на {id}
     */
    groupByStructure(requests) {
        const grouped = {};
        for (const request of requests) {
            // Заменяем все числа в пути на {id}
            const normalizedEndpoint = request.endpoint.replace(/\/\d+/g, '/{id}');
            const key = `${request.method}:${normalizedEndpoint}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            if (grouped[key].length < this.config.maxTestsPerEndpoint) {
                grouped[key].push(request);
            }
        }
        return grouped;
    }
    groupByEndpoint(requests) {
        const grouped = {};
        for (const request of requests) {
            const key = `${request.method}:${request.endpoint}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            if (grouped[key].length < this.config.maxTestsPerEndpoint) {
                grouped[key].push(request);
            }
        }
        return grouped;
    }
    async fetchUniqueRequests() {
        const schema = this.config.dbSchema;
        const conditions = [];
        if (this.config.onlySuccessful) {
            conditions.push('response_status >= 200 AND response_status < 300');
        }
        if (this.config.endpointFilter.length > 0) {
            const endpoints = this.config.endpointFilter.map(e => `'${e}'`).join(',');
            conditions.push(`endpoint IN (${endpoints})`);
        }
        if (this.config.methodFilter.length > 0) {
            const methods = this.config.methodFilter.map(m => `'${m}'`).join(',');
            conditions.push(`method IN (${methods})`);
        }
        if (!this.config.force) {
            conditions.push('(test_generated IS NULL OR test_generated = FALSE)');
        }
        let requests;
        if (conditions.length > 0) {
            const whereClause = conditions.join(' AND ');
            requests = await this.sql `
        SELECT DISTINCT ON (endpoint, method, request_body::text)
          id,
          endpoint,
          method,
          request_body,
          response_body,
          response_status,
          test_name,
          test_generated,
          test_file_path
        FROM ${this.sql(schema + '.api_requests')}
        WHERE ${this.sql.unsafe(whereClause)}
        ORDER BY endpoint, method, request_body::text, created_at DESC
      `;
        }
        else {
            requests = await this.sql `
        SELECT DISTINCT ON (endpoint, method, request_body::text)
          id,
          endpoint,
          method,
          request_body,
          response_body,
          response_status,
          test_name,
          test_generated,
          test_file_path
        FROM ${this.sql(schema + '.api_requests')}
        ORDER BY endpoint, method, request_body::text, created_at DESC
      `;
        }
        // НОВОЕ v14.0: Фильтрация по excludeEndpoints и excludeMethods
        let filteredRequests = requests;
        if (this.config.excludeEndpoints.length > 0) {
            const beforeCount = filteredRequests.length;
            filteredRequests = filteredRequests.filter(r => !shouldExcludeEndpoint(r.endpoint, this.config.excludeEndpoints));
            if (filteredRequests.length !== beforeCount) {
                console.log(`  🚫 Исключено по excludeEndpoints: ${beforeCount - filteredRequests.length} запросов`);
            }
        }
        if (this.config.excludeMethods.length > 0) {
            const beforeCount = filteredRequests.length;
            filteredRequests = filteredRequests.filter(r => !shouldExcludeMethod(r.method, this.config.excludeMethods));
            if (filteredRequests.length !== beforeCount) {
                console.log(`  🚫 Исключено по excludeMethods: ${beforeCount - filteredRequests.length} запросов`);
            }
        }
        return filteredRequests;
    }
    async generateTestsForEndpoint(endpointKey, requests) {
        const [method, endpoint] = endpointKey.split(':');
        // НОВОЕ v12.0: Дедупликация тестов (Идея 1 + 2)
        if (this.config.deduplication.enabled && requests.length > 1) {
            const beforeCount = requests.length;
            requests = (0, test_deduplication_1.deduplicateTests)(requests, this.config.deduplication);
            const afterCount = requests.length;
            if (beforeCount !== afterCount) {
                console.log(`  🔄 Дедупликация ${endpoint}: ${beforeCount} → ${afterCount} тестов`);
            }
        }
        const fileName = this.endpointToFileName(endpoint, method);
        // НОВОЕ v14.0: Группировка по категориям
        let outputDir = this.config.outputDir;
        if (this.config.groupByCategory) {
            const category = getCategoryFromEndpoint(endpoint);
            outputDir = path.join(this.config.outputDir, category);
        }
        const filePath = path.join(outputDir, `${fileName}.happy-path.test.ts`);
        const fileExists = fs.existsSync(filePath);
        let existingTests = [];
        let newTestsAdded = 0;
        if (fileExists && !this.config.force) {
            const content = fs.readFileSync(filePath, 'utf-8');
            existingTests = this.extractTestIds(content);
            requests = requests.filter(r => !existingTests.includes(`db-id-${r.id}`));
            newTestsAdded = requests.length;
            if (requests.length === 0) {
                console.log(`  ⏭️  ${fileName}.happy-path.test.ts - нет новых данных`);
                return { total: existingTests.length, added: 0 };
            }
            await this.appendTestsToFile(filePath, endpoint, method, requests);
            console.log(`  ✓ ${fileName}.happy-path.test.ts (+${requests.length})`);
        }
        else {
            // НОВОЕ v14.0: Создаем папку с категорией
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }
            if (this.config.createSeparateDataFiles) {
                const dataDir = path.join(outputDir, 'test-data');
                if (!fs.existsSync(dataDir)) {
                    fs.mkdirSync(dataDir, { recursive: true });
                }
            }
            const testCode = await this.generateTestFile(endpoint, method, requests, outputDir);
            fs.writeFileSync(filePath, testCode, 'utf-8');
            newTestsAdded = requests.length;
            const mode = this.config.force ? '🔄' : '✨';
            console.log(`  ${mode} ${fileName}.happy-path.test.ts (${requests.length})`);
        }
        await this.markAsGenerated(requests.map(r => r.id), filePath);
        return {
            total: existingTests.length + newTestsAdded,
            added: newTestsAdded
        };
    }
    extractTestIds(content) {
        const matches = content.matchAll(/\/\/\s*DB ID:\s*(db-id-\d+)/g);
        return Array.from(matches, m => m[1]);
    }
    async appendTestsToFile(filePath, endpoint, method, requests) {
        let content = fs.readFileSync(filePath, 'utf-8');
        const lastBraceIndex = content.lastIndexOf('});');
        if (lastBraceIndex === -1) {
            throw new Error(`Не удалось найти конец describe блока в ${filePath}`);
        }
        // Находим DTO
        let dtoInfo = null;
        if (this.config.apiGeneratedPath) {
            dtoInfo = (0, dto_finder_1.findDtoForEndpoint)(this.config.apiGeneratedPath, endpoint, method);
        }
        const newTests = await Promise.all(requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1, dtoInfo)));
        content = content.slice(0, lastBraceIndex) + '\n' + newTests.join('\n\n') + '\n' + content.slice(lastBraceIndex);
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    /**
     * Генерирует полный файл теста
     * @param endpoint - Эндпоинт API
     * @param method - HTTP метод
     * @param requests - Массив запросов
     * @param outputDir - Папка для тестов (с учётом категории если groupByCategory: true)
     */
    async generateTestFile(endpoint, method, requests, outputDir) {
        // Ищем DTO
        let dtoInfo = null;
        if (this.config.apiGeneratedPath) {
            dtoInfo = (0, dto_finder_1.findDtoForEndpoint)(this.config.apiGeneratedPath, endpoint, method);
        }
        // Генерируем импорты
        const imports = [
            // ИСПРАВЛЕНИЕ 1: Конфигурируемый импорт
            `import test, { expect } from '${this.config.testImportPath}';`,
            `import axios from 'axios';`,
        ];
        // ИСПРАВЛЕНИЕ 11: Импорт функций сравнения из NPM пакета
        // ИСПРАВЛЕНИЕ v14.5.1: formatDifferencesAsBlocks импортируется из test-helpers если createSeparateDataFiles=true
        if (this.config.createSeparateDataFiles) {
            // Только compareDbWithResponse - formatDifferencesAsBlocks придёт из test-helpers
            imports.push(`import { compareDbWithResponse } from '${this.config.packageName}/dist/utils/data-comparison';`);
        }
        else {
            // Обе функции из пакета
            imports.push(`import { compareDbWithResponse, formatDifferencesAsBlocks } from '${this.config.packageName}/dist/utils/data-comparison';`);
        }
        // Импорт axios конфига
        if (this.config.axiosConfigPath && this.config.axiosConfigName) {
            imports.push(`import { ${this.config.axiosConfigName} } from '${this.config.axiosConfigPath}';`);
        }
        // НОВОЕ v14.1: Импорт handleApiError из apiTestHelper (содержит email логику внутри)
        if (this.config.apiTestHelperPath) {
            imports.push(`import { handleApiError } from '${this.config.apiTestHelperPath}';`);
        }
        // НОВОЕ v14.1: Импорт функции отправки email если настроена
        if (this.config.send5xxEmailNotification && this.config.emailHelperPath) {
            imports.push(`import { ${this.config.emailHelperMethodName} } from '${this.config.emailHelperPath}';`);
        }
        // ИСПРАВЛЕНИЕ 10: Импорт DTO
        // ИСПРАВЛЕНИЕ v14.1: Используем переданный outputDir для корректного относительного пути
        if (dtoInfo) {
            const dtoImportPath = this.getRelativePath(outputDir, dtoInfo.filePath);
            imports.push(`import type { ${dtoInfo.name} } from '${dtoImportPath}';`);
        }
        // ИСПРАВЛЕНИЕ 9: Импорты нормализованных данных
        if (this.config.createSeparateDataFiles) {
            const fileName = this.endpointToFileName(endpoint, method);
            // НОВОЕ v14.5: Импорт helper функций (включая formatDifferencesAsBlocks)
            imports.push(`import { prepareUniqueFields, buildCurlCommand, compareWithoutUniqueFields, verifyUniqueFields, formatDifferencesAsBlocks } from './test-data/test-helpers';`);
            for (let i = 0; i < requests.length; i++) {
                imports.push(`import { requestData as requestData${i + 1}, normalizedExpectedResponse as normalizedExpectedResponse${i + 1} } from './test-data/${fileName}-data-${i + 1}';`);
            }
        }
        // Генерируем тесты
        const tests = await Promise.all(requests.map((req, index) => this.generateSingleTest(endpoint, method, req, index + 1, dtoInfo)));
        // ИСПРАВЛЕНИЕ 9: Создаем файлы с нормализованными данными
        // ИСПРАВЛЕНИЕ v14.1: Передаём outputDir с учётом категории
        if (this.config.createSeparateDataFiles) {
            await this.createDataFiles(endpoint, method, requests, dtoInfo, outputDir);
        }
        // ИСПРАВЛЕНИЕ 3: Рандомный номер
        const randomId = Math.floor(Math.random() * 10000);
        return `${imports.join('\n')}

const endpoint = '${endpoint}';
const httpMethod = '${method}';

// ИСПРАВЛЕНИЕ 2: Только 200-ые коды
const apiErrorCodes = {
  success: 200,
  created: 201,
  noContent: 204,
};

const success = apiErrorCodes.${this.getSuccessCodeName(requests[0]?.response_status || 200)};

// ИСПРАВЛЕНИЕ 3: Автоматическое описание
const caseInfoObj = {
  testCase: 'HP-${randomId}',
  aqaOwner: 'HappyPathGenerator',
  tms_testName: 'Happy path тесты с проверкой ${method} ${endpoint}',
  testType: 'api'
};

test.describe.configure({ mode: "parallel" });
test.describe(\`API тесты для эндпоинта \${httpMethod} >> \${endpoint} - Happy Path\`, async () => {

  // ============================================
  // HAPPY PATH ТЕСТЫ
  // ============================================

${tests.join('\n\n')}

});
`;
    }
    /**
     * ИСПРАВЛЕНИЕ 9: Создает файлы с НОРМАЛИЗОВАННЫМИ данными на основе DTO
     * ИСПРАВЛЕНИЕ v14.1: Добавлен параметр outputDir для корректной работы с groupByCategory
     */
    async createDataFiles(endpoint, method, requests, dtoInfo, outputDir) {
        const fileName = this.endpointToFileName(endpoint, method);
        // ИСПРАВЛЕНИЕ v14.1: Используем переданный outputDir вместо this.config.outputDir
        const dataDir = path.join(outputDir, 'test-data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        // НОВОЕ v14.5: Генерируем файл с helper функциями (один раз на папку)
        // НОВОЕ v14.5.4: Добавлены skipCompareFields и ignoreFieldValues
        const helpersFilePath = path.join(dataDir, 'test-helpers.ts');
        if (!fs.existsSync(helpersFilePath)) {
            const helpersConfig = {
                uniqueFields: this.config.uniqueFields,
                uniqueFieldsUpperCase: this.config.uniqueFieldsUpperCase,
                packageName: this.config.packageName,
                skipCompareFields: this.config.skipCompareFields,
                ignoreFieldValues: this.config.ignoreFieldValues
            };
            const helpersCode = (0, test_helpers_generator_1.generateTestHelpersCode)(helpersConfig);
            fs.writeFileSync(helpersFilePath, helpersCode, 'utf-8');
        }
        for (let i = 0; i < requests.length; i++) {
            const request = requests[i];
            const dataFileName = `${fileName}-data-${i + 1}.ts`;
            const dataFilePath = path.join(dataDir, dataFileName);
            // ИСПРАВЛЕНИЕ 7: Нормализуем на основе DTO
            let normalizedResponse;
            if (dtoInfo) {
                normalizedResponse = (0, data_comparison_1.normalizeDbDataByDto)(request.response_body, dtoInfo);
            }
            else {
                normalizedResponse = (0, data_comparison_1.normalizeDbData)(request.response_body);
            }
            // ИСПРАВЛЕНИЕ v14.5.2: Если request_body строка - парсим перед stringify
            let requestBodyForExport = request.request_body;
            if (typeof requestBodyForExport === 'string') {
                try {
                    requestBodyForExport = JSON.parse(requestBodyForExport);
                }
                catch {
                    // Если парсинг не удался - оставляем как есть
                }
            }
            const dataContent = `/**
 * Тестовые данные для ${method} ${endpoint}
 * DB ID: ${request.id}
 */

export const requestData = ${JSON.stringify(requestBodyForExport, null, 2)};

// Нормализованный response (готовый для сравнения)
export const normalizedExpectedResponse = ${JSON.stringify(normalizedResponse, null, 2)};
`;
            fs.writeFileSync(dataFilePath, dataContent, 'utf-8');
        }
    }
    /**
     * ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ метод генерации теста
     * ИСПРАВЛЕНИЯ 4, 5, 6, 7
     */
    async generateSingleTest(endpoint, method, request, testNumber, dtoInfo) {
        // ИСПРАВЛЕНИЕ 3: Уникальный рандомный номер
        const randomId = Math.floor(Math.random() * 1000);
        const testName = `Happy path #${testNumber} (ID: ${randomId})`;
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(method);
        const standUrlVar = `process.env.${this.config.standUrlEnvVar}`;
        const axiosConfig = this.config.axiosConfigName;
        let testCode = `  test(\`\${httpMethod} ${testName} (\${success}) @api ${this.config.testTag}\`, async ({ page }, testInfo) => {
    // DB ID: db-id-${request.id}
    // ИСПРАВЛЕНИЕ 12: Реальный endpoint с подставленными параметрами пути
    const actualEndpoint = '${request.endpoint}';
`;
        // Данные
        if (this.config.createSeparateDataFiles) {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.7: Корректная копия для массивов и объектов
                testCode += `    let requestData = Array.isArray(requestData${testNumber}) ? [...requestData${testNumber}] : { ...requestData${testNumber} };
`;
            }
            // ИСПРАВЛЕНИЕ 9: Только переменная, не объект целиком
            testCode += `    const normalizedExpected = normalizedExpectedResponse${testNumber};

`;
        }
        else {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.2: Если request_body строка - парсим перед stringify
                let requestBodyObj = request.request_body;
                if (typeof requestBodyObj === 'string') {
                    try {
                        requestBodyObj = JSON.parse(requestBodyObj);
                    }
                    catch {
                        // Если парсинг не удался - оставляем как есть
                    }
                }
                testCode += `    const requestData = ${JSON.stringify(requestBodyObj, null, 4).replace(/^/gm, '    ')};

`;
            }
            // ИСПРАВЛЕНИЕ 7: Нормализуем на основе DTO
            let normalizedResponse;
            if (dtoInfo) {
                normalizedResponse = (0, data_comparison_1.normalizeDbDataByDto)(request.response_body, dtoInfo);
            }
            else {
                normalizedResponse = (0, data_comparison_1.normalizeDbData)(request.response_body);
            }
            testCode += `    const normalizedExpected = ${JSON.stringify(normalizedResponse, null, 4).replace(/^/gm, '    ')};
    
`;
        }
        // НОВОЕ v14.2: Генерация уникальных значений для полей (избегаем 400 "Уже существует")
        // НОВОЕ v14.5: Используем helper функцию вместо inline кода
        const useUniqueFields = hasBody && this.config.enableUniqueFieldGeneration && this.config.uniqueFields.length > 0;
        const useSeparateDataFiles = this.config.createSeparateDataFiles;
        if (useUniqueFields) {
            if (useSeparateDataFiles) {
                // Используем helper функцию из test-helpers.ts
                // ИСПРАВЛЕНИЕ v14.5: prepareUniqueFields возвращает новый объект, просто переприсваиваем
                testCode += `    // Подготовка уникальных значений для избежания 400 "Уже существует"
    const { data: preparedData, modifiedFields: modifiedUniqueFields } = prepareUniqueFields(requestData);
    requestData = preparedData;

`;
            }
            else {
                // Inline код когда нет отдельных файлов данных
                const uniqueFieldsList = this.config.uniqueFields;
                const upperCaseFields = this.config.uniqueFieldsUpperCase;
                testCode += `    // Генерация уникальных значений для избежания ошибок 400 "Уже существует"
    const uniqueSuffix = \`_\${Date.now()}_\${Math.random().toString(36).substring(2, 7)}\`;
    const modifiedUniqueFields: Record<string, string> = {};
`;
                for (const field of uniqueFieldsList) {
                    const isUpperCase = upperCaseFields.includes(field);
                    if (isUpperCase) {
                        testCode += `    if (requestData.${field} && typeof requestData.${field} === 'string') {
      requestData.${field} = (requestData.${field} + uniqueSuffix).toUpperCase();
      modifiedUniqueFields['${field}'] = requestData.${field};
    }
`;
                    }
                    else {
                        testCode += `    if (requestData.${field} && typeof requestData.${field} === 'string') {
      requestData.${field} = requestData.${field} + uniqueSuffix;
      modifiedUniqueFields['${field}'] = requestData.${field};
    }
`;
                    }
                }
                testCode += `
`;
            }
        }
        // ИСПРАВЛЕНИЕ 4: Запрос через catch с детальным выводом
        testCode += `    let response;

    try {
`;
        if (hasBody) {
            testCode += `      response = await axios.${method.toLowerCase()}(${standUrlVar} + actualEndpoint, requestData, ${axiosConfig});
`;
        }
        else {
            testCode += `      response = await axios.${method.toLowerCase()}(${standUrlVar} + actualEndpoint, ${axiosConfig});
`;
        }
        // НОВОЕ v14.1: Используем handleApiError для обработки ошибок (email логика внутри)
        const useApiTestHelper = this.config.apiTestHelperPath ? true : false;
        const use5xxEmailNotification = this.config.send5xxEmailNotification && this.config.emailHelperPath;
        const emailMethodName = this.config.emailHelperMethodName || 'sendErrorMailbyApi';
        if (useApiTestHelper) {
            // Используем централизованный handleApiError
            testCode += `    } catch (error: any) {
      await handleApiError({
        error,
        testInfo,
        endpoint: actualEndpoint,
        method: httpMethod,
        standUrl: ${standUrlVar},${hasBody ? `
        requestBody: requestData,` : ''}
        axiosConfig: ${axiosConfig},${use5xxEmailNotification ? `
        sendEmailFn: ${emailMethodName}` : ''}
      });
    }
`;
        }
        else {
            // Fallback без apiTestHelper
            testCode += `    } catch (error: any) {
      console.error('❌ Ошибка при вызове endpoint:');
      console.error('Endpoint:', actualEndpoint);
      console.error('Method:', httpMethod);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('Error message:', error.message);
      throw error;
    }
`;
        }
        testCode += `
    // Основные проверки
    await expect(response.status).toBe(success);
    await expect(response.data).toBeDefined();
`;
        // ИСПРАВЛЕНИЕ 6: Валидация типов на основе DTO
        if (dtoInfo && dtoInfo.fields.length > 0) {
            testCode += `\n    // Валидация типов данных из DTO: ${dtoInfo.name}\n`;
            for (const field of dtoInfo.fields.slice(0, 5)) {
                const jsType = this.getJsType(field.type);
                if (jsType === 'array') {
                    testCode += `    await expect(Array.isArray(response.data.${field.name})).toBe(true);\n`;
                }
                else if (jsType) {
                    testCode += `    await expect(typeof response.data.${field.name}).toBe('${jsType}');\n`;
                }
            }
        }
        // ИСПРАВЛЕНИЕ 5: Проверка обязательных полей из DTO
        if (dtoInfo && dtoInfo.fields.length > 0) {
            testCode += `\n    // Проверка обязательных полей из DTO: ${dtoInfo.name}\n`;
            const requiredFields = dtoInfo.fields.filter(f => f.required);
            for (const field of requiredFields.slice(0, 5)) {
                testCode += `    await expect(response.data.${field.name}).toBeDefined();\n`;
            }
        }
        // ИСПРАВЛЕНИЕ 5: Используем deepCompareObjects вместо toMatchObject
        // ИСПРАВЛЕНИЕ 13: Улучшенный вывод различий с цветами (блочный формат)
        // НОВОЕ v14.1: При несовпадении выводим endpoint, метод и CURL для повторения
        // НОВОЕ v14.1: Пропускаем сравнение если ожидаемый response пустой (null, undefined, "")
        // НОВОЕ v14.2: Отдельная проверка уникальных полей + исключение их из основного сравнения
        testCode += `
    // Проверка на пустой ожидаемый response - пропускаем сравнение данных
    const isEmptyExpected = normalizedExpected === null ||
                            normalizedExpected === undefined ||
                            normalizedExpected === '' ||
                            (typeof normalizedExpected === 'object' && Object.keys(normalizedExpected).length === 0);

    if (isEmptyExpected) {
      // Для пустых response проверяем только что запрос успешен
      console.log('ℹ️ Ожидаемый response пустой - проверяем только статус код');
    } else {
`;
        // НОВОЕ v14.2: Добавляем проверку уникальных полей для POST/PUT/PATCH
        // НОВОЕ v14.5: Используем helper функции когда есть отдельные файлы данных
        if (useUniqueFields) {
            if (useSeparateDataFiles) {
                // Используем helper функции из test-helpers.ts
                // ИСПРАВЛЕНИЕ v14.5.4: Проверяем только те уникальные поля, которые есть в response
                testCode += `      // Проверка уникальных полей (response должен вернуть то что отправили)
      // ВАЖНО: Проверяем только поля которые ЕСТЬ в response (некоторые endpoint возвращают только id)
      const { allMatch, mismatches, skippedFields } = verifyUniqueFields(response.data, modifiedUniqueFields);
      if (skippedFields.length > 0) {
        console.log('ℹ️ Пропущены уникальные поля (отсутствуют в response):', skippedFields);
      }
      if (!allMatch) {
        console.error('❌ Несовпадение уникальных полей:', mismatches);
      }
      await expect(allMatch, 'Уникальные поля должны совпадать').toBe(true);

      // Сравнение остальных полей (без уникальных)
      const comparison = compareWithoutUniqueFields(normalizedExpected, response.data, modifiedUniqueFields);
`;
            }
            else {
                // Inline код когда нет отдельных файлов данных
                // ИСПРАВЛЕНИЕ v14.5.4: Проверяем только те уникальные поля, которые есть в response
                testCode += `      // Проверка уникальных полей (response должен вернуть то что отправили)
      // ВАЖНО: Проверяем только поля которые ЕСТЬ в response (некоторые endpoint возвращают только id)
      const uniqueFieldErrors: string[] = [];
      const skippedUniqueFields: string[] = [];
      for (const [fieldName, sentValue] of Object.entries(modifiedUniqueFields)) {
        // ИСПРАВЛЕНИЕ v14.5.4: Проверяем только если поле СУЩЕСТВУЕТ в response
        if (response.data && fieldName in response.data) {
          const receivedValue = response.data[fieldName];
          if (receivedValue !== sentValue) {
            uniqueFieldErrors.push(\`Поле '\${fieldName}': отправлено '\${sentValue}', получено '\${receivedValue}'\`);
          }
        } else {
          // Поле отсутствует в response - пропускаем (не считаем ошибкой)
          skippedUniqueFields.push(fieldName);
        }
      }
      if (skippedUniqueFields.length > 0) {
        console.log('ℹ️ Пропущены уникальные поля (отсутствуют в response):', skippedUniqueFields);
      }
      if (uniqueFieldErrors.length > 0) {
        console.error('❌ Несовпадение уникальных полей:', uniqueFieldErrors);
      }
      await expect(uniqueFieldErrors.length, 'Уникальные поля должны совпадать').toBe(0);

      // Сравнение остальных полей (без уникальных)
      const uniqueFieldNames = Object.keys(modifiedUniqueFields);
      const removeFields = (obj: any, fields: string[]): any => {
        if (!obj || typeof obj !== 'object') return obj;
        const result = { ...obj };
        fields.forEach(f => delete result[f]);
        return result;
      };
      const comparison = compareDbWithResponse(removeFields(normalizedExpected, uniqueFieldNames), removeFields(response.data, uniqueFieldNames));
`;
            }
        }
        else {
            // ИСПРАВЛЕНИЕ v14.5: Когда нет уникальных полей - обычное сравнение
            if (useSeparateDataFiles) {
                testCode += `      // Глубокое сравнение всех полей
      const comparison = compareWithoutUniqueFields(normalizedExpected, response.data, {});
`;
            }
            else {
                testCode += `      // Глубокое сравнение всех полей
      const comparison = compareDbWithResponse(normalizedExpected, response.data);
`;
            }
        }
        // НОВОЕ v14.5: Используем helper для CURL если есть отдельные файлы данных
        if (useSeparateDataFiles) {
            testCode += `
      if (!comparison.isEqual) {
        console.log(formatDifferencesAsBlocks(comparison.differences));
        console.log('\\n📍 Endpoint:', actualEndpoint, '| Method:', httpMethod);
        console.log('📋 CURL:', buildCurlCommand(httpMethod, ${standUrlVar} + actualEndpoint, ${hasBody ? 'requestData' : 'undefined'}, ${axiosConfig}?.headers?.Authorization || ${axiosConfig}?.headers?.authorization));
      }

      await expect(comparison.isEqual).toBe(true);
    }
  });`;
        }
        else {
            // Inline CURL генерация когда нет helper функций
            testCode += `
      if (!comparison.isEqual) {
        console.log(formatDifferencesAsBlocks(comparison.differences));
        console.log('\\n📍 Endpoint:', actualEndpoint, '| Method:', httpMethod);
`;
            if (hasBody) {
                testCode += `        const curlCmd = \`curl -X \${httpMethod} '\${${standUrlVar}}\${actualEndpoint}' -H 'Content-Type: application/json' -H 'Authorization: \${${axiosConfig}?.headers?.Authorization || ${axiosConfig}?.headers?.authorization || 'Bearer YOUR_TOKEN'}' -d '\${JSON.stringify(requestData)}'\`;
        console.log('📋 CURL:', curlCmd);
`;
            }
            else {
                testCode += `        const curlCmd = \`curl -X \${httpMethod} '\${${standUrlVar}}\${actualEndpoint}' -H 'Authorization: \${${axiosConfig}?.headers?.Authorization || ${axiosConfig}?.headers?.authorization || 'Bearer YOUR_TOKEN'}'\`;
        console.log('📋 CURL:', curlCmd);
`;
            }
            testCode += `      }

      await expect(comparison.isEqual).toBe(true);
    }
  });`;
        }
        return testCode;
    }
    getJsType(tsType) {
        tsType = tsType.toLowerCase().trim();
        if (tsType.includes('string'))
            return 'string';
        if (tsType.includes('number'))
            return 'number';
        if (tsType.includes('boolean'))
            return 'boolean';
        if (tsType.includes('[]') || tsType.includes('array'))
            return 'array';
        if (tsType === 'object')
            return 'object';
        return null;
    }
    getRelativePath(from, to) {
        const relative = path.relative(path.dirname(from), to);
        return relative.startsWith('.') ? relative.replace(/\.ts$/, '') : `./${relative.replace(/\.ts$/, '')}`;
    }
    endpointToFileName(endpoint, method) {
        let fileName = endpoint
            .replace(/^\/api\/v[0-9]+\//, '')
            .replace(/\{[^}]+\}/g, 'id')
            .replace(/\/\d+/g, '-id') // ИСПРАВЛЕНИЕ 8: Числа → -id
            .replace(/\//g, '-')
            .replace(/[^a-z0-9-]/gi, '')
            .toLowerCase();
        fileName = `${method.toLowerCase()}-${fileName}`;
        return fileName;
    }
    getSuccessCodeName(status) {
        if (status === 201)
            return 'created';
        if (status === 204)
            return 'noContent';
        return 'success';
    }
    async markAsGenerated(ids, filePath) {
        const schema = this.config.dbSchema;
        for (const id of ids) {
            await this.sql `
        UPDATE ${this.sql(schema + '.api_requests')}
        SET
          test_generated = TRUE,
          test_file_path = ${filePath},
          generated_at = NOW()
        WHERE id = ${id}
      `;
        }
    }
    // ═══════════════════════════════════════════════════════════════════════════════
    // НОВОЕ v14.3: ГЕНЕРАЦИЯ ТЕСТОВ НА ВАЛИДАЦИЮ (422 ОШИБКИ)
    // ═══════════════════════════════════════════════════════════════════════════════
    /**
     * Генерирует тесты для 422 ошибок валидации
     * Тесты проверяют: статус 422 + ожидаемое сообщение об ошибке
     */
    async generateValidation422Tests(validation422Errors) {
        if (!this.config.validationTests.enabled || validation422Errors.length === 0) {
            return;
        }
        console.log(`\n📋 Генерация тестов на валидацию (422)...`);
        console.log(`   Найдено ${validation422Errors.length} ошибок с детализацией`);
        // Определяем папку для тестов валидации
        const validationOutputDir = path.resolve(this.config.outputDir, this.config.validationTests.outputDir || '../validation-tests');
        if (!fs.existsSync(validationOutputDir)) {
            fs.mkdirSync(validationOutputDir, { recursive: true });
        }
        // Группируем по endpoint + method
        const grouped = this.groupValidation422Errors(validation422Errors);
        let totalTests = 0;
        let newTests = 0;
        for (const [key, errors] of Object.entries(grouped)) {
            const { total, added } = await this.generateValidation422TestsForEndpoint(key, errors, validationOutputDir);
            totalTests += total;
            newTests += added;
        }
        console.log(`\n✅ Генерация тестов валидации завершена!`);
        console.log(`   Всего тестов: ${totalTests}`);
        console.log(`   Новых тестов: ${newTests}`);
    }
    /**
     * Группирует 422 ошибки по endpoint + method
     */
    groupValidation422Errors(errors) {
        const grouped = {};
        const maxTests = this.config.validationTests.maxTestsPerEndpoint || 3;
        for (const error of errors) {
            // Нормализуем endpoint (заменяем числа на {id})
            const normalizedEndpoint = error.endpoint.replace(/\/\d+/g, '/{id}');
            const key = `${error.method}:${normalizedEndpoint}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            if (grouped[key].length < maxTests) {
                grouped[key].push(error);
            }
        }
        return grouped;
    }
    /**
     * Генерирует тесты валидации для одного endpoint
     */
    async generateValidation422TestsForEndpoint(key, errors, outputDir) {
        const [method, endpoint] = key.split(':');
        // Определяем категорию (для группировки по папкам)
        let category = '';
        if (this.config.validationTests.groupByCategory) {
            const parts = endpoint.split('/').filter(Boolean);
            // Берем первый значимый сегмент после api/v1/
            const startIndex = parts.findIndex(p => p.match(/^v\d+$/));
            if (startIndex >= 0 && parts[startIndex + 1]) {
                category = parts[startIndex + 1];
            }
            else if (parts.length > 0) {
                category = parts[0];
            }
        }
        // Формируем путь к файлу
        const fileName = this.endpointToFileName(endpoint, method) + '-validation';
        const categoryDir = category ? path.join(outputDir, category) : outputDir;
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        const testFilePath = path.join(categoryDir, `${fileName}.test.ts`);
        const testDataDir = path.join(categoryDir, 'test-data');
        // Проверяем существует ли уже файл
        if (fs.existsSync(testFilePath) && !this.config.force) {
            console.log(`  ⏭️  Пропущен (уже существует): ${fileName}`);
            return { total: errors.length, added: 0 };
        }
        // Генерируем тестовый файл
        const testCode = await this.generateValidation422TestFile(endpoint, method, errors, testDataDir, testFilePath);
        fs.writeFileSync(testFilePath, testCode, 'utf-8');
        console.log(`  ✓ Создан: ${fileName} (${errors.length} тестов)`);
        return { total: errors.length, added: errors.length };
    }
    /**
     * Генерирует код файла с тестами валидации
     */
    async generateValidation422TestFile(endpoint, method, errors, testDataDir, testFilePath) {
        const standUrlVar = `process.env.${this.config.standUrlEnvVar}`;
        const axiosConfig = this.config.axiosConfigName;
        const testTag = this.config.validationTests.testTag || '@apiValidation';
        const createDataFiles = this.config.validationTests.createSeparateDataFiles;
        // Импорты
        let code = `/**
 * Тесты валидации API (422 ошибки)
 * Автоматически сгенерировано: ${new Date().toISOString()}
 * Endpoint: ${method} ${endpoint}
 *
 * Эти тесты проверяют корректность ответов при невалидных данных:
 * - Статус 422 Unprocessable Entity
 * - Детальное сообщение об ошибке
 */

import { test, expect } from '${this.config.testImportPath}';
import axios from 'axios';
import { ${axiosConfig} } from '${this.config.axiosConfigPath}';
`;
        // Импорт apiTestHelper если настроен
        if (this.config.apiTestHelperPath) {
            code += `import { handleApiError, getMessageFromError } from '${this.config.apiTestHelperPath}';\n`;
        }
        // Импорт email helper если настроен
        if (this.config.send5xxEmailNotification && this.config.emailHelperPath) {
            code += `import { ${this.config.emailHelperMethodName || 'sendErrorMailbyApi'} } from '${this.config.emailHelperPath}';\n`;
        }
        // Тестовые данные
        if (createDataFiles) {
            // Создаем папку test-data
            if (!fs.existsSync(testDataDir)) {
                fs.mkdirSync(testDataDir, { recursive: true });
            }
            // Генерируем файл с тестовыми данными
            const dataFileName = this.endpointToFileName(endpoint, method) + '-validation-data';
            const dataFilePath = path.join(testDataDir, `${dataFileName}.ts`);
            let dataCode = `/**
 * Тестовые данные для тестов валидации
 * Endpoint: ${method} ${endpoint}
 */

`;
            for (let i = 0; i < errors.length; i++) {
                const error = errors[i];
                // ИСПРАВЛЕНИЕ v14.5.2: Если requestBody строка - парсим перед stringify
                let requestBodyForExport = error.requestBody;
                if (typeof requestBodyForExport === 'string') {
                    try {
                        requestBodyForExport = JSON.parse(requestBodyForExport);
                    }
                    catch {
                        // Если парсинг не удался - оставляем как есть
                    }
                }
                dataCode += `export const requestData${i + 1} = ${JSON.stringify(requestBodyForExport, null, 2)};\n\n`;
                dataCode += `export const expectedError${i + 1} = ${JSON.stringify({
                    status: 422,
                    detailMessage: error.detailMessage,
                    responseData: error.responseData
                }, null, 2)};\n\n`;
            }
            fs.writeFileSync(dataFilePath, dataCode, 'utf-8');
            // Импорт тестовых данных
            const relativeDataPath = path.relative(path.dirname(testFilePath), dataFilePath).replace(/\.ts$/, '');
            code += `import {\n`;
            for (let i = 0; i < errors.length; i++) {
                code += `  requestData${i + 1},\n`;
                code += `  expectedError${i + 1},\n`;
            }
            code += `} from './${relativeDataPath.startsWith('.') ? relativeDataPath : './' + relativeDataPath}';\n`;
        }
        code += `
const httpMethod = '${method}';

test.describe('${method} ${endpoint} - Validation Tests ${testTag}', () => {
`;
        // Генерируем тесты
        for (let i = 0; i < errors.length; i++) {
            const error = errors[i];
            code += await this.generateSingle422Test(error, i + 1, standUrlVar, axiosConfig, createDataFiles ?? true);
            code += '\n';
        }
        code += `});
`;
        return code;
    }
    /**
     * Генерирует код одного теста на 422 ошибку
     */
    async generateSingle422Test(error, testNumber, standUrlVar, axiosConfig, useDataFiles) {
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(error.method);
        const shortMessage = error.detailMessage.length > 50
            ? error.detailMessage.substring(0, 47) + '...'
            : error.detailMessage;
        let testCode = `  test(\`Validation #${testNumber}: ${shortMessage.replace(/`/g, "'")} (422) @api ${this.config.validationTests.testTag || '@apiValidation'}\`, async ({ page }, testInfo) => {
    // Request ID: ${error.requestId}
    const actualEndpoint = '${error.endpoint}';
`;
        // Данные запроса
        if (useDataFiles) {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.7: Корректная копия для массивов и объектов
                testCode += `    const requestData = Array.isArray(requestData${testNumber}) ? [...requestData${testNumber}] : { ...requestData${testNumber} };
`;
            }
            testCode += `    const expectedErrorData = expectedError${testNumber};
`;
        }
        else {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.2: Если requestBody строка - парсим перед stringify
                let requestBodyObj = error.requestBody;
                if (typeof requestBodyObj === 'string') {
                    try {
                        requestBodyObj = JSON.parse(requestBodyObj);
                    }
                    catch {
                        // Если парсинг не удался - оставляем как есть
                    }
                }
                testCode += `    const requestData = ${JSON.stringify(requestBodyObj, null, 4).replace(/^/gm, '    ')};
`;
            }
            testCode += `    const expectedErrorData = {
      status: 422,
      detailMessage: ${JSON.stringify(error.detailMessage)},
    };
`;
        }
        // Отправка запроса
        testCode += `
    let response;
    let errorCaught = false;

    try {
`;
        if (hasBody) {
            testCode += `      response = await axios.${error.method.toLowerCase()}(${standUrlVar} + actualEndpoint, requestData, ${axiosConfig});
`;
        }
        else {
            testCode += `      response = await axios.${error.method.toLowerCase()}(${standUrlVar} + actualEndpoint, ${axiosConfig});
`;
        }
        testCode += `    } catch (error: any) {
      errorCaught = true;
      response = error.response;

      // Если это НЕ 422 - пробрасываем ошибку
      if (!response || response.status !== 422) {
`;
        // Обработка неожиданных ошибок
        const use5xxEmail = this.config.send5xxEmailNotification && this.config.emailHelperPath;
        const emailMethodName = this.config.emailHelperMethodName || 'sendErrorMailbyApi';
        if (this.config.apiTestHelperPath) {
            testCode += `        await handleApiError({
          error,
          testInfo,
          endpoint: actualEndpoint,
          method: httpMethod,
          standUrl: ${standUrlVar},${hasBody ? `
          requestBody: requestData,` : ''}
          axiosConfig: ${axiosConfig},${use5xxEmail ? `
          sendEmailFn: ${emailMethodName}` : ''}
        });
`;
        }
        else {
            testCode += `        console.error('❌ Ожидалась ошибка 422, но получена:', response?.status || error.message);
        throw error;
`;
        }
        testCode += `      }
    }

    // Проверяем что запрос вернул 422
    await expect(errorCaught, 'Ожидалась ошибка 422, но запрос успешен').toBe(true);
    await expect(response).toBeDefined();
    await expect(response.status).toBe(422);

    // Проверяем детальное сообщение об ошибке
    const responseDetail = response.data?.detail || response.data?.message || response.data?.error || JSON.stringify(response.data);

    if (responseDetail !== expectedErrorData.detailMessage) {
      console.log('\\n📋 Различие в сообщении об ошибке:');
      console.log('Ожидалось:', expectedErrorData.detailMessage);
      console.log('Получено:', responseDetail);
      console.log('\\n📍 Информация о запросе:');
      console.log('Endpoint:', actualEndpoint);
      console.log('Method:', httpMethod);
      console.log('Full URL:', ${standUrlVar} + actualEndpoint);
`;
        // CURL для отладки
        if (hasBody) {
            testCode += `
      // CURL команда для повторения
      const curlCmd = \`curl -X \${httpMethod} '\${${standUrlVar}}\${actualEndpoint}' \\\\
  -H 'Content-Type: application/json' \\\\
  -H 'Authorization: \${${axiosConfig}?.headers?.Authorization || ${axiosConfig}?.headers?.authorization || 'Bearer YOUR_TOKEN'}' \\\\
  -d '\${JSON.stringify(requestData)}'\`;
      console.log('\\n📋 CURL для повторения:');
      console.log(curlCmd);
`;
        }
        else {
            testCode += `
      // CURL команда для повторения
      const curlCmd = \`curl -X \${httpMethod} '\${${standUrlVar}}\${actualEndpoint}' \\\\
  -H 'Authorization: \${${axiosConfig}?.headers?.Authorization || ${axiosConfig}?.headers?.authorization || 'Bearer YOUR_TOKEN'}'\`;
      console.log('\\n📋 CURL для повторения:');
      console.log(curlCmd);
`;
        }
        testCode += `    }

    // Мягкая проверка сообщения - выводим предупреждение, но не падаем
    // (сообщения могут меняться, главное - что вернулся 422)
    if (responseDetail !== expectedErrorData.detailMessage) {
      console.warn('⚠️  Сообщение об ошибке изменилось (тест НЕ падает, но требует внимания)');
    }

    // Основная проверка - статус 422
    await expect(response.status, 'Ожидается статус 422 Unprocessable Entity').toBe(422);
  });`;
        return testCode;
    }
    // ═══════════════════════════════════════════════════════════════════════════════
    // НОВОЕ v14.4: ГЕНЕРАЦИЯ ТЕСТОВ НА 400 ОШИБКИ (ДУБЛИКАТЫ)
    // ═══════════════════════════════════════════════════════════════════════════════
    /**
     * Генерирует негативные тесты для 400 ошибок "Уже существует":
     * - Негативный тест: оригинальные данные → 400 + проверка сообщения
     * ИСПРАВЛЕНИЕ v14.5.5: Позитивные тесты убраны (были нестабильны)
     */
    async generate400DuplicateTests(duplicate400Errors) {
        if (!this.config.duplicateTests.enabled || duplicate400Errors.length === 0) {
            return;
        }
        console.log(`\n📋 Генерация парных тестов на дубликаты (400)...`);
        console.log(`   Найдено ${duplicate400Errors.length} ошибок с детализацией`);
        // Определяем папку для тестов (абсолютный путь из конфига)
        const duplicateOutputDir = path.resolve(this.config.duplicateTests.outputDir || './tests/api/negative-400');
        if (!fs.existsSync(duplicateOutputDir)) {
            fs.mkdirSync(duplicateOutputDir, { recursive: true });
        }
        // Группируем по endpoint + method
        const grouped = this.groupDuplicate400Errors(duplicate400Errors);
        let totalTests = 0;
        let newTests = 0;
        for (const [key, errors] of Object.entries(grouped)) {
            const { total, added } = await this.generate400TestsForEndpoint(key, errors, duplicateOutputDir);
            totalTests += total;
            newTests += added;
        }
        console.log(`\n✅ Генерация тестов на дубликаты завершена!`);
        console.log(`   Всего тестов: ${totalTests}`);
        console.log(`   Новых тестов: ${newTests}`);
    }
    /**
     * Группирует 400 ошибки по endpoint + method
     */
    groupDuplicate400Errors(errors) {
        const grouped = {};
        const maxTests = this.config.duplicateTests.maxTestsPerEndpoint || 2;
        for (const error of errors) {
            // Нормализуем endpoint (заменяем числа на {id})
            const normalizedEndpoint = error.endpoint.replace(/\/\d+/g, '/{id}');
            const key = `${error.method}:${normalizedEndpoint}`;
            if (!grouped[key]) {
                grouped[key] = [];
            }
            if (grouped[key].length < maxTests) {
                grouped[key].push(error);
            }
        }
        return grouped;
    }
    /**
     * Генерирует парные тесты для одного endpoint
     */
    async generate400TestsForEndpoint(key, errors, outputDir) {
        const [method, endpoint] = key.split(':');
        // Определяем категорию (для группировки по папкам)
        let category = '';
        if (this.config.duplicateTests.groupByCategory) {
            const parts = endpoint.split('/').filter(Boolean);
            const startIndex = parts.findIndex(p => p.match(/^v\d+$/));
            if (startIndex >= 0 && parts[startIndex + 1]) {
                category = parts[startIndex + 1];
            }
            else if (parts.length > 0) {
                category = parts[0];
            }
        }
        // Формируем путь к файлу
        const fileName = this.endpointToFileName(endpoint, method) + '-duplicate-400';
        const categoryDir = category ? path.join(outputDir, category) : outputDir;
        if (!fs.existsSync(categoryDir)) {
            fs.mkdirSync(categoryDir, { recursive: true });
        }
        const testFilePath = path.join(categoryDir, `${fileName}.test.ts`);
        const testDataDir = path.join(categoryDir, 'test-data');
        // Проверяем существует ли уже файл
        if (fs.existsSync(testFilePath) && !this.config.force) {
            console.log(`  ⏭️  Пропущен (уже существует): ${fileName}`);
            return { total: errors.length * 2, added: 0 }; // *2 потому что парные тесты
        }
        // Генерируем тестовый файл
        const testCode = await this.generate400TestFile(endpoint, method, errors, testDataDir, testFilePath);
        fs.writeFileSync(testFilePath, testCode, 'utf-8');
        console.log(`  ✓ Создан: ${fileName} (${errors.length * 2} тестов: ${errors.length} негативных + ${errors.length} позитивных)`);
        return { total: errors.length * 2, added: errors.length * 2 };
    }
    /**
     * Генерирует код файла с парными тестами на 400
     */
    async generate400TestFile(endpoint, method, errors, testDataDir, testFilePath) {
        const standUrlVar = `process.env.${this.config.standUrlEnvVar}`;
        const axiosConfig = this.config.axiosConfigName;
        const testTag = this.config.duplicateTests.testTag || '@negative400Validation';
        const createDataFiles = this.config.duplicateTests.createSeparateDataFiles;
        // Импорты
        let code = `/**
 * Парные тесты на дубликаты (400 ошибки)
 * Автоматически сгенерировано: ${new Date().toISOString()}
 * Endpoint: ${method} ${endpoint}
 *
 * Эти тесты проверяют корректность обработки дубликатов:
 * - Негативный: оригинальные данные → 400 + сообщение об ошибке
 * - Позитивный: данные с уникальными полями → 2xx + проверка response
 */

import { test, expect } from '${this.config.testImportPath}';
import axios from 'axios';
import { ${axiosConfig} } from '${this.config.axiosConfigPath}';
`;
        // Импорт apiTestHelper если настроен
        if (this.config.apiTestHelperPath) {
            code += `import { handleApiError, getMessageFromError } from '${this.config.apiTestHelperPath}';\n`;
        }
        // Импорт compareDbWithResponse для позитивных тестов
        code += `import { compareDbWithResponse } from '${this.config.packageName}';\n`;
        // Импорт email helper если настроен
        if (this.config.send5xxEmailNotification && this.config.emailHelperPath) {
            code += `import { ${this.config.emailHelperMethodName || 'sendErrorMailbyApi'} } from '${this.config.emailHelperPath}';\n`;
        }
        // Тестовые данные
        if (createDataFiles) {
            // Создаем папку test-data
            if (!fs.existsSync(testDataDir)) {
                fs.mkdirSync(testDataDir, { recursive: true });
            }
            // Генерируем файл с тестовыми данными
            const dataFileName = this.endpointToFileName(endpoint, method) + '-duplicate-400-data';
            const dataFilePath = path.join(testDataDir, `${dataFileName}.ts`);
            let dataCode = `/**
 * Тестовые данные для парных тестов на дубликаты (400)
 * Endpoint: ${method} ${endpoint}
 */

`;
            for (let i = 0; i < errors.length; i++) {
                const error = errors[i];
                // ИСПРАВЛЕНИЕ v14.5.2: Если requestBody строка - парсим перед stringify
                let requestBodyForExport = error.requestBody;
                if (typeof requestBodyForExport === 'string') {
                    try {
                        requestBodyForExport = JSON.parse(requestBodyForExport);
                    }
                    catch {
                        // Если парсинг не удался - оставляем как есть
                    }
                }
                // ИСПРАВЛЕНИЕ v14.5.5: Убрана генерация expectedSuccess (позитивные тесты отключены)
                dataCode += `// Тест #${i + 1}\n`;
                dataCode += `export const requestData${i + 1} = ${JSON.stringify(requestBodyForExport, null, 2)};\n\n`;
                dataCode += `export const expectedError${i + 1} = ${JSON.stringify({
                    status: 400,
                    detailMessage: error.detailMessage,
                    responseData: error.responseData
                }, null, 2)};\n\n`;
            }
            fs.writeFileSync(dataFilePath, dataCode, 'utf-8');
            // Импорт тестовых данных (только для негативных тестов)
            const relativeDataPath = path.relative(path.dirname(testFilePath), dataFilePath).replace(/\.ts$/, '');
            code += `import {\n`;
            for (let i = 0; i < errors.length; i++) {
                code += `  requestData${i + 1},\n`;
                code += `  expectedError${i + 1},\n`;
            }
            code += `} from './${relativeDataPath.startsWith('.') ? relativeDataPath : './' + relativeDataPath}';\n`;
        }
        code += `
const httpMethod = '${method}';

test.describe('${method} ${endpoint} - Duplicate Tests ${testTag}', () => {
`;
        // ИСПРАВЛЕНИЕ v14.5.5: Генерируем только негативные тесты (без позитивных)
        // Позитивные тесты с uniqueFields убраны, так как они нестабильны
        for (let i = 0; i < errors.length; i++) {
            const error = errors[i];
            // Негативный тест (400) - проверяем что запрос возвращает 400 + сообщение
            code += await this.generateSingle400NegativeTest(error, i + 1, standUrlVar, axiosConfig, createDataFiles ?? true);
            code += '\n';
        }
        code += `});
`;
        return code;
    }
    /**
     * Генерирует негативный тест: оригинальные данные → 400
     */
    async generateSingle400NegativeTest(error, testNumber, standUrlVar, axiosConfig, useDataFiles) {
        const hasBody = ['POST', 'PUT', 'PATCH'].includes(error.method);
        const shortMessage = error.detailMessage.length > 40
            ? error.detailMessage.substring(0, 37) + '...'
            : error.detailMessage;
        let testCode = `  test(\`Negative #${testNumber}: ${shortMessage.replace(/`/g, "'")} (400) @api ${this.config.duplicateTests.testTag || '@negative400Validation'}\`, async ({ page }, testInfo) => {
    // Request ID: ${error.requestId}
    // Негативный тест: оригинальные данные должны вернуть 400 "Уже существует"
    const actualEndpoint = '${error.endpoint}';
`;
        // Данные запроса
        if (useDataFiles) {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.7: Корректная копия для массивов и объектов
                testCode += `    const requestData = Array.isArray(requestData${testNumber}) ? [...requestData${testNumber}] : { ...requestData${testNumber} };
`;
            }
            testCode += `    const expectedErrorData = expectedError${testNumber};
`;
        }
        else {
            if (hasBody) {
                // ИСПРАВЛЕНИЕ v14.5.2: Если requestBody строка - парсим перед stringify
                let requestBodyObj = error.requestBody;
                if (typeof requestBodyObj === 'string') {
                    try {
                        requestBodyObj = JSON.parse(requestBodyObj);
                    }
                    catch {
                        // Если парсинг не удался - оставляем как есть
                    }
                }
                testCode += `    const requestData = ${JSON.stringify(requestBodyObj, null, 4).replace(/^/gm, '    ')};
`;
            }
            testCode += `    const expectedErrorData = {
      status: 400,
      detailMessage: ${JSON.stringify(error.detailMessage)},
    };
`;
        }
        // Отправка запроса
        testCode += `
    let response;
    let errorCaught = false;

    try {
`;
        if (hasBody) {
            testCode += `      response = await axios.${error.method.toLowerCase()}(${standUrlVar} + actualEndpoint, requestData, ${axiosConfig});
`;
        }
        else {
            testCode += `      response = await axios.${error.method.toLowerCase()}(${standUrlVar} + actualEndpoint, ${axiosConfig});
`;
        }
        testCode += `    } catch (error: any) {
      errorCaught = true;
      response = error.response;

      // Если это НЕ 400 - пробрасываем ошибку
      if (!response || response.status !== 400) {
`;
        // Обработка неожиданных ошибок
        const use5xxEmail = this.config.send5xxEmailNotification && this.config.emailHelperPath;
        const emailMethodName = this.config.emailHelperMethodName || 'sendErrorMailbyApi';
        if (this.config.apiTestHelperPath) {
            testCode += `        await handleApiError({
          error,
          testInfo,
          endpoint: actualEndpoint,
          method: httpMethod,
          standUrl: ${standUrlVar},${hasBody ? `
          requestBody: requestData,` : ''}
          axiosConfig: ${axiosConfig},${use5xxEmail ? `
          sendEmailFn: ${emailMethodName}` : ''}
        });
`;
        }
        else {
            testCode += `        console.error('❌ Ожидалась ошибка 400, но получена:', response?.status || error.message);
        throw error;
`;
        }
        testCode += `      }
    }

    // Проверяем что запрос вернул 400
    await expect(errorCaught, 'Ожидалась ошибка 400 (дубликат), но запрос успешен').toBe(true);
    await expect(response).toBeDefined();
    await expect(response.status).toBe(400);

    // Проверяем детальное сообщение об ошибке (из реального response)
    const responseDetail = response.data?.detail || response.data?.message || response.data?.error || JSON.stringify(response.data);

    // Проверка ТОЧНОГО совпадения сообщения (взято из реального API)
    await expect(responseDetail, 'Сообщение об ошибке должно совпадать').toBe(expectedErrorData.detailMessage);
  });`;
        return testCode;
    }
}
exports.HappyPathTestGenerator = HappyPathTestGenerator;
async function generateHappyPathTests(config, sqlConnection) {
    const generator = new HappyPathTestGenerator(config, sqlConnection);
    await generator.generate();
}
/**
 * НОВОЕ v14.1: Переактуализация тестовых данных Happy Path тестов
 *
 * Этот метод:
 * 1. Сканирует папку с тестами
 * 2. Извлекает endpoint и тестовые данные из каждого теста
 * 3. Вызывает endpoint на реальном стенде
 * 4. Сравнивает полученные данные с ожидаемыми в тесте
 * 5. Обновляет тестовые данные если есть различия
 *
 * @example
 * await reActualizeHappyPathTests({
 *   testsDir: './e2e/api/happy-path',
 *   standUrl: 'https://api.example.com',
 *   axiosConfig: { headers: { Authorization: 'Bearer xxx' } },
 *   endpointFilter: ['/api/v1/orders'], // опционально
 *   updateFiles: true
 * });
 */
async function reActualizeHappyPathTests(config) {
    const { testsDir, endpointFilter = [], standUrl, axiosConfig, updateFiles = true, debug = false } = config;
    console.log('🔄 Начинаю переактуализацию тестовых данных...');
    console.log(`📁 Папка с тестами: ${testsDir}`);
    if (endpointFilter.length > 0) {
        console.log(`🔍 Фильтр endpoints: ${endpointFilter.join(', ')}`);
    }
    else {
        console.log('🔍 Актуализация ВСЕХ endpoints');
    }
    const result = {
        totalTests: 0,
        updatedTests: 0,
        skippedTests: 0,
        failedTests: 0,
        details: []
    };
    // Проверяем существование папки
    if (!fs.existsSync(testsDir)) {
        console.error(`❌ Папка не найдена: ${testsDir}`);
        return result;
    }
    // Получаем все тестовые файлы рекурсивно
    const testFiles = getTestFilesRecursively(testsDir);
    console.log(`📋 Найдено тестовых файлов: ${testFiles.length}`);
    for (const testFile of testFiles) {
        if (debug) {
            console.log(`\n📄 Обработка: ${path.relative(testsDir, testFile)}`);
        }
        try {
            const fileContent = fs.readFileSync(testFile, 'utf-8');
            // Извлекаем информацию о тесте
            const testInfo = extractTestInfo(fileContent);
            if (!testInfo) {
                if (debug) {
                    console.log(`  ⚠️  Не удалось извлечь информацию о тесте`);
                }
                result.skippedTests++;
                result.details.push({
                    testFile,
                    endpoint: 'unknown',
                    method: 'unknown',
                    status: 'skipped',
                    reason: 'Could not extract test info'
                });
                continue;
            }
            result.totalTests++;
            // Проверяем фильтр endpoints
            if (endpointFilter.length > 0) {
                const matchesFilter = endpointFilter.some(filter => {
                    const normalizedFilter = filter.replace(/\{[^}]+\}/g, '{id}');
                    const normalizedEndpoint = testInfo.endpoint.replace(/\{[^}]+\}/g, '{id}').replace(/\/\d+/g, '/{id}');
                    return normalizedEndpoint.includes(normalizedFilter) || normalizedFilter.includes(normalizedEndpoint);
                });
                if (!matchesFilter) {
                    if (debug) {
                        console.log(`  ⏭️  Пропущен (не соответствует фильтру)`);
                    }
                    result.skippedTests++;
                    result.details.push({
                        testFile,
                        endpoint: testInfo.endpoint,
                        method: testInfo.method,
                        status: 'skipped',
                        reason: 'Does not match endpoint filter'
                    });
                    continue;
                }
            }
            // Вызываем endpoint
            console.log(`  🌐 ${testInfo.method} ${testInfo.endpoint}`);
            try {
                const fullUrl = standUrl + testInfo.endpoint;
                let response;
                if (['POST', 'PUT', 'PATCH'].includes(testInfo.method.toUpperCase())) {
                    response = await (0, axios_1.default)({
                        method: testInfo.method.toLowerCase(),
                        url: fullUrl,
                        data: testInfo.requestData,
                        ...axiosConfig
                    });
                }
                else {
                    response = await (0, axios_1.default)({
                        method: testInfo.method.toLowerCase(),
                        url: fullUrl,
                        ...axiosConfig
                    });
                }
                // Сравниваем данные
                const comparison = compareResponses(testInfo.expectedResponse, response.data);
                if (comparison.isEqual) {
                    console.log(`    ✅ Данные актуальны`);
                    result.details.push({
                        testFile,
                        endpoint: testInfo.endpoint,
                        method: testInfo.method,
                        status: 'unchanged'
                    });
                }
                else {
                    console.log(`    🔄 Обнаружены изменения: ${comparison.changedFields.join(', ')}`);
                    if (updateFiles) {
                        // Обновляем файл
                        const updatedContent = updateTestDataInFile(fileContent, response.data, testInfo);
                        fs.writeFileSync(testFile, updatedContent, 'utf-8');
                        console.log(`    ✅ Файл обновлён`);
                        result.updatedTests++;
                    }
                    else {
                        console.log(`    ℹ️  Обновление файла пропущено (updateFiles: false)`);
                    }
                    result.details.push({
                        testFile,
                        endpoint: testInfo.endpoint,
                        method: testInfo.method,
                        status: 'updated',
                        changedFields: comparison.changedFields
                    });
                }
            }
            catch (apiError) {
                const status = apiError.response?.status;
                console.log(`    ❌ Ошибка API: ${status || apiError.message}`);
                result.failedTests++;
                result.details.push({
                    testFile,
                    endpoint: testInfo.endpoint,
                    method: testInfo.method,
                    status: 'failed',
                    reason: `API error: ${status || apiError.message}`
                });
            }
        }
        catch (error) {
            console.error(`  ❌ Ошибка обработки файла: ${error.message}`);
            result.failedTests++;
            result.details.push({
                testFile,
                endpoint: 'unknown',
                method: 'unknown',
                status: 'failed',
                reason: error.message
            });
        }
    }
    // Итоговая статистика
    console.log('\n📊 Результаты переактуализации:');
    console.log(`   Всего тестов: ${result.totalTests}`);
    console.log(`   Обновлено: ${result.updatedTests}`);
    console.log(`   Пропущено: ${result.skippedTests}`);
    console.log(`   Ошибок: ${result.failedTests}`);
    return result;
}
/**
 * Рекурсивно получает все .test.ts файлы из папки
 */
function getTestFilesRecursively(dir) {
    const files = [];
    if (!fs.existsSync(dir))
        return files;
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'test-data') {
            files.push(...getTestFilesRecursively(fullPath));
        }
        else if (stat.isFile() && item.endsWith('.happy-path.test.ts')) {
            files.push(fullPath);
        }
    }
    return files;
}
/**
 * Извлекает информацию о тесте из содержимого файла
 */
function extractTestInfo(content) {
    try {
        // Извлекаем endpoint
        const endpointMatch = content.match(/const endpoint = ['"`]([^'"`]+)['"`]/);
        if (!endpointMatch)
            return null;
        // Извлекаем метод
        const methodMatch = content.match(/const httpMethod = ['"`]([^'"`]+)['"`]/);
        if (!methodMatch)
            return null;
        // Извлекаем actualEndpoint (реальный endpoint с подставленными ID)
        const actualEndpointMatch = content.match(/const actualEndpoint = ['"`]([^'"`]+)['"`]/);
        // Извлекаем requestData
        let requestData = {};
        const requestDataMatch = content.match(/const requestData = (\{[\s\S]*?\});/);
        if (requestDataMatch) {
            try {
                // Пробуем распарсить как JSON-подобную структуру
                const jsonLike = requestDataMatch[1]
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                requestData = JSON.parse(jsonLike);
            }
            catch {
                // Если не получилось, оставляем пустой объект
            }
        }
        // Извлекаем normalizedExpected
        let expectedResponse = {};
        const normalizedMatch = content.match(/const normalizedExpected = (\{[\s\S]*?\});/);
        if (normalizedMatch) {
            try {
                const jsonLike = normalizedMatch[1]
                    .replace(/'/g, '"')
                    .replace(/(\w+):/g, '"$1":')
                    .replace(/,\s*}/g, '}')
                    .replace(/,\s*]/g, ']');
                expectedResponse = JSON.parse(jsonLike);
            }
            catch {
                // Если не получилось, оставляем пустой объект
            }
        }
        return {
            endpoint: actualEndpointMatch ? actualEndpointMatch[1] : endpointMatch[1],
            method: methodMatch[1],
            requestData,
            expectedResponse
        };
    }
    catch {
        return null;
    }
}
/**
 * Сравнивает два ответа и возвращает список изменённых полей
 */
function compareResponses(expected, actual) {
    const changedFields = [];
    function compare(exp, act, prefix = '') {
        if (exp === null && act === null)
            return;
        if (exp === undefined && act === undefined)
            return;
        if (typeof exp !== typeof act) {
            changedFields.push(prefix || 'root');
            return;
        }
        if (Array.isArray(exp) && Array.isArray(act)) {
            if (exp.length !== act.length) {
                changedFields.push(`${prefix}[length]`);
            }
            for (let i = 0; i < Math.min(exp.length, act.length); i++) {
                compare(exp[i], act[i], `${prefix}[${i}]`);
            }
            return;
        }
        if (typeof exp === 'object' && exp !== null) {
            const allKeys = new Set([...Object.keys(exp || {}), ...Object.keys(act || {})]);
            for (const key of allKeys) {
                const newPrefix = prefix ? `${prefix}.${key}` : key;
                if (!(key in exp)) {
                    changedFields.push(`${newPrefix} (new)`);
                }
                else if (!(key in act)) {
                    changedFields.push(`${newPrefix} (removed)`);
                }
                else {
                    compare(exp[key], act[key], newPrefix);
                }
            }
            return;
        }
        if (exp !== act) {
            changedFields.push(prefix || 'root');
        }
    }
    compare(expected, actual);
    return {
        isEqual: changedFields.length === 0,
        changedFields
    };
}
/**
 * Обновляет тестовые данные в файле
 */
function updateTestDataInFile(content, newResponseData, testInfo) {
    // Находим и заменяем normalizedExpected
    const normalizedExpectedRegex = /(const normalizedExpected = )(\{[\s\S]*?\})(;)/;
    if (normalizedExpectedRegex.test(content)) {
        const formattedData = JSON.stringify(newResponseData, null, 4)
            .split('\n')
            .map((line, i) => i === 0 ? line : '    ' + line)
            .join('\n');
        return content.replace(normalizedExpectedRegex, `$1${formattedData}$3`);
    }
    return content;
}
//# sourceMappingURL=happy-path-generator.js.map