"use client";

export function NeighbourAlertsCta() {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById("smart-alerts")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
      className="inline-flex h-12 items-center justify-center rounded-control bg-navy px-6 text-small font-semibold text-white transition-colors hover:bg-navy-deep"
    >
      Set neighbourhood alert
    </button>
  );
}
