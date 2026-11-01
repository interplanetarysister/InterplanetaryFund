// Route same-origin Pages API requests through the independent migration Worker.
import migrationApi from "../../worker/index.js";

export async function onRequest(context) {
  return migrationApi.fetch(context.request, context.env);
}
