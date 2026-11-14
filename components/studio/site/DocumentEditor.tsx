"use client";

import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StudioAlert, StudioPage } from "@/components/studio/chrome";
import { Button } from "@/components/ui/Button";
import { SiteEditorSkeleton } from "@/components/studio/StudioSkeletons";
import { PreviewFrame } from "@/components/studio/site/PreviewFrame";
import { useUserKeys } from "@/components/providers/AuthProvider";
import { fetchJson, HttpError } from "@/lib/queries/fetcher";
import { qk } from "@/lib/queries/keys";
import { useSiteDocument, useSiteRevisions, type SiteRecordBody } from "@/lib/queries/siteStudio";
import { fillSiteDefaults } from "@/lib/site/fillDefaults";
import type { SiteKey } from "@/lib/site/types";
import type { FieldErrors } from "@/lib/site/validate";

export function DocumentEditor({
  siteKey,
  title,
  lede,
  validate,
  previewOf,
  children,
  skeleton = "panels",
}: {
  siteKey: SiteKey;
  title: string;
  lede: string;
  validate: (draft: unknown) => FieldErrors;
  previewOf: (draft: unknown, extra: Record<string, unknown>) => unknown;
  skeleton?: "homepage" | "panels";
  children: (
    draft: unknown,
    update: (next: unknown) => void,
    errors: FieldErrors,
    setPreviewExtra: (extra: Record<string, unknown>) => void,
    openPreview: () => void,
  ) => ReactNode;
}) {
  const keys = useUserKeys();
  const queryClient = useQueryClient();
  const cacheKeys = keys ?? qk.me(-1);
  const documentQuery = useSiteDocument(siteKey);
  const revisionQuery = useSiteRevisions(siteKey);
  const record = documentQuery.data ?? null;
  const revisions = revisionQuery.data?.results ?? [];
  const [draft, setDraft] = useState<unknown>(null);
  const [recordAt, setRecordAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [previewExtra, setPreviewExtra] = useState<Record<string, unknown>>({});
  const [previewOpen, setPreviewOpen] = useState(false);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 4500);
  }

  if (record && record.updated_at !== recordAt) {
    setRecordAt(record.updated_at);
    // Older drafts may omit fields added later (e.g. hero tryPrompts). Fill
    // from defaults so the form always has something to edit.
    setDraft(fillSiteDefaults(siteKey, record.draft));
    setServerErrors({});
  }

  function remember(next: SiteRecordBody) {
    queryClient.setQueryData(cacheKeys.siteDocument(siteKey), next);
    if (keys) void queryClient.invalidateQueries({ queryKey: keys.siteRevisions(siteKey) });
  }

  const errors = draft ? { ...validate(draft), ...serverErrors } : {};
  const invalid = Object.keys(errors).length > 0;
  const unsaved = JSON.stringify(draft) !== JSON.stringify(record?.draft);

  async function send(path: string, body: unknown, fallback: string, okMessage?: string) {
    setBusy(true);
    setBusyLabel(okMessage?.startsWith("Published") ? "Publishing…" : "Working…");
    setError(null);
    setNotice(null);
    setServerErrors({});
    try {
      const next = await fetchJson<SiteRecordBody>(path, { method: "POST", body, fallback });
      remember(next);
      if (okMessage) flash(okMessage);
    } catch (caught) {
      if (caught instanceof HttpError && caught.status === 409) {
        setError("Someone else saved a newer draft. Reload the page to see their changes.");
      } else if (caught instanceof HttpError) {
        setServerErrors(caught.fieldErrors);
        setError(caught.message);
      } else {
        setError(caught instanceof Error ? caught.message : fallback);
      }
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function save(options: { quiet?: boolean } = {}): Promise<SiteRecordBody | null> {
    if (!record) return null;
    setBusy(true);
    setBusyLabel("Saving draft…");
    setError(null);
    if (!options.quiet) setNotice(null);
    setServerErrors({});
    try {
      const next = await fetchJson<SiteRecordBody>(`/api/studio/site/${siteKey}`, {
        method: "PUT",
        body: { draft, expected_updated_at: record.updated_at },
        fallback: "Could not save the draft.",
      });
      queryClient.setQueryData(cacheKeys.siteDocument(siteKey), next);
      if (!options.quiet) flash("Draft saved.");
      return next;
    } catch (caught) {
      if (caught instanceof HttpError) {
        setServerErrors(caught.fieldErrors);
        setError(caught.status === 409 ? "Someone else saved a newer draft. Reload the page to see their changes." : caught.message);
      } else {
        setError("Could not save the draft.");
      }
      return null;
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function publish() {
    if (!record) return;
    const current = unsaved ? await save({ quiet: true }) : record;
    if (!current) return;
    await send(
      `/api/studio/site/${siteKey}/publish`,
      { expected_updated_at: current.updated_at },
      "Could not publish.",
      "Published. Visitors now see this version.",
    );
  }

  if (documentQuery.isPending || (record && draft === null)) {
    return <SiteEditorSkeleton homepage={skeleton === "homepage"} />;
  }
  if (!record) {
    return (
      <p role="alert" className="rounded-surface border border-negative/30 bg-surface p-5 text-body">
        {documentQuery.error instanceof Error ? documentQuery.error.message : "Could not load this page."}
      </p>
    );
  }

  const status = unsaved
    ? "You have changes that are not saved yet."
    : record.dirty
      ? "Draft saved. Visitors still see the last published version."
      : "This matches what visitors see right now.";

  return (
    <div className="space-y-6">
      <StudioPage
        title={title}
        description={lede}
        toolbar={
          <>
            {busyLabel ? (
              <span className="text-caption text-ink-muted" aria-live="polite">
                {busyLabel}
              </span>
            ) : null}
            <Button type="button" variant="secondary" size="sm" aria-haspopup="dialog" aria-expanded={previewOpen} disabled={busy} onClick={() => setPreviewOpen(true)}>
              Open preview
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={busy || !unsaved} onClick={() => void save()}>
              {busyLabel === "Saving draft…" ? "Saving…" : "Save draft"}
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={busy || invalid} onClick={() => void publish()}>
              {busyLabel === "Publishing…" ? "Publishing…" : "Publish to the site"}
            </Button>
          </>
        }
        note={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`flex items-center gap-2 text-small ${unsaved ? "font-medium text-ink" : "text-ink-muted"}`}>
            <span
              className={`h-1.5 w-1.5 rounded-full ${unsaved ? "bg-gold-deep" : record.dirty ? "bg-navy" : "bg-positive"}`}
              aria-hidden="true"
            />
            {status}
            {invalid ? " Fix the notes in red before you publish." : ""}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy || (!unsaved && !record.dirty)}
            onClick={() =>
              void send(
                `/api/studio/site/${siteKey}/discard`,
                { expected_updated_at: record.updated_at },
                "Could not discard the draft.",
                "Draft discarded.",
              )
            }
          >
            Discard draft
          </Button>
        </div>
        }
      />
      <div aria-live="polite" className="space-y-3">
        {notice ? (
          <p className="rounded-control border border-positive/30 bg-positive-soft px-3.5 py-2.5 text-small text-positive">
            {notice}
          </p>
        ) : null}
        {error ? <StudioAlert>{error}</StudioAlert> : null}
      </div>
      <div className={busy ? "pointer-events-none min-w-0 opacity-60" : "min-w-0"}>
        {children(draft, setDraft, errors, setPreviewExtra, () => setPreviewOpen(true))}
      </div>
      <PreviewFrame payload={previewOf(draft, previewExtra)} open={previewOpen} onClose={() => setPreviewOpen(false)} />
      {revisions.length > 0 && (
        <section className="border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-h3 text-ink">Bring back an older version</h2>
          <p className="mt-1 text-small text-ink-muted">This copies that version into your draft. Visitors do not see it until you publish.</p>
          <ul className="mt-4 divide-y divide-line">
            {revisions.map((revision) => (
              <li key={revision.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-small">
                <span className="text-ink">
                  {new Date(revision.created_at).toLocaleString()}
                  {revision.created_by ? <span className="text-ink-muted"> · {revision.created_by}</span> : null}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() => void send(`/api/studio/site/${siteKey}/restore`, { revision_id: revision.id, expected_updated_at: record.updated_at }, "Could not restore that version.")}
                >
                  Use this version
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
