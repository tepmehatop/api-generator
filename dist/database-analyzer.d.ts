/**
 * Конфигурация для анализа БД и генерации тестовых данных
 */
export interface DatabaseAnalyzerConfig {
    /**
     * Путь к тест файлу который нужно проанализировать
     * Например: './tests/api/orders/createOrder.test.ts'
     */
    testFilePath: string;
    /**
     * Имя метода для подключения к БД (template literal)
     * Например: 'testDbConnect' - будет использоваться как await testDbConnect`SELECT ...`
     */
    dbConnectionMethod: string;
    /**
     * Force режим - заново искать таблицы даже если они уже найдены
     * @default false
     */
    force?: boolean;
    /**
     * Генерировать новые данные или использовать существующие
     * @default 'existing' - брать существующие данные из БД
     */
    dataStrategy?: 'existing' | 'generate' | 'both';
    /**
     * Количество примеров данных для каждой таблицы
     * @default 5
     */
    samplesCount?: number;
}
/**
 * Результат анализа
 */
interface AnalysisResult {
    endpoint: string;
    confirmedTables: string[];
    suspectedTables: string[];
    relatedTables: string[];
    testData: Record<string, any[]>;
}
/**
 * Анализатор базы данных для генерации тестовых данных
 */
export declare class DatabaseAnalyzer {
    private config;
    private dbConnect;
    private schemaCache;
    constructor(config: DatabaseAnalyzerConfig, dbConnectFunction: any);
    /**
     * Главный метод - анализирует тест и генерирует данные
     */
    analyze(): Promise<AnalysisResult>;
    /**
     * Извлекает информацию из тест файла
     */
    private extractTestInfo;
    /**
     * Извлекает поля из DTO
     */
    private extractDTOFields;
    /**
     * ЭТАП 1: Находит таблицы по полям DTO
     */
    private findTablesByFields;
    /**
     * Генерирует варианты имени поля (camelCase, snake_case, etc)
     */
    private generateFieldVariants;
    /**
     * ЭТАП 2: Находит связанные таблицы через FK
     */
    private findRelatedTables;
    /**
     * ЭТАП 3: Подтверждает таблицы реальным вызовом endpoint
     */
    private confirmWithRealCall;
    /**
     * Генерирует уникальные тестовые данные
     */
    private generateUniqueTestData;
    /**
     * Генерирует тестовые данные для таблиц
     */
    private generateTestData;
    /**
     * Очищает строку от служебных полей
     */
    private sanitizeRow;
    /**
     * Обновляет тест файл с найденными таблицами и данными
     */
    private updateTestFile;
    /**
     * Генерирует секцию с тестовыми данными
     */
    private generateTestDataSection;
}
/**
 * Основная функция для анализа и генерации тестовых данных
 */
export declare function analyzeAndGenerateTestData(config: DatabaseAnalyzerConfig, dbConnectFunction: any): Promise<AnalysisResult>;
export {};
//# sourceMappingURL=database-analyzer.d.ts.map