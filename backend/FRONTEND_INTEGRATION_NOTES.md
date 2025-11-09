# Frontend Integration for Model Manager (Optional Enhancements)

## ✅ Current Status: No Changes Required

The lazy loading with context manager approach works transparently on the backend. **No frontend changes are required** for it to work correctly.

However, you can optionally add user-friendly loading indicators to show model status.

---

## 🎨 Optional Enhancement: Model Status Indicator

### Step 1: Add Model Status API Client Method

Add to `/frontend/src/lib/api/services/models.ts` (new file):

```typescript
import { axiosInstance } from '../client';

export interface ModelStatus {
  concept: 'not_loaded' | 'loading' | 'ready' | 'error' | 'unloaded';
  relationship: 'not_loaded' | 'loading' | 'ready' | 'error' | 'unloaded';
  attribute: 'not_loaded' | 'loading' | 'ready' | 'error' | 'unloaded';
}

export interface ModelStatusResponse {
  all_ready: boolean;
  details: ModelStatus;
}

export const modelService = {
  /**
   * Get the loading status of all models
   */
  async getStatus(): Promise<ModelStatus> {
    const response = await axiosInstance.get<ModelStatus>('/api/models/status');
    return response.data;
  },

  /**
   * Check if all models are ready
   */
  async checkReady(): Promise<ModelStatusResponse> {
    const response = await axiosInstance.get<ModelStatusResponse>('/api/models/ready');
    return response.data;
  },
};
```

### Step 2: Optional Loading Message in ConceptsStep

Update `/frontend/src/components/steps/ConceptsStep.tsx`:

```typescript
// Add at the top with other imports
import { useState, useEffect } from 'react';

// Add this state variable
const [modelLoading, setModelLoading] = useState<string | null>(null);

// Add this effect to show loading message on first concept generation
useEffect(() => {
  // Only show on first generation
  if (processingState === 'generating' && jobId) {
    // Optional: Check if this is likely the first model load
    // by seeing if it's taking longer than expected
    const timer = setTimeout(() => {
      setModelLoading(
        'AI model is loading for the first time. This may take 10-30 seconds...'
      );
    }, 5000); // Show message after 5 seconds

    return () => {
      clearTimeout(timer);
      setModelLoading(null);
    };
  }
}, [processingState, jobId]);

// Add this to your render, near the JobProgressIndicator:
{modelLoading && (
  <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
    <div className="flex items-center gap-2 text-blue-700">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span className="text-sm">{modelLoading}</span>
    </div>
  </div>
)}
```

### Step 3: Optional Global Model Status Banner

Add to your main layout to show model status on app startup:

Create `/frontend/src/components/ui/ModelStatusBanner.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { modelService } from '@/lib/api/services/models';

export function ModelStatusBanner() {
  const [status, setStatus] = useState<'checking' | 'loading' | 'ready' | 'error' | 'hidden'>('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const response = await modelService.checkReady();
        
        if (response.all_ready) {
          setStatus('ready');
          setMessage('All AI models ready');
          
          // Auto-hide after 3 seconds
          setTimeout(() => setStatus('hidden'), 3000);
          
          // Stop polling
          if (interval) clearInterval(interval);
        } else {
          setStatus('loading');
          
          // Check which models are loading
          const loadingModels = Object.entries(response.details)
            .filter(([_, status]) => status === 'loading')
            .map(([name, _]) => name);
          
          if (loadingModels.length > 0) {
            setMessage(`Loading models: ${loadingModels.join(', ')}...`);
          } else {
            setMessage('AI models will load on first use');
            // Hide if no models are actively loading
            setTimeout(() => setStatus('hidden'), 5000);
            if (interval) clearInterval(interval);
          }
        }
      } catch (error) {
        console.error('Error checking model status:', error);
        setStatus('hidden'); // Hide on error
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds
    interval = setInterval(checkStatus, 5000);

    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  if (status === 'hidden') return null;

  return (
    <div className={`
      fixed top-0 left-0 right-0 z-50 p-3 text-center text-sm
      ${status === 'checking' || status === 'loading' ? 'bg-blue-50 text-blue-800 border-b border-blue-200' : ''}
      ${status === 'ready' ? 'bg-green-50 text-green-800 border-b border-green-200' : ''}
      ${status === 'error' ? 'bg-red-50 text-red-800 border-b border-red-200' : ''}
    `}>
      <div className="flex items-center justify-center gap-2">
        {(status === 'checking' || status === 'loading') && (
          <Loader2 className="w-4 h-4 animate-spin" />
        )}
        {status === 'ready' && (
          <CheckCircle2 className="w-4 h-4" />
        )}
        {status === 'error' && (
          <XCircle className="w-4 h-4" />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}
```

Then add to your root layout:

```typescript
import { ModelStatusBanner } from '@/components/ui/ModelStatusBanner';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <ModelStatusBanner />
        {children}
      </body>
    </html>
  );
}
```

---

## 🎯 Recommendation

**For now: Skip all frontend changes!** 

The lazy loading works perfectly without any frontend modifications. Users will experience:

- **First concept generation**: Takes 10-30 seconds longer (model loads in background)
- **Subsequent generations**: Same speed as before (but model unloads after each use)

The existing loading indicator (`JobProgressIndicator`) already shows progress, so users won't be confused.

### When to Add Frontend Enhancements:

1. **If users report confusion** about initial delay → Add the "model loading" message
2. **If you want to show system status** → Add the global status banner
3. **Otherwise**: Leave it as-is! Simpler is better.

---

## 📊 User Experience Comparison

### Current Experience (No Frontend Changes)

```
User Action: "Generate concepts"
  ↓
Frontend: Shows "Generating concepts..." (existing JobProgressIndicator)
  ↓
Backend: [Loads model] → [Generates] → [Unloads model] (10-30s first time, 5-10s subsequent)
  ↓
Frontend: Shows results
```

**User sees:** Standard loading indicator, slightly longer wait on first use.

### With Optional Enhancement

```
User Action: "Generate concepts"
  ↓
Frontend: Shows "Generating concepts..."
  ↓
After 5s: Shows "AI model loading for first time..." (only if taking long)
  ↓
Backend: [Loads model] → [Generates] → [Unloads model]
  ↓
Frontend: Shows results
```

**User sees:** More informative message explaining the delay.

---

## ✅ Conclusion

**No frontend changes are required!** The backend changes are transparent to the frontend. All existing error handling and loading indicators will work correctly.

Optional enhancements can be added later if needed, but they're not necessary for the system to function properly.
