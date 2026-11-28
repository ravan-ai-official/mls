"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

/**
 * Confirmation and single-field prompts, built on `Modal`.
 *
 * These replace `window.confirm` / `window.prompt` and hand-rolled overlays:
 * native dialogs can't be styled, block the whole tab, and are suppressed by
 * some browsers after a few uses; the hand-rolled ones skipped scroll lock,
 * Escape and focus trapping. Using these everywhere keeps every confirmation
 * looking and behaving the same.
 */

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  busy = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  /** The consequence, in plain words. Name the thing being acted on. */
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Extract<ButtonVariant, "primary" | "danger">;
  /** While true the dialog can't be dismissed and the confirm button spins. */
  busy?: boolean;
  error?: string | null;
}) {
  const close = () => {
    if (!busy) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            size="sm"
            onClick={onConfirm}
            loading={busy}
            // Destructive actions start on Cancel, so a stray Enter is harmless.
            data-autofocus={tone === "danger" ? undefined : true}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children && <div className="text-small text-ink-muted">{children}</div>}
      {error && (
        <p role="alert" className="mt-3 rounded-control border border-negative/30 bg-negative-soft/40 px-3 py-2 text-caption text-ink">
          {error}
        </p>
      )}
    </Modal>
  );
}

export function PromptDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  label,
  placeholder,
  initialValue = "",
  submitLabel = "Save",
  type = "text",
  busy = false,
  error,
  validate,
  allowEmpty = false,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  type?: "text" | "url" | "email";
  busy?: boolean;
  error?: string | null;
  /** Returns a message to block submit, or null when the value is fine. */
  validate?: (value: string) => string | null;
  /** When true, empty submit is allowed (e.g. decorative image alt=""). */
  allowEmpty?: boolean;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} description={description} size="sm">
      {/* Remounted per open so the field starts from `initialValue` each time. */}
      {open && (
        <PromptForm
          label={label}
          placeholder={placeholder}
          initialValue={initialValue}
          submitLabel={submitLabel}
          type={type}
          busy={busy}
          error={error}
          validate={validate}
          allowEmpty={allowEmpty}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      )}
    </Modal>
  );
}

function PromptForm({
  label,
  placeholder,
  initialValue,
  submitLabel,
  type,
  busy,
  error,
  validate,
  allowEmpty,
  onCancel,
  onSubmit,
}: {
  label: string;
  placeholder?: string;
  initialValue: string;
  submitLabel: string;
  type: "text" | "url" | "email";
  busy: boolean;
  error?: string | null;
  validate?: (value: string) => string | null;
  allowEmpty: boolean;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const inputId = useId();
  const [value, setValue] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed && !allowEmpty) return;
    const problem = validate?.(trimmed) ?? null;
    setLocalError(problem);
    if (!problem) onSubmit(trimmed);
  }

  const shown = localError ?? error;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor={inputId} className="mb-1 block text-caption font-medium text-ink">
          {label}
        </label>
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setLocalError(null);
          }}
          placeholder={placeholder}
          data-autofocus
          aria-invalid={shown ? true : undefined}
          className="w-full rounded-control border border-line bg-surface px-3 py-2 text-small text-ink focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10"
        />
        {shown && (
          <p role="alert" className="mt-1.5 text-caption text-negative">
            {shown}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={busy} disabled={!allowEmpty && !value.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
