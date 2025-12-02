"use strict";
/**
 * Транслитерация русского текста в английский
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.transliterate = transliterate;
exports.transliterateToCamelCase = transliterateToCamelCase;
exports.transliterateToPascalCase = transliterateToPascalCase;
const translitMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'е': 'e', 'ё': 'yo', 'ж': 'zh', 'з': 'z', 'и': 'i',
    'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
    'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch',
    'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '',
    'э': 'e', 'ю': 'yu', 'я': 'ya',
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
    'Е': 'E', 'Ё': 'Yo', 'Ж': 'Zh', 'З': 'Z', 'И': 'I',
    'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N',
    'О': 'O', 'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T',
    'У': 'U', 'Ф': 'F', 'Х': 'H', 'Ц': 'Ts', 'Ч': 'Ch',
    'Ш': 'Sh', 'Щ': 'Sch', 'Ъ': '', 'Ы': 'Y', 'Ь': '',
    'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya'
};
/**
 * Транслитерирует русский текст в английский
 * @param text - Текст для транслитерации
 * @returns Транслитерированный текст
 */
function transliterate(text) {
    return text
        .split('')
        .map(char => translitMap[char] || char)
        .join('');
}
/**
 * Транслитерирует и приводит к camelCase для использования в именах переменных
 * @param text - Текст для преобразования
 * @returns camelCase текст
 */
function transliterateToCamelCase(text) {
    const transliterated = transliterate(text);
    // Удаляем специальные символы и разбиваем на слова
    const words = transliterated
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/);
    if (words.length === 0)
        return '';
    // Первое слово с маленькой буквы, остальные с большой
    return words
        .map((word, index) => {
        if (index === 0) {
            return word.toLowerCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
        .join('');
}
/**
 * Транслитерирует и приводит к PascalCase для использования в именах типов
 * @param text - Текст для преобразования
 * @returns PascalCase текст
 */
function transliterateToPascalCase(text) {
    const transliterated = transliterate(text);
    // Удаляем специальные символы и разбиваем на слова
    const words = transliterated
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .split(/\s+/);
    // Все слова с большой буквы
    return words
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}
//# sourceMappingURL=transliterate.js.map