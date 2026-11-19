"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { WhatsappLink } from "@/components/providers/WhatsappProvider";
import { browserSessionKey } from "@/lib/activity/client";
import { cn } from "@/lib/utils/cn";

interface AssistLink {
  label: string;
  href: string;
}

interface AssistMessage {
  role: "user" | "assistant";
  text: string;
  links?: AssistLink[];
  handoff?: "none" | "whatsapp" | "contact";
}

const SUGGESTIONS = [
  "3 bed condos in Vaughan",
  "Pre-construction near Toronto",
  "Show market trends",
  "Assignments for sale",
] as const;

/**
 * Floating site assistant. Answers come from the backend, which only sees
 * listings, pre-construction, assignments and this site's own pages.
 */
export function AiAssistant() {
  const titleId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistMessage[]>([]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const node = listRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [messages, pending, open]);

  async function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || pending) return;
    setDraft("");
    setError(null);
    setMessages((current) => [...current, { role: "user", text: trimmed }]);
    setPending(true);
    try {
      const response = await fetch("/api/ai-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, session_key: browserSessionKey() }),
      });
      const payload = (await response.json()) as {
        answer?: string;
        links?: AssistLink[];
        handoff?: AssistMessage["handoff"];
        error?: string;
      };
      if (!response.ok || !payload.answer) {
        setError(payload.error || "The assistant is unavailable right now.");
        return;
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: payload.answer!,
          links: payload.links ?? [],
          handoff: payload.handoff ?? "none",
        },
      ]);
    } catch {
      setError("The assistant is unavailable right now.");
    } finally {
      setPending(false);
    }
  }

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    await sendQuestion(draft);
  }

  function onComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(draft);
    }
  }

  return (
    <div className="pointer-events-none fixed bottom-6 right-4 z-[60] flex flex-col items-end gap-3 sm:right-6">
      {open && (
        <section
          role="dialog"
          aria-labelledby={titleId}
          className="pointer-events-auto flex h-[min(34rem,calc(100dvh-7.5rem))] w-[min(23.5rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-[0_24px_64px_-16px_rgba(21,35,56,0.45)] ring-1 ring-navy/10 animate-in fade-in zoom-in-95 slide-in-from-bottom-3 duration-200"
        >
          <header className="relative overflow-hidden bg-gradient-to-br from-navy via-navy to-navy-soft px-4 pb-3.5 pt-3.5 text-white">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gold/20 blur-2xl"
            />
            <div className="relative flex items-start gap-3">
              <span className="relative mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <AssistantMark className="h-5 w-5 text-gold" />
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-navy bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
                  HomeAtlas assistant
                </h2>
                <p className="mt-0.5 text-[12px] text-white/75">
                  Online · listings, projects & pages
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="grid h-8 w-8 place-items-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[linear-gradient(180deg,#f8f7f4_0%,#ffffff_40%)] px-3.5 py-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-3 shadow-sm">
                  <p className="text-[13px] leading-relaxed text-ink">
                    Hi — ask where to find a listing, a pre-construction project,
                    market trends, or an assignment.
                  </p>
                </div>
                <div>
                  <p className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    Try asking
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        disabled={pending}
                        onClick={() => void sendQuestion(suggestion)}
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-[12px] font-medium text-ink-soft shadow-sm transition hover:border-navy/30 hover:bg-navy-tint hover:text-navy disabled:opacity-50"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[88%] px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm",
                    message.role === "user"
                      ? "rounded-2xl rounded-br-md bg-navy text-white"
                      : "rounded-2xl rounded-bl-md border border-line bg-surface text-ink",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.text}</p>
                  {message.links && message.links.length > 0 && (
                    <ul className="mt-2.5 space-y-1.5 border-t border-line/80 pt-2.5">
                      {message.links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-navy transition hover:text-navy-soft"
                          >
                            <span aria-hidden>→</span>
                            {link.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  {message.handoff === "whatsapp" && (
                    <WhatsappLink
                      message="Hi, I was using the HomeAtlas assistant and would like to talk to someone."
                      className="mt-2.5 inline-flex rounded-full bg-[#25d366]/10 px-3 py-1.5 text-[12px] font-semibold text-[#128c7e] transition hover:bg-[#25d366]/20"
                    >
                      Continue on WhatsApp
                    </WhatsappLink>
                  )}
                  {message.handoff === "contact" && (
                    <Link
                      href="/market-trends"
                      className="mt-2.5 inline-flex rounded-full bg-navy-tint px-3 py-1.5 text-[12px] font-semibold text-navy transition hover:bg-navy/10"
                    >
                      Contact an agent
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3 shadow-sm">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle [animation-delay:-0.2s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle [animation-delay:-0.1s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-subtle" />
                  <span className="sr-only">Looking that up</span>
                </div>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-negative/20 bg-negative-soft px-3 py-2 text-[12px] text-negative"
              >
                {error}
              </p>
            )}
          </div>

          <form
            onSubmit={ask}
            className="border-t border-line bg-surface p-3"
          >
            <label htmlFor="assistant-question" className="sr-only">
              Your question
            </label>
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface-alt/80 p-1.5 shadow-inner transition focus-within:border-navy/40 focus-within:bg-surface focus-within:ring-2 focus-within:ring-navy/10">
              <textarea
                ref={inputRef}
                id="assistant-question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onComposerKeyDown}
                rows={1}
                maxLength={500}
                placeholder="Ask about homes, projects…"
                className="max-h-28 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2.5 py-2 text-[13px] text-ink outline-none placeholder:text-ink-subtle"
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Send message"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-white transition hover:bg-navy-deep disabled:cursor-not-allowed disabled:bg-navy/35"
              >
                {pending ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <SendIcon className="h-4 w-4" />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[10px] text-ink-subtle">
              Enter to send · Shift+Enter for a new line
            </p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={open ? "Hide assistant" : "Ask HomeAtlas"}
        className={cn(
          "pointer-events-auto group inline-flex items-center gap-2.5 rounded-full bg-navy pl-2 pr-4 py-2 text-white shadow-[0_12px_32px_-8px_rgba(21,35,56,0.55)] transition hover:bg-navy-deep hover:shadow-[0_16px_40px_-8px_rgba(21,35,56,0.65)]",
          open && "pr-3",
        )}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 transition group-hover:bg-white/15">
          {open ? <CloseIcon className="h-4 w-4" /> : <AssistantMark className="h-[18px] w-[18px] text-gold" />}
        </span>
        <span className="text-[13px] font-semibold tracking-tight">
          {open ? "Close" : "Ask HomeAtlas"}
        </span>
      </button>
    </div>
  );
}

function AssistantMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 3.5 13.8 8.7 19 10.5 13.8 12.3 12 17.5 10.2 12.3 5 10.5 10.2 8.7 12 3.5Z"
        fill="currentColor"
      />
      <path
        d="M18.2 14.2 19 16.4 21.2 17.2 19 18 18.2 20.2 17.4 18 15.2 17.2 17.4 16.4 18.2 14.2Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 12h12M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6 6l12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M20 12a8 8 0 0 0-8-8"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
