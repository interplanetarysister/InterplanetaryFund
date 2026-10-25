// Bounded, deterministic Base44 entity pagination for scheduled jobs.
// A truncated scan is explicit; never silently replace oldest-first with
// newest-first when a crowded subscriber queue grows.
export async function readEntityPages(sr: any, name: string, query: any,
    order = 'created_date', batch = 200, max = 3000) {
  const rows: any[] = [];
  const seen = new Set<string>();
  let truncated = false;
  for (let skip = 0; skip < max; skip += batch) {
    const page = await sr.entities[name].filter(query, order, batch, skip);
    if (!Array.isArray(page)) throw new Error('Base44 pagination is unavailable.');
    if (!page.length) break;
    let newRows = 0;
    for (const item of page) {
      if (!item?.id || seen.has(item.id)) continue;
      seen.add(item.id);
      rows.push(item);
      newRows++;
    }
    if (!newRows) throw new Error('Base44 pagination returned repeated rows.');
    if (page.length < batch) break;
    if (skip + batch >= max) truncated = true;
  }
  return { rows, truncated };
}
