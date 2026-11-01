// Compatibility re-export. The canonical connection recipe registry lives in shared/
// so every Base44 function and helper consumes the same non-secret routing knowledge.
export { TRANSPORT_PRIORITY, STATIC_CONNECTION_RECIPES, staticRecipe, orderedTransports } from '../shared/platformConnectionRecipes.ts';
