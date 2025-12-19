#!/usr/bin/env node

/**
 * Скрипт для добавления prevPackage в конфиг файлы
 * 
 * Использование:
 *   node update-config.js <config-path> <prev-version>
 * 
 * Пример:
 *   node update-config.js configs/orders_config.json 1.55.0
 */

const fs = require('fs');
const path = require('path');

// Параметры
const configPath = process.argv[2];
const prevVersion = process.argv[3];
const registryUrl = process.env.NPM_REGISTRY_URL || 'https://customRegistry.niu.ru/repo/npm/api-codegen';
const packageName = process.env.PACKAGE_NAME || 'api-codegen';

if (!configPath || !prevVersion) {
  console.error('❌ Использование: node update-config.js <config-path> <prev-version>');
  console.error('   Пример: node update-config.js configs/orders_config.json 1.55.0');
  process.exit(1);
}

// Проверяем что это не FALSE
if (prevVersion.toUpperCase() === 'FALSE' || prevVersion === '') {
  console.log('ℹ️ Версия не указана (FALSE) - пропускаем обновление');
  process.exit(0);
}

// Читаем конфиг
if (!fs.existsSync(configPath)) {
  console.error(`❌ Файл не найден: ${configPath}`);
  process.exit(1);
}

const configText = fs.readFileSync(configPath, 'utf-8');
const config = JSON.parse(configText);

// Формируем URL
const prevPackageUrl = `${registryUrl}/${packageName}-${prevVersion}.tgz`;

// Добавляем prevPackage
config.prevPackage = prevPackageUrl;

// Сохраняем
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');

console.log(`✓ Обновлён ${configPath}`);
console.log(`  prevPackage: ${prevPackageUrl}`);
