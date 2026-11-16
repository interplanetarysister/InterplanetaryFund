// A context edit permanently retires all proposals from that request, including
// rejected responses and finally callbacks that arrive after a newer request.
export function createCampaignWritingRequests() {
  let revision = 0;
  let active = null;
  return {
    begin() {
      if (active) return null;
      active = { revision };
      return active;
    },
    invalidate() { revision += 1; active = null; },
    current(request) { return Boolean(request && active === request && request.revision === revision); },
    finish(request) {
      if (!this.current(request)) return false;
      active = null;
      return true;
    },
  };
}
