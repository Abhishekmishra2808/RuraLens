/**
 * Map markers: SVG pins using the same lucide icons as the panels, cached by style key.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ASSET_TYPE_META, STATE_META } from '../twinVisuals';
import type { AssetVisualState, TwinAssetType } from '../../../types/twin';

export const MARKER_WIDTH = 44;
export const MARKER_HEIGHT = 56;
/** Billboards are sized in CSS pixels, so rasterize at 2x to stay sharp on HiDPI screens. */
const MARKER_RASTER_SCALE = 2;

const markerCache = new Map<string, string>();
const glyphCache = new Map<TwinAssetType, string>();
const clusterCache = new Map<string, HTMLCanvasElement>();

function glyph(type: TwinAssetType): string {
  let svg = glyphCache.get(type);
  if (!svg) {
    svg = renderToStaticMarkup(
      createElement(ASSET_TYPE_META[type].icon, { size: 16, color: '#ffffff', strokeWidth: 2.25, x: 10, y: 10 }),
    );
    glyphCache.set(type, svg);
  }
  return svg;
}

/** Returns an SVG data URL; the pin tip is the exact asset location (bottom centre). */
export function markerIcon(type: TwinAssetType, state: AssetVisualState, selected: boolean): string {
  const key = `${type}|${state}|${selected ? 1 : 0}`;
  const hit = markerCache.get(key);
  if (hit) return hit;

  const color = STATE_META[state].color;
  const failed = state === 'failed' || state === 'predicted-failure';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MARKER_WIDTH * MARKER_RASTER_SCALE}" height="${MARKER_HEIGHT * MARKER_RASTER_SCALE}" viewBox="0 0 36 46">
  <defs><filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.8" stdDeviation="0.9" flood-color="#000000" flood-opacity="0.45"/></filter></defs>
  <g filter="url(#s)">
  ${selected ? '<circle cx="18" cy="18" r="17.5" fill="#18181b"/>' : ''}
  <path d="M12.5 31 L18 44 L23.5 31 Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="18" cy="18" r="${selected ? 15 : 14}" fill="${color}" stroke="#ffffff" stroke-width="2"/>
  </g>
  ${glyph(type)}
  ${
    failed
      ? '<circle cx="29" cy="7" r="6" fill="#ffffff"/><path d="M26.5 4.5 L31.5 9.5 M31.5 4.5 L26.5 9.5" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round"/>'
      : ''
  }
</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  markerCache.set(key, url);
  return url;
}

export function clusterIcon(count: number, color: string): HTMLCanvasElement {
  const key = `${count}|${color}`;
  const hit = clusterCache.get(key);
  if (hit) return hit;

  const scale = 2;
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size * scale;
  canvas.height = size * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = color;
  ctx.stroke();

  ctx.fillStyle = '#18181b';
  ctx.font = '600 14px Geist, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(count), size / 2, size / 2 + 1);

  clusterCache.set(key, canvas);
  return canvas;
}
