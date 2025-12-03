import { ParsedSpec } from './parser';
import { GeneratorConfig } from './index';
interface GeneratedFile {
    filename: string;
    content: string;
}
/**
 * Генератор TypeScript кода из распарсенной OpenAPI спецификации
 */
export declare class CodeGenerator {
    private config;
    private spec;
    private usedSchemas;
    private baseSchemas;
    constructor(config: GeneratorConfig, spec: ParsedSpec);
    /**
     * Определяет базовые схемы, используемые в нескольких тегах
     */
    private identifyBaseSchemas;
    /**
     * Проверяет есть ли security в операции
     */
    private hasSecurityInSpec;
    /**
     * Извлекает имена схем из операции
     */
    private extractSchemasFromPath;
    /**
     * Генерирует все файлы
     */
    generate(): GeneratedFile[];
    /**
     * Анализирует файлы и автоматически добавляет недостающие импорты
     */
    private fixMissingImports;
    /**
     * Извлекает все используемые типы из содержимого файла
     */
    private extractUsedTypes;
    /**
     * Извлекает все определенные типы в файле
     */
    private extractDefinedTypes;
    /**
     * Извлекает уже существующие импорты
     */
    private extractExistingImports;
    /**
     * Добавляет импорты в файл
     */
    private addImportsToFile;
    /**
     * Группирует операции по тегам
     */
    private groupOperationsByTag;
    /**
     * Генерирует файл с базовыми типами
     */
    private generateBaseTypesFile;
    /**
     * Рекурсивно собирает все зависимости схемы
     */
    private collectAllDependencies;
    /**
     * Генерирует файл для конкретного тега
     */
    private generateTagFile;
    /**
     * Генерирует класс API для тега
     */
    private generateApiClass;
    /**
     * Генерирует метод класса
     */
    private generateClassMethod;
    /**
     * Получает локальные схемы для тега (не базовые)
     */
    private getLocalSchemasForTag;
    /**
     * Извлекает зависимости схемы
     */
    private extractSchemasDependencies;
    /**
     * Генерирует определение типа из схемы
     */
    private generateTypeDefinition;
    /**
     * Безопасное имя свойства - оборачивает в кавычки если нужно
     */
    private sanitizePropertyName;
    /**
     * Преобразует схему в TypeScript тип
     */
    private schemaToTypeScript;
    /**
     * Генерирует функцию API метода
     */
    private generateApiFunction;
    /**
     * Генерирует параметры функции
     */
    private generateFunctionParameters;
    /**
     * Получает тип для request body
     */
    private getRequestBodyType;
    /**
     * Генерирует тип возвращаемого значения
     */
    private generateReturnType;
    /**
     * Генерирует index файл
     */
    private generateIndexFile;
    /**
     * Генерирует HTTP client файл
     */
    private generateHttpClientFile;
    /**
     * Получает имя файла для тега
     */
    private getTagFilename;
}
export {};
//# sourceMappingURL=generator.d.ts.map