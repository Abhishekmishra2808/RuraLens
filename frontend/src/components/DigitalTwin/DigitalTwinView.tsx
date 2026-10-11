import { useEffect } from 'react';
import { getActiveRun, useTwinStore } from '../../store/twinStore';
import CesiumCity from './CesiumCity';
import TwinPanel from './TwinPanel';

const FRAME_MS = 1300;

interface Props {
  onOpenClassic: () => void;
}

/** Snapshot playback lives here so it keeps running whichever panel tab is open. */
function usePlayback() {
  const run = useTwinStore(getActiveRun);
  const playing = useTwinStore((s) => s.simulation.playing);
  const frameIndex = useTwinStore((s) => s.simulation.frameIndex);
  const setFrame = useTwinStore((s) => s.setFrame);
  const setPlaying = useTwinStore((s) => s.setPlaying);
  const lastFrame = run ? run.frames.length - 1 : 0;

  useEffect(() => {
    if (!playing || !run) return;
    if (frameIndex >= lastFrame) {
      setPlaying(false);
      return;
    }
    const t = window.setTimeout(() => setFrame(frameIndex + 1), FRAME_MS);
    return () => window.clearTimeout(t);
  }, [playing, frameIndex, lastFrame, run, setFrame, setPlaying]);
}

/** CesiumJS 3D digital twin: map (70%) beside a fixed side panel (30%); nothing overlaps the map. */
export default function DigitalTwinView({ onOpenClassic }: Props) {
  usePlayback();

  useEffect(() => {
    const store = useTwinStore.getState();
    if (store.datasetStatus === 'idle') {
      void store.loadDataset(store.datasetId);
      void store.loadScenarios();
    }
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-white lg:flex-row">
      <section className="relative min-h-[45%] flex-1 overflow-hidden bg-zinc-200" aria-label="3D map">
        <CesiumCity onOpenClassic={onOpenClassic} />
      </section>
      <div className="flex max-h-[55%] min-h-0 flex-col border-t border-zinc-200 lg:max-h-none lg:w-[30%] lg:min-w-[320px] lg:border-l lg:border-t-0">
        <TwinPanel onOpenClassic={onOpenClassic} />
      </div>
    </div>
  );
}
