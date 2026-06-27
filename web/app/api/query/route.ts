import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROW_LIMIT = 5000;

// Safely double-quote a Postgres identifier (supports schema.table). Mirrors the
// per-dialect quoting used in the Python framework — neutralizes SQL injection
// via the table name.
function quoteIdent(name: string): string {
  const parts = String(name)
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error("Invalid table name.");
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}

// Connect to a user-supplied Postgres database and return rows.
// The connection string is used per-request and never stored. NOTE: a database
// reachable from the deployment host is required (e.g. a cloud Postgres such as
// Neon / Supabase / RDS) — a localhost DB on your laptop will not be reachable.
export async function POST(req: NextRequest) {
  let client: Client | null = null;
  try {
    const body = await req.json();
    const connectionString: string = body?.connectionString ?? "";
    const table: string = body?.table ?? "";
    const customQuery: string = (body?.query ?? "").trim();

    if (!connectionString) {
      return NextResponse.json({ error: "Missing connection string." }, { status: 400 });
    }

    let sql: string;
    if (customQuery) {
      if (!/^select\b/i.test(customQuery)) {
        return NextResponse.json({ error: "Only SELECT queries are allowed." }, { status: 400 });
      }
      // Wrap so a trailing statement cannot escape and a hard row cap is enforced.
      sql = `SELECT * FROM (${customQuery.replace(/;\s*$/, "")}) AS _sub LIMIT ${ROW_LIMIT}`;
    } else {
      if (!table) {
        return NextResponse.json({ error: "Provide a table name or a SELECT query." }, { status: 400 });
      }
      sql = `SELECT * FROM ${quoteIdent(table)} LIMIT ${ROW_LIMIT}`;
    }

    client = new Client({
      connectionString,
      // Most managed Postgres providers require TLS; accept their certs for the demo.
      ssl: /sslmode=disable/i.test(connectionString) ? undefined : { rejectUnauthorized: false },
      statement_timeout: 15000,
      connectionTimeoutMillis: 10000,
    });
    await client.connect();
    const result = await client.query(sql);
    return NextResponse.json({ rows: result.rows, count: result.rowCount });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e) }, { status: 500 });
  } finally {
    if (client) await client.end().catch(() => {});
  }
}
