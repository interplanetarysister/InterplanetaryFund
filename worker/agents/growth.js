import {
  strategyRoute,
  strategyMessages,
  strategyEvidence,
} from "./strategy.js";

export function growthEvidence(context) {
  return strategyEvidence(context).map((fact, i) => {
    const campaign = context.campaigns[i];
    const metrics = (
      context.verified_donation_activity?.available === true
        ? context.verified_donation_activity.by_campaign_currency || []
        : []
    ).filter((x) => x.campaign_id === campaign.id);
    const captured = metrics.map((x) => {
      const digits = String(x.gift_cents);
      if (
        !/^\d{1,24}$/.test(digits) ||
        !/^\d{1,15}$/.test(String(x.captured_gifts)) ||
        !/^[A-Z]{3}$/.test(x.currency)
      )
        throw Error("Verified campaign totals could not be read.");
      const amount = digits.padStart(3, "0");
      return `${x.captured_gifts} captured gifts totaling ${amount.slice(0, -2)}.${amount.slice(-2)} ${x.currency}`;
    });
    return (
      fact +
      (captured.length
        ? ` Canonical IFund records show ${captured.join("; ")}; legacy gifts are unreconciled.`
        : " Verified donation growth and trends are unavailable; do not infer zero or momentum.")
    );
  });
}
export function growthMessages(input, context) {
  const messages = strategyMessages(input, context);
  messages[0].content =
    messages[0].content.replace("IFund Strategy Agent", "IFund Growth Agent") +
    " Focus on useful reach and legitimate support rather than output volume or vanity engagement. Compare plausible supporter segments, communities, channels and message angles as hypotheses to test, not verified people or guaranteed opportunities. Never infer donor attributes, sensitive traits, vulnerabilities or permission to contact people. No spam, stereotyping, fabricated urgency or paid promotion. One aggregate snapshot does not establish momentum, conversion, donor retention or platform usage. Do not rank connections as underused without verified usage. Connection metadata never establishes publishing permission or consent. Prefer small, voluntary, measurable experiments with a clear review point. Give each recommendation a distinct action title, a testable hypothesis, an effort estimate and an honest success signal. Predictions must remain estimates. Never claim a specialist ran, a post was published or a supporter was contacted.";
  const data = JSON.parse(messages[1].content);
  data.evidence_facts = growthEvidence(context);
  data.connections = Array.isArray(context.connections)
    ? context.connections.slice(0, 30).map((c) => ({
        provider: String(c.provider || "").slice(0, 60),
        status: String(c.status || "unknown").slice(0, 30),
        verified: c.verified === true,
        capabilities_available: false,
      }))
    : [];
  data.connection_usage = { available: false };
  messages[1].content = JSON.stringify(data);
  if (new TextEncoder().encode(JSON.stringify(messages)).byteLength > 24000)
    throw Error(
      "There is too much context for one report. Select fewer campaigns.",
    );
  return messages;
}
export function growthRoute(request, env, fetcher = fetch) {
  return strategyRoute(request, env, fetcher, {
    id: "growth",
    messages: growthMessages,
    evidence: growthEvidence,
  });
}
export default {
  fetch(request, env) {
    return growthRoute(request, env);
  },
};
