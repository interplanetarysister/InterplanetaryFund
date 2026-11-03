import migrationWorker from "../../worker/index.js";

/** Route preview API requests through the same fail-closed migration Worker. */
export async function onRequest(context) {
  return migrationWorker.fetch(context.request, context.env);
}
