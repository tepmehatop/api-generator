/**
 * Генератор Happy Path API тестов
 * ВЕРСИЯ 12.0 - ДЕДУПЛИКАЦИЯ И ВАЛИДАЦИЯ ДАННЫХ
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
 * 14. НОВОЕ: Дедупликация тестов (Идея 1 + 2)
 * 15. НОВОЕ: Валидация данных (Стратегия 1 - проверка актуальности)
 */
export interface HappyPathTestConfig {
    /**
     * Папка для выгрузки сгенерированных тестов
     * @example './e2e/api/happy-path'
     */
    outputDir: string;
    /**
     * НОВОЕ v14.0: Группировать тесты по категориям в подпапки
     * Категория определяется из пути endpoint: /api/v1/orders/place -> orders/
     * Если true - тесты будут лежать в outputDir/orders/, outputDir/users/ и т.д.
     * @default true
     */
    groupByCategory?: boolean;
    /**
     * @deprecated Используйте dbDataConnection вместо этого
     * Имя метода подключения к БД (для обратной совместимости)
     */
    dbConnectionMethod?: string;
    /**
     * НОВОЕ v14.0: Подключение к БД где хранятся собранные API запросы
     * Используется для чтения таблицы api_requests из которой генерируются тесты
     *
     * @example
     * // В вашем проекте:
     * import postgres from 'postgres';
     * export const sqlDataGenConn = postgres({ host: 'data-gen-db.example.com', ... });
     *
     * // В конфиге:
     * dbDataConnection: sqlDataGenConn
     */
    dbDataConnection?: any;
    /**
     * НОВОЕ v14.0: Схема БД для api_requests (где хранятся собранные запросы)
     * @default 'qa'
     * @example 'qa' -> таблица qa.api_requests
     */
    dbDataSchema?: string;
    /**
     * НОВОЕ v14.0: Подключение к БД тестового стенда
     * Используется для валидации данных - проверки что данные в БД стенда актуальны
     * Это ДРУГАЯ база данных, отличная от dbDataConnection
     *
     * @example
     * // В вашем проекте:
     * import postgres from 'postgres';
     * export const sqlStandConn = postgres({ host: 'test-stand-db.example.com', ... });
     *
     * // В конфиге:
     * dbStandConnection: sqlStandConn
     */
    dbStandConnection?: any;
    /**
     * НОВОЕ v14.0: Схема БД тестового стенда для валидации
     * @default 'public'
     * @example 'orders' -> таблицы orders.*, users.* и т.д.
     */
    dbStandSchema?: string;
    /**
     * @deprecated Используйте dbDataSchema вместо этого
     */
    dbSchema?: string;
    /**
     * Генерировать тесты ТОЛЬКО для указанных эндпоинтов (белый список)
     * Если пустой - генерируются тесты для всех эндпоинтов
     * @example ['/api/v1/orders', '/api/v1/users']
     */
    endpointFilter?: string[];
    /**
     * НОВОЕ v14.0: НЕ генерировать тесты для указанных эндпоинтов (черный список)
     * Исключает эндпоинты из генерации даже если они попадают в endpointFilter
     * @example ['/api/v1/internal', '/api/v1/admin', '/api/v1/debug']
     */
    excludeEndpoints?: string[];
    /**
     * Генерировать тесты ТОЛЬКО для указанных HTTP методов (белый список)
     * @example ['GET', 'POST'] - только GET и POST запросы
     */
    methodFilter?: string[];
    /**
     * НОВОЕ v14.0: НЕ генерировать тесты для указанных HTTP методов (черный список)
     * @example ['DELETE', 'PATCH'] - исключить DELETE и PATCH из генерации
     */
    excludeMethods?: string[];
    /**
     * Максимальное количество тестов на один эндпоинт
     * @default 5
     */
    maxTestsPerEndpoint?: number;
    /**
     * Генерировать тесты только для успешных запросов (2xx)
     * @default true
     */
    onlySuccessful?: boolean;
    /**
     * Тег для сгенерированных тестов
     * @default '@apiHappyPath'
     * @example '@apiHappyPath @smoke'
     */
    testTag?: string;
    /**
     * Принудительная перегенерация всех тестов (игнорировать существующие)
     * @default false
     */
    force?: boolean;
    /**
     * Переменная окружения с URL тестового стенда
     * @default 'StandURL'
     * @example 'TEST_STAND_URL' -> process.env.TEST_STAND_URL
     */
    standUrlEnvVar?: string;
    /**
     * Имя конфига axios для авторизации (экспортируется из axiosConfigPath)
     * @default 'configApiHeaderAdmin'
     * @example 'configApiHeaderAdmin' -> { headers: { Authorization: 'Bearer ...' } }
     */
    axiosConfigName?: string;
    /**
     * Путь к файлу с axios конфигами (относительно тестового файла)
     * @default '../../../helpers/axiosHelpers'
     */
    axiosConfigPath?: string;
    /**
     * НОВОЕ v14.0: Путь к apiTestHelper для детализации ошибок
     * При падении теста выводит детальный response с готовым curl запросом
     * @default '../../../helpers/apiTestHelper'
     * @example '../../../helpers/apiTestHelper' -> import { getMessageFromError } from '...'
     */
    apiTestHelperPath?: string;
    /**
     * НОВОЕ v14.1: Путь к методу отправки email уведомлений о 5xx ошибках
     * Метод должен принимать HTML-строку с телом письма
     *
     * @example '../../../helpers/mailHelper' -> import { sendErrorMailbyApi } from '...'
     */
    emailHelperPath?: string;
    /**
     * НОВОЕ v14.1: Имя метода для отправки email (экспортируется из emailHelperPath)
     * @default 'sendErrorMailbyApi'
     */
    emailHelperMethodName?: string;
    /**
     * НОВОЕ v14.1: Отправлять email уведомления при 5xx ошибках (500, 501, 502, 503)
     * Требует настроенный emailHelperPath
     * @default false
     */
    send5xxEmailNotification?: boolean;
    /**
     * Путь к сгенерированным API методам (для поиска DTO)
     * @example './src/generated-api'
     */
    apiGeneratedPath?: string;
    /**
     * Создавать отдельные файлы с тестовыми данными
     * Если true - данные выносятся в папку test-data/
     * @default false
     */
    createSeparateDataFiles?: boolean;
    /**
     * Объединять дубликаты тестов (одинаковые эндпоинты)
     * @default true
     */
    mergeDuplicateTests?: boolean;
    /**
     * Путь для импорта test и expect (фреймворк тестирования)
     * @default '@playwright/test'
     * @example '../../../fixtures/baseTest' - для кастомных fixtures
     */
    testImportPath?: string;
    /**
     * Название NPM пакета для импорта утилит (compareDbWithResponse и т.д.)
     * @default Читается из package.json или '@your-company/api-codegen'
     */
    packageName?: string;
    /**
     * Настройки дедупликации тестов
     *
     * ЗАЧЕМ ЭТО НУЖНО:
     * При сборе API запросов часто получаем много похожих запросов к одному эндпоинту.
     * Например, 100 запросов GET /api/v1/orders/{id} с разными id.
     * Генерировать 100 тестов бессмысленно - достаточно 2-3 уникальных случая.
     *
     * КАК РАБОТАЕТ:
     * 1. Группирует запросы по эндпоинту и методу
     * 2. Сравнивает структуру response (игнорируя id, timestamps)
     * 3. Выбирает уникальные случаи (разные status, type, пустые массивы)
     * 4. Оставляет максимум maxTestsPerEndpoint тестов
     */
    deduplication?: {
        /**
         * Включить дедупликацию
         * @default true
         */
        enabled?: boolean;
        /**
         * Поля которые ИГНОРИРУЮТСЯ при сравнении уникальности
         * Поддерживает wildcard: '*_id' матчит 'user_id', 'order_id' и т.д.
         * @default ['id', '*_id', 'created_at', 'updated_at', 'modified_at', 'deleted_at', 'timestamp', '*_timestamp', 'uuid', 'guid']
         *
         * ПРИМЕР: Два запроса с разными id считаются одинаковыми:
         * { id: 1, status: 'active' } == { id: 2, status: 'active' }
         */
        ignoreFields?: string[];
        /**
         * Поля которые ВАЖНЫ для определения уникальности
         * Если эти поля отличаются - запросы считаются уникальными
         * @default ['status', 'state', 'type', 'role', 'category', 'kind']
         *
         * ПРИМЕР: Два запроса с разным status - это разные тест-кейсы:
         * { status: 'active' } != { status: 'deleted' }
         */
        significantFields?: string[];
        /**
         * Обнаруживать edge cases (граничные случаи)
         * Автоматически выделяет тесты с: пустыми массивами, null, 0, пустыми строками
         * @default true
         *
         * ПРИМЕР: Если есть запросы с items: [] и items: [...] - оба будут сохранены
         */
        detectEdgeCases?: boolean;
        /**
         * Максимум тестов на один эндпоинт (после дедупликации)
         * @default 2
         */
        maxTestsPerEndpoint?: number;
        /**
         * Теги в названии теста которые защищают от удаления при дедупликации
         * Тесты с этими тегами всегда сохраняются
         * @default ['[KEEP]', '[IMPORTANT]']
         *
         * ПРИМЕР: test('GET /orders [KEEP] - специальный случай', ...) - не удалится
         */
        preserveTaggedTests?: string[];
    };
    /**
     * Настройки валидации актуальности данных
     *
     * ЗАЧЕМ ЭТО НУЖНО:
     * Собранные API запросы могут устареть - данные в БД стенда изменились.
     * Например, заказ был в статусе 'pending', а теперь 'completed'.
     * Тест с ожиданием 'pending' будет падать.
     *
     * КАК РАБОТАЕТ:
     * 1. Перед генерацией отправляет запрос на реальный стенд
     * 2. Сравнивает ответ с сохраненным в api_requests
     * 3. Если данные изменились - применяет стратегию (update/skip/delete)
     */
    dataValidation?: {
        /**
         * Включить валидацию данных
         * @default true
         */
        enabled?: boolean;
        /**
         * Проверять актуальность данных ПЕРЕД генерацией теста
         * Отправляет реальный запрос и сравнивает с сохраненным response
         * @default true
         */
        validateBeforeGeneration?: boolean;
        /**
         * Что делать с устаревшими данными:
         * - 'update': Обновить response в api_requests актуальными данными
         * - 'skip': Пропустить генерацию теста для этого запроса
         * - 'delete': Удалить запрос из api_requests
         * @default 'delete'
         */
        onStaleData?: 'update' | 'skip' | 'delete';
        /**
         * Поля которые определяют что данные устарели
         * Если эти поля изменились - данные считаются устаревшими
         * @default ['status', 'state', 'type', 'role', 'category']
         *
         * ПРИМЕР: Если status изменился с 'pending' на 'completed' - данные устарели
         */
        staleIfChanged?: string[];
        /**
         * Изменения каких полей ДОПУСТИМЫ (не считаются устареванием)
         * Поддерживает wildcard: '*_at' матчит 'created_at', 'updated_at'
         * @default ['updated_at', 'modified_at', '*_timestamp', '*_at']
         *
         * ПРИМЕР: Изменение updated_at не делает данные устаревшими
         */
        allowChanges?: string[];
        /**
         * Дополнительно проверять данные в БД тестового стенда
         * Требует настроенный dbStandConnection
         * @default false
         */
        validateInDatabase?: boolean;
        /**
         * Логировать все обнаруженные изменения данных
         * @default true
         */
        logChanges?: boolean;
        /**
         * Путь для сохранения логов валидации
         * @default './happy-path-validation-logs'
         */
        logPath?: string;
        /**
         * НОВОЕ v14.1: Путь к JSON файлу для логирования 4xx ошибок
         * Сохраняет ошибки 400, 404, 422 и подобные в читаемом JSON формате
         * @example './validation-errors/client-errors.json'
         */
        clientErrorsLogPath?: string;
        /**
         * НОВОЕ v14.1: Путь к JSON файлу для логирования 5xx ошибок
         * Сохраняет ошибки 500, 501, 502, 503 в отдельный файл
         * @example './validation-errors/server-errors.json'
         */
        serverErrorsLogPath?: string;
        /**
         * НОВОЕ v14.1: Отправлять email уведомления при 5xx ошибках валидации
         * Требует настроенный emailHelperPath в основном конфиге
         * @default false
         */
        sendServerErrorEmail?: boolean;
    };
    /**
     * Включить детальное логирование для отладки
     * @default false
     */
    debug?: boolean;
}
export declare class HappyPathTestGenerator {
    private sql;
    private sqlStand;
    private config;
    /**
     * @param config - Конфигурация генератора
     * @param sqlConnection - Подключение к БД для ОБРАТНОЙ СОВМЕСТИМОСТИ
     *                        Предпочтительнее использовать config.dbDataConnection и config.dbStandConnection
     */
    constructor(config: HappyPathTestConfig, sqlConnection?: any);
    /**
     * НОВОЕ v14.1: Загружает функцию отправки email для уведомлений об ошибках
     */
    private loadEmailSendFunction;
    generate(): Promise<void>;
    /**
     * ИСПРАВЛЕНИЕ 8: Правильная группировка - заменяем числа на {id}
     */
    private groupByStructure;
    private groupByEndpoint;
    private fetchUniqueRequests;
    private generateTestsForEndpoint;
    private extractTestIds;
    private appendTestsToFile;
    /**
     * Генерирует полный файл теста
     * @param endpoint - Эндпоинт API
     * @param method - HTTP метод
     * @param requests - Массив запросов
     * @param outputDir - Папка для тестов (с учётом категории если groupByCategory: true)
     */
    private generateTestFile;
    /**
     * ИСПРАВЛЕНИЕ 9: Создает файлы с НОРМАЛИЗОВАННЫМИ данными на основе DTO
     * ИСПРАВЛЕНИЕ v14.1: Добавлен параметр outputDir для корректной работы с groupByCategory
     */
    private createDataFiles;
    /**
     * ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ метод генерации теста
     * ИСПРАВЛЕНИЯ 4, 5, 6, 7
     */
    private generateSingleTest;
    private getJsType;
    private getRelativePath;
    private endpointToFileName;
    private getSuccessCodeName;
    private markAsGenerated;
}
export declare function generateHappyPathTests(config: HappyPathTestConfig, sqlConnection: any): Promise<void>;
/**
 * Конфигурация для переактуализации тестовых данных
 */
