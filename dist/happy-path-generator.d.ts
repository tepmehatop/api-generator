/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 *
 * Особенности:
 * - Читает данные из БД (qa.api_requests)
 * - Инкрементальная генерация (дополняет существующие файлы)
 * - Отслеживание сгенерированных тестов в БД
 * - Force режим для перегенерации
 * - Стандартная структура как в позитивных/негативных тестах
 */
export interface HappyPathTestConfig {
    /**
     * Подключение к БД
     */
    database: {
        host: string;
        port: number;
        database: string;
        username: string;
        password: string;
    };
    /**
     * Путь для сохранения тестов
     */
    outputDir: string;
    /**
     * Force режим - перегенерировать все тесты
     * @default false
     */
    force?: boolean;
    /**
     * Фильтр по endpoint (опционально)
     */
    endpointFilter?: string[];
    /**
     * Фильтр по HTTP методу (опционально)
     */
    methodFilter?: string[];
    /**
     * Максимальное количество тестов на один endpoint
     * @default 10
     */
    maxTestsPerEndpoint?: number;
    /**
     * Только успешные ответы (2xx)
     * @default true
     */
    onlySuccessful?: boolean;
    /**
     * Тег для тестов
     * @default '@apiHappyPath'
     */
    testTag?: string;
    /**
     * Путь к axiosHelpers
     * @default '../../../helpers/axiosHelpers'
     */
    axiosHelpersPath?: string;
}
export declare class HappyPathTestGenerator {
    private sql;
    private config;
    constructor(config: HappyPathTestConfig);
    /**
     * Генерирует все Happy Path тесты
     */
    generate(): Promise<void>;
    private fetchUniqueRequests;
    private groupByEndpoint;
    private generateTestsForEndpoint;
    private extractTestIds;
    private appendTestsToFile;
    private generateTestFile;
    private generateTestCases;
    private generateAxiosCall;
    private generateTestTitle;
    private getSuccessCode;
    private endpointToFileName;
    private markAsGenerated;
}
export declare function generateHappyPathTests(config: HappyPathTestConfig): Promise<void>;
//# sourceMappingURL=happy-path-generator.d.ts.map