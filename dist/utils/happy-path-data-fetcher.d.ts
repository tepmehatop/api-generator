/**
 * Утилита для получения данных из Happy Path тестов
 * Версия 1.0
 *
 * Читает данные из БД (qa.api_requests) для использования в позитивных и Pairwise тестах
 */
export interface HappyPathData {
    id: number;
    endpoint: string;
    method: string;
    request_body: any;
    response_body: any;
    response_status: number;
    test_name: string;
}
export interface HappyPathDataFetcherConfig {
    /**
     * Функция подключения к БД (sql tagged template)
     */
    dbConnection: any;
    /**
     * Схема БД
     * @default 'qa'
     */
    dbSchema?: string;
    /**
     * Количество записей для выборки
     * @default 15
     */
    samplesCount?: number;
}
/**
 * Получает данные из Happy Path тестов для заданного эндпоинта
 *
 * @param endpoint - Endpoint (может содержать {id})
 * @param method - HTTP метод (GET, POST, PUT, DELETE)
 * @param config - Конфигурация подключения к БД
 * @returns Массив данных из Happy Path тестов
 */
export declare function fetchHappyPathData(endpoint: string, method: string, config: HappyPathDataFetcherConfig): Promise<HappyPathData[]>;
/**
 * Получает все эндпоинты без Happy Path данных
 *
 * @param config - Конфигурация подключения к БД
 * @returns Массив эндпоинтов без данных
 */
export declare function getEndpointsWithoutHappyPathData(config: HappyPathDataFetcherConfig): Promise<{
    endpoint: string;
    method: string;
}[]>;
/**
 * Извлекает данные для обязательных полей из Happy Path данных
 *
 * @param happyPathData - Массив Happy Path данных
 * @param requiredFields - Список обязательных полей
 * @returns Объект с данными только для обязательных полей
 */
export declare function extractRequiredFieldsData(happyPathData: HappyPathData[], requiredFields: string[]): Record<string, any>[];
/**
 * Извлекает данные для всех полей из Happy Path данных
 *
 * @param happyPathData - Массив Happy Path данных
 * @returns Массив объектов со всеми полями
 */
export declare function extractAllFieldsData(happyPathData: HappyPathData[]): Record<string, any>[];
/**
 * Генерирует комбинации данных для Pairwise тестов
 *
 * @param happyPathData - Массив Happy Path данных
 * @param requiredFields - Список обязательных полей
 * @param optionalFields - Список необязательных полей
 * @returns Массив комбинаций данных для Pairwise тестов
 */
export declare function generatePairwiseCombinations(happyPathData: HappyPathData[], requiredFields: string[], optionalFields: string[]): Record<string, any>[];
//# sourceMappingURL=happy-path-data-fetcher.d.ts.map