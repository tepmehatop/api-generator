/**
 * Парсер для OpenAPI спецификаций различных версий
 */
export declare class OpenAPIParser {
    private spec;
    private version;
    constructor(spec: any);
    /**
     * Определяет версию OpenAPI спецификации
     */
    private detectVersion;
    /**
     * Парсит спецификацию и возвращает унифицированную структуру
     */
    parse(): ParsedSpec;
    /**
     * Парсит информацию о API
     */
    private parseInfo;
    /**
     * Парсит базовый URL
     */
    private parseBaseUrl;
    /**
     * Парсит теги
     */
    private parseTags;
    /**
     * Парсит пути (endpoints)
     */
    private parsePaths;
    /**
     * Генерирует operationId если он отсутствует
     */
    private generateOperationId;
    /**
     * Парсит параметры операции
     */
    private parseParameters;
    /**
     * Парсит тело запроса
     */
    private parseRequestBody;
    /**
     * Парсит ответы
     */
    private parseResponses;
    /**
     * Парсит схемы (models/DTOs)
     */
    private parseSchemas;
    /**
     * Парсит отдельную схему
     */
    private parseSchema;
    /**
     * Разрешает $ref ссылку
     */
    private resolveRef;
    /**
     * Извлекает имя из $ref
     */
    private extractRefName;
}
export interface ParsedSpec {
    version: '2.0' | '3.0' | '3.1';
    info: ApiInfo;
    baseUrl: string;
    tags: Tag[];
    paths: PathItem[];
    schemas: Record<string, Schema>;
}
export interface ApiInfo {
    title: string;
    version: string;
    description: string;
}
export interface Tag {
    name: string;
    description: string;
}
export interface PathItem {
    path: string;
    method: string;
    operationId: string;
    summary: string;
    description: string;
    tags: string[];
    parameters: Parameter[];
    requestBody?: RequestBody;
    responses: Record<string, Response>;
    deprecated: boolean;
}
export interface Parameter {
    name: string;
    in: 'query' | 'path' | 'header' | 'cookie' | 'body' | 'formData';
    required: boolean;
    description: string;
    schema: Schema;
}
export interface RequestBody {
    required: boolean;
    content: Record<string, {
        schema: Schema;
    }>;
}
export interface Response {
    description: string;
    schema?: Schema;
}
export interface Schema {
    type: string;
    format?: string;
    ref?: string;
    items?: Schema;
    properties?: Record<string, Schema>;
    required?: string[];
    enum?: any[];
    description?: string;
    nullable?: boolean;
    default?: any;
    additionalProperties?: any;
    compositor?: 'allOf' | 'oneOf' | 'anyOf';
    schemas?: Schema[];
}
//# sourceMappingURL=parser.d.ts.map