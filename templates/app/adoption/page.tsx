import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AdoptionTable,
  type AdoptionCell,
  type AdoptionRow,
} from "@/components/adoption-table";
import {
  appVersion,
  canViewAdoption,
  cleanPeriod,
  screenEvent,
  shouldRecord,
} from "@/lib/usage/contract";
import { recordUsage } from "@/lib/usage/record";

/**
 * Starter adoption report page.
 * Wire getSession() / supabase client to your app's auth helpers before shipping.
 */

export const dynamic = "force-dynamic";
export const metadata = { title: "Adoption" };

function num(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function percent(value: unknown) {
  if (value == null || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${number.toFixed(1)}%`;
}

function text(value: unknown) {
  if (value == null || value === "") return "—";
  return String(value);
}

function list(value: unknown) {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function words(value: unknown): AdoptionCell {
  const label = text(value);
  return { text: label, sort: label === "—" ? "" : label };
}

function count(value: unknown): AdoptionCell {
  const number = num(value);
  return { text: String(number), sort: number };
}

function rate(value: unknown): AdoptionCell {
  if (value == null || value === "") return { text: "—", sort: Number.NEGATIVE_INFINITY };
  const number = Number(value);
  if (!Number.isFinite(number)) return { text: "—", sort: Number.NEGATIVE_INFINITY };
  return { text: `${number.toFixed(1)}%`, sort: number };
}

function dayCell(value: unknown): AdoptionCell {
  const match = String(value ?? "").match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return { text: "—", sort: Number.NEGATIVE_INFINITY };
  return { text: match[1], sort: Date.parse(`${match[1]}T00:00:00Z`) };
}

function when(value: unknown): AdoptionCell {
  if (value == null || value === "") return { text: "—", sort: Number.NEGATIVE_INFINITY };
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return { text: String(value), sort: 0 };
  return { text: date.toISOString().slice(0, 16).replace("T", " ") + " Z", sort: date.getTime() };
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

// >>> ADAPT: replace with your session + supabase helpers.
async function getAccess(): Promise<{
  user: { id: string } | null;
  role: string | null;
  supabase: {
    rpc: (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
}> {
  throw new Error("Wire getAccess() to your Supabase session helpers");
}

export default async function AdoptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await getAccess();
  if (!access.user || !canViewAdoption(access.role)) redirect("/");

  const params = await searchParams;
  const days = cleanPeriod(one(params.days));

  if (shouldRecord(access.user.id)) {
    await recordUsage(access.supabase, [
      screenEvent("adoption_viewed", crypto.randomUUID()),
    ]);
  }

  const [company, users, features, errors, daily] = await Promise.all([
    access.supabase.rpc("usage_company", { day_count: days }),
    access.supabase.rpc("usage_user_rows", { day_count: days }),
    access.supabase.rpc("usage_feature_rows", { day_count: days }),
    access.supabase.rpc("usage_error_rows", { day_count: days }),
    access.supabase.rpc("usage_daily_rows", { day_count: days }),
  ]);

  const failure = [company.error, users.error, features.error, errors.error, daily.error].find(
    Boolean,
  );
  const summary = ((company.data as unknown[] | null)?.[0] ?? {}) as Record<string, unknown>;

  const metrics: [string, string][] = [
    ["Eligible users", String(num(summary.eligible))],
    ["Activated", String(num(summary.activated))],
    ["Activation", percent(summary.activation_rate)],
    ["Active in this period", String(num(summary.active_users))],
    ["Adoption", percent(summary.adoption_rate)],
    ["Logged in once", String(num(summary.logged_in_once))],
    ["Daily active users", String(num(summary.dau))],
    ["Weekly active users", String(num(summary.wau))],
    ["Monthly active users", String(num(summary.mau))],
    ["Export completion", percent(summary.export_completion)],
    ["Search success", percent(summary.search_success_rate)],
    ["Error rate", percent(summary.error_rate)],
    ["Release on latest event", text(summary.application_version ?? appVersion())],
    ["Environment", text(summary.environment)],
  ];

  const companyRows: AdoptionRow[] = metrics.map(([label, value]) => ({
    key: label,
    cells: [words(label), words(value)],
  }));

  const dailyRows: AdoptionRow[] = list(daily.data).map((row) => ({
    key: String(row.activity_date),
    cells: [
      dayCell(row.activity_date),
      count(row.active_users),
      count(row.logins),
      count(row.searches),
      count(row.searches_with_results),
      count(row.exports),
      count(row.errors),
    ],
  }));

  const userRows: AdoptionRow[] = list(users.data).map((row) => ({
    key: String(row.user_id ?? row.email),
    cells: [
      words(row.email),
      words(row.role),
      words(row.status),
      when(row.first_login),
      when(row.last_sign_in_at),
      when(row.last_active),
      count(row.login_count),
      count(row.active_days),
      count(row.sessions),
    ],
  }));

  const featureRows: AdoptionRow[] = list(features.data).map((row) => ({
    key: String(row.feature),
    cells: [
      words(row.feature),
      count(row.unique_users),
      count(row.usage_count),
      rate(row.adoption_rate),
      when(row.last_used),
    ],
  }));

  const errorRows: AdoptionRow[] = list(errors.data).map((row, index) => ({
    key: `${row.event_timestamp}-${index}`,
    cells: [
      when(row.event_timestamp),
      words(row.email),
      words(row.branch),
      words(row.module),
      words(row.page),
      words(row.event_name),
      words(row.error_code),
    ],
  }));

  return (
    <div className="adoption">
      <header className="mast">
        <h1>Adoption</h1>
        <p className="footing">
          Activation counts real product work (home, search, filter, list, or export).
          Signing in alone does not. No visitor IP or user-agent is stored.
        </p>
        <p className="freshness">
          Release {appVersion()}. Figures use the last {days} days, except DAU / WAU / MAU
          (today / 7 / 30 days).
        </p>
      </header>

      <div className="flip" role="group" aria-label="Period">
        {[7, 14, 30].map((period) => (
          <Link
            key={period}
            href={`/adoption?days=${period}`}
            aria-current={days === period ? "page" : undefined}
          >
            {period} days
          </Link>
        ))}
      </div>

      {failure ? <p className="banner">{failure.message}</p> : null}

      <AdoptionTable
        title="Company"
        caption="Company adoption"
        file="company"
        period={days}
        columns={[
          { key: "metric", label: "Metric" },
          { key: "value", label: "Value" },
        ]}
        rows={companyRows}
        empty="No company figures."
      />
      <AdoptionTable
        title="Days"
        caption="Daily usage"
        file="days"
        period={days}
        columns={[
          { key: "date", label: "Date" },
          { key: "active", label: "Active users", numeric: true },
          { key: "logins", label: "Logins", numeric: true },
          { key: "searches", label: "Searches", numeric: true },
          { key: "results", label: "Searches with results", numeric: true },
          { key: "exports", label: "Exports", numeric: true },
          { key: "errors", label: "Errors", numeric: true },
        ]}
        rows={dailyRows}
        empty="No usage in this period."
      />
      <AdoptionTable
        title="Users"
        caption="User adoption"
        file="users"
        period={days}
        columns={[
          { key: "email", label: "Email" },
          { key: "role", label: "Role" },
          { key: "status", label: "Status" },
          { key: "first", label: "First login" },
          { key: "signin", label: "Last sign-in" },
          { key: "active", label: "Last active" },
          { key: "logins", label: "Logins", numeric: true },
          { key: "days", label: "Active days", numeric: true },
          { key: "sessions", label: "Sessions", numeric: true },
        ]}
        rows={userRows}
        empty="No users yet."
      />
      <AdoptionTable
        title="Features"
        caption="Feature adoption"
        file="features"
        period={days}
        columns={[
          { key: "feature", label: "Feature" },
          { key: "users", label: "Users", numeric: true },
          { key: "uses", label: "Uses", numeric: true },
          { key: "rate", label: "Adoption %", numeric: true },
          { key: "last", label: "Last used" },
        ]}
        rows={featureRows}
        empty="No feature use in this period."
      />
      <AdoptionTable
        title="Errors"
        caption="Errors"
        file="errors"
        period={days}
        columns={[
          { key: "when", label: "When" },
          { key: "user", label: "User" },
          { key: "branch", label: "Branch" },
          { key: "module", label: "Module" },
          { key: "page", label: "Page" },
          { key: "event", label: "Event" },
          { key: "code", label: "Code" },
        ]}
        rows={errorRows}
        empty="No errors in this period."
      />
    </div>
  );
}
