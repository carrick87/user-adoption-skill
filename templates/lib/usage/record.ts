import { usagePayload, type UsageEvent } from "./contract";

export type UsageRecorder = {
  rpc: (
    fn: string,
    args: { events: unknown },
  ) => PromiseLike<{ error: { message: string } | null }>;
};

/** Insert events. Never throw — product flows must still succeed. */
export async function recordUsage(client: UsageRecorder, events: UsageEvent[]) {
  if (events.length === 0) return;
  try {
    const { error } = await client.rpc("usage_record_usage", {
      events: usagePayload(events),
    });
    if (error) return;
  } catch {
    return;
  }
}
