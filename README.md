# @your-company/api-codegen

Complete solution for API client generation, test automation, and database integration - all in one package!

## 📦 What's Inside

This package contains:
1. **API Generator** - Generate TypeScript API clients from OpenAPI specs
2. **Test Generator** - Create Playwright tests automatically
3. **Database Analyzer** - Extract real data from DB for tests
4. **Generated API Methods** - Ready-to-use API client (in `/api` folder)

## 🚀 Quick Start

### For DevOps (Jenkins - Generate API Client)

**Step 1:** Clone this repository
```bash
git clone https://github.com/your-company/api-codegen.git
cd api-codegen
npm install
```

**Step 2:** Create config file `codegen.config.json`:
```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL"
}
```

**Step 3:** Generate API
```bash
npx api-codegen generate
```

This creates files in `/api`:
- `orders.api.ts` - API methods
- `orders.types.ts` - TypeScript interfaces
- `products.api.ts`
- etc.

**Step 4:** Build and publish
```bash
npm run build
npm publish
```

### For QA (Use in Tests)

**Step 1:** Install package
```bash
npm install @your-company/api-codegen
```

**Step 2:** Use generated API methods
```typescript
// Import API methods from the package
import { createOrder, getOrders } from '@your-company/api-codegen/api/orders.api';
import type { CreateOrderRequest } from '@your-company/api-codegen/api/orders.types';

// Use in your tests
test('create order', async () => {
  const request: CreateOrderRequest = {
    productId: 123,
    quantity: 2,
    orderType: 'standard'
  };
  
  const response = await createOrder(request);
  expect(response.status).toBe(201);
});
```

**Step 3:** Generate tests
```typescript
import { generateApiTests } from '@your-company/api-codegen';

await generateApiTests({
  apiFilePath: './node_modules/@your-company/api-codegen/api/orders.api.ts',
  outputDir: './tests/api/orders'
});
```

**Step 4:** Analyze database
```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import { testDbConnect } from './helpers/dbConnection';

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema'
}, testDbConnect);
```

## 📋 CLI Commands

### Generate API

```bash
# Use default config (codegen.config.json)
npx api-codegen generate

# Use custom config
npx api-codegen generate --config=./config/my-config.json

# Show help
npx api-codegen --help
```

### Config File Structure

Create `codegen.config.json` in project root:

```json
{
  "specUrl": "https://api.example.com/openapi.json",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL",
  "authTokenVar": "process.env.AUTH_TOKEN",
  "generateErrorHandlers": true,
  "generateTypes": true,
  "transliterateRussian": true,
  "useClasses": false
}
```

**Parameters:**
- `specUrl` - URL or path to OpenAPI spec (required)
- `outputDir` - Where to generate files (default: `./api`)
- `httpClient` - `axios` or `fetch` (default: `axios`)
- `baseUrl` - Base URL for API calls
- `authTokenVar` - Auth token variable name
- `generateErrorHandlers` - Generate error handlers (default: `true`)
- `generateTypes` - Generate TypeScript types (default: `true`)
- `transliterateRussian` - Transliterate Russian tags (default: `true`)
- `useClasses` - Use classes instead of functions (default: `false`)

## 🔧 Jenkins Integration

### Jenkinsfile Example

```groovy
pipeline {
    agent any
    
    environment {
        NPM_REGISTRY = 'https://your-internal-npm-registry.com/'
        NPM_TOKEN = credentials('npm-token')
        OPENAPI_URL = 'https://api.example.com/openapi.json'
    }
    
    stages {
        stage('Checkout') {
            steps {
                git 'https://github.com/your-company/api-codegen.git'
            }
        }
        
        stage('Install Dependencies') {
            steps {
                sh 'npm install'
            }
        }
        
        stage('Generate API') {
            steps {
                // Create config
                sh '''
                    cat > codegen.config.json << EOF
{
  "specUrl": "${OPENAPI_URL}",
  "outputDir": "./api",
  "httpClient": "axios",
  "baseUrl": "process.env.API_BASE_URL"
}
EOF
                '''
                
                // Generate
                sh 'npx api-codegen generate'
            }
        }
        
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }
        
        stage('Publish to NPM') {
            steps {
                sh '''
                    echo "//your-npm-registry.com/:_authToken=${NPM_TOKEN}" > .npmrc
                    npm publish --registry=${NPM_REGISTRY}
                '''
            }
        }
    }
    
    post {
        always {
            sh 'rm -f .npmrc'
        }
    }
}
```

### Alternative: Using Script

Create `scripts/generate-and-publish.sh`:

```bash
#!/bin/bash
set -e

echo "📥 Installing dependencies..."
npm install

echo "🔧 Generating API from OpenAPI spec..."
npx api-codegen generate --config=codegen.config.json

echo "🔨 Building package..."
npm run build

echo "📦 Publishing to NPM..."
npm publish --registry=${NPM_REGISTRY}

echo "✅ Done!"
```

Then in Jenkins:
```bash
chmod +x scripts/generate-and-publish.sh
./scripts/generate-and-publish.sh
```

## 📁 Package Structure

After generation and build:

