import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useTwinStore } from '../../store/twinStore';
import { CESIUM_TOKEN_STATUS } from '../../config/cesium';

const TOKEN_MESSAGES = {
  missing: 'No Cesium ion token. Terrain, imagery and 3D buildings are off. Set VITE_CESIUM_ION_TOKEN in frontend/.env.local and restart.',
  malformed: 'VITE_CESIUM_ION_TOKEN is incomplete (expected three dot-separated parts). Copy the full token and restart.',
} as const;

/** Explains why the scene is running without some 3D data sources. */
export default function SceneNotice() {
  const status = useTwinStore((s) => s.sceneStatus);
  const [dismissed, setDismissed] = useState<string | null>(null);

  let text: string | null = null;
  if (CESIUM_TOKEN_STATUS !== 'ok') {
    text = TOKEN_MESSAGES[CESIUM_TOKEN_STATUS];
  } else {
    const failed = (
      [
        ['terrain', status.terrain],
        ['imagery', status.imagery],
        ['3D buildings', status.buildings],
      ] as const
    )
      .filter(([, s]) => s === 'fallback' || s === 'error')
      .map(([label]) => label);
    if (failed.length > 0) {
      text = `Could not load ${failed.join(', ')} from Cesium ion. Check the token's asset access and allowed domains.${
        status.message ? ` (${status.message})` : ''
      }`;
    }
  }

  if (!text || dismissed === text) return null;

  return (
    <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-800">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <p className="flex-1 leading-snug">{text}</p>
      <button onClick={() => setDismissed(text)} className="rounded p-0.5 hover:bg-amber-100" aria-label="Dismiss">
        <X size={13} />
      </button>
    </div>
  );
}
