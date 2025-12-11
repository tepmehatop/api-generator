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
     * Схема БД для поиска таблиц
     * @default null - искать во всех схемах
     * Примеры: 'public', 'app', 'orders_schema'
     */
    dbSchema?: string | null;
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
    /**
     * Этапы анализа которые нужно выполнить
     * @default { schemaAnalysis: true, foreignKeys: true, empiricalTest: true }
     */
    stages?: {
        schemaAnalysis?: boolean;
        foreignKeys?: boolean;
        empiricalTest?: boolean;
    };
    /**
     * Токен авторизации для вызова endpoint (для Этапа 3)
     * Будет добавлен в заголовок Authorization: Bearer <token>
     */
    authToken?: string;
    /**
     * Поля которые нужно исключить при генерации данных для эмпирического теста (Этап 3)
     * Например: ['id', 'created_at', 'updated_at']
     */
    excludeFieldsForEmpirical?: string[];
    /**
     * Детализация логов для каждого этапа
     * @default { stage1: true, stage2: true, stage3: true }
     */
    verboseStages?: {
        stage1?: boolean;
        stage2?: boolean;
        stage3?: boolean;
    };
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
     * Конвертирует camelCase в snake_case
     */
    private toSnakeCase;
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
     * Генерирует тестовые данные на основе существующих записей в БД
     */
    private generateTestDataFromExisting;
    /**
     * Генерирует fallback значение для поля
     */
    private generateFallbackValue;
    /**
     * Генерирует уникальные тестовые данные (устаревший метод)
     * @deprecated Используйте generateTestDataFromExisting
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
     * Создает отдельный файл с тестовыми данными
     */
    private createTestDataFile;
    /**
     * Генерирует секцию с тестовыми данными (устаревший метод)
     * @deprecated Используйте createTestDataFile вместо этого
     */
    private generateTestDataSection;
}
/**
 * Основная функция для анализа и генерации тестовых данных
 */
export declare function analyzeAndGenerateTestData(config: DatabaseAnalyzerConfig, dbConnectFunction: any): Promise<AnalysisResult>;
export {};
//# sourceMappingURL=database-analyzer.d.ts.map