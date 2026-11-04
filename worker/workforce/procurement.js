// Pure, bounded planning. Durable reservation and authorization remain in Postgres.
const finite = (n, min = 0) => Number.isFinite(n) && n >= min;
const strings = (xs, max = 32) =>
  Array.isArray(xs) &&
  xs.length <= max &&
  xs.every((x) => typeof x === "string" && x.length > 0 && x.length <= 160);
const fresh = (date, now) => typeof date === "string" && Date.parse(date) > now;

function eligible(candidate, task, now) {
  const c = candidate;
  return (
    c &&
    typeof c.id === "string" &&
    /^[a-z0-9_-]{1,80}$/.test(c.id) &&
    typeof c.revision === "string" &&
    c.registered === true &&
    c.available === true &&
    c.tested === true &&
    strings(c.assigned_positions) &&
    c.assigned_positions.includes(task.position_id) &&
    strings(c.capabilities) &&
    strings(c.tested_capabilities) &&
    strings(c.permissions) &&
    c.permissions.every((p) => task.allowed_permissions.includes(p)) &&
    (task.required_permissions || []).every((p) => c.permissions.includes(p)) &&
    c.security === "supabase_owner_scoped_v1" &&
    finite(c.max_complexity) &&
    c.max_complexity >= task.complexity &&
    finite(c.max_input_bytes) &&
    c.max_input_bytes >= task.input_bytes &&
    finite(c.max_output_tokens) &&
    c.max_output_tokens >= task.max_output_tokens &&
    finite(c.estimated_units, 1) &&
    c.cost?.verified === true &&
    c.cost.additional_cost === 0 &&
    c.cost.trial === false &&
    c.cost.hard_stop === true &&
    fresh(c.cost.expires_at, now) &&
    typeof c.cost.evidence === "string" &&
    c.cost.evidence.length > 0 &&
    c.evaluation?.passed === true &&
    c.evaluation.revision === c.revision &&
    typeof c.evaluation.evidence === "string" &&
    c.evaluation.evidence.length > 0 &&
    fresh(c.evaluation.expires_at, now) &&
    finite(c.reliability) &&
    c.reliability <= 1 &&
    finite(c.quality) &&
    c.quality <= 1 &&
    finite(c.latency_ms)
  );
}

const score = (c) =>
  c.quality * 5 +
  c.reliability * 5 -
  Math.min(c.latency_ms, 120000) / 120000 -
  Math.min(c.estimated_units, 10000) / 10000;

/** Selects a tested implementation or a small team; never infers equivalence from model names. */
export function procureTeam(
  task,
  candidates,
  { now = Date.now(), max_members = 3 } = {},
) {
  const unavailable = { state: "unavailable", members: [], reserved_units: 0 };
  if (
    !task ||
    !strings(task.capabilities, 16) ||
    task.capabilities.length === 0 ||
    !strings(task.allowed_permissions, 16) ||
    (task.required_permissions !== undefined &&
      !strings(task.required_permissions, 16)) ||
    typeof task.position_id !== "string" ||
    !finite(task.complexity) ||
    !finite(task.input_bytes) ||
    !finite(task.max_output_tokens) ||
    !finite(task.remaining_units) ||
    !Array.isArray(candidates) ||
    candidates.length > 100 ||
    !Number.isFinite(now) ||
    !Number.isInteger(max_members) ||
    max_members < 1 ||
    max_members > 3
  )
    return unavailable;
  const ids = new Map();
  for (const c of candidates)
    if (c?.id) ids.set(c.id, (ids.get(c.id) || 0) + 1);
  const pool = candidates
    .filter((c) => ids.get(c?.id) === 1 && eligible(c, task, now))
    .sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
  const required = [...new Set(task.capabilities)];
  const complete = (1 << required.length) - 1;
  const masks = pool.map((c) =>
    required.reduce(
      (mask, k, index) =>
        mask |
        (c.capabilities.includes(k) && c.tested_capabilities.includes(k)
          ? 1 << index
          : 0),
      0,
    ),
  );
  let best = null,
    capacity = false;
  function visit(start, members, units, mask = 0) {
    if (members.length) {
      if (mask === complete) {
        if (units > task.remaining_units) {
          capacity = true;
          return;
        }
        const quality =
          members.reduce((s, c) => s + score(c), 0) / members.length;
        const key = members
          .map((c) => c.id)
          .sort()
          .join(",");
        if (
          !best ||
          members.length < best.members.length ||
          (members.length === best.members.length &&
            (quality > best.quality ||
              (quality === best.quality && key < best.key)))
        )
          best = {
            members: [...members].sort((a, b) => a.id.localeCompare(b.id)),
            units,
            quality,
            key,
          };
        return;
      }
    }
    if (
      members.length === max_members ||
      (best && members.length >= best.members.length)
    )
      return;
    for (let i = start; i < pool.length; i++)
      if ((mask | masks[i]) !== mask)
        visit(
          i + 1,
          [...members, pool[i]],
          units + pool[i].estimated_units,
          mask | masks[i],
        );
  }
  visit(0, [], 0);
  return best
    ? { state: "selected", members: best.members, reserved_units: best.units }
    : { ...unavailable, state: capacity ? "capacity" : "unavailable" };
}
