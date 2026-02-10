/**
 * Генератор API тестов из сгенерированных API методов
 * ВЕРСИЯ 14.0 - РАЗДЕЛЬНЫЕ МЕТОДЫ ГЕНЕРАЦИИ (negative, positive, pairwise)
 * ВЕРСИЯ 13.0 - ИНТЕГРАЦИЯ С HAPPY PATH ДАННЫМИ
 */
/**
 * НОВОЕ v14.0: Базовый конфиг для всех типов тестов
 */
export interface BaseTestConfig {
    /**
     * Путь к файлу или папке с API методами
     * Примеры:
     * - './src/api/pets.api.ts' - один файл
     * - './src/api/' - все файлы в папке
     */
    apiFilePath: string;
    /**
     * Папка для выгрузки тестов
     */
    outputDir: string;
    /**
     * Путь к baseTest фикстуре (например, ../../../fixtures/baseTest)
     */
    baseTestPath?: string;
    /**
     * Путь к axiosHelpers (например, ../../../helpers/axiosHelpers)
     */
    axiosHelpersPath?: string;
    /**
     * Путь к apiTestHelper (например, ../../../helpers/apiTestHelper)
     */
    apiTestHelperPath?: string;
    /**
     * НОВОЕ v13.0: Использовать данные из Happy Path тестов
     * @default true
     */
    useHappyPathData?: boolean;
    /**
     * НОВОЕ v13.0: Функция подключения к БД (sql tagged template)
     * Необходимо для получения данных из Happy Path тестов
     */
    dbConnection?: any;
    /**
     * НОВОЕ v13.0: Схема БД для Happy Path данных
     * @default 'qa'
     */
    dbSchema?: string;
    /**
     * НОВОЕ v13.0: Количество записей Happy Path для выборки
     * @default 15
     */
    happyPathSamplesCount?: number;
    /**
     * НОВОЕ v13.0: Количество попыток подбора данных для получения 200 ответа
     * @default 10
     */
    maxDataGenerationAttempts?: number;
    /**
     * НОВОЕ v13.0: URL стенда для тестового вызова при генерации данных
     * @default process.env.StandURL
     */
    standUrl?: string;
    /**
     * НОВОЕ v13.0: Токен авторизации для тестового вызова
     * @default process.env.AUTH_TOKEN
     */
    authToken?: string;
    /**
     * НОВОЕ v14.0: Группировать тесты по категориям в подпапки
     * @default true
     */
    groupByCategory?: boolean;
}
/**
 * НОВОЕ v14.0: Конфиг для негативных тестов
 */
export interface NegativeTestConfig extends BaseTestConfig {
    /**
     * Генерировать тесты 401 Unauthorized
     * @default true
     */
    generate401Tests?: boolean;
    /**
     * Генерировать тесты 403 Forbidden
     * @default true
     */
    generate403Tests?: boolean;
    /**
     * Генерировать тесты 400 Bad Request
     * @default true
     */
    generate400Tests?: boolean;
    /**
     * Генерировать тесты 404 Not Found
     * @default true
     */
    generate404Tests?: boolean;
    /**
     * Генерировать тесты 405 Method Not Allowed
     * @default true
     */
    generate405Tests?: boolean;
    /**
     * НОВОЕ v14.1: Глобально исключить методы из 405 проверок
     * Эти HTTP методы НЕ будут использоваться для проверки 405 ошибки
     *
     * ЗАЧЕМ: Некоторые методы (например DELETE) опасны - могут удалить тестовые данные
     * даже если для конкретного endpoint этот метод разрешён
     *
     * @example ['DELETE'] - никогда не вызывать DELETE для 405 проверок
     * @example ['DELETE', 'PUT'] - никогда не вызывать DELETE и PUT
     * @default []
     */
    exclude405Methods?: string[];
}
/**
 * НОВОЕ v14.0: Конфиг для позитивных тестов
 */
export interface PositiveTestConfig extends BaseTestConfig {
    /**
     * Генерировать тест с только обязательными полями
     * @default true
     */
    generateRequiredFieldsTest?: boolean;
    /**
     * Генерировать тест со всеми полями
     * @default true
     */
    generateAllFieldsTest?: boolean;
}
/**
 * НОВОЕ v14.0: Конфиг для pairwise тестов
 */
export interface PairwiseTestConfig extends BaseTestConfig {
    /**
     * Генерировать комбинации необязательных полей
     * @default true
     */
    generateOptionalCombinations?: boolean;
    /**
     * Генерировать тесты для enum значений
     * @default true
     */
    generateEnumTests?: boolean;
    /**
     * Максимальное количество pairwise комбинаций на endpoint
     * @default 10
     */
    maxPairwiseCombinations?: number;
}
/**
 * @deprecated Используйте отдельные методы: generateNegativeTests, generatePositiveTests, generatePairwiseTests
 */
export interface ApiTestConfig extends BaseTestConfig {
    /**
     * Генерировать тесты для негативных сценариев (401, 403, 400, 405)
     * @default true
     */
    generateNegativeTests?: boolean;
    /**
     * Генерировать тесты для позитивных сценариев (200, 201)
     * @default true
     */
    generatePositiveTests?: boolean;
    /**
     * Генерировать pairwise тесты (комбинаторное покрытие)
     * @default false
     */
    generatePairwiseTests?: boolean;
}
/**
 * НОВОЕ v14.0: Результат генерации тестов
 */
interface GenerationResult {
    generatedCount: number;
    updatedCount: number;
    skippedCount: number;
    failedCount: number;
    failures: GenerationFailure[];
}
/**
 * НОВОЕ v14.0: Информация о неудачной генерации
 */
interface GenerationFailure {
    methodName: string;
    reason: 'no_dto' | 'no_endpoint' | 'parse_error' | 'write_error' | 'other';
    details: string;
}
/**
 * НОВОЕ v14.0: Генерирует API тесты для негативных сценариев
 */
export declare function generateNegativeTests(config: NegativeTestConfig): Promise<GenerationResult>;
/**
 * НОВОЕ v14.0: Генерирует API тесты для позитивных сценариев
 */
export declare function generatePositiveTests(config: PositiveTestConfig): Promise<GenerationResult>;
/**
 * НОВОЕ v14.0: Генерирует pairwise тесты
 */
export declare function generatePairwiseTests(config: PairwiseTestConfig): Promise<GenerationResult>;
/**
 * @deprecated Используйте отдельные методы: generateNegativeTests, generatePositiveTests, generatePairwiseTests
 * Генерирует API тесты из файла с методами
 */
export declare function generateApiTests(config: ApiTestConfig): Promise<void>;
export {};
//# sourceMappingURL=test-generator.d.ts.map