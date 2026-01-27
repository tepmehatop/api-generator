/**
 * Генератор API тестов из сгенерированных API методов
 * ВЕРСИЯ 13.0 - ИНТЕГРАЦИЯ С HAPPY PATH ДАННЫМИ
 */
export interface ApiTestConfig {
    /**
     * Путь к файлу с API методами (например, ./src/api/pets.api.ts)
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
}
/**
 * Генерирует API тесты из файла с методами
 */
export declare function generateApiTests(config: ApiTestConfig): Promise<void>;
//# sourceMappingURL=test-generator.d.ts.map