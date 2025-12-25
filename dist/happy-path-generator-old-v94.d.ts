/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 */
export interface HappyPathTestConfig {
    outputDir: string;
    dbConnectionMethod: string;
    dbSchema?: string;
    endpointFilter?: string[];
    methodFilter?: string[];
    maxTestsPerEndpoint?: number;
    onlySuccessful?: boolean;
    testTag?: string;
    force?: boolean;
}
export declare class HappyPathTestGenerator {
    private sql;
    private config;
    constructor(config: HappyPathTestConfig, sqlConnection: any);
    /**
     * Генерирует все Happy Path тесты
     */
    generate(): Promise<void>;
    /**
     * Получает уникальные запросы из БД
     * ✅ ИСПРАВЛЕНО: Используем tagged template literal!
     */
    private fetchUniqueRequests;
    /**
     * Группирует запросы по endpoint
     */
    private groupByEndpoint;
    /**
     * Генерирует тесты для одного endpoint
     */
    private generateTestsForEndpoint;
    /**
     * Извлекает ID тестов из существующего файла
     */
    private extractTestIds;
    /**
     * Добавляет новые тесты в существующий файл
     */
    private appendTestsToFile;
    /**
     * Генерирует полный файл теста
     */
    private generateTestFile;
    /**
     * Генерирует один тест
     */
    private generateSingleTest;
    /**
     * Преобразует endpoint в имя файла
     */
    private endpointToFileName;
    /**
     * Помечает запросы как сгенерированные в БД
     * ✅ ИСПРАВЛЕНО: Используем tagged template literal!
     */
    private markAsGenerated;
}
/**
 * Экспортируемая функция для удобства использования
 */
export declare function generateHappyPathTests(config: HappyPathTestConfig, sqlConnection: any): Promise<void>;
//# sourceMappingURL=happy-path-generator-old-v94.d.ts.map