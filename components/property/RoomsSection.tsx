"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import type { PropertyRoom } from "@/lib/types/domain";
import {
  readRoomUnits,
  roomDimensionForUnits,
  saveRoomUnits,
  type RoomUnits,
} from "@/lib/property/roomUnits";

/**
 * Rooms table with an [m] / [ft] segmented control.
 * Preference lives in sessionStorage (`room-units-v1`) so Back keeps the choice.
 */
export function RoomsSection({ rooms }: { rooms: PropertyRoom[] }) {
  const [units, setUnits] = useState<RoomUnits>("m");
  const showNotes = rooms.some((room) => Boolean(room.notes?.trim()));

  useEffect(() => {
    setUnits(readRoomUnits());
  }, []);

  function selectUnits(next: RoomUnits) {
    setUnits(next);
    saveRoomUnits(next);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-alt px-4 py-4 sm:px-6">
        <h2 className="text-[18px] font-semibold text-ink">Rooms</h2>
        <div
          role="group"
          aria-label="Room dimension units"
          className="flex items-center overflow-hidden rounded-control border border-line"
        >
          <UnitOption label="Metres" active={units === "m"} onClick={() => selectUnits("m")}>
            m
          </UnitOption>
          <span className="h-6 w-px bg-line" aria-hidden="true" />
          <UnitOption label="Feet" active={units === "ft"} onClick={() => selectUnits("ft")}>
            ft
          </UnitOption>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left text-ink-muted">
              <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                Room
              </th>
              <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                Level
              </th>
              <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                Dimensions
              </th>
              {showNotes ? (
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">
                  Notes
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, index) => (
              <tr key={`${room.name}-${index}`} className="border-b border-line-soft">
                <td className="px-4 py-3 font-medium text-ink sm:px-6">{room.name}</td>
                <td className="px-4 py-3 text-ink-muted sm:px-6">{room.level ?? ""}</td>
                <td className="px-4 py-3 text-ink-muted sm:px-6">
                  {roomDimensionForUnits(room, units)}
                </td>
                {showNotes ? (
                  <td className="px-4 py-3 text-ink-muted sm:px-6">{room.notes ?? ""}</td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnitOption({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-8 min-w-9 items-center justify-center px-2.5 text-[12px] font-semibold uppercase tracking-wide transition-colors",
        active ? "bg-ink text-white" : "bg-surface text-ink-muted hover:bg-surface-alt hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
