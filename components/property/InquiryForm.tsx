"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, TelInput, Textarea } from "@/components/ui/Field";
import { useAuth } from "@/components/providers/AuthProvider";
import { USE_ASSIGNMENT_SAMPLES } from "@/lib/demo/assignments";
import { useSubmitInquiry } from "@/lib/queries/inquiries";

/**
 * Showing request / listing enquiry.
 *
 * Posts to mls-v2 `inquiries/`. NOTE (API_GAPS G8): `PropertyInquiry` has no
 * foreign key to a listing, so the property is conveyed through `page_url` and
 * a prefilled message. An agent can still act on it, but the lead is not
 * queryable by listing — adding `listing_key` to that model is the real fix.
 */
/**
 * Copy per context. "showing" is the MLS listing default and must stay
 * unchanged; "precon" drops the MLS® number (a project has none) and asks for
 * project details rather than a viewing time.
 */
const COPY = {
  showing: {
    title: "Schedule viewing",
    hint: "Tour with a HomeAtlas agent. No obligation.",
    submit: "Schedule viewing",
    intent: "showing",
    message: (address: string, listingKey: string) =>
      `I'd like to schedule a showing for ${address} (MLS® ${listingKey}).`,
  },
  precon: {
    title: "Register interest",
    hint: "Registration and enquiry. No obligation — ask about releases, pricing and incentives.",
    submit: "Register interest",
    // The backend has no pre-con intent; the project is named in the message.
    intent: "buy",
    message: (address: string) =>
      `I'd like to register my interest in ${address}, including current pricing, available units and incentives.`,
  },
  assignment: {
    title: "Ask about this assignment",
    hint: "No obligation. An agent will reply with details and next steps.",
    submit: "Send message",
    intent: "buy",
    message: (address: string) =>
      `I'm interested in the assignment for ${address}. Please send me the details and next steps.`,
  },
  contact: {
    title: "Send a message",
    hint: "Questions about buying, selling, or a listing. No obligation.",
    submit: "Send message",
    intent: "explore",
    message: (address: string) =>
      `I'd like to get in touch with ${address} about buying or selling a home.`,
  },
} as const;

/** listing_key used for assignment leads, so they stay distinguishable from MLS® keys. */
export function assignmentLeadKey(id: number): string {
  return `ASSIGNMENT-${id}`;
}

export function InquiryForm({
  listingKey,
  address,
  mls,
  variant = "showing",
  framed = true,
}: {
  listingKey: string;
  address: string;
  /** Board MLS® number for the message text. Defaults to listingKey. */
  mls?: string;
  variant?: keyof typeof COPY;
  /** False inside a Modal, which already supplies the card chrome. */
  framed?: boolean;
}) {
  const copy = COPY[variant];
  const mlsLabel = (mls ?? listingKey).trim() || listingKey;
  const { user } = useAuth();
  const submit = useSubmitInquiry();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("name") ?? "").trim();
    const [firstName, ...rest] = fullName.split(" ");

    if (USE_ASSIGNMENT_SAMPLES && listingKey.startsWith("ASSIGNMENT-")) {
      setSent(true);
      return;
    }

    try {
      await submit.mutateAsync({
        first_name: firstName,
        last_name: rest.join(" "),
        email: String(data.get("email") ?? "").trim(),
        phone: String(data.get("phone") ?? "").trim(),
        intent: copy.intent,
        message: String(data.get("message") ?? "").trim(),
        // Buyer-search criteria. A showing already names the listing in the
        // message, so copying that address in as a "preferred location" only
        // repeats it in the CRM note.
        preferred_locations: "",
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        listing_key: listingKey,
      });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  }

  if (sent) {
    return (
      <div className="rounded-surface border border-positive/30 bg-positive-soft p-5">
        <h3 className="text-h3 text-positive">Request sent</h3>
        <p className="mt-1.5 text-small text-ink-muted">
          An agent will be in touch shortly about {address}.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={
        framed ? "space-y-4 rounded-surface border border-line bg-surface p-5 shadow-card" : "space-y-4"
      }
    >
      {framed && (
        <div>
          <h3 className="text-h3 text-ink">{copy.title}</h3>
          <p className="mt-1 text-caption text-ink-muted">{copy.hint}</p>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-control bg-negative-soft px-3 py-2 text-caption text-negative">
          {error}
        </p>
      )}

      <Field label="Name" htmlFor="inquiry-name" required>
        <Input
          id="inquiry-name"
          name="name"
          autoComplete="name"
          required
          defaultValue={user?.name ?? ""}
        />
      </Field>

      <Field label="Email" htmlFor="inquiry-email" required>
        <Input
          id="inquiry-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={user?.email ?? ""}
        />
      </Field>

      <Field label="Phone" htmlFor="inquiry-phone">
        <TelInput
          id="inquiry-phone"
          name="phone"
          autoComplete="tel"
          defaultValue={user?.phone ?? ""}
        />
      </Field>

      <Field
        label="Message"
        htmlFor="inquiry-message"
        required
        hint="At least 10 characters."
      >
        <Textarea
          id="inquiry-message"
          name="message"
          required
          minLength={10}
          defaultValue={copy.message(address, mlsLabel)}
        />
      </Field>

      <Button type="submit" variant="primary" block loading={submit.isPending}>
        {copy.submit}
      </Button>
    </form>
  );
}
