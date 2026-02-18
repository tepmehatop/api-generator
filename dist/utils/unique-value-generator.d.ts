/**
 * Генератор уникальных значений для полей
 * ВЕРСИЯ 14.5.9
 *
 * Генерирует полностью НОВЫЕ значения, сохраняя формат оригинала:
 * - AUTOCODE → XKZPQWNM (все буквы, uppercase, та же длина)
 * - test-code → hjkl-mnop (lowercase с дефисом)
 * - MixedCase → PqrsAbcd (mixed case)
 * - ABC123 → XYZ789 (буквы + цифры)
 */
/**
 * Конфигурация генерации для конкретного поля
 */
export interface UniqueFieldGenerationConfig {
    /** Имя поля */
    fieldName: string;
    /**
     * Тип генерации:
     * - 'auto' - автоматически определяется из оригинала (по умолчанию)
     * - 'uppercase' - только заглавные буквы (ABCDEF)
     * - 'lowercase' - только строчные буквы (abcdef)
     * - 'mixed' - смешанный регистр (AbCdEf)
     * - 'alphanumeric' - буквы и цифры (Abc123)
     * - 'numeric' - только цифры (123456)
     * - 'pattern' - использовать customPattern
     */
    type?: 'auto' | 'uppercase' | 'lowercase' | 'mixed' | 'alphanumeric' | 'numeric' | 'pattern';
    /**
     * Длина генерируемого значения:
     * - 'same' - такая же как у оригинала (по умолчанию)
     * - number - фиксированная длина
     */
    length?: 'same' | number;
    /**
     * Кастомный паттерн для генерации
     * Используется когда type = 'pattern'
     *
     * Поддерживаемые placeholders:
     * - {A} - случайная заглавная буква
     * - {a} - случайная строчная буква
     * - {0} - случайная цифра
     * - {X} - случайный hex символ (0-F)
     * - {*} - любой символ
     *
     * @example "PRD-{A}{A}{A}-{0}{0}{0}" → "PRD-XKZ-789"
     * @example "{A}{A}{A}{A}{0}{0}" → "XYZW45"
     */
    customPattern?: string;
    /**
     * Сохранять разделители из оригинала (-, _, пробелы)
     * @default true
     */
    keepDelimiters?: boolean;
    /**
     * Префикс для генерируемого значения
     * @example "TEST_" → "TEST_XYZABC"
     */
    prefix?: string;
    /**
     * Суффикс для генерируемого значения
     * @example "_NEW" → "XYZABC_NEW"
     */
    suffix?: string;
}
/**
 * Анализирует оригинальное значение и определяет его формат
 */
export declare function analyzeValueFormat(value: string): {
    isUppercase: boolean;
    isLowercase: boolean;
    isMixed: boolean;
    hasDigits: boolean;
    hasLetters: boolean;
    delimiters: string[];
    segments: {
        type: 'letters' | 'digits' | 'delimiter';
        value: string;
        isUpper: boolean;
    }[];
    length: number;
};
/**
 * Генерирует полностью НОВОЕ уникальное значение на основе оригинала
 *
 * ВАЖНО: Новое значение НЕ содержит оригинальное значение!
 * AUTOCODE → XKZPQWNM (а не AUTOCODE_suffix)
 */
export declare function generateSmartUniqueValue(originalValue: string, config?: UniqueFieldGenerationConfig): string;
/**
 * Подготавливает request body с уникальными полями (ПОЛНАЯ ЗАМЕНА значений)
 *
 * В отличие от старой версии, НЕ добавляет суффикс, а ПОЛНОСТЬЮ заменяет значение
 * на новое, сохраняя формат оригинала.
 */
export declare function prepareUniqueFieldsSmart<T>(requestData: T, uniqueFieldsConfig: (string | UniqueFieldGenerationConfig)[], upperCaseFields?: string[]): {
    data: T;
    modifiedFields: Record<string, string>;
};
//# sourceMappingURL=unique-value-generator.d.ts.map