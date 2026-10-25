// Check that both REST paths are handled by the Worker, not the SPA.
// No API key is sent and no campaign content is modified.
const origin = process.env.IFUND_PUBLIC_ORIGIN || "https://interplanetaryfund.com";
const requests = [
  { path: "/api/v1/agent/campaigns", method: "GET" },
  { path: "/api/v1/agent/content", method: "POST" },
];
for (const { path, method } of requests) {
  let response;
  try {
    response = await fetch(new URL(path, origin), {
      method, headers: { accept: "application/json" },
      redirect: "manual", signal: AbortSignal.timeout(12000),
    });
  } catch (error) {
    console.error("FAIL: API unreachable", path, error.name);
    process.exitCode = 1;
    continue;
  }
  const type = response.headers.get("content-type") || "";
  let parsed;
  try { parsed = await response.json(); } catch { /* HTML fallback or malformed JSON */ }
  if (response.status === 401 && type.includes("application/json") && typeof parsed?.error === "string") {
    console.log("PASS:", method, path, "returns JSON 401 without credentials");
  } else {
    console.error("FAIL:", method, path, "expected JSON 401; received", response.status, type);
    process.exitCode = 1;
  }
}
