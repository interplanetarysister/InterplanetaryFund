import { fixture as strategyFixture, as } from "./strategy-fixture.js";
import { readFileSync } from "node:fs";
export { as };
export async function fixture() {
  const db = await strategyFixture();
  const ddl = readFileSync(
    new URL(
      "../supabase/migrations/pending/20261102_ifund_base44_entity_tables.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const start = ddl.indexOf(
    "create table if not exists public.ifund_agent_conversation_run (",
  );
  const end = ddl.indexOf(
    "\n\n",
    ddl.indexOf("revoke all on public.ifund_agent_conversation_run", start),
  );
  await db.exec(ddl.slice(start, end));
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261104063945_ifund_growth_agent_contracts.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("update ifund_growth_runtime.control set enabled=true");
  return db;
}
