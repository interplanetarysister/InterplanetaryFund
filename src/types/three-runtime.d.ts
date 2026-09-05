// three is intentionally loaded at runtime before globe.gl and is consumed through
// the explicitly-any THREE bridge in src/pages/Globe.tsx. Keep this declaration
// local until the globe integration is migrated to first-class static Three types.
declare module "three";
