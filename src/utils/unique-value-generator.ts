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
export function analyzeValueFormat(value: string): {
  isUppercase: boolean;
  isLowercase: boolean;
  isMixed: boolean;
  hasDigits: boolean;
  hasLetters: boolean;
  delimiters: string[];
  segments: { type: 'letters' | 'digits' | 'delimiter'; value: string; isUpper: boolean }[];
  length: number;
} {
  const delimiters: string[] = [];
  const segments: { type: 'letters' | 'digits' | 'delimiter'; value: string; isUpper: boolean }[] = [];

  let currentSegment = '';
  let currentType: 'letters' | 'digits' | 'delimiter' | null = null;

  for (const char of value) {
    const isLetter = /[a-zA-Z]/.test(char);
    const isDigit = /[0-9]/.test(char);
    const isDelimiter = /[-_\s.]/.test(char);

    let charType: 'letters' | 'digits' | 'delimiter';
    if (isLetter) charType = 'letters';
    else if (isDigit) charType = 'digits';
    else charType = 'delimiter';

    if (currentType !== charType) {
      if (currentSegment) {
        segments.push({
          type: currentType!,
          value: currentSegment,
          isUpper: currentType === 'letters' ? currentSegment === currentSegment.toUpperCase() : false
        });
        if (currentType === 'delimiter') {
          delimiters.push(currentSegment);
        }
      }
      currentSegment = char;
      currentType = charType;
    } else {
      currentSegment += char;
    }
  }

  // Добавляем последний сегмент
  if (currentSegment) {
    segments.push({
      type: currentType!,
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
function randomLetter(uppercase: boolean): string {
  const letters = uppercase ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'abcdefghjklmnpqrstuvwxyz';
  return letters[Math.floor(Math.random() * letters.length)];
}

/**
 * Генерирует случайную цифру
 */
function randomDigit(): string {
  return String(Math.floor(Math.random() * 10));
}

/**
 * Генерирует случайный hex символ
 */
function randomHex(): string {
  return '0123456789ABCDEF'[Math.floor(Math.random() * 16)];
}

/**
 * Генерирует строку из случайных символов заданного типа
 */
function generateRandomString(length: number, type: 'uppercase' | 'lowercase' | 'mixed' | 'digits' | 'alphanumeric'): string {
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
function generateFromPattern(pattern: string): string {
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
    } else {
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
export function generateSmartUniqueValue(
  originalValue: string,
  config?: UniqueFieldGenerationConfig
): string {
  // Если пустое значение - генерируем что-то
  if (!originalValue || originalValue.trim() === '') {
    return generateRandomString(8, 'uppercase');
  }

  // Если есть кастомный паттерн
  if (config?.type === 'pattern' && config.customPattern) {
    let result = generateFromPattern(config.customPattern);
    if (config.prefix) result = config.prefix + result;
    if (config.suffix) result = result + config.suffix;
    return result;
  }

  // Анализируем оригинальное значение
  const format = analyzeValueFormat(originalValue);

  // Определяем целевую длину
  const targetLength = config?.length === 'same' || config?.length === undefined
    ? format.length
    : config.length;

  // Определяем тип генерации
  let genType: 'uppercase' | 'lowercase' | 'mixed' | 'digits' | 'alphanumeric' = 'uppercase';

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
  } else {
    // Автоопределение
    if (!format.hasLetters && format.hasDigits) {
      genType = 'digits';
    } else if (format.hasLetters && format.hasDigits) {
      genType = 'alphanumeric';
    } else if (format.isUppercase) {
      genType = 'uppercase';
    } else if (format.isLowercase) {
      genType = 'lowercase';
    } else if (format.isMixed) {
      genType = 'mixed';
    }
  }

  // Генерируем новое значение
  let result: string;

  // Если есть разделители и keepDelimiters = true (по умолчанию)
  if (format.delimiters.length > 0 && (config?.keepDelimiters !== false)) {
    // Генерируем посегментно, сохраняя структуру
    result = format.segments.map(segment => {
      if (segment.type === 'delimiter') {
        return segment.value; // Сохраняем разделитель
      } else if (segment.type === 'digits') {
        return generateRandomString(segment.value.length, 'digits');
      } else {
        // Буквы - сохраняем регистр сегмента
        const segmentType = segment.isUpper ? 'uppercase' : 'lowercase';
        return generateRandomString(segment.value.length, segmentType);
      }
    }).join('');
  } else {
    // Простая генерация без разделителей
    result = generateRandomString(targetLength, genType);
  }

  // Добавляем префикс/суффикс
  if (config?.prefix) result = config.prefix + result;
  if (config?.suffix) result = result + config.suffix;

  return result;
}

/**
 * Подготавливает request body с уникальными полями (ПОЛНАЯ ЗАМЕНА значений)
 *
 * В отличие от старой версии, НЕ добавляет суффикс, а ПОЛНОСТЬЮ заменяет значение
 * на новое, сохраняя формат оригинала.
 */
export function prepareUniqueFieldsSmart<T>(
  requestData: T,
  uniqueFieldsConfig: (string | UniqueFieldGenerationConfig)[],
  upperCaseFields: string[] = []
): { data: T; modifiedFields: Record<string, string> } {
  // Если массив - возвращаем как есть (нет именованных полей для модификации)
  if (Array.isArray(requestData)) {
    return { data: requestData, modifiedFields: {} };
  }

  const data = { ...requestData } as Record<string, any>;
  const modifiedFields: Record<string, string> = {};

  // Нормализуем конфиг - преобразуем строки в объекты
  const normalizedConfigs: UniqueFieldGenerationConfig[] = uniqueFieldsConfig.map(config => {
    if (typeof config === 'string') {
      return {
        fieldName: config,
        type: 'auto' as const,
        length: 'same' as const,
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

  return { data: data as T, modifiedFields };
}
