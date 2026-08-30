// three is loaded lazily at runtime by Globe.tsx and its public typings are not
// currently present in the repository dependency graph. Keep the dynamic import
// type-safe until @types/three can be added through the lockfile in a dedicated
// dependency-maintenance change.
declare module "three";
