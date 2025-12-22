# ✅ Решение проблемы 401 + Локальные файлы из Git

## Проблема

При сравнении с предыдущей версией из приватного NPM registry возникает ошибка 401.

## ✅ Два решения

### Решение 1: Улучшенная авторизация (попробуйте сначала)

Улучшен парсинг .npmrc с поддержкой:
- Специфичных токенов для registry
- Base64 auth правильно
- NPM токенов
- Детальная диагностика

### Решение 2: Локальные файлы из Git (100% работает!)

Вместо скачивания из NPM registry - храните архивы в Git!

---

## Решение 2: Локальные файлы (рекомендуется)

### Шаг 1: Создайте папку для архивов

```bash
mkdir -p archive
```

### Шаг 2: Сохраняйте каждую версию после публикации

```bash
# После npm publish
cp api-codegen-1.55.0.tgz archive/

# Коммитим
git add archive/api-codegen-1.55.0.tgz
git commit -m "chore: archive version 1.55.0 for comparison"
git push
```

### Шаг 3: Обновите конфиг

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "./archive/api-codegen-1.55.0.tgz"
}
```

### Структура проекта:

```
api-codegen/
├── archive/                          ← Git папка с версиями
│   ├── api-codegen-1.55.0.tgz
│   ├── api-codegen-1.54.0.tgz
│   ├── api-codegen-1.53.0.tgz
│   └── README.md                     ← Список версий
├── configs/
│   └── orders_config.json            ← prevPackage: "./archive/..."
├── dist/
└── package.json
```

### Jenkins Pipeline с локальными файлами:

```groovy
pipeline {
    agent any
    
    parameters {
        string(name: 'PREV_COMPARE_VERSION', defaultValue: 'FALSE')
    }
    
    stages {
        stage('Подготовка') {
            steps {
                // Checkout включает папку archive/
                checkout scm
                
                sh 'npm install && npm run build'
            }
        }
        
        stage('Обновление конфигов') {
            when { 
                expression { params.PREV_COMPARE_VERSION != 'FALSE' } 
            }
            steps {
                script {
                    // Используем ЛОКАЛЬНЫЙ файл
                    def localArchive = "./archive/api-codegen-${params.PREV_COMPARE_VERSION}.tgz"
                    
                    // Проверяем существование
                    sh """
                        if [ ! -f "${localArchive}" ]; then
                            echo "❌ Архив не найден: ${localArchive}"
                            echo "📦 Доступные версии:"
                            ls -1 archive/*.tgz 2>/dev/null || echo "  (пусто)"
                            exit 1
                        fi
                        
                        echo "✓ Найден: ${localArchive}"
                    """
                    
                    // Обновляем конфиг
                    sh """
                        node scripts/update-config-local.js configs/orders_config.json ${localArchive}
                    """
                }
            }
        }
        
        stage('Генерация') {
            steps {
                sh 'npm run generate -- --config=configs/orders_config.json'
                // Использует локальный файл!
            }
        }
        
        stage('Архивируем новую версию') {
            steps {
                script {
                    def newVersion = sh(
                        script: 'node -p "require(\'./package.json\').version"',
                        returnStdout: true
                    ).trim()
                    
                    sh """
                        # Создаём архив
                        npm pack
                        
                        # Копируем в archive/
                        mv api-codegen-${newVersion}.tgz archive/
                        
                        # Коммитим
                        git add archive/
                        git commit -m "chore: archive version ${newVersion}" || true
                        git push origin HEAD:main || true
                    """
                }
            }
        }
        
        stage('Публикация') {
            steps {
                sh 'npm publish'
            }
        }
    }
}
```

---

## Скрипт для локальных файлов

Создайте `scripts/update-config-local.js`:

```javascript
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const configPath = process.argv[2];
const localFilePath = process.argv[3];

if (!configPath || !localFilePath) {
  console.error('Usage: node update-config-local.js <config> <local-file>');
  process.exit(1);
}

// Читаем конфиг
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

// Устанавливаем локальный путь
config.prevPackage = localFilePath;

// Сохраняем
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

console.log(`✓ Конфиг обновлён: prevPackage = ${localFilePath}`);
```

---

## Решение 1: Улучшенная авторизация

Если всё-таки хотите использовать NPM registry:

### Что улучшено:

1. **Точный поиск токена** - ищет токен для конкретного registry
2. **Правильный Base64** - использует `_auth` как есть
3. **Детальная диагностика** - показывает что именно не так
4. **Fallback** - пробует разные варианты

### Формат .npmrc:

```ini
# Для конкретного registry (рекомендуется)
//customRegistry.niu.ru/repo/npm/:_authToken=YOUR_TOKEN_HERE

