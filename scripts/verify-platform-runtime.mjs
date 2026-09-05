const endpoint = process.env.PLATFORM_VERIFY_URL || process.env.CONVEX_PLATFORM_EVENT_URL;
const secret = process.env.PLATFORM_BRIDGE_SECRET;
const actorId = process.env.PLATFORM_VERIFY_ACTOR_ID;

if (!endpoint || !secret || !actorId) {
  console.error("Set PLATFORM_VERIFY_URL (or CONVEX_PLATFORM_EVENT_URL), PLATFORM_BRIDGE_SECRET, and PLATFORM_VERIFY_ACTOR_ID.");
  process.exit(2);
}

const idempotencyKey = `runtime-verification:${Date.now()}:${crypto.randomUUID()}`;
const payload = {
  verification: "feature-10-runtime",
  generatedAt: new Date().toISOString(),
};

const input = {
  eventId: crypto.randomUUID(),
  name: "platform.event.recorded",
  actorId,
  resourceType: "platform",
  resourceId: "feature-10-runtime-verification",
  correlationId: `runtime:${idempotencyKey}`,
  idempotencyKey,
  occurredAt: new Date().toISOString(),
  version: 1,
  payload,
};

async function send() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-platform-bridge-secret": secret,
    },
    body: JSON.stringify(input),
  });
  const text = await response.text();
  let body;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: response.status, body };
}

const [first, second] = await Promise.all([send(), send()]);
const results = [first, second];
const recorded = results.filter((result) => result.status === 200 && result.body?.recorded === true && result.body?.duplicate === false);
const duplicates = results.filter((result) => result.status === 200 && result.body?.duplicate === true);

if (recorded.length !== 1 || duplicates.length !== 1) {
  console.error(JSON.stringify({ ok: false, results }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  message: "Concurrent duplicate platform events collapsed to one durable record.",
  idempotencyKey,
  results,
}, null, 2));
