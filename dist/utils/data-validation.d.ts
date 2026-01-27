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