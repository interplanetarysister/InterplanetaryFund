// Stable service identities. Implementations and provider choices belong in the workforce registry.
// Full preserved instructions, tools and memory contracts: position-contracts.json (server only).
const positions = [
  {
    id: "chief_of_staff",
    title: "Chief of Staff",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "eccac6ca3b31066d0c5817550834bd6a092348bb170e87d66459c993d1fda313",
  },
  {
    id: "strategy_agent",
    title: "Strategy",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "acb83a017c3a9eda46997a0853e7b3d32b209d0b2c3df4facb75e5dae2523056",
  },
  {
    id: "growth_agent",
    title: "Growth",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "0757986693590bd4b467406139987101efcc225a7cf59a8fa895af08e9da09c4",
  },
  {
    id: "communications_agent",
    title: "Communications",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "37097ccd666016fa5d1b102a1cd82ed85837b17e639b1b941ffd72d7cac9012b",
  },
  {
    id: "story_agent",
    title: "Story",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "1436b2557ba1b88dc9c7c7dffc3e4e2312d033af2b45aed8f974df5ab67e6f10",
  },
  {
    id: "finance_agent",
    title: "Finance",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "a298ff7136566786af2d78d80dff6e8f6561af0982bac0adee2fd5dea9d66c43",
  },
  {
    id: "outreach_agent",
    title: "Outreach",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "f6c60968fcf1771ea2ad64265469364cb82de33fabbbdb6c5665e8c8162b1caa",
  },
  {
    id: "connection_discovery_agent",
    title: "Discovery",
    selectable: true,
    min_plan_level: 1,
    contract_sha256:
      "91bf743522f36e43d8bbb33758459a29be9451f2eb290a16fe9a75aaa2ad572d",
  },
  {
    id: "managed_connection_agent",
    title: "Managed Connections",
    selectable: true,
    min_plan_level: 2,
    contract_sha256:
      "a55aeaf89a1faa08940eaf0314f43c2452361bd2b321f236dbb255cdf1f0badc",
  },
  {
    id: "admin_builder_agent",
    title: "Admin Builder Coordinator",
    selectable: false,
    min_plan_level: null,
    contract_sha256:
      "ee89e011d44802b4c5b0fed98f024338a11a5829ce5f4a121822b95e5203c713",
  },
];
for (const position of positions) Object.freeze(position);
Object.freeze(positions);
export function serviceCatalog() {
  return positions.filter((p) => p.selectable);
}
export function servicePosition(id) {
  return positions.find((p) => p.id === id) || null;
}
export function allServicePositions() {
  return [...positions];
}
