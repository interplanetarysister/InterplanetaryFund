import { serviceGateway } from "../../../../../worker/services/gateway.js";

export function onRequest({ request, env }) {
  return serviceGateway(request, env);
}
