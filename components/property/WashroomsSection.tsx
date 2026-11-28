"use client";

import { useEffect, useState } from "react";
import type { PropertyWashroom, PropertyWashroomInfo } from "@/lib/types/domain";
import {
  isRoomUnits,
  readRoomUnits,
  ROOM_UNITS_EVENT,
  roomDimensionForUnits,
  type RoomUnits,
} from "@/lib/property/roomUnits";

/**
 * Washroom Info — prefer REALM `washroom_info[]` (count / pieces / level).
 * Fallback: detailed washrooms[] / bath room rows with dimensions.
 */
export function WashroomsSection({
  washroomInfo,
  washrooms,
  bathroomsTotal,
  bathroomsFull,
  bathroomsPartial,
}: {
  washroomInfo: PropertyWashroomInfo[];
  washrooms: PropertyWashroom[];
  bathroomsTotal: number | null;
  bathroomsFull: number | null;
  bathroomsPartial: number | null;
}) {
  const [units, setUnits] = useState<RoomUnits>("m");
  const useSummary = washroomInfo.length > 0;

  useEffect(() => {
    setUnits(readRoomUnits());
    const onUnits = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (isRoomUnits(detail)) setUnits(detail);
      else setUnits(readRoomUnits());
    };
    window.addEventListener(ROOM_UNITS_EVENT, onUnits);
    return () => window.removeEventListener(ROOM_UNITS_EVENT, onUnits);
  }, []);

  const summary = formatBathSummary(bathroomsTotal, bathroomsFull, bathroomsPartial);
  if (!useSummary && washrooms.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-line">
      <div className="border-b border-line bg-surface-alt px-4 py-4 sm:px-6">
        <h2 className="text-[18px] font-semibold text-ink">Washroom Info</h2>
        {summary ? (
          <p className="mt-1 text-[13px] text-ink-muted">{summary}</p>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        {useSummary ? (
          <table className="w-full min-w-[360px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  # of Washrooms
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Pieces
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Level
                </th>
              </tr>
            </thead>
            <tbody>
              {washroomInfo.map((row, index) => (
                <tr
                  key={`${row.level}-${row.pieces}-${index}`}
                  className="border-b border-line-soft"
                >
                  <td className="px-4 py-3 font-medium text-ink sm:px-6">{row.count}</td>
                  <td className="px-4 py-3 text-ink-muted sm:px-6">{row.pieces ?? ""}</td>
                  <td className="px-4 py-3 text-ink-muted sm:px-6">{row.level ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[480px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-ink-muted">
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Type
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Level
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Pieces
                </th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Dimensions
                </th>
              </tr>
            </thead>
            <tbody>
              {washrooms.map((row, index) => (
                <tr
                  key={`${row.type}-${row.level}-${index}`}
                  className="border-b border-line-soft"
                >
                  <td className="px-4 py-3 font-medium text-ink sm:px-6">{row.type}</td>
                  <td className="px-4 py-3 text-ink-muted sm:px-6">{row.level ?? ""}</td>
                  <td className="px-4 py-3 text-ink-muted sm:px-6">{row.description ?? ""}</td>
                  <td className="px-4 py-3 text-ink-muted sm:px-6">
                    {roomDimensionForUnits(row, units)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function formatBathSummary(
  total: number | null,
  full: number | null,
  partial: number | null,
): string | null {
  const parts: string[] = [];
  if (total != null) parts.push(`${total} total`);
  if (full != null) parts.push(`${full} full`);
  if (partial != null) parts.push(`${partial} partial`);
  return parts.length ? parts.join(" · ") : null;
}
