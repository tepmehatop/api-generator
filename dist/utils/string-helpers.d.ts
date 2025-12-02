/**
 * Утилиты для преобразования строк
 */
/**
 * Преобразует строку в camelCase
 * @example toCamelCase('get_user_by_id') => 'getUserById'
 * @example toCamelCase('GetUserById') => 'getUserById'
 */
export declare function toCamelCase(str: string): string;
/**
 * Преобразует строку в PascalCase
 * @example toPascalCase('get_user_by_id') => 'GetUserById'
 * @example toPascalCase('getUserById') => 'GetUserById'
 */
export declare function toPascalCase(str: string): string;
/**
 * Преобразует строку в kebab-case
 * @example toKebabCase('getUserById') => 'get-user-by-id'
 * @example toKebabCase('GetUserById') => 'get-user-by-id'
 */
export declare function toKebabCase(str: string): string;
/**
 * Преобразует строку в snake_case
 * @example toSnakeCase('getUserById') => 'get_user_by_id'
 * @example toSnakeCase('GetUserById') => 'get_user_by_id'
 */
export declare function toSnakeCase(str: string): string;
/**
 * Делает первую букву заглавной
 * @example capitalize('hello') => 'Hello'
 */
export declare function capitalize(str: string): string;
/**
 * Делает первую букву строчной
 * @example uncapitalize('Hello') => 'hello'
 */
export declare function uncapitalize(str: string): string;
/**
 * Удаляет специальные символы из строки
 * @example sanitize('hello@world!') => 'helloworld'
 */
export declare function sanitize(str: string): string;
/**
 * Проверяет, является ли строка валидным идентификатором TypeScript
 */
export declare function isValidIdentifier(str: string): boolean;
/**
 * Делает строку валидным идентификатором TypeScript
 */
export declare function toValidIdentifier(str: string): string;
/**
 * Экранирует строку для использования в комментариях JSDoc
 */
export declare function escapeJSDoc(str: string): string;
//# sourceMappingURL=string-helpers.d.ts.map