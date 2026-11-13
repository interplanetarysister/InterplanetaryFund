/**
 * Special-purpose help article content contract on the already authorized
 * Website Studio API. Bundled article slugs remain the public canonical links.
 * A draft does not override the published answer; publishing is explicit.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export function helpStudioSlug(articleSlug) {
  if (typeof articleSlug !== "string" || !SLUG.test(articleSlug) ||
      ("help-" + articleSlug).length > 60)
    throw new Error("Invalid help article slug.");
  return "help-" + articleSlug;
}
export function helpStudioPayload(article, answer, status = "draft") {
  const text = typeof answer === "string" ? answer.trim() : "";
  if (!article || typeof article.question !== "string" ||
      !["draft", "published"].includes(status) ||
      text.length < 20 || text.length > 4000)
    throw new Error("Write a help answer between 20 and 4,000 characters.");
  return {
    slug: helpStudioSlug(article.slug),
    title: article.question.trim().slice(0, 120),
    status,
    content: { blocks: [{ id: "help-main", type: "text",
      heading: article.question.trim().slice(0, 120), body: text }] },
  };
}
export function helpStudioAnswer(page, articleSlug, { requirePublished = true } = {}) {
  if (!page || page.slug !== helpStudioSlug(articleSlug) ||
      (requirePublished && page.status !== "published") ||
      !Array.isArray(page.content?.blocks)) return null;
  const blocks = page.content.blocks.filter(b => b?.id === "help-main" && b.type === "text");
  if (blocks.length !== 1 || typeof blocks[0].body !== "string") return null;
  const text = blocks[0].body.trim();
  return text.length >= 20 && text.length <= 4000 ? text : null;
}
