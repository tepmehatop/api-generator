/**
 * Утилита для тестирования конвертации naming convention
 * Использование: ts-node test-naming.ts
 */

function generateFieldVariants(field: string): string[] {
  const variants = new Set<string>();
  
  // 1. Оригинал
  variants.add(field);
  variants.add(field.toLowerCase());
  
  // 2. snake_case (правильная конвертация)
  const snakeCase = field
    .replace(/([A-Z])/g, (match, char, offset) => {
      return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
    });
  
  variants.add(snakeCase);
  
  // 3. Вариант с подчеркиванием в начале
  if (snakeCase.startsWith('_')) {
    variants.add(snakeCase.substring(1));
  }
  
  // 4. SCREAMING_SNAKE_CASE
  variants.add(snakeCase.toUpperCase());
  
  // 5. kebab-case
  const kebabCase = snakeCase.replace(/_/g, '-');
  variants.add(kebabCase);
  
  // 6. PascalCase
  const pascalCase = field.charAt(0).toUpperCase() + field.slice(1);
  variants.add(pascalCase);
  
  // 7. Plural формы
  variants.add(field + 's');
  variants.add(snakeCase + 's');
  variants.add(field.toLowerCase() + 's');
  
  // 8. Без последней буквы
  if (field.endsWith('s') || field.endsWith('S')) {
    const singular = field.slice(0, -1);
    variants.add(singular);
    variants.add(singular.toLowerCase());
    
    const singularSnake = singular
      .replace(/([A-Z])/g, (match, char, offset) => {
        return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
      });
    variants.add(singularSnake);
  }
  
  // 9. Без префиксов
  const withoutPrefix = field.replace(/^(is|has|get|set|use|can|should)/, '');
  if (withoutPrefix !== field) {
    variants.add(withoutPrefix);
    variants.add(withoutPrefix.toLowerCase());
    
    const withoutPrefixSnake = withoutPrefix
      .replace(/([A-Z])/g, (match, char, offset) => {
        return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
      });
    variants.add(withoutPrefixSnake);
  }
  
  // 10. Без суффиксов
  const withoutSuffix = field.replace(/(Id|ID|Type|Status|Date|Time|At|By)$/, '');
  if (withoutSuffix !== field) {
    variants.add(withoutSuffix);
    variants.add(withoutSuffix.toLowerCase());
    
    const withoutSuffixSnake = withoutSuffix
      .replace(/([A-Z])/g, (match, char, offset) => {
        return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
      });
    variants.add(withoutSuffixSnake);
  }
  
  // 11. Для *Id полей
  if (field.toLowerCase().endsWith('id')) {
    const base = field.slice(0, -2);
    const baseSnake = base
      .replace(/([A-Z])/g, (match, char, offset) => {
        return offset === 0 ? char.toLowerCase() : '_' + char.toLowerCase();
      });
    
    variants.add(baseSnake + '_id');
    variants.add(baseSnake + 'id');
    variants.add(base.toLowerCase() + '_id');
    variants.add(base.toLowerCase() + 'id');
  }
  
  return Array.from(variants).filter(v => v.length > 0);
}

// Тестовые примеры
const testCases = [
  { dto: 'orderType', expected: 'order_type' },
  { dto: 'productId', expected: 'product_id' },
  { dto: 'regNumberS', expected: 'reg_number_s' },
  { dto: 'customerId', expected: 'customer_id' },
  { dto: 'isActive', expected: 'is_active' },
  { dto: 'createdAt', expected: 'created_at' },
  { dto: 'userId', expected: 'user_id' },
  { dto: 'OrderType', expected: 'order_type' },
  { dto: 'firstName', expected: 'first_name' },
  { dto: 'lastName', expected: 'last_name' },
  { dto: 'phoneNumber', expected: 'phone_number' },
  { dto: 'emailAddress', expected: 'email_address' },
];

console.log('🧪 ТЕСТИРОВАНИЕ КОНВЕРТАЦИИ NAMING\n');
console.log('═'.repeat(80));

testCases.forEach(test => {
  const variants = generateFieldVariants(test.dto);
  const found = variants.includes(test.expected);
  
  console.log(`\n📌 DTO поле: "${test.dto}"`);
  console.log(`   Ожидается: "${test.expected}"`);
  console.log(`   Результат: ${found ? '✅ НАЙДЕНО' : '❌ НЕ НАЙДЕНО'}`);
  
  if (!found) {
    console.log(`   ⚠️  Сгенерированные варианты:`);
    variants.forEach(v => console.log(`      - "${v}"`));
  } else {
    console.log(`   ℹ️  Всего вариантов: ${variants.length}`);
  }
});

console.log('\n' + '═'.repeat(80));
console.log('\n💡 Если какие-то тесты не прошли, проверьте логику в generateFieldVariants\n');
