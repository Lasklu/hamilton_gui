# Mock API Endpoints

Mock endpoints are available for testing the frontend without implementing the full backend logic. These endpoints return realistic fake data immediately.

## Available Mock Endpoints

### 1. Upload Database
**POST** `/mock/databases`

Accepts a database name and SQL file, returns a mock database object.

**Response:**
```json
{
  "id": "db_000001",
  "name": "my-database",
  "createdAt": "2025-11-05T10:30:00Z"
}
```

### 2. Get Database Metadata
**GET** `/mock/databases/{databaseId}`

Returns mock database metadata for any database ID.

**Response:**
```json
{
  "id": "db_000001",
  "name": "Mock Database db_000001",
  "createdAt": "2025-11-05T10:30:00Z"
}
```

### 3. Get Database Schema
**GET** `/mock/databases/{databaseId}/schema`

Returns a mock schema with sample tables:
- `users` (5 columns: id, username, email, created_at, is_active)
- `orders` (6 columns: id, user_id, order_date, total_amount, status, shipping_address)
- `order_items` (5 columns: id, order_id, product_id, quantity, price)
- `products` (5 columns: id, name, description, price, stock_quantity)

**Response:**
```json
{
  "databaseId": "db_000001",
  "tableCount": 4,
  "tables": [
    {
      "schema": "public",
      "name": "users",
      "columnCount": 5,
      "columns": [
        {
          "name": "id",
          "dataType": "INTEGER",
          "nullable": false,
          "isPrimaryKey": true,
          "isForeignKey": false
        },
        ...
      ]
    },
    ...
  ]
}
```

### 4. Cluster Database
**POST** `/mock/databases/{databaseId}/cluster`

Returns mock clustering suggestions grouping tables by domain:
- User Management (users)
- Order Processing (orders, order_items)
- Product Catalog (products)

**Request Body:**
```json
{
  "applyFinetuning": false
}
```

**Response:**
```json
{
  "databaseId": "db_000001",
  "createdAt": "2025-11-05T10:30:00Z",
  "appliedFinetuning": false,
  "groups": [
    {
      "label": "User Management",
      "tables": [
        { "schema": "public", "name": "users" }
      ],
      "scores": {
        "coherence": 0.95,
        "similarity": 0.89
      }
    },
    ...
  ]
}
```

## Usage in Frontend

The frontend is already configured to use mock endpoints. To switch between mock and real API:

```typescript
// Using mock API (current default)
import { mockClient } from '@/lib/api/services'

const database = await mockClient.databases.create(name, file)
const schema = await mockClient.databases.getSchema(databaseId)
const clusters = await mockClient.clustering.cluster(databaseId)

// Using real API (when backend is implemented)
import { apiClient } from '@/lib/api/services'

const database = await apiClient.databases.create(name, file)
const schema = await apiClient.databases.getSchema(databaseId)
const clusters = await apiClient.clustering.cluster(databaseId)
```

## Testing

1. Start the backend server:
   ```bash
   cd backend
   python -m app.main
   ```

2. Visit the API documentation:
   - Swagger UI: http://localhost:8000/docs
   - Look for endpoints tagged with **[Mock]**

3. Test the mock endpoints directly or use the frontend to see them in action

## Benefits

- ✅ Test frontend flows without backend implementation
- ✅ Realistic sample data for UI development
- ✅ Fast iteration on frontend features
- ✅ Easy to switch to real API when ready
