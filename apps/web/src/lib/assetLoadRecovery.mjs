// Detect lazy-route JavaScript chunk failures without catching ordinary render errors.
export function isAssetLoadFailure(error) {
  const message = typeof error?.message === "string" ? error.message : "";
  const name = typeof error?.name === "string" ? error.name : "";
  return name === "ChunkLoadError" ||
    /failed to fetch dynamically imported module|importing a module script failed|loading chunk [\w.-]+ failed|failed to load module script/i.test(message);
}
