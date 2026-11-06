import { fixture as base, as } from "./strategy-fixture.js";
import { readFileSync } from "node:fs";
export { as };
export async function fixture() {
  const db = await base();
  const source = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  for (const name of ["ifund_authorization_grant", "ifund_agent_delegation"]) {
    const start = source.indexOf(
      "create table if not exists public." + name + " (",
    );
    const end = source.indexOf(
      "\n\n",
      source.indexOf("revoke all on public." + name, start),
    );
    await db.exec(source.slice(start, end));
  }
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261105115633_ifund_managed_connections_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("update ifund_connections_runtime.control set enabled=true");
  return db;
}
