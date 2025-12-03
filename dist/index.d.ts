export { generateApiTests, ApiTestConfig } from './test-generator';
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