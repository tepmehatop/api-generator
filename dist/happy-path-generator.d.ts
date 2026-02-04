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
    outputDir: string;
    dbConnectionMethod: string;
    dbSchema?: string;
    endpointFilter?: string[];
    methodFilter?: string[];
    maxTestsPerEndpoint?: number;
    onlySuccessful?: boolean;
    testTag?: string;
    force?: boolean;
    standUrlEnvVar?: string;
    axiosConfigName?: string;
    axiosConfigPath?: string;
    apiGeneratedPath?: string;
    createSeparateDataFiles?: boolean;
    mergeDuplicateTests?: boolean;
    testImportPath?: string;
    packageName?: string;
    deduplication?: {
        enabled?: boolean;
        ignoreFields?: string[];
        significantFields?: string[];
        detectEdgeCases?: boolean;
        maxTestsPerEndpoint?: number;
        preserveTaggedTests?: string[];
    };
    dataValidation?: {
        enabled?: boolean;
        validateBeforeGeneration?: boolean;
        onStaleData?: 'update' | 'skip' | 'delete';
        staleIfChanged?: string[];
        allowChanges?: string[];
        validateInDatabase?: boolean;
        standUrl?: string;
        axiosConfig?: any;
        logChanges?: boolean;
        logPath?: string;
    };
    debug?: boolean;
}
export declare class HappyPathTestGenerator {
    private sql;
    private config;
    constructor(config: HappyPathTestConfig, sqlConnection: any);
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
     */
    private generateTestFile;
    /**
     * ИСПРАВЛЕНИЕ 9: Создает файлы с НОРМАЛИЗОВАННЫМИ данными на основе DTO
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
//# sourceMappingURL=happy-path-generator.d.ts.map