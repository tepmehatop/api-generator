#!/usr/bin/env node

/**
 * CLI для генерации API
 * Использование: npx api-codegen generate --config=codegen.config.json
 */

const { generateApi } = require('../dist/index');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === '--help' || command === '-h') {
  console.log(`
📦 API CodeGen CLI

Использование:
  npx api-codegen generate [options]

Опции:
  --config=<path>      Путь к конфиг файлу (по умолчанию: codegen.config.json)
  --help, -h           Показать справку

Примеры:
  npx api-codegen generate
  npx api-codegen generate --config=./config/api.config.json

Структура конфиг файла (codegen.config.json):
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL",
  "authTokenVar": "process.env.AUTH_TOKEN"
}
  `);
  process.exit(0);
}

if (command === 'generate') {
  // Ищем конфиг файл
  let configPath = 'codegen.config.json';
  
  // Проверяем аргумент --config
  const configArg = args.find(arg => arg.startsWith('--config='));
  if (configArg) {
    configPath = configArg.split('=')[1];
  }
  
  // Проверяем существование файла
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
} else {
  console.error(`❌ Неизвестная команда: ${command}`);
  console.error('Используйте --help для справки');
  process.exit(1);
}
