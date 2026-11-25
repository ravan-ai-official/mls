"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { useAuth } from "@/components/providers/AuthProvider";
import { useNote, useSaveNote } from "@/lib/queries/notes";
import { formatDate } from "@/lib/utils/format";

/**
 * Private note on a listing — the "Notes" tab in the reference's Watched menu.
 * Backed by mls-v2 `property-notes/` (GET/PUT, authenticated, keyed by listing).
 */
export function PropertyNote({ listingKey }: { listingKey: string }) {
  const { user, openAuth } = useAuth();
  // Shared with the Watched Notes tab: saving here updates that list too.
  const note = useNote(listingKey);
  const saveNote = useSaveNote(listingKey);
  // null = untouched, so the field follows the cache until the user types.
  const [draft, setDraft] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const body = draft ?? note.data?.body ?? "";
  const savedAt = note.data?.updatedAt ?? null;
  const status = saveNote.isPending
    ? "saving"
    : saveNote.isError
      ? "error"
      : justSaved
        ? "saved"
        : "idle";

  function save() {
    setJustSaved(false);
    saveNote.mutate(body, {
      onSuccess: () => {
        setDraft(null);
        setJustSaved(true);
      },
    });
  }

  if (!user) {
    return (
      <section className="mt-10 rounded-surface border border-line bg-surface p-5">
        <h2 className="text-h3 text-ink">Notes</h2>
        <p className="mt-1.5 text-small text-ink-muted">
          Sign in to keep private notes on this home.
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => openAuth("login")}>
          Sign in
        </Button>
      </section>
    );
  }

  return (
    <section className="mt-10 rounded-surface border border-line bg-surface p-5">
      <h2 className="text-h3 text-ink">Notes</h2>
      <p className="mt-1 text-caption text-ink-muted">
        Private to your account — never shown to anyone else.
      </p>

      <label htmlFor={`note-${listingKey}`} className="sr-only">
        Private note about this property
      </label>
      <Textarea
        id={`note-${listingKey}`}
        className="mt-3"
        value={body}
        maxLength={20000}
        placeholder="Parking is tight, but the kitchen was renovated last year…"
        onChange={(event) => {
          setDraft(event.target.value);
          setJustSaved(false);
          if (saveNote.isError) saveNote.reset();
        }}
      />

      <div className="mt-3 flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={save}
          loading={status === "saving"}
          disabled={status === "saving"}
        >
          Save note
        </Button>
        <span className="text-caption text-ink-muted" role="status">
          {status === "saved" && "Saved"}
          {status === "error" && (
            <span className="text-negative">Could not save. Try again.</span>
          )}
          {status === "idle" && savedAt && `Last saved ${formatDate(savedAt)}`}
        </span>
      </div>
    </section>
  );
}
