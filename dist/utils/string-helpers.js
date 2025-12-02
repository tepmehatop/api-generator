"use strict";
/**
 * Утилиты для преобразования строк
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toCamelCase = toCamelCase;
exports.toPascalCase = toPascalCase;
exports.toKebabCase = toKebabCase;
exports.toSnakeCase = toSnakeCase;
exports.capitalize = capitalize;
exports.uncapitalize = uncapitalize;
exports.sanitize = sanitize;
exports.isValidIdentifier = isValidIdentifier;
exports.toValidIdentifier = toValidIdentifier;
exports.escapeJSDoc = escapeJSDoc;
/**
 * Преобразует строку в camelCase
 * @example toCamelCase('get_user_by_id') => 'getUserById'
 * @example toCamelCase('GetUserById') => 'getUserById'
 */
function toCamelCase(str) {
    return str
        .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
        .replace(/^[A-Z]/, (char) => char.toLowerCase());
}
/**
 * Преобразует строку в PascalCase
 * @example toPascalCase('get_user_by_id') => 'GetUserById'
 * @example toPascalCase('getUserById') => 'GetUserById'
 */
function toPascalCase(str) {
    const camelCase = toCamelCase(str);
    return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}
/**
 * Преобразует строку в kebab-case
 * @example toKebabCase('getUserById') => 'get-user-by-id'
 * @example toKebabCase('GetUserById') => 'get-user-by-id'
 */
function toKebabCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}
/**
 * Преобразует строку в snake_case
 * @example toSnakeCase('getUserById') => 'get_user_by_id'
 * @example toSnakeCase('GetUserById') => 'get_user_by_id'
 */
function toSnakeCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}
/**
 * Делает первую букву заглавной
 * @example capitalize('hello') => 'Hello'
 */
function capitalize(str) {
    if (!str)
        return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}
/**
 * Делает первую букву строчной
 * @example uncapitalize('Hello') => 'hello'
 */
function uncapitalize(str) {
    if (!str)
        return str;
    return str.charAt(0).toLowerCase() + str.slice(1);
}
/**
 * Удаляет специальные символы из строки
 * @example sanitize('hello@world!') => 'helloworld'
 */
function sanitize(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '');
}
/**
 * Проверяет, является ли строка валидным идентификатором TypeScript
 */
function isValidIdentifier(str) {
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}
/**
 * Делает строку валидным идентификатором TypeScript
 */
function toValidIdentifier(str) {
    // Удаляем недопустимые символы
    let result = str.replace(/[^a-zA-Z0-9_$]/g, '');
    // Если начинается с цифры, добавляем префикс
    if (/^[0-9]/.test(result)) {
        result = '_' + result;
    }
    // Если пустая строка, возвращаем дефолтное значение
    if (!result) {
        result = '_';
    }
    return result;
}
/**
 * Экранирует строку для использования в комментариях JSDoc
 */
function escapeJSDoc(str) {
    return str
        .replace(/\*\//g, '*\\/')
        .replace(/\/\*/g, '/\\*');
}
//# sourceMappingURL=string-helpers.js.map