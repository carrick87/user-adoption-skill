/**
 * Usage event contract for privacy-first adoption tracking.
 * Adapt APP_NAME, EVENT_NAMES, and builders to the host app.
 * Never add IP, user-agent, raw search text, or secrets to metadata.
 */

export const APP_NAME = "App";
export const QUIET_MS = 30 * 60 * 1000;

export const EVENT_NAMES = [
  "user_login",
  "user_logout",
  "session_started",
  "session_ended",
  "home_viewed",
  "searched",
  "filtered",
  "list_viewed",
  "export_completed",
  "export_failed",
  "access_denied",
  "access_waiting",
  "error_occurred",
  "admin_viewed",
  "adoption_viewed",
] as const;

export type UsageEventName = (typeof EVENT_NAMES)[number];

const METADATA_KEYS = new Set([
  "result_count",
  "zero_results",
  "search_class",
  "status",
  "side",
  "group_id",
  "page",
  "page_size",
  "sort",
  "direction",
  "filter_columns",
  "action",
  "row_count",
  "error_code",
  "http_status",
]);

const NUMBER_KEYS = new Set([
  "result_count",
  "page",
  "page_size",
  "row_count",
  "http_status",
]);

const BOOLEAN_KEYS = new Set(["zero_results"]);

const TEXT_KEYS = new Set([
  "search_class",
  "status",
  "side",
  "group_id",
  "sort",
  "direction",
  "action",
  "error_code",
]);

export type UsageEntity = {
  entity_id: string;
  branch?: string | null;
};

export type UsageEvent = {
  event_name: UsageEventName;
  application_version: string;
  environment: string;
  branch: string | null;
  correlation_id: string;
  page: string;
  module: string;
  entity_type: string | null;
  entity_id: string | null;
  success: boolean | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  entities?: UsageEntity[];
};

/** Wire to your changelog / package version. */
export function appVersion() {
  return process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
}

export function appEnvironment() {
  const value =
    process.env.NEXT_PUBLIC_APP_ENV || process.env.VERCEL_ENV || "development";
  return value.slice(0, 32);
}

/** Adapt role names to the host app. */
export function canViewAdoption(role: string | null | undefined) {
  return role === "admin" || role === "super";
}

export function shouldRecord(userId: string | null | undefined) {
  return Boolean(userId);
}

export function cleanPeriod(value: string | null | undefined): 7 | 14 | 30 {
  if (value === "14") return 14;
  if (value === "30") return 30;
  return 7;
}

export function searchClass(term: string) {
  const trimmed = term.trim();
  if (/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(trimmed)) return "identifier";
  return "text";
}

export function entityId(value: string | null | undefined) {
  if (!value || !/^[A-Za-z0-9._:-]{1,64}$/.test(value)) return null;
  return value;
}

export function sanitizeMetadata(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (!METADATA_KEYS.has(key)) continue;
    if (BOOLEAN_KEYS.has(key) && typeof value === "boolean") {
      metadata[key] = value;
    } else if (NUMBER_KEYS.has(key) && typeof value === "number" && Number.isFinite(value)) {
      metadata[key] = value;
    } else if (
      TEXT_KEYS.has(key) &&
      typeof value === "string" &&
      value.length <= 64 &&
      /^[A-Za-z0-9_ .:/-]+$/.test(value)
    ) {
      metadata[key] = value;
    } else if (key === "filter_columns" && Array.isArray(value)) {
      metadata[key] = value.filter(
        (item): item is string =>
          typeof item === "string" && /^[a-z0-9_]{1,40}$/.test(item),
      );
    }
  }
  return metadata;
}

function stamp(name: UsageEventName, page: string, module: string): UsageEvent {
  return {
    event_name: name,
    application_version: appVersion(),
    environment: appEnvironment(),
    branch: null,
    correlation_id: "",
    page,
    module,
    entity_type: null,
    entity_id: null,
    success: true,
    duration_ms: null,
    metadata: {},
  };
}

