/**
 * MovementTab — exports the return rate table shown below the movement map.
 * The actual movement visualization lives in MapView (Leaflet layer).
 */

import React, { useState } from 'react';
import type { HatcheryReturnStats } from '../services/fishMigrationService';

interface ReturnTableProps {
  stats: HatcheryReturnStats[];
}

export function MovementReturnTable({ stats }: ReturnTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalReleased = stats.reduce((s, r) => s + r.totalReleased, 0);
  const totalReturned = stats.reduce((s, r) => s + r.totalReturned, 0);
  const totalNotReturnedPct = totalReleased > 0
    ? ((totalReleased - totalReturned) / totalReleased) * 100
    : 0;

  function toggle(name: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  if (stats.length === 0) return null;

  return (
    <div className="movement-return-table">
      <div className="return-table-header">
        <h3>Return Rate by Hatchery</h3>
        <span className="return-table-subtitle">% of released fish that did not return — click a row to expand by species</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Hatchery</th>
            <th>Released</th>
            <th>Returned</th>
            <th>Not Returned %</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stats.map(row => (
            <React.Fragment key={row.hatcheryName}>
              <tr className="return-row" onClick={() => toggle(row.hatcheryName)}>
                <td>
                  <span className="hatchery-dot" style={{ background: row.color }} />
                  {row.hatcheryName}
                </td>
                <td>{row.totalReleased.toLocaleString()}</td>
                <td>{row.totalReturned.toLocaleString()}</td>
                <td>
                  <div className="pct-bar-wrap">
                    <div className="pct-bar" style={{ width: `${Math.min(row.notReturnedPct, 100)}%`, background: row.color }} />
                    <span>{row.notReturnedPct.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="expand-btn">{expanded.has(row.hatcheryName) ? '▲' : '▼'}</td>
              </tr>
              {expanded.has(row.hatcheryName) && row.speciesBreakdown.map(sp => (
                <tr key={`${row.hatcheryName}-${sp.species}`} className="species-breakdown-row">
                  <td className="species-indent">↳ {sp.species}</td>
                  <td>{sp.released.toLocaleString()}</td>
                  <td>{sp.returned.toLocaleString()}</td>
                  <td>
                    <div className="pct-bar-wrap">
                      <div className="pct-bar" style={{ width: `${Math.min(sp.notReturnedPct, 100)}%`, background: row.color, opacity: 0.6 }} />
                      <span>{sp.notReturnedPct.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td />
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td>TOTAL</td>
            <td>{totalReleased.toLocaleString()}</td>
            <td>{totalReturned.toLocaleString()}</td>
            <td>
              <div className="pct-bar-wrap">
                <div className="pct-bar total-bar" style={{ width: `${Math.min(totalNotReturnedPct, 100)}%` }} />
                <span>{totalNotReturnedPct.toFixed(1)}%</span>
              </div>
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
