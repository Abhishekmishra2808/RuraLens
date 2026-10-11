import { Component, Suspense, lazy, useState, type ReactNode } from 'react';
import { Box, Loader2, Map as MapIcon } from 'lucide-react';
import Map3D from '../Map3D/Map3D';

const DigitalTwinView = lazy(() => import('../DigitalTwin/DigitalTwinView'));

type MapMode = 'twin' | 'classic';
const MODE_KEY = 'ruralens.mapMode';

function readMode(): MapMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'classic' ? 'classic' : 'twin';
  } catch {
    return 'twin';
  }
}

class TwinErrorBoundary extends Component<{ onFallback: () => void; children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[DigitalTwin] crashed', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-slate-900 p-6 text-center">
          <h3 className="mb-2 text-lg font-semibold text-white">The 3D digital twin failed to load</h3>
          <p className="mb-5 text-sm text-slate-300">{this.state.error.message}</p>
          <button
            onClick={this.props.onFallback}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            <MapIcon size={16} /> Open classic 2D map
          </button>
        </div>
      </div>
    );
  }
}

export default function MapView() {
  const [mode, setModeState] = useState<MapMode>(readMode);

  const setMode = (next: MapMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      // Storage unavailable (private mode); the choice just isn't remembered.
    }
  };

  if (mode === 'classic') {
    return (
      <div className="relative h-full w-full bg-slate-950">
        <Map3D />
        <button
          onClick={() => setMode('twin')}
          className="absolute bottom-10 right-3 z-10 flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-slate-900/90 px-3 py-2 text-xs font-semibold text-cyan-100 shadow-lg backdrop-blur-md hover:bg-slate-800"
        >
          <Box size={14} /> Open 3D digital twin
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950">
      <TwinErrorBoundary onFallback={() => setMode('classic')}>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Loading 3D engine…
            </div>
          }
        >
          <DigitalTwinView onOpenClassic={() => setMode('classic')} />
        </Suspense>
      </TwinErrorBoundary>
    </div>
  );
}