export interface ReActualizeConfig {
    /**
     * Путь к папке со сгенерированными Happy Path тестами
     * @example './e2e/api/happy-path'
     */
    testsDir: string;
    /**
     * Фильтр endpoints для актуализации
     * Если пустой - актуализируются все endpoints
     * @example ['/api/v1/orders', '/api/v1/users/{id}']
     */
    endpointFilter?: string[];
    /**
     * URL тестового стенда
     * @example 'https://api.example.com'
     */
    standUrl: string;
    /**
     * Axios конфиг для авторизации
     * @example { headers: { Authorization: 'Bearer xxx' } }
     */
    axiosConfig: any;
    /**
     * Обновлять тестовые данные в файлах
     * Если false - только показывает что изменилось
     * @default true
     */
    updateFiles?: boolean;
    /**
     * Включить детальное логирование
     * @default false
     */
    debug?: boolean;
}
/**
 * Результат переактуализации
 */
export interface ReActualizeResult {
    totalTests: number;
    updatedTests: number;
    skippedTests: number;
    failedTests: number;
    details: Array<{
        testFile: string;
        endpoint: string;
        method: string;
        status: 'updated' | 'skipped' | 'failed' | 'unchanged';
        reason?: string;
        changedFields?: string[];
    }>;
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
export declare function reActualizeHappyPathTests(config: ReActualizeConfig): Promise<ReActualizeResult>;
//# sourceMappingURL=happy-path-generator.d.ts.map