```
@your-company/api-codegen/
├── api/                          ← Generated API (TypeScript)
│   ├── orders.api.ts
│   ├── orders.types.ts
│   ├── products.api.ts
│   ├── products.types.ts
│   └── base.types.ts
│
├── dist/                         ← Compiled generator
│   ├── index.js
│   ├── index.d.ts
│   ├── generator.js
│   ├── test-generator.js
│   └── database-analyzer.js
│
├── bin/
│   └── cli.js                    ← CLI command
│
├── package.json
├── README.md
└── codegen.config.json
```

## 🎯 Usage Examples

### Example 1: Use API Methods in Tests

```typescript
import test, { expect } from '@playwright/test';
import { createOrder, getOrderById, updateOrder } from '@your-company/api-codegen/api/orders.api';
import type { CreateOrderRequest, UpdateOrderRequest } from '@your-company/api-codegen/api/orders.types';

test.describe('Orders API', () => {
  test('create and get order', async () => {
    // Create
    const createRequest: CreateOrderRequest = {
      productId: 100,
      quantity: 5,
      orderType: 'express'
    };
    
    const createResponse = await createOrder(createRequest);
    expect(createResponse.status).toBe(201);
    
    const orderId = createResponse.data.id;
    
    // Get
    const getResponse = await getOrderById(orderId);
    expect(getResponse.status).toBe(200);
    expect(getResponse.data.productId).toBe(100);
  });
  
  test('update order', async () => {
    const updateRequest: UpdateOrderRequest = {
      quantity: 10,
      status: 'completed'
    };
    
    const response = await updateOrder(123, updateRequest);
    expect(response.status).toBe(200);
  });
});
```

### Example 2: Generate Tests

```typescript
import { generateApiTests } from '@your-company/api-codegen';

// Generate tests for orders API
await generateApiTests({
  apiFilePath: './node_modules/@your-company/api-codegen/api/orders.api.ts',
  outputDir: './tests/api/orders',
  generatePositiveTests: true,
  generateNegativeTests: true,
  generatePairwiseTests: true
});
```

### Example 3: Analyze Database

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const testDbConnect = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  samplesCount: 15,
  
  stages: {
    schemaAnalysis: true,
    foreignKeys: false,
    empiricalTest: false
  }
}, testDbConnect);
```

## 🔑 API Reference

### CLI

```bash
npx api-codegen generate [options]

Options:
  --config=<path>      Path to config file (default: codegen.config.json)
  --help, -h           Show help
```

### generateApi(config)

Generate TypeScript API client from OpenAPI spec.

```typescript
import { generateApi } from '@your-company/api-codegen';

await generateApi({
  specUrl: 'https://api.example.com/openapi.json',
  outputDir: './api',
  httpClient: 'axios',
  baseUrl: 'process.env.API_BASE_URL'
});
```

### generateApiTests(config)

Generate Playwright tests for API.

```typescript
import { generateApiTests } from '@your-company/api-codegen';

await generateApiTests({
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',
  generatePositiveTests: true,
  generateNegativeTests: true,
  generatePairwiseTests: true
});
```

### analyzeAndGenerateTestData(config, dbConnect)

Analyze database and generate test data.

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';

await analyzeAndGenerateTestData({
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',
  samplesCount: 15
}, testDbConnect);
```

## 📊 Workflow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ JENKINS (DevOps)                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. git clone api-codegen                                    │
│ 2. npm install                                              │
│ 3. npx api-codegen generate  → creates /api/*.ts           │
│ 4. npm run build             → creates /dist/*.js          │
│ 5. npm publish               → publishes EVERYTHING        │
│                                                              │
│ Published Package Contains:                                 │
│   ├── /api/*.ts       (generated API methods + types)      │
│   ├── /dist/*.js      (generator tools)                    │
│   └── /bin/cli.js     (CLI command)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ TEST PROJECT (QA)                                           │
├─────────────────────────────────────────────────────────────┤
│ 1. npm install @your-company/api-codegen                    │
│                                                              │
│ 2. Use API methods:                                         │
│    import { createOrder } from                              │
│      '@your-company/api-codegen/api/orders.api'             │
│                                                              │
│ 3. Generate tests:                                          │
│    import { generateApiTests } from                         │
│      '@your-company/api-codegen'                            │
│                                                              │
│ 4. Analyze DB:                                              │
│    import { analyzeAndGenerateTestData } from               │
│      '@your-company/api-codegen'                            │
└─────────────────────────────────────────────────────────────┘
```

## 🔍 Troubleshooting

### Error: "Config file not found"

Create `codegen.config.json` in project root:
```bash
cp codegen.config.example.json codegen.config.json
# Edit the file with your values
```

### Error: "Cannot find module '@your-company/api-codegen/api/orders.api'"

Make sure:
1. Package is installed: `npm list @your-company/api-codegen`
2. API was generated before publishing
3. `/api` folder exists in node_modules

### Error: "Command not found: api-codegen"

Use `npx`:
```bash
npx api-codegen generate
```

## 📝 License

MIT

## 🆘 Support

For issues and questions, contact your internal development team.
