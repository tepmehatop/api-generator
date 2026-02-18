"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeValueFormat = analyzeValueFormat;
exports.generateSmartUniqueValue = generateSmartUniqueValue;
exports.prepareUniqueFieldsSmart = prepareUniqueFieldsSmart;
/**
 * Анализирует оригинальное значение и определяет его формат
 */
function analyzeValueFormat(value) {
    const delimiters = [];
    const segments = [];
    let currentSegment = '';
    let currentType = null;
    for (const char of value) {
        const isLetter = /[a-zA-Z]/.test(char);
        const isDigit = /[0-9]/.test(char);
        const isDelimiter = /[-_\s.]/.test(char);
        let charType;
        if (isLetter)
            charType = 'letters';
        else if (isDigit)
            charType = 'digits';
        else
            charType = 'delimiter';
        if (currentType !== charType) {
            if (currentSegment) {
                segments.push({
                    type: currentType,
                    value: currentSegment,
                    isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false
                });
                if (currentType === 'delimiter') {
                    delimiters.push(currentSegment);
                }
            }
            currentSegment = char;
            currentType = charType;
        }
        else {
            currentSegment += char;
        }
    }
    // Добавляем последний сегмент
    if (currentSegment) {
        segments.push({
            type: currentType,
            value: currentSegment,
            isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false
        });
        if (currentType === 'delimiter') {
            delimiters.push(currentSegment);
        }
    }
    const letters = value.replace(/[^a-zA-Z]/g, '');
    const hasLetters = letters.length > 0;
    const hasDigits = /[0-9]/.test(value);
    const isUppercase = hasLetters && letters === letters.toUpperCase();
    const isLowercase = hasLetters && letters === letters.toLowerCase();
    const isMixed = hasLetters && !isUppercase && !isLowercase;
    return {
        isUppercase,
        isLowercase,
        isMixed,
        hasDigits,
        hasLetters,
        delimiters,
        segments,
        length: value.length
    };
}
/**
 * Генерирует случайную букву
 */
function randomLetter(uppercase) {
    const letters = uppercase ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'abcdefghjklmnpqrstuvwxyz';
    return letters[Math.floor(Math.random() * letters.length)];
}
/**
 * Генерирует случайную цифру
 */
function randomDigit() {
    return String(Math.floor(Math.random() * 10));
}
/**
 * Генерирует случайный hex символ
 */
function randomHex() {
    return '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
}
/**
 * Генерирует строку из случайных символов заданного типа
 */
function generateRandomString(length, type) {
    let result = '';
    for (let i = 0; i < length; i++) {
        switch (type) {
            case 'uppercase':
                result += randomLetter(true);
                break;
            case 'lowercase':
                result += randomLetter(false);
                break;
            case 'mixed':
                result += randomLetter(Math.random() > 0.5);
                break;
            case 'digits':
                result += randomDigit();
                break;
            case 'alphanumeric':
                result += Math.random() > 0.3 ? randomLetter(Math.random() > 0.5) : randomDigit();
                break;
        }
    }
    return result;
}
/**
 * Генерирует значение по паттерну
 */
function generateFromPattern(pattern) {
    let result = '';
    let i = 0;
    while (i < pattern.length) {
        if (pattern[i] === '{' && i + 2 < pattern.length && pattern[i + 2] === '}') {
            const placeholder = pattern[i + 1];
            switch (placeholder) {
                case 'A':
                    result += randomLetter(true);
                    break;
                case 'a':
                    result += randomLetter(false);
                    break;
                case '0':
                    result += randomDigit();
                    break;
                case 'X':
                    result += randomHex();
                    break;
                case '*':
                    result += Math.random() > 0.5 ? randomLetter(Math.random() > 0.5) : randomDigit();
                    break;
                default:
                    result += placeholder;
            }
            i += 3;
        }
        else {
            result += pattern[i];
            i++;
        }
    }
    return result;
}
/**
 * Генерирует полностью НОВОЕ уникальное значение на основе оригинала
 *
 * ВАЖНО: Новое значение НЕ содержит оригинальное значение!
 * AUTOCODE → XKZPQWNM (а не AUTOCODE_suffix)
 */
function generateSmartUniqueValue(originalValue, config) {
    // Если пустое значение - генерируем что-то
    if (!originalValue || originalValue.trim() === '') {
        return generateRandomString(8, 'uppercase');
    }
    // Если есть кастомный паттерн
    if (config?.type === 'pattern' && config.customPattern) {
        let result = generateFromPattern(config.customPattern);
        if (config.prefix)
            result = config.prefix + result;
        if (config.suffix)
            result = result + config.suffix;
        return result;
    }
    // Анализируем оригинальное значение
    const format = analyzeValueFormat(originalValue);
    // Определяем целевую длину
    const targetLength = config?.length === 'same' || config?.length === undefined
        ? format.length
        : config.length;
    // Определяем тип генерации
    let genType = 'uppercase';
    if (config?.type && config.type !== 'auto') {
        switch (config.type) {
            case 'uppercase':
                genType = 'uppercase';
                break;
            case 'lowercase':
                genType = 'lowercase';
                break;
            case 'mixed':
                genType = 'mixed';
                break;
            case 'numeric':
                genType = 'digits';
                break;
            case 'alphanumeric':
                genType = 'alphanumeric';
                break;
        }
    }
    else {
        // Автоопределение
        if (!format.hasLetters && format.hasDigits) {
            genType = 'digits';
        }
        else if (format.hasLetters && format.hasDigits) {
            genType = 'alphanumeric';
        }
        else if (format.isUppercase) {
            genType = 'uppercase';
        }
        else if (format.isLowercase) {
            genType = 'lowercase';
        }
        else if (format.isMixed) {
            genType = 'mixed';
        }
    }
    // Генерируем новое значение
    let result;
    // Если есть разделители и keepDelimiters = true (по умолчанию)
    if (format.delimiters.length > 0 && (config?.keepDelimiters !== false)) {
        // Генерируем посегментно, сохраняя структуру
        result = format.segments.map(segment => {
            if (segment.type === 'delimiter') {
                return segment.value; // Сохраняем разделитель
            }
            else if (segment.type === 'digits') {
                return generateRandomString(segment.value.length, 'digits');
            }
            else {
                // Буквы - сохраняем регистр сегмента
                const segmentType = segment.isUpper ? 'uppercase' : 'lowercase';
                return generateRandomString(segment.value.length, segmentType);
            }
        }).join('');
    }
    else {
        // Простая генерация без разделителей
        result = generateRandomString(targetLength, genType);
    }
    // Добавляем префикс/суффикс
    if (config?.prefix)
        result = config.prefix + result;
    if (config?.suffix)
        result = result + config.suffix;
    return result;
}
/**
 * Подготавливает request body с уникальными полями (ПОЛНАЯ ЗАМЕНА значений)
 *
 * В отличие от старой версии, НЕ добавляет суффикс, а ПОЛНОСТЬЮ заменяет значение
 * на новое, сохраняя формат оригинала.
 */
function prepareUniqueFieldsSmart(requestData, uniqueFieldsConfig, upperCaseFields = []) {
    // Если массив - возвращаем как есть (нет именованных полей для модификации)
    if (Array.isArray(requestData)) {
        return { data: requestData, modifiedFields: {} };
    }
    const data = { ...requestData };
    const modifiedFields = {};
    // Нормализуем конфиг - преобразуем строки в объекты
    const normalizedConfigs = uniqueFieldsConfig.map(config => {
        if (typeof config === 'string') {
            return {
                fieldName: config,
                type: 'auto',
                length: 'same',
                keepDelimiters: true
            };
        }
        return config;
    });
    for (const config of normalizedConfigs) {
        const fieldName = config.fieldName;
        if (data[fieldName] !== undefined && typeof data[fieldName] === 'string') {
            // Если поле в списке uppercase - форсируем uppercase
            let effectiveConfig = { ...config };
            if (upperCaseFields.includes(fieldName)) {
                effectiveConfig.type = 'uppercase';
            }
            // Генерируем новое уникальное значение
            const newValue = generateSmartUniqueValue(data[fieldName], effectiveConfig);
            data[fieldName] = newValue;
            modifiedFields[fieldName] = newValue;
        }
    }
    return { data: data, modifiedFields };
}
//# sourceMappingURL=unique-value-generator.js.map