# Или Base64
//customRegistry.niu.ru/repo/npm/:_auth=BASE64_STRING

# Или общий токен
_authToken=YOUR_TOKEN
```

### Логи при успехе:

```
📦 Скачиваю: https://customRegistry.niu.ru/...
🔑 Найден .npmrc, использую авторизацию...
   Registry: //customRegistry.niu.ru/repo/npm
✓ Найден _auth (base64) для registry
   Использую: Basic auth (base64)
   Authorization header установлен
📥 Отправляю запрос...
✓ Пакет скачан
```

### Логи при ошибке 401:

```
❌ Ошибка 401: Не удалось авторизоваться

💡 Попробуйте альтернативный метод:
   1. Вместо URL используйте локальный файл из Git:
      "prevPackage": "./archive/api-codegen-1.55.0.tgz"
   
   2. Или положите файл в репозиторий Bitbucket:
      mkdir -p archive
      cp api-codegen-1.55.0.tgz archive/
      git add archive/ && git commit -m "Add version 1.55.0"
   
   3. Проверьте .npmrc:
      ✓ .npmrc найден
      ✓ Токен найден в файле
```

---

## Отладка .npmrc

### Проверьте формат:

```bash
cat .npmrc
```

Должно быть БЕЗ лишних пробелов:

```ini
# ✅ Правильно
//customRegistry.niu.ru/repo/npm/:_authToken=abc123

# ❌ Неправильно (пробелы)
//customRegistry.niu.ru/repo/npm/ :_authToken = abc123
```

### Проверьте токен:

```bash
# Тестируем токен
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://customRegistry.niu.ru/repo/npm/api-codegen/-/api-codegen-1.55.0.tgz \
  -o test.tgz

# Должен скачать файл
ls -lh test.tgz
```

### Если Base64:

```bash
# Проверяем что это правильный base64
echo "YOUR_BASE64" | base64 -d
# Должен показать username:password
```

---

## Сравнение методов

| Метод | Плюсы | Минусы |
|-------|-------|--------|
| **Локальные файлы** | ✅ 100% работает<br>✅ Нет проблем с авторизацией<br>✅ Версии в Git<br>✅ Быстро | ❌ Файлы в репозитории<br>❌ Занимают место |
| **NPM Registry** | ✅ Чистый репозиторий<br>✅ Централизованное хранилище | ❌ Проблемы с авторизацией<br>❌ Зависимость от registry |

## 💡 Рекомендация

**Используйте локальные файлы!**

Причины:
1. 100% надёжность
2. Не зависите от NPM registry
3. Версии в Git - полный контроль
4. Легко откатиться на любую версию

### Оптимизация размера:

Храните только последние 5-10 версий:

```bash
# Удаляем старые версии
cd archive
ls -t *.tgz | tail -n +11 | xargs rm -f
git add .
git commit -m "chore: cleanup old archives"
```

---

## Примеры конфигов

### С NPM registry:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "https://customRegistry.niu.ru/repo/npm/api-codegen/api-codegen-1.55.0.tgz"
}
```

### С локальным файлом:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "./archive/api-codegen-1.55.0.tgz"
}
```

### Без сравнения:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders"
}
```

---

## Workflow

### Первый релиз (1.55.0):

```bash
npm run build
npm run generate -- --config=configs/orders_config.json

# Создаём архив
npm pack

# Сохраняем в Git
mkdir -p archive
mv api-codegen-1.55.0.tgz archive/
git add archive/
git commit -m "archive: version 1.55.0"
git push

npm publish
```

### Следующий релиз (1.56.0) со сравнением:

```bash
# Обновляем конфиг
cat > configs/orders_config.json << EOF
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./dist/orders",
  "prevPackage": "./archive/api-codegen-1.55.0.tgz"
}
EOF

# Генерируем
npm run generate -- --config=configs/orders_config.json
# Создаётся dist/orders/COMPARE_README.md!

# Архивируем
npm pack
mv api-codegen-1.56.0.tgz archive/
git add archive/ dist/
git commit -m "release: version 1.56.0 with comparison"
git push

npm publish
```

---

## ✅ Итого

- ✅ **Локальные файлы** - 100% работает, рекомендуется
- ✅ **Улучшенная авторизация** - для NPM registry
- ✅ **Детальная диагностика** - понятные ошибки
- ✅ **Два метода** - выбирайте что удобнее

**Готово к production с любым способом!** 📦✨