export function loginEvents(correlationId: string) {
  const login = stamp("user_login", "login", "auth");
  login.correlation_id = correlationId;
  return [login];
}

export function logoutEvents(correlationId: string) {
  const logout = stamp("user_logout", "session", "auth");
  const ended = stamp("session_ended", "session", "auth");
  logout.correlation_id = correlationId;
  ended.correlation_id = correlationId;
  return [logout, ended];
}

export function errorEvent(input: {
  correlationId: string;
  page: string;
  module: string;
  errorCode: string;
  branch?: string | null;
  httpStatus?: number;
}) {
  const event = stamp("error_occurred", input.page, input.module);
  event.correlation_id = input.correlationId;
  event.branch = entityId(input.branch ?? null);
  event.success = false;
  event.metadata = sanitizeMetadata({
    error_code: input.errorCode,
    http_status: input.httpStatus,
  });
  return event;
}

export function homeViewedEvent(input: {
  correlationId: string;
  branch?: string | null;
  resultCount?: number;
}) {
  const event = stamp("home_viewed", "home", "home");
  event.correlation_id = input.correlationId;
  event.branch = entityId(input.branch ?? null);
  event.metadata = sanitizeMetadata({
    result_count: input.resultCount,
  });
  return event;
}

export function searchedEvent(input: {
  correlationId: string;
  term: string;
  resultCount: number;
  branch?: string | null;
  matchedEntityId?: string | null;
}) {
  const event = stamp("searched", "home", "home");
  event.correlation_id = input.correlationId;
  event.branch = entityId(input.branch ?? null);
  event.entity_type = "entity";
  event.entity_id = entityId(input.matchedEntityId ?? null);
  event.metadata = sanitizeMetadata({
    result_count: input.resultCount,
    zero_results: input.resultCount === 0,
    search_class: searchClass(input.term),
  });
  return event;
}

export function listViewedEvent(input: {
  correlationId: string;
  entities: UsageEntity[];
  total: number;
  page: number;
  pageSize: number;
  branch?: string | null;
}) {
  const event = stamp("list_viewed", "home", "home");
  event.correlation_id = input.correlationId;
  event.branch = entityId(input.branch ?? null);
  event.entity_type = "entity";
  event.metadata = sanitizeMetadata({
    result_count: input.total,
    zero_results: input.total === 0,
    page: input.page,
    page_size: input.pageSize,
  });
  event.entities = input.entities
    .map((row) => ({
      entity_id: entityId(row.entity_id) ?? "",
      branch: entityId(row.branch ?? null),
    }))
    .filter((row) => row.entity_id)
    .slice(0, 500);
  return event;
}

export function exportEvent(input: {
  correlationId: string;
  success: boolean;
  rowCount: number;
  durationMs: number;
  branch?: string | null;
  errorCode?: string;
}) {
  const event = stamp(
    input.success ? "export_completed" : "export_failed",
    "export",
    "export",
  );
  event.correlation_id = input.correlationId;
  event.branch = entityId(input.branch ?? null);
  event.success = input.success;
  event.duration_ms = input.durationMs;
  event.metadata = sanitizeMetadata({
    row_count: input.rowCount,
    error_code: input.errorCode,
  });
  return event;
}

export function screenEvent(
  name: "admin_viewed" | "adoption_viewed",
  correlationId: string,
) {
  const event = stamp(
    name,
    name === "admin_viewed" ? "admin" : "adoption",
    "admin",
  );
  event.correlation_id = correlationId;
  return event;
}

export function usagePayload(events: UsageEvent[]) {
  return events.map((event) => {
    const payload: Record<string, unknown> = {
      event_name: event.event_name,
      application_version: event.application_version,
      environment: event.environment,
      branch: event.branch,
      correlation_id: event.correlation_id,
      page: event.page,
      module: event.module,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      success: event.success,
      duration_ms: event.duration_ms,
      metadata: sanitizeMetadata(event.metadata),
    };
    if (event.entities?.length) payload.entities = event.entities;
    return payload;
  });
}
