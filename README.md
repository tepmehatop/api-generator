# @your-company/api-codegen

Complete solution for API client generation, test automation, and database integration - all in one package!

## 🎉 What's New in v13.0

Version 13.0 introduces powerful Happy Path data integration:
- **🎯 Happy Path Integration**: Use real data from UI tests stored in `qa.api_requests` database table
- **🔄 Intelligent Retry Strategy**: 10-15 attempts to get successful responses with smart fallback
- **📊 Data Validation**: Pre-generation validation with stale data detection (v12.0+)
- **🎲 Test Deduplication**: Signature-based grouping to avoid redundant tests (v12.0+)
- **📁 Separate Data Files**: Organized `testData/*.data.ts` files for each endpoint
- **❌ Removed Content-Type Test**: Eliminated unsupportedMediaType (415) test from negative scenarios

## 📦 What's Inside

This package contains:
1. **API Generator** - Generate TypeScript API clients from OpenAPI specs
2. **Test Generator** - Create Playwright tests automatically with Happy Path data
3. **Database Analyzer** - Extract real data from DB for tests with intelligent retry
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
npm run generate
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

**Step 3:** Generate tests with Happy Path data (v13.0)
```typescript
import { generateApiTests } from '@your-company/api-codegen';
import postgres from 'postgres';

// Connect to database with Happy Path data
const sql = postgres({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME
});

await generateApiTests({
  apiFilePath: './node_modules/@your-company/api-codegen/api/orders.api.ts',
  outputDir: './tests/api/orders',

  // NEW in v13.0: Happy Path integration
  useHappyPathData: true,
  dbConnection: sql,
  dbSchema: 'qa', // Schema with api_requests table
  happyPathSamplesCount: 15,
  maxDataGenerationAttempts: 10,

  // Validation (v12.0+)
  validation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update' // or 'skip', 'delete'
  },

  // Deduplication (v12.0+)
  deduplication: {
    enabled: true,
    maxTestsPerEndpoint: 5
  }
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

## 🗄️ Database Setup (v13.0)

### Happy Path Data Requirements

To use Happy Path integration (v13.0), your database must have a `qa.api_requests` table:

```sql
CREATE TABLE qa.api_requests (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER NOT NULL,
  test_name VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_api_requests_endpoint_method
  ON qa.api_requests(endpoint, method, response_status);
```

This table stores data from your UI/Happy Path tests. The generator:
1. Fetches real data from this table
2. Uses it for positive and pairwise tests
3. Falls back to generated data if no Happy Path data exists
4. Makes 10-15 attempts to get successful responses

### Environment Variables

```bash
# Required for Happy Path integration
StandURL=https://api.example.com
AUTH_TOKEN=your_auth_token_here

# Database connection
DB_HOST=localhost
DB_NAME=test_database
DB_USER=postgres
DB_PASSWORD=password
```

## 📋 CLI Commands

### Generate API

```bash
# Use default config (codegen.config.json)
npm run generate

# Use custom config
npm run generate --config=./config/my-config.json

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
                sh 'npm run generate'
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
npm run generate --config=codegen.config.json

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

### Example 4: Complete v13.0 Workflow with Happy Path

```typescript
import { generateApiTests } from '@your-company/api-codegen';
import postgres from 'postgres';

// 1. Setup database connection
const sql = postgres({
  host: process.env.DB_HOST,
  port: 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

// 2. Generate tests with Happy Path data
await generateApiTests({
  // API source
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',

  // Enable all test types
  generatePositiveTests: true,
  generateNegativeTests: true,
  generatePairwiseTests: true,

  // v13.0: Happy Path integration
  useHappyPathData: true,
  dbConnection: sql,
  dbSchema: 'qa',
  happyPathSamplesCount: 15,
  maxDataGenerationAttempts: 10,
  standUrl: process.env.StandURL,
  authToken: process.env.AUTH_TOKEN,

  // v12.0: Validation
  validation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update',
    staleIfChanged: ['status', 'type', 'state'],
    allowChanges: ['*_at', '*_timestamp', 'updated_at'],
    logChanges: true,
    logPath: './logs/validation.log'
  },

  // v12.0: Deduplication
  deduplication: {
    enabled: true,
    ignoreFields: ['id', '*_id', '*_timestamp'],
    significantFields: ['status', 'type', 'role'],
    detectEdgeCases: true,
    maxTestsPerEndpoint: 5,
    preserveTaggedTests: ['[KEEP]']
  },

  // Filters
  includeEndpoints: ['/orders', '/products'],
  excludeMethods: ['DELETE']
});

// 3. Close connection
await sql.end();
```

**What Happens:**
1. Generator fetches data from `qa.api_requests` table
2. Validates data is not stale (compares with live API)
3. Deduplicates similar tests (keeps 5 best per endpoint)
4. Creates test files with separate `testData/*.data.ts` files
5. Generated tests use Happy Path data for realistic scenarios
6. Falls back to generated data if Happy Path unavailable
7. Makes up to 10 attempts to get successful responses

**Generated Structure:**
```
tests/api/orders/
├── createOrder.test.ts          # Test file
├── createOrder-positive.test.ts
├── createOrder-negative.test.ts
├── createOrder-pairwise.test.ts
└── testData/
    ├── createOrder.data.ts      # Happy Path data
    ├── createOrder-positive.data.ts
    └── createOrder-pairwise.data.ts
```

## 🎛️ Filters and Options

### Endpoint and Method Filters

Control which endpoints and methods to generate tests for:

```typescript
await generateApiTests({
  // ... other config

  // Include only specific endpoints
  includeEndpoints: [
    '/orders',
    '/products',
    '/users/{id}'
  ],

  // Exclude specific endpoints
  excludeEndpoints: [
    '/admin',
    '/internal',
    '/debug'
  ],

  // Include only specific HTTP methods
  includeMethods: ['GET', 'POST', 'PUT'],

  // Exclude specific HTTP methods
  excludeMethods: ['DELETE', 'PATCH']
});
```

**Filter Logic:**
- If `includeEndpoints` is set, only those endpoints are processed
- Then `excludeEndpoints` removes specific ones
- Same logic applies to `includeMethods`/`excludeMethods`
- Filters support exact matches and wildcards

### Test Type Selection

Choose which test types to generate:

```typescript
await generateApiTests({
  // ... other config

  generatePositiveTests: true,   // Happy path tests
  generateNegativeTests: false,  // Error scenarios (400, 401, 404, etc.)
  generatePairwiseTests: true    // Combinatorial tests
});
```

**Test Types:**
- **Positive**: Tests with valid data expecting 2xx responses
- **Negative**: Tests with invalid data expecting 4xx/5xx responses
- **Pairwise**: Combinatorial tests with different field combinations

### Validation Options (v12.0+)

Control how stale data is handled:

```typescript
validation: {
  enabled: true,
  validateBeforeGeneration: true,

  // What to do with stale data
  onStaleData: 'update',  // Options: 'update', 'skip', 'delete'

  // Fields that make data stale if changed
  staleIfChanged: [
    'status',
    'type',
    'state',
    'role',
    'enabled'
  ],

  // Fields that are OK to change (timestamps, etc.)
  allowChanges: [
    '*_at',           // created_at, updated_at
    '*_timestamp',    // any_timestamp
    'updated_at',
    'last_modified'
  ],

  // Logging
  logChanges: true,
  logPath: './logs/validation.log'
}
```

### Deduplication Options (v12.0+)

Reduce redundant tests while keeping edge cases:

```typescript
deduplication: {
  enabled: true,

  // Fields to ignore when comparing (technical fields)
  ignoreFields: [
    'id',
    '*_id',          // user_id, order_id, etc.
    '*_timestamp',
    '*_at'
  ],

  // Important fields that affect business logic
  significantFields: [
    'status',
    'type',
    'role',
    'state',
    'enabled'
  ],

  // Keep tests with edge cases (null, empty arrays)
  detectEdgeCases: true,

  // Maximum tests per endpoint
  maxTestsPerEndpoint: 5,

  // Preserve tests with specific tags
  preserveTaggedTests: [
    '[KEEP]',
    '[IMPORTANT]',
    '[EDGE_CASE]'
  ]
}
```

## 🔑 API Reference

### CLI

```bash
npm run generate [options]

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

Generate Playwright tests for API with Happy Path integration (v13.0).

```typescript
import { generateApiTests } from '@your-company/api-codegen';
import postgres from 'postgres';

const sql = postgres({ /* connection config */ });

await generateApiTests({
  // Required
  apiFilePath: './api/orders.api.ts',
  outputDir: './tests/api/orders',

  // Test types (default: all true)
  generatePositiveTests: true,
  generateNegativeTests: true,
  generatePairwiseTests: true,

  // NEW in v13.0: Happy Path integration
  useHappyPathData: true,              // Use data from qa.api_requests
  dbConnection: sql,                   // postgres connection
  dbSchema: 'qa',                      // Schema name (default: 'qa')
  happyPathSamplesCount: 15,           // How many samples to fetch
  maxDataGenerationAttempts: 10,       // Max attempts to get 200 response
  standUrl: 'https://api.example.com', // API base URL
  authToken: 'Bearer token',           // Auth token for API calls

  // Validation (v12.0+)
  validation: {
    enabled: true,
    validateBeforeGeneration: true,    // Validate before generating tests
    onStaleData: 'update',             // 'update' | 'skip' | 'delete'
    staleIfChanged: ['status', 'type', 'state'], // Significant fields
    allowChanges: ['*_at', '*_timestamp'],       // Allowed changes
    validateInDatabase: false,
    logChanges: true,
    logPath: './logs/validation.log'
  },

  // Deduplication (v12.0+)
  deduplication: {
    enabled: true,
    ignoreFields: ['id', '*_id', '*_timestamp', '*_at'],
    significantFields: ['status', 'type', 'state', 'role'],
    detectEdgeCases: true,             // Detect null, empty arrays
    maxTestsPerEndpoint: 5,            // Limit tests per endpoint
    preserveTaggedTests: ['[KEEP]', '[IMPORTANT]']
  },

  // Filters
  includeEndpoints: ['/orders', '/products'],  // Only these endpoints
  excludeEndpoints: ['/admin'],                // Skip these
  includeMethods: ['POST', 'PUT'],             // Only these methods
  excludeMethods: ['DELETE']                    // Skip these
});
```

**Configuration Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `useHappyPathData` | boolean | false | Enable Happy Path integration |
| `dbConnection` | any | - | postgres connection object |
| `dbSchema` | string | 'qa' | Database schema name |
| `happyPathSamplesCount` | number | 15 | Samples to fetch per endpoint |
| `maxDataGenerationAttempts` | number | 10 | Max retry attempts for 200 response |
| `standUrl` | string | env.StandURL | API base URL |
| `authToken` | string | env.AUTH_TOKEN | Authentication token |
| `validation.enabled` | boolean | false | Enable data validation |
| `validation.onStaleData` | string | 'skip' | Action on stale data |
| `deduplication.enabled` | boolean | false | Enable test deduplication |
| `deduplication.maxTestsPerEndpoint` | number | 10 | Max tests per endpoint |

### analyzeAndGenerateTestData(config, dbConnect)

Analyze database and generate test data with intelligent retry (v13.0).

```typescript
import { analyzeAndGenerateTestData } from '@your-company/api-codegen';
import postgres from 'postgres';

const testDbConnect = postgres({ /* connection */ });

await analyzeAndGenerateTestData({
  // Required
  testFilePath: './tests/api/orders/createOrder.test.ts',
  dbConnectionMethod: 'testDbConnect',
  dbSchema: 'orders_schema',

  // Data generation
  samplesCount: 15,                    // Samples per table
  maxAttempts: 10,                     // Max attempts for 200 response

  // NEW in v13.0: Happy Path integration
  useHappyPathData: true,              // Fetch from qa.api_requests
  happyPathSchema: 'qa',               // Happy Path schema

  // Analysis stages
  stages: {
    schemaAnalysis: true,              // Analyze DB schema
    foreignKeys: true,                 // Include foreign keys
    empiricalTest: true                // Test with real API calls
  },

  // Filters
  excludeTables: ['migrations', 'logs'],
  includeColumns: ['id', 'name', 'status']
}, testDbConnect);
```

**How It Works (v13.0):**
1. Analyzes database schema
2. Fetches Happy Path data from `qa.api_requests`
3. Generates fallback test data
4. Makes 10-15 attempts to get successful API response:
   - Tries Happy Path data first
   - Falls back to generated data
   - Stops on 401/403 (auth errors)
   - Continues on 400 (validation errors) with new data
5. Updates test file with working data

## 📊 Workflow Diagram (v13.0)

```
┌─────────────────────────────────────────────────────────────┐
│ JENKINS (DevOps)                                            │
├─────────────────────────────────────────────────────────────┤
│ 1. git clone api-codegen                                    │
│ 2. npm install                                              │
│ 3. npm run generate  → creates /api/*.ts           │
│ 4. npm run build             → creates /dist/*.js          │
│ 5. npm publish               → publishes EVERYTHING        │
│                                                              │
│ Published Package Contains:                                 │
│   ├── /api/*.ts       (generated API methods + types)      │
│   ├── /dist/*.js      (generator tools v13.0)              │
│   └── /bin/cli.js     (CLI command)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ DATABASE (PostgreSQL)                          NEW in v13.0 │
├─────────────────────────────────────────────────────────────┤
│ qa.api_requests table:                                      │
│   ├── endpoint, method                                      │
│   ├── request_body (JSONB)                                  │
│   ├── response_body (JSONB)                                 │
│   └── response_status                                       │
│                                                              │
│ Populated by: UI/Happy Path tests                          │
│ Used for: Real data in API test generation                 │
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
│ 3. Generate tests (v13.0):                    ← Reads from │
│    import { generateApiTests } from              qa.api_    │
│      '@your-company/api-codegen'                 requests   │
│                                                              │
│    Creates:                                                 │
│    ├── tests/api/orders/createOrder.test.ts                │
│    └── tests/api/orders/testData/                          │
│        └── createOrder.data.ts  ← Happy Path data          │
│                                                              │
│ 4. Analyze DB (v13.0):                                     │
│    - Fetches Happy Path data                               │
│    - Makes 10-15 attempts for 200 response                 │
│    - Falls back to generated data                          │
│    - Validates data is not stale (v12.0)                   │
│    - Deduplicates similar tests (v12.0)                    │
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
npm run generate
```

### Error: "Table qa.api_requests does not exist" (v13.0)

Create the Happy Path table:
```sql
CREATE TABLE qa.api_requests (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(500) NOT NULL,
  method VARCHAR(10) NOT NULL,
  request_body JSONB,
  response_body JSONB,
  response_status INTEGER NOT NULL,
  test_name VARCHAR(500),
  created_at TIMESTAMP DEFAULT NOW()
);
```

Or disable Happy Path integration:
```typescript
await generateApiTests({
  useHappyPathData: false,  // Disable
  // ... other config
});
```

### Warning: "No Happy Path data found" (v13.0)

This is normal if your `qa.api_requests` table is empty. The generator will:
1. Try to fetch Happy Path data
2. Fall back to generated data if not found
3. Make multiple attempts to get 200 responses

To populate the table, run your UI/Happy Path tests which should log API requests to the database.

### Error: "Max attempts reached, could not get 200 response" (v13.0)

The generator tried 10-15 times but couldn't get a successful response. Check:
1. API endpoint is accessible (StandURL is correct)
2. Authentication token is valid (AUTH_TOKEN)
3. Required fields are correct in the DTO
4. Database has valid Happy Path data

Increase attempts if needed:
```typescript
await generateApiTests({
  maxDataGenerationAttempts: 20,  // Increase from 10
  // ... other config
});
```

### Issue: Tests are duplicated

Enable deduplication (v12.0+):
```typescript
await generateApiTests({
  deduplication: {
    enabled: true,
    maxTestsPerEndpoint: 5
  }
});
```

### Issue: Tests use stale/outdated data

Enable validation (v12.0+):
```typescript
await generateApiTests({
  validation: {
    enabled: true,
    validateBeforeGeneration: true,
    onStaleData: 'update'  // Auto-update stale data
  }
});
```

## 📚 Version History

### v13.0 (Current)
- ✅ Happy Path data integration from `qa.api_requests` table
- ✅ Intelligent retry strategy (10-15 attempts with fallback)
- ✅ Separate `testData/*.data.ts` files for each endpoint
- ✅ Removed Content-Type (415) test from negative scenarios
- ✅ Smart data generation stopping on 401/403, continuing on 400
- ✅ Environment variable support (StandURL, AUTH_TOKEN)

### v12.0
- ✅ Data validation with stale data detection
- ✅ Test deduplication with signature-based grouping
- ✅ Edge case detection (null, empty arrays, rare values)
- ✅ Configurable validation and deduplication rules

### v11.0 and earlier
- API client generation from OpenAPI specs
- Basic test generation (positive, negative, pairwise)
- Database analysis for test data
- TypeScript and Axios support

## 📝 License

MIT

## 🆘 Support

For issues and questions, contact your internal development team.
