/**
 * Генератор API тестов из сгенерированных API методов
 */
export interface ApiTestConfig {
    /**
     * Путь к файлу с API методами (например, ./src/api/pets.api.ts)
     */
    apiFilePath: string;
    /**
     * Папка для выгрузки тестов
     */
    outputDir: string;
    /**
     * Путь к baseTest фикстуре (например, ../../../fixtures/baseTest)
     */
    baseTestPath?: string;
    /**
     * Путь к axiosHelpers (например, ../../../helpers/axiosHelpers)
     */
    axiosHelpersPath?: string;
    /**
     * Путь к apiTestHelper (например, ../../../helpers/apiTestHelper)
     */
    apiTestHelperPath?: string;
    /**
     * Генерировать тесты для негативных сценариев (401, 403, 400, 405)
     * @default true
     */
    generateNegativeTests?: boolean;
    /**
     * Генерировать тесты для позитивных сценариев (200, 201)
     * @default true
     */
    generatePositiveTests?: boolean;
    /**
     * Генерировать pairwise тесты (комбинаторное покрытие)
     * @default false
     */
    generatePairwiseTests?: boolean;
}
/**
 * Генерирует API тесты из файла с методами
 */
export declare function generateApiTests(config: ApiTestConfig): Promise<void>;
//# sourceMappingURL=test-generator.d.ts.map