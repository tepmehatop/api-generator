/**
 * Утилиты для преобразования строк
 */

/**
 * Преобразует строку в camelCase
 * @example toCamelCase('get_user_by_id') => 'getUserById'
 * @example toCamelCase('GetUserById') => 'getUserById'
 */
export function toCamelCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, char) => (char ? char.toUpperCase() : ''))
    .replace(/^[A-Z]/, (char) => char.toLowerCase());
}

/**
 * Преобразует строку в PascalCase
 * @example toPascalCase('get_user_by_id') => 'GetUserById'
 * @example toPascalCase('getUserById') => 'GetUserById'
 */
export function toPascalCase(str: string): string {
  const camelCase = toCamelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}

/**
 * Преобразует строку в kebab-case
 * @example toKebabCase('getUserById') => 'get-user-by-id'
 * @example toKebabCase('GetUserById') => 'get-user-by-id'
 */
export function toKebabCase(str: string): string {
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
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();
}

/**
 * Делает первую букву заглавной
 * @example capitalize('hello') => 'Hello'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Делает первую букву строчной
 * @example uncapitalize('Hello') => 'hello'
 */
export function uncapitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Удаляет специальные символы из строки
 * @example sanitize('hello@world!') => 'helloworld'
 */
export function sanitize(str: string): string {
  return str.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Проверяет, является ли строка валидным идентификатором TypeScript
 */
export function isValidIdentifier(str: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(str);
}

/**
 * Делает строку валидным идентификатором TypeScript
 */
export function toValidIdentifier(str: string): string {
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
export function escapeJSDoc(str: string): string {
  return str
    .replace(/\*\//g, '*\\/')
    .replace(/\/\*/g, '/\\*');
}
