/**
 * Генератор Happy Path API тестов на основе реальных данных с фронта
 *
 * ВЕРСИЯ 10.0 - ВСЕ 12 ПУНКТОВ ИСПРАВЛЕНИЙ
 *
 * 1. ✅ Полный архив проекта
 * 2. ✅ Файлы с префиксом .test.ts (не .spec.ts)
 * 3. ✅ Структура теста СТРОГО как в примере findPetsByStatus.test.ts
 * 4. ✅ Использование только axios (без request от Playwright)
 * 5. ✅ Нормализация данных из БД
 * 6. ✅ Глубокое сравнение объектов
 * 7. ✅ Конфигурируемая глобальная переменная стенда
 * 8. ✅ Конфигурируемый axios config с импортом
 * 9. ✅ Валидация структуры и типов данных
 * 10. ✅ Проверка обязательных полей из DTO
 * 11. ✅ Вынос данных в отдельные файлы
 * 12. ✅ Объединение дублирующих тестов
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
}
export declare class HappyPathTestGenerator {
    private sql;
    private config;
    constructor(config: HappyPathTestConfig, sqlConnection: any);
    generate(): Promise<void>;
    /**
     * Пункт 12: Группировка по структуре запроса (объединение дублей)
     */
    private groupByStructure;
    /**
     * Создает хэш структуры request (игнорируя ID)
     */
    private getStructureHash;
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
     * Пункт 11: Создает отдельные файлы с данными
     */
    private createDataFiles;
    /**
     * Генерирует один тест со ВСЕМИ исправлениями
     * Пункт 3: Структура СТРОГО как в примере findPetsByStatus.test.ts
     * Пункт 4: Только axios
     * Пункт 5 и 6: Нормализация и глубокое сравнение
     * Пункт 7: Конфигурируемая переменная стенда
     * Пункт 8: Конфигурируемый axios config
     * Пункт 9: Валидация типов
     * Пункт 10: Проверка DTO
     */
    private generateSingleTest;
    private extractQueryParams;
    private endpointToFileName;
    private getSuccessCodeName;
    private markAsGenerated;
}
export declare function generateHappyPathTests(config: HappyPathTestConfig, sqlConnection: any): Promise<void>;
//# sourceMappingURL=happy-path-generator.d.ts.map