import { useMemo } from 'react';
import { getActiveRun, useTwinStore } from '../../store/twinStore';
import { computeVisualStates, effectiveFrame } from './twinVisuals';

/** Per-asset visual state for the active simulation frame (shared by scene and panels). */
export function useVisualStates() {
  const assets = useTwinStore((s) => s.assets);
  const run = useTwinStore(getActiveRun);
  const frameIndex = useTwinStore((s) => s.simulation.frameIndex);
  const view = useTwinStore((s) => s.simulation.view);
  const frame = run ? effectiveFrame(run, frameIndex, view) : 0;
  const states = useMemo(() => computeVisualStates(assets, run, frame), [assets, run, frame]);
  return { states, frame, run };
}
