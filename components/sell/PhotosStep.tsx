"use client";

import { FileDropzone, type DropzoneItem } from "@/components/ui/FileDropzone";
import type { SubmissionMedia, SubmissionMediaType } from "@/lib/api/listingSubmissions";
import { ACCEPTED_TYPES, RAW_MAX_BYTES } from "@/lib/utils/imageResize";
import { cn } from "@/lib/utils/cn";
import type { StepProps } from "@/components/sell/form";
import type { MediaQueue } from "@/components/sell/useMediaQueue";

/** Backend cap per submission, including files uploaded in an earlier session. */
export const MAX_SUBMISSION_FILES = 25;

const KIND_LABELS: Record<SubmissionMediaType, string> = {
  photo: "Photo",
  floor_plan: "Floor plan",
  supporting_document: "Document",
};

/** Step 3 — media and the two declarations the backend requires to submit. */
export function PhotosStep({
  form,
  errors,
  set,
  queue,
  existing,
  uploading,
}: StepProps & {
  queue: MediaQueue;
  existing: SubmissionMedia[];
  uploading: boolean;
}) {
  const room = Math.max(0, MAX_SUBMISSION_FILES - existing.length);

  return (
    <div className="space-y-6">
      {existing.length > 0 && (
        <div>
          <p className="text-small font-medium text-ink">Already uploaded ({existing.length})</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {existing.map((media) => (
              <li
                key={media.id}
                className="relative h-16 w-16 overflow-hidden rounded-control border border-line bg-surface-alt"
                title={KIND_LABELS[media.media_type]}
              >
                {media.file_url && !/\.pdf($|\?)/i.test(media.file_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- storage URLs vary (Cloudinary / local)
                  <img src={media.file_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-eyebrow text-ink-muted">PDF</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <FileDropzone
        label="Add photos and floor plans"
        hint="JPEG, PNG, WebP or PDF. Large photos are resized automatically; PDFs up to 4 MB."
        accept={ACCEPTED_TYPES}
        maxBytes={RAW_MAX_BYTES}
        maxFiles={room}
        items={queue.items}
        onAdd={queue.add}
        onRemove={queue.remove}
        disabled={uploading}
        renderItemExtra={(item) => (
          <KindSelect item={item} disabled={uploading} onChange={(kind) => queue.setKind(item.id, kind)} />
        )}
      />

      {queue.rejections.length > 0 && (
        <ul className="space-y-1 rounded-control bg-negative-soft px-4 py-3 text-caption text-negative" role="alert">
          {queue.rejections.map((rejection, index) => (
            <li key={`${rejection.name}-${index}`}>
              <span className="font-medium">{rejection.name}</span>: {rejection.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 rounded-surface border border-line bg-surface-alt p-5">
        {form.purpose === "assignment" && (
          <Consent
            id="listing-consent-to-advertise"
            checked={form.consent_to_advertise}
            onChange={(value) => set("consent_to_advertise", value)}
            error={errors.consent_to_advertise}
          >
            I consent to HomeAtlas advertising this assignment publicly once it is approved.
          </Consent>
        )}
        <Consent
          id="listing-ownership-confirmed"
          checked={form.ownership_confirmed}
          onChange={(value) => set("ownership_confirmed", value)}
          error={errors.ownership_confirmed}
        >
          I own this property, or I am authorized by the owner (or builder, for an assignment) to
          list it.
        </Consent>
        <Consent
          id="listing-publication-consent"
          checked={form.publication_consent}
          onChange={(value) => set("publication_consent", value)}
          error={errors.publication_consent}
        >
          I consent to HomeAtlas reviewing this submission and publishing the approved details and
          photos. My contact details stay private.
        </Consent>
      </div>
    </div>
  );
}

function KindSelect({
  item,
  disabled,
  onChange,
}: {
  item: DropzoneItem;
  disabled: boolean;
  onChange: (kind: SubmissionMediaType) => void;
}) {
  const pdf = item.file.type === "application/pdf";
  // A PDF can't render as a gallery photo, so it is a plan or a document.
  const kinds: SubmissionMediaType[] = pdf ? ["floor_plan", "supporting_document"] : ["photo", "floor_plan"];
  return (
    <select
      aria-label={`Type for ${item.file.name}`}
      value={item.kind ?? kinds[0]}
      disabled={disabled || item.status === "done" || item.status === "uploading"}
      onChange={(event) => onChange(event.target.value as SubmissionMediaType)}
      className={cn(
        "h-9 shrink-0 rounded-control border border-line bg-surface px-2 text-caption text-ink",
        "focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10 disabled:opacity-60",
      )}
    >
      {kinds.map((kind) => (
        <option key={kind} value={kind}>
          {KIND_LABELS[kind]}
        </option>
      ))}
    </select>
  );
}

function Consent({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-small text-ink">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-4 w-4 shrink-0 accent-navy"
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 pl-7 text-caption text-negative" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
