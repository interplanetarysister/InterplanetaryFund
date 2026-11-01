import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { HELP_CATEGORIES, helpArticlePath } from "../src/lib/helpCenter.js";
import { PUBLIC_HELP_ARTICLES, publicHelpArticle } from "../src/lib/publicHelp.js";
import { TERMS_VERSION, TERMS_SECTIONS, PRIVACY_SECTIONS } from "../src/lib/legalPolicy.js";

const file = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");

test("source-aligned public routes exist in independent router", () => {
  const app = file("src/App.jsx");
  for (const route of ["/about", "/contact", "/help", "/help/:slug", "/terms", "/privacy"]) {
    assert.ok(app.includes('path="' + route + '"'), "missing route " + route);
  }
  for (const target of ["About", "Contact", "Help", "HelpArticle", "Terms", "Privacy"]) {
    assert.match(app, new RegExp('import ' + target + ' from "./pages/' + target + '"'));
  }
  for (const target of ["/about", "/contact", "/help", "/terms", "/privacy"]) {
    assert.ok(app.includes('to="' + target + '"'), "missing public navigation link " + target);
  }
});

test("public pages never silently call Base44 or claim a support message was sent", () => {
  for (const page of ["About", "Contact", "Help", "HelpArticle", "Terms", "Privacy"]) {
    const source = file("src/pages/" + page + ".jsx");
    assert.doesNotMatch(source, /base44Client|base44\.functions|sendPublicContactMessage|SUPABASE_SERVICE_ROLE_KEY/i);
  }
  const contact = file("src/pages/Contact.jsx");
  assert.match(contact, /mailto:/);
  assert.match(contact, /will not collect or store your message/);
  assert.doesNotMatch(contact, /<form|fetch\(/);
});

test("legal documents preserve the original versioned source text, without implied acceptance", () => {
  assert.equal(TERMS_VERSION, "2026-10-13-v3");
  assert.ok(TERMS_SECTIONS.length > 5);
  assert.ok(PRIVACY_SECTIONS.length > 3);
  assert.ok(TERMS_SECTIONS.every((s) => s.title && s.paragraphs.length > 0));
  assert.ok(PRIVACY_SECTIONS.every((s) => s.title && s.paragraphs.length > 0));
  assert.match(file("src/pages/Terms.jsx"), /TERMS_VERSION/);
  assert.match(file("src/pages/Privacy.jsx"), /PRIVACY_SECTIONS/);
  assert.doesNotMatch(file("src/pages/Terms.jsx"), /recordLegalAcceptance|\.insert\(/);
});

test("independent help catalog uses stable original categories and safe local content", () => {
  const categories = new Set(HELP_CATEGORIES.map((item) => item.name));
  const slugs = new Set();
  for (const article of PUBLIC_HELP_ARTICLES) {
    assert.ok(categories.has(article.category), article.slug);
    assert.match(article.slug, /^[a-z0-9-]+$/);
    assert.ok(!slugs.has(article.slug), "duplicate slug");
    slugs.add(article.slug);
    assert.equal(publicHelpArticle(article.slug), article);
    assert.equal(helpArticlePath(article.slug), "/help/" + article.slug);
    assert.ok(article.answer.length > 25);
  }
  assert.equal(publicHelpArticle("unpublished-private-record"), null);
  assert.doesNotMatch(file("src/pages/Help.jsx"), /\.from\(["']ifund_help_articles|base44/);
});
