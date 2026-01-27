/**
 * Утилиты для дедупликации Happy Path тестов
 * ВЕРСИЯ 12.0
 *
 * Реализует:
 * - Идея 1: Группировка по "signature" (игнорируем технические поля)
 * - Идея 2: Обнаружение edge cases (пустые массивы, null, редкие значения)
 */
export interface DeduplicationConfig {
    enabled?: boolean;
    ignoreFields?: string[];
    significantFields?: string[];
    detectEdgeCases?: boolean;
    maxTestsPerEndpoint?: number;
    preserveTaggedTests?: string[];
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
export interface EdgeCaseInfo {
    type: 'empty_array' | 'null_field' | 'rare_value';
    path: string;
    value: any;
}
/**
 * Вычисляет "signature" (отпечаток) ответа
 * Игнорирует технические поля (id, timestamps)
 * Учитывает значимые поля (status, type, role)
 */
export declare function calculateResponseSignature(response: any, config: DeduplicationConfig, path?: string): string;
/**
 * Обнаруживает edge cases в ответе
 */
export declare function detectEdgeCases(response: any, path?: string): EdgeCaseInfo[];
/**
 * Группирует запросы по signature с учетом edge cases
 * Возвращает: { signature → массив запросов }
 */
export declare function groupRequestsBySignature(requests: TestRequest[], config: DeduplicationConfig): Map<string, TestRequest[]>;
/**
 * Обнаруживает редкие значения в значимых полях
 * Редкое значение = встречается < 20% от всех запросов
 */
export declare function detectRareValues(requests: TestRequest[], significantFields: string[]): TestRequest[];
/**
 * Выбирает лучшие тесты из группы
 * Стратегия: 1 базовый + edge cases + редкие значения (до maxTests)
 */
export declare function selectBestTests(requests: TestRequest[], config: DeduplicationConfig): TestRequest[];
/**
 * Главная функция дедупликации
 * Принимает массив запросов, возвращает отфильтрованный массив
 */
export declare function deduplicateTests(requests: TestRequest[], config: DeduplicationConfig): TestRequest[];
//# sourceMappingURL=test-deduplication.d.ts.map