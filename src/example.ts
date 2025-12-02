import { generateApi } from './index';
import * as path from 'path';

/**
 * Пример использования генератора API
 */
async function example() {
  try {
    console.log('=== Пример генерации API клиента ===\n');
    
    // Пример: Генерация из локального файла (Swagger 2.0)
    await generateApi({
      specUrl: path.join(__dirname, '../test-swagger.json'),
      outputDir: path.join(__dirname, '../generated/test-api'),
      httpClient: 'axios',
      baseUrl: 'https://api.example.com/v1',
      generateErrorHandlers: true,
      generateTypes: true,
      transliterateRussian: true,
    });
    
    console.log('\n✅ Пример выполнен успешно!');
    console.log('📂 Проверьте папку: generated/test-api');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

// Запускаем пример
example();
