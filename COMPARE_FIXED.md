# ✅ Исправления Compare: Авторизация + Один файл в dist/

## Что исправлено

### 1. ✅ Один файл COMPARE_README.md в dist/

**БЫЛО:** Множество файлов в корне: `ordersCompareReadme.md`, `productsCompareReadme.md`, etc.

**СТАЛО:** Один файл `COMPARE_README.md` в каждом `dist/{service}/`

### 2. ✅ Файл попадает в NPM пакет

**БЫЛО:** Файлы в корне → НЕ попадали в NPM

**СТАЛО:** Файлы в `dist/` → попадают в NPM пакет!

### 3. ✅ Авторизация через .npmrc

**БЫЛО:** Ошибка 401 при скачивании из приватного registry

**СТАЛО:** Автоматическое чтение токена из `.npmrc`

---

## Структура после генерации

```
api-codegen/
├── .npmrc                      ← Токен авторизации
├── dist/
│   ├── orders/
│   │   ├── API_README.md       ← Документация API
│   │   ├── COMPARE_README.md   ← Отчёт о сравнении! ✨
│   │   ├── orders.api.ts
│   │   └── index.ts
│   │
│   ├── products/
│   │   ├── API_README.md
│   │   ├── COMPARE_README.md   ← Отчёт о сравнении!
│   │   └── ...
│   │
│   └── finance/
│       ├── API_README.md
│       ├── COMPARE_README.md   ← Отчёт о сравнении!
│       └── ...
│
└── package.json
```

### В NPM пакете:

```
@your-company/api-codegen/
└── dist/
    ├── orders/
    │   ├── API_README.md       ✅ В пакете
    │   ├── COMPARE_README.md   ✅ В пакете
    │   └── ...
    └── ...
```

---

## Авторизация через .npmrc

### Формат .npmrc:

```ini
# Вариант 1: Bearer токен (рекомендуется)
//customRegistry.niu.ru/repo/npm/:_authToken=YOUR_TOKEN_HERE

# Вариант 2: Base64 (username:password)
//customRegistry.niu.ru/repo/npm/:_auth=BASE64_STRING

# Вариант 3: С Bearer префиксом
//customRegistry.niu.ru/repo/npm/:_authToken=Bearer YOUR_TOKEN
```

### Пример .npmrc для проекта:

```ini
# Registry
registry=https://customRegistry.niu.ru/repo/npm/

# Авторизация
//customRegistry.niu.ru/repo/npm/:_authToken=NpmToken.abc123-xyz789

# Опционально
always-auth=true
```

### Jenkins - создание .npmrc:

```groovy
stage('Подготовка') {
    steps {
        withCredentials([string(credentialsId: 'npm-token', variable: 'NPM_TOKEN')]) {
            sh '''
                echo "//customRegistry.niu.ru/repo/npm/:_authToken=${NPM_TOKEN}" > .npmrc
            '''
        }
        
        sh 'npm install'
        sh 'npm run build'
    }
}
```

---

## Workflow с авторизацией

### Генерация с сравнением:

```bash
npm run generate -- --config=configs/orders_config.json
```

**Логи:**

```
🔍 Начинаю сравнение с предыдущей версией...
📦 Скачиваю: https://customRegistry.niu.ru/.../api-codegen-1.55.0.tgz
🔑 Найден .npmrc, использую авторизацию...
✓ Токен авторизации найден
✓ Пакет скачан                    ← Работает!
📊 Извлекаю информацию...
🔄 Сравниваю версии...
✅ Отчёт: dist/orders/COMPARE_README.md
```

---

## Jenkins Pipeline (полный)

```groovy
pipeline {
    agent any
    
    parameters {
        string(name: 'PREV_COMPARE_VERSION', defaultValue: 'FALSE')
    }
    
    stages {
        stage('Подготовка') {
            steps {
                // Создаём .npmrc с токеном
                withCredentials([string(credentialsId: 'npm-token', variable: 'NPM_TOKEN')]) {
                    sh """
                        echo "//customRegistry.niu.ru/repo/npm/:_authToken=\${NPM_TOKEN}" > .npmrc
                    """
                }
                
                sh 'npm install && npm run build'
            }
        }
        
        stage('Обновление конфигов') {
            when { expression { params.PREV_COMPARE_VERSION != 'FALSE' } }
            steps {
                sh """
                    node scripts/update-config.js configs/orders_config.json ${params.PREV_COMPARE_VERSION}
                """
            }
        }
        
        stage('Генерация') {
            steps {
                sh 'npm run generate -- --config=configs/orders_config.json'
                // Создаётся dist/orders/COMPARE_README.md
            }
        }
        
        stage('Публикация') {
            steps {
                sh 'npm publish'
            }
        }
    }
    
    post {
        always {
            sh 'rm -f .npmrc'  // Удаляем токен
        }
    }
}
```

---

## Troubleshooting

### Ошибка 401:

```
❌ Ошибка авторизации (401)
   Проверьте:
   1. Файл .npmrc существует
   2. Токен актуален
   3. Токен имеет доступ к registry
```

**Решение:**

```bash
# Проверьте токен
npm whoami --registry=https://customRegistry.niu.ru/repo/npm/

# Обновите
npm login --registry=https://customRegistry.niu.ru/repo/npm/
```

---

## ✅ Итого

- ✅ **COMPARE_README.md в dist/** - попадает в NPM
- ✅ **Авторизация через .npmrc** - работает
- ✅ **Поддержка Bearer и Base64** токенов
- ✅ **Понятные ошибки** при проблемах с авторизацией

**Готово к production!** 🔐✨
