/**
 * Утилиты для валидации данных Happy Path тестов
 * ВЕРСИЯ 14.4
 *
 * Решает проблему "stale data" (устаревшие данные):
 * - Проверяет актуальность данных перед генерацией
 * - Обнаруживает изменения в значимых полях (status, state, type)
 * - Обновляет или удаляет устаревшие тесты
 *
 * НОВОЕ v14.3:
 * - Сбор 422 ошибок с детальными сообщениями для генерации тестов валидации
 * - Пропуск и логирование "Bad Request" без детализации
 *
 * НОВОЕ v14.4:
 * - Сбор 400 ошибок "Уже существует" для генерации парных тестов
 * - Негативный тест: оригинальные данные → 400 + проверка сообщения
 * - Позитивный тест: данные с uniqueFields → 2xx + проверка response
 */
export interface ValidationConfig {
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
    /**
     * Путь к JSON файлу для логирования 4xx ошибок (400, 404, 422 и т.д.)
     * @example './validation-errors/4xx-errors.json'
     */
    clientErrorsLogPath?: string;
    /**
     * Путь к JSON файлу для логирования 5xx ошибок (500, 501, 502, 503)
     * @example './validation-errors/5xx-errors.json'
     */
    serverErrorsLogPath?: string;
    /**
     * Путь к методу отправки email для 5xx ошибок
     * @example '../../../helpers/mailHelper'
     */
    emailHelperPath?: string;
    /**
     * Имя метода для отправки email
     * @default 'sendErrorMailbyApi'
     */
    emailHelperMethodName?: string;
    /**
     * Отправлять email при 5xx ошибках во время валидации
     * @default false
     */
    sendServerErrorEmail?: boolean;
    /**
     * Функция для отправки email (передается напрямую)
     * Альтернатива emailHelperPath - можно передать функцию напрямую
     */
    emailSendFunction?: (html: string) => Promise<void>;
    /**
     * Включить сбор 422 ошибок для генерации тестов валидации
     * @default false
     */
    collect422Errors?: boolean;
    /**
     * Путь к JSON файлу для логирования пропущенных "Bad Request" ответов
     * @example './validation-errors/422-bad-request-skipped.json'
     */
    badRequestSkipLogPath?: string;
    /**
     * Паттерны сообщений которые считаются "пустыми" и пропускаются
     * @default ['Bad Request', 'Validation failed', '']
     */
    skipMessagePatterns?: string[];
    /**
     * Включить сбор 400 ошибок для генерации тестов на дубликаты
     * @default false
     */
    collect400Errors?: boolean;
    /**
     * Путь к JSON файлу для логирования пропущенных 400 "Bad Request" ответов
     * @example './validation-errors/400-bad-request-skipped.json'
     */
    badRequest400SkipLogPath?: string;
    /**
     * Паттерны сообщений для 400 которые считаются "пустыми" и пропускаются
     * @default ['Bad Request', '']
     */
    skip400MessagePatterns?: string[];
}
/**
 * НОВОЕ v14.3: Структура 422 ошибки для генерации тестов
 */
export interface Validation422Error {
    requestId: number;
    endpoint: string;
    method: string;
    requestBody: any;
    responseStatus: 422;
    responseData: any;
    detailMessage: string;
    testName?: string;
}
/**
 * НОВОЕ v14.4: Структура 400 ошибки для генерации парных тестов (негатив + позитив)
 */
export interface Duplicate400Error {
    requestId: number;
    endpoint: string;
    method: string;
    requestBody: any;
    expectedResponseBody: any;
    expectedStatus: number;
    responseStatus: 400;
    responseData: any;
    detailMessage: string;
    testName?: string;
}
/**
 * Структура записи об ошибке валидации
 */
export interface ValidationErrorEntry {
    timestamp: string;
    timestampMsk: string;
    errorCode: number;
    errorMessage: string;
    endpoint: string;
    method: string;
    fullUrl: string;
    requestBody?: any;
    responseData?: any;
    curlCommand: string;
    requestId?: number;
    testName?: string;
}
export interface TestRequest {
    id: number;
    endpoint: string;
    method: string;
    request_body: any;
    response_body: any;
    response_status: number;
    test_name: string;
}
export interface ValidationResult {
    isValid: boolean;
    isStale: boolean;
    changes: FieldChange[];
    updatedResponse?: any;
    action: 'keep' | 'update' | 'delete' | 'skip';
    is422Error?: boolean;
    errorResponseData?: any;
    is400Error?: boolean;
    errorCode?: number;
}
export interface FieldChange {
    path: string;
    oldValue: any;
    newValue: any;
    isSignificant: boolean;
}
/**
 * Валидирует request - проверяет актуальность данных
 * Вызывает LIVE API и сравнивает с сохраненным response
 */
export declare function validateRequest(request: TestRequest, config: ValidationConfig, axios: any): Promise<ValidationResult>;
/**
 * Валидирует массив requests
 * Возвращает только валидные или обновленные requests
 *
 * НОВОЕ v14.3: Также собирает 422 ошибки с детальными сообщениями
 * НОВОЕ v14.4: Также собирает 400 ошибки для парных тестов (негатив + позитив)
 */
export declare function validateRequests(requests: TestRequest[], config: ValidationConfig, axios: any): Promise<{
    validRequests: TestRequest[];
    deletedCount: number;
    updatedCount: number;
    skippedCount: number;
    validation422Errors: Validation422Error[];
    badRequestSkippedCount: number;
    duplicate400Errors: Duplicate400Error[];
    badRequest400SkippedCount: number;
}>;
//# sourceMappingURL=data-validation.d.ts.map