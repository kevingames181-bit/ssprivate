/**
 * FixMapResize — production Leaflet black-map fix component.
 *
 * Solves all known causes of Leaflet rendering black:
 *  1. Tab switching hides the container → tiles never load
 *  2. Parent container has 0-height at mount time
 *  3. CSS transitions delay layout hydration
 *  4. React Strict Mode double-mount
 *  5. Tile loading race conditions on first render
 *
 * Usage: render as a child of <MapContainer>
 *   <MapContainer ...>
 *     <FixMapResize visible={activeTab === 'movement'} />
 *   </MapContainer>
 */

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface FixMapResizeProps {
  /** Pass true when the tab/panel containing this map becomes visible */
  visible?: boolean;
  /** Extra delay in ms after visibility change before invalidating (default 120) */
  delay?: number;
}

export function FixMapResize({ visible = true, delay = 120 }: FixMapResizeProps) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  function invalidate() {
    try {
      map.invalidateSize({ animate: false, pan: false });
    } catch {
      // Map may have been removed from DOM — safe to ignore
    }
  }

  // ── On mount: immediate + delayed invalidation ────────────────────────────
  useEffect(() => {
    // Immediate — catches cases where container already has size
    invalidate();

    // Delayed — catches CSS transition / layout hydration delays
    timerRef.current = setTimeout(invalidate, delay);

    // Second pass for slow tile servers / heavy CSS
    const t2 = setTimeout(invalidate, delay * 3);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── On visibility change (tab switching) ─────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    // Invalidate immediately when tab becomes visible
    invalidate();

    timerRef.current = setTimeout(invalidate, delay);
    const t2 = setTimeout(invalidate, delay * 4);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── ResizeObserver: invalidate whenever container changes size ────────────
  useEffect(() => {
    const container = map.getContainer();
    if (!container || typeof ResizeObserver === 'undefined') return;

    observerRef.current = new ResizeObserver(() => {
      invalidate();
    });
    observerRef.current.observe(container);

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // ── document visibility (browser tab switching) ───────────────────────────
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setTimeout(invalidate, 50);
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
