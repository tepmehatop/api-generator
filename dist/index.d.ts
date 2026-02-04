export { generateApiTests, ApiTestConfig, generateNegativeTests, generatePositiveTests, generatePairwiseTests, NegativeTestConfig, PositiveTestConfig, PairwiseTestConfig, BaseTestConfig } from './test-generator';
export { analyzeAndGenerateTestData, DatabaseAnalyzerConfig } from './database-analyzer';
export { generateHappyPathTests, HappyPathTestConfig, HappyPathTestGenerator } from './happy-path-generator';
export { setupApiCollector, sendCollectedData, createCollector, collectApiData, CollectorConfig, ApiRequestData } from './test-collector';
export { normalizeDbData, convertDataTypes, deepCompareObjects, compareDbWithResponse } from './utils/data-comparison';
export { generateTypeValidationCode, FieldSchema } from './utils/type-validator';
export { findDtoForEndpoint, generateDtoValidationCode, DTOInfo, DTOField } from './utils/dto-finder';
export interface GeneratorConfig {
    /**
     * URL или путь к OpenAPI документу (JSON)
     */
    specUrl: string;
    /**
     * Путь к папке для выгрузки сгенерированных файлов
     */
    outputDir: string;
    /**
     * HTTP клиент для API запросов
     * @default 'axios'
     */
    httpClient?: 'axios' | 'fetch';
    /**
     * Базовый URL для API запросов (опционально)
     * Можно передать как строку или имя переменной окружения
     * @example 'https://api.example.com'
     * @example 'process.env.STAND_URL'
     */
    baseUrl?: string;
    /**
     * URL к предыдущей версии пакета для сравнения (опционально)
     * Формат: https://registry.com/repo/npm/package/package-1.55.tgz
     * Если указан, будет создан CompareReadme.md с изменениями
     * @example 'https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.tgz'
     */
    prevPackage?: string;
    /**
     * Переменная окружения для токена авторизации
     * @example 'process.env.AUTH_TOKEN'
     */
    authTokenVar?: string;
    /**
     * Добавить хелперы для обработки ошибок
     * @default true
     */
    generateErrorHandlers?: boolean;
    /**
     * Генерировать типы для запросов/ответов
     * @default true
     */
    generateTypes?: boolean;
    /**
     * Использовать transliteration для русских названий тегов
     * @default true
     */
    transliterateRussian?: boolean;
    /**
     * Генерировать методы как класс вместо отдельных функций
     * @default false
     */
    useClasses?: boolean;
}
/**
 * Основной класс для генерации API клиента из OpenAPI спецификации
 */
export declare class ApiGenerator {
    private config;
    constructor(config: GeneratorConfig);
    /**
     * Запускает процесс генерации API клиента
     */
    generate(): Promise<void>;
    /**
     * Сравнивает текущую версию с предыдущей
     */
    private compareWithPrevious;
    /**
     * Загружает OpenAPI спецификацию из URL или файла
     */
    private loadSpec;
    /**
     * Сохраняет сгенерированные файлы в файловую систему
     */
    private saveFiles;
}
/**
 * Функция-хелпер для быстрой генерации
 */
export declare function generateApi(config: GeneratorConfig): Promise<void>;
//# sourceMappingURL=index.d.ts.map