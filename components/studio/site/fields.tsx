"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";

export function TextControl({
  label,
  value,
  max,
  error,
  onChange,
  onBlur,
  hint,
  multiline,
}: {
  label: string;
  value: string;
  max: number;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: string;
  multiline?: boolean;
}) {
  const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const over = value.length > max;
  return (
    <Field label={label} htmlFor={id} hint={hint || `${value.length}/${max}`} error={error || (over ? `Keep this to ${max} characters.` : null)}>
      {multiline ? (
        <Textarea
          id={id}
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={over || !!error}
        />
      ) : (
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={over || !!error}
        />
      )}
    </Field>
  );
}

export function ImageControl({
  label,
  url,
  alt,
  role,
  error,
  altError,
  onChange,
}: {
  label: string;
  url: string;
  alt: string;
  role: "hero" | "section";
  error?: string;
  altError?: string;
  onChange: (next: { url: string; alt: string }) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const min = role === "hero" ? [1600, 900] : [800, 450];

  async function upload(file: File) {
    setUploadError(null);
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Images must be 8 MB or smaller.");
      return;
    }
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) {
      setUploadError("Upload a JPEG, PNG, or WebP image.");
      return;
    }
    if (bitmap.width < min[0] || bitmap.height < min[1]) {
      setUploadError(`Use an image at least ${min[0]}×${min[1]} pixels so it stays sharp.`);
      bitmap.close();
      return;
    }
    bitmap.close();
    const body = new FormData();
    body.append("file", file);
    body.append("role", role);
    setUploading(true);
    try {
      const response = await fetch("/api/studio/site/media", { method: "POST", body });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setUploadError(typeof data?.error === "string" ? data.error : "Could not upload that image.");
        return;
      }
      onChange({ url: data.url, alt });
    } catch {
      setUploadError("Could not upload that image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <Field label={label} htmlFor={`${label}-file`} hint={`At least ${min[0]}×${min[1]} pixels, 8 MB max.`} error={error || uploadError}>
        <Input id={`${label}-url`} value={url} onChange={(event) => onChange({ url: event.target.value, alt })} />
        <input
          id={`${label}-file`}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="mt-2 block text-caption text-ink-muted"
          disabled={uploading}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </Field>
      <TextControl label="Alt text" value={alt} max={140} error={altError} onChange={(next) => onChange({ url, alt: next })} hint="Required. Describe the photo for people who cannot see it." />
      {uploading && <p className="text-caption text-ink-muted">Uploading…</p>}
    </div>
  );
}
