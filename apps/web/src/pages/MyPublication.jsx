import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import { authClient } from "@/api/auth";
import { resolveVerifiedEmailUser } from "@/lib/verifiedEmailUser";
import {
  REPORTER_BLOG_ID,
  loadReporterWorkspace,
  saveReporterStory,
} from "@/lib/reporterWorkspace";

// This page is only the official Reporter publication workspace.
// It is intentionally not the member-owned /my-blog studio. The member blog
// create/edit/publish API and its entitlement/RLS contract must be implemented
// and verified separately before /my-blog can route here.
const EMPTY = { id: "", title: "", summary: "", body: "", status: "draft" };

export default function MyPublication() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const current = await resolveVerifiedEmailUser(authClient().auth);
        if (!live) return;
        setUser(current);
        if (current)
          setWorkspace(await loadReporterWorkspace(authClient(), current));
      } catch {
        if (live) setError("Your publication could not be loaded.");
      } finally {
        if (live) setChecking(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!user) return;
    setWorkspace(await loadReporterWorkspace(authClient(), user));
  }, [user]);

  function edit(entry) {
    setError("");
    setNotice("");
    setForm({
      id: entry.id,
      title: entry.title || "",
      summary: entry.summary || "",
      body: entry.body || "",
      status: entry.status || "draft",
    });
  }

  async function submit(event, status) {
    event.preventDefault();
    if (busy || !user) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const saved = await saveReporterStory(authClient(), user, {
        ...form,
        status,
      });
      setForm(
        saved.status === "published"
          ? EMPTY
          : {
              id: saved.id,
              title: form.title,
              summary: form.summary,
              body: form.body,
              status: "draft",
            },
      );
      setNotice(saved.status === "published" ? "Published." : "Draft saved.");
      try {
        await reload();
      } catch {
        setNotice(
          saved.status === "published"
            ? "Published. Your story is saved, but the list could not refresh. Reload to see it."
            : "Draft saved. The list could not refresh. Reload to see it.",
        );
      }
    } catch (err) {
      setError(err?.message || "Your story was not saved.");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <main className="ifund-public min-h-dvh px-5 py-12 text-white">
        <p className="mx-auto max-w-3xl text-slate-300">
          Checking your account…
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="ifund-public min-h-dvh px-5 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          <BrandLogo size="sm" nameClassName="text-slate-100" />
          <h1 className="mt-6 text-3xl font-semibold">
            Sign in to manage your publication
          </h1>
          <p className="mt-3 text-slate-300">
            Only the verified owner of a publication can write here.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950"
          >
            Sign in
          </Link>
        </div>
      </main>
    );
  }

  const blog = workspace?.blog;
  const entries = workspace?.entries || [];

  return (
    <main className="ifund-public min-h-dvh px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <BrandLogo size="sm" nameClassName="text-slate-100" />
        <h1 className="mt-6 text-3xl font-semibold">
          {blog ? blog.title : "Your publication"}
        </h1>

        {!blog ? (
          <p className="mt-4 rounded-2xl border border-slate-600 bg-white/5 p-5 text-slate-200">
            This account does not own a publication. You can read every
            published story in the{" "}
            <Link to="/blogs" className="underline">
              story library
            </Link>
            .
          </p>
        ) : (
          <>
            <form
              onSubmit={(e) => submit(e, "draft")}
              className="mt-6 space-y-4"
            >
              <label className="block text-sm font-medium">
                Headline
                <input
                  required
                  maxLength={160}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
                />
              </label>
              <label className="block text-sm font-medium">
                Summary
                <input
                  maxLength={400}
                  value={form.summary}
                  onChange={(e) =>
                    setForm({ ...form, summary: e.target.value })
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"
                />
              </label>
              <label className="block text-sm font-medium">
                Story
                <textarea
                  required
                  rows={10}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-500 bg-white p-4 text-slate-950"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-200">
                  {error}
                </p>
              )}
              {notice && (
                <p role="status" className="text-sm text-cyan-200">
                  {notice}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  type="submit"
                  className="min-h-12 rounded-xl border border-cyan-300 px-5 font-semibold text-cyan-100 disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save draft"}
                </button>
                <button
                  disabled={busy}
                  type="button"
                  onClick={(e) => submit(e, "published")}
                  className="min-h-12 rounded-xl bg-cyan-400 px-5 font-semibold text-slate-950 disabled:opacity-60"
                >
                  {busy ? "Publishing…" : "Publish"}
                </button>
                {form.id && (
                  <button
                    disabled={busy}
                    type="button"
                    onClick={() => {
                      setForm(EMPTY);
                      setError("");
                      setNotice("");
                    }}
                    className="min-h-12 rounded-xl px-4 text-slate-300"
                  >
                    New story
                  </button>
                )}
              </div>
            </form>

            <h2 className="mt-10 text-xl font-semibold">Your stories</h2>
            {entries.length === 0 ? (
              <p className="mt-3 text-slate-300">
                No stories yet. The first one is yours to write.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-600 bg-white/5 p-4"
                  >
                    <span>
                      <span className="font-medium">{entry.title}</span>
                      <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">
                        {entry.status}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => edit(entry)}
                      className="min-h-11 rounded-lg border border-slate-500 px-4 text-sm"
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}
