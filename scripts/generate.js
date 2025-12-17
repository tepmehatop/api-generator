#!/usr/bin/env node

/**
 * CLI для генерации API (Development version - работает с src/)
 * Использование: node scripts/generate.js --config=codegen.config.json
 */

const fs = require('fs');
const path = require('path');

// Для разработки используем ts-node или напрямую требуем скомпилированный dist
let generateApi;

try {
  // Пытаемся загрузить из dist (если уже собрано)
  generateApi = require('../dist/index').generateApi;
} catch (e) {
  console.error('❌ Ошибка: dist/ не найден. Сначала выполните npm run build');
  console.error('');
  console.error('Выполните:');
  console.error('  npm run build');
  console.error('  npm run generate');
  process.exit(1);
}

const args = process.argv.slice(2);

// Парсим аргументы
let configPath = 'codegen.config.json';

for (const arg of args) {
  if (arg.startsWith('--config=')) {
    configPath = arg.split('=')[1];
  } else if (arg === '--help' || arg === '-h') {
    console.log(`
📦 API CodeGen - Generate Script

Использование:
  npm run generate [-- --config=<path>]

Опции:
  --config=<path>      Путь к конфиг файлу (по умолчанию: codegen.config.json)
  --help, -h           Показать справку

Примеры:
  npm run generate
  npm run generate -- --config=./config/api.config.json

Структура конфиг файла (codegen.config.json):
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL"
}
    `);
    process.exit(0);
  }
}

// Проверяем существование конфига
const fullConfigPath = path.resolve(process.cwd(), configPath);

if (!fs.existsSync(fullConfigPath)) {
  console.error(`❌ Ошибка: Конфиг файл не найден: ${configPath}`);
  console.error('');
  console.error('💡 Создайте файл codegen.config.json в корне проекта:');
  console.error('');
  console.error(JSON.stringify({
    specUrl: "https://api.example.com/openapi.json",
    outputDir: "./api",
    httpClient: "axios",
    baseUrl: "process.env.API_BASE_URL"
  }, null, 2));
  console.error('');
  console.error('Или скопируйте пример:');
  console.error('  cp codegen.config.example.json codegen.config.json');
  process.exit(1);
}

// Читаем конфиг
let config;
try {
  const configContent = fs.readFileSync(fullConfigPath, 'utf-8');
  config = JSON.parse(configContent);
} catch (error) {
  console.error(`❌ Ошибка при чтении конфига: ${error.message}`);
  process.exit(1);
}

// Запускаем генерацию
console.log(`📋 Используем конфиг: ${configPath}`);
console.log('');

generateApi(config)
  .then(() => {
    console.log('');
    console.log('✅ Генерация завершена успешно!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Ошибка при генерации:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
