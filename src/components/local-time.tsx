"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** Renders a date in the viewer's own time zone (UTC on the server, then localised in the browser). */
export function LocalTime({ iso, withZone = true }: { iso: string; withZone?: boolean }) {
  const text = useSyncExternalStore(
    noop,
    () =>
      new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", ...(withZone ? { timeZoneName: "short" } : {}) }).format(new Date(iso)),
    () => `${new Date(iso).toUTCString().slice(0, -7)} UTC`,
  );
  return <time dateTime={iso}>{text}</time>;
}

/** The browser's offset from UTC in minutes (as Date#getTimezoneOffset), 0 on the server. */
export const useTimezoneOffset = () => useSyncExternalStore(noop, () => new Date().getTimezoneOffset(), () => 0);
