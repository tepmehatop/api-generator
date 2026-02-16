/**
 * Генератор helper функций для тестов
 * ВЕРСИЯ 14.5.2
 *
 * Генерирует вспомогательные функции которые выносятся в test-data:
 * - prepareUniqueFields - подготовка уникальных значений для POST/PUT/PATCH
 * - buildCurlCommand - генерация CURL команды (однострочная, без двойного экранирования)
 * - compareWithoutUniqueFields - сравнение response без уникальных полей
 * - verifyUniqueFields - проверка уникальных полей в response
 * - formatDifferencesAsBlocks - форматирование различий (реэкспорт)
 */
export interface TestHelpersConfig {
    uniqueFields: string[];
    uniqueFieldsUpperCase: string[];
    packageName: string;
}
/**
 * Генерирует код файла с helper функциями
 */
export declare function generateTestHelpersCode(config: TestHelpersConfig): string;
/**
 * Генерирует код с inline helper функциями для тестов
 * Используется когда createSeparateDataFiles = false
 */
export declare function generateInlineHelpers(config: TestHelpersConfig): string;
//# sourceMappingURL=test-helpers-generator.d.ts.map