# Hamilton GUI - Setup Guide

## Current Configuration

### Backend
- **URL**: http://172.20.11.15:8000
- **Status**: ✅ Running
- **API Docs**: http://172.20.11.15:8000/docs
- **Port**: 8000

### Frontend
- **URL**: http://localhost:3001
- **Status**: ✅ Running
- **Port**: 3001 (auto-selected, 3000 was in use)

### CORS Configuration
The backend is configured to accept requests from:
- http://localhost:3000
- http://localhost:3001
- http://172.20.11.15:3000
- http://172.20.11.15:3001

## Running the Application

### Start Backend
```bash
cd backend
python -m app.main
```

### Start Frontend
```bash
cd frontend
npm run dev
```

## Testing the Application

### 1. Access the Frontend
Open your browser to: http://localhost:3001

### 2. Test Mock API Mode
- The debug toggle in the top-right enables/disables Mock API mode
- **Mock Mode ON** (yellow badge): Uses `/mock/*` endpoints for instant responses
- **Mock Mode OFF**: Uses real backend API endpoints

### 3. Upload a Database
1. Enter a database name
2. Choose upload method (File or Paste SQL)
3. Upload your SQL schema
4. Click "Upload and Continue"

### 4. View Clustering Visualization
After upload, you'll automatically proceed to the clustering step:
- **Left Panel (1/3)**: Cluster information with table lists and confidence scores
- **Right Panel (2/3)**: Interactive graph visualization
  - Nodes represent tables (colored by cluster)
  - Hover over nodes to see column details
  - Zoom with mouse wheel
  - Drag to pan
  - Click and drag nodes to reposition

## Features Implemented

✅ Database upload (file or text)
✅ Progress tracking (6-step workflow)
✅ Database schema metadata endpoint
✅ Automatic clustering of tables
✅ Interactive graph visualization with:
  - Color-coded clusters
  - Hover tooltips showing columns
  - Foreign key relationship arrows
  - Zoom and pan controls
  - Responsive layout
✅ Mock API for testing without backend logic
✅ Debug mode toggle
✅ Loading states with progress messages
✅ Error handling

## API Endpoints

### Real API
- `POST /databases` - Upload database from file
- `POST /databases/from-text` - Upload database from text
- `GET /databases/{id}` - Get database metadata
- `GET /databases/{id}/schema` - Get database schema with tables/columns
- `POST /databases/{id}/cluster` - Run clustering algorithm

### Mock API
- `POST /mock/databases` - Mock database upload
- `POST /mock/databases/from-text` - Mock database upload from text
- `GET /mock/databases/{id}` - Mock database metadata
- `GET /mock/databases/{id}/schema` - Mock schema (returns sample e-commerce DB)
- `POST /mock/databases/{id}/cluster` - Mock clustering (3 clusters)

## Next Steps

The following steps are placeholders and need implementation:
- Step 3: Edit Concepts
- Step 4: Edit Attributes
- Step 5: Edit Relationships
- Step 6: Export Ontology

Backend services need actual implementation:
- SQL parsing logic
- Clustering algorithm
- Ontology generation (concepts, attributes, relationships)

## Troubleshooting

### CORS Errors
If you see CORS errors, verify:
1. Backend `.env` file has correct CORS_ORIGINS
2. Frontend `.env.local` has correct NEXT_PUBLIC_API_BASE_URL
3. Both servers are running

### Port Already in Use
```bash
# Kill existing processes
pkill -f "python -m app.main"
pkill -f "next dev"

# Or find and kill specific process
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:3000 | xargs kill -9  # Frontend
```

### Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Frontend Dependencies
```bash
cd frontend
npm install
```
