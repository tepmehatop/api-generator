/**
 * Утилиты для валидации данных Happy Path тестов
 * ВЕРСИЯ 12.0
 *
 * Решает проблему "stale data" (устаревшие данные):
 * - Проверяет актуальность данных перед генерацией
 * - Обнаруживает изменения в значимых полях (status, state, type)
 * - Обновляет или удаляет устаревшие тесты
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
 */
export declare function validateRequests(requests: TestRequest[], config: ValidationConfig, axios: any): Promise<{
    validRequests: TestRequest[];
    deletedCount: number;
    updatedCount: number;
    skippedCount: number;
}>;
//# sourceMappingURL=data-validation.d.ts.map