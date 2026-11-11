import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import { authClient } from "@/api/auth";
import { resolveVerifiedEmailUser } from "@/lib/verifiedEmailUser";
import {
  createMemberBlog,
  loadReporterWorkspace,
  saveReporterStory,
} from "@/lib/reporterWorkspace";

const EMPTY = { id: "", title: "", summary: "", body: "", status: "draft" };

export default function MyPublication() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [selected, setSelected] = useState("");
  const [newBlog, setNewBlog] = useState({ title: "", description: "" });
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
        if (current) {
          const loaded = await loadReporterWorkspace(authClient(), current);
          if (live) setWorkspace(loaded);
        }
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
        blogId: blog.id,
        status,
      });
      await reload();
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

  const blogs = workspace?.blogs || [];
  const blog = blogs.find(item => item.id === selected) || blogs[0];
  const entries = blog?.entries || [];

  async function create(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const id = await createMemberBlog(authClient(), newBlog);
      await reload();
      setSelected(id);
      setNewBlog({ title: "", description: "" });
      setForm(EMPTY);
      setNotice("Blog created.");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ifund-public min-h-dvh px-5 py-12 text-white">
      <div className="mx-auto max-w-3xl">
        <BrandLogo size="sm" nameClassName="text-slate-100" />
        <h1 className="mt-6 text-3xl font-semibold">
          {blog ? blog.title : "Your publication"}
        </h1>

        {error && <p role="alert" className="mt-3 text-red-200">{error}</p>}
        {notice && <p role="status" className="mt-3 text-cyan-200">{notice}</p>}
        {blogs.length > 1 && <label className="mt-4 block">Select a blog
          <select value={blog.id} onChange={event => {
            setSelected(event.target.value);
            setForm(EMPTY);
            setError("");
            setNotice("");
          }} className="ml-3 min-h-11 rounded-xl bg-white px-3 text-slate-950" disabled={busy}>
            {blogs.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select>
        </label>}
        {workspace?.can_create && <form onSubmit={create} className="mt-5 space-y-3 rounded-xl border border-slate-600 p-4">
          <h2 className="text-xl font-semibold">Create a member blog</h2>
          <label className="block">Blog name
            <input required minLength={3} maxLength={90} value={newBlog.title} onChange={event => setNewBlog({ ...newBlog, title: event.target.value })} className="mt-1 min-h-11 w-full rounded-xl bg-white px-3 text-slate-950" />
          </label>
          <label className="block">Description
            <textarea maxLength={500} value={newBlog.description} onChange={event => setNewBlog({ ...newBlog, description: event.target.value })} className="mt-1 w-full rounded-xl bg-white p-3 text-slate-950" />
          </label>
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950">Create blog</button>
        </form>}
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
            {!blog.can_write && <p className="mt-4 text-slate-300">Publishing requires active access to this blog.</p>}
            {blog.can_write && <form
              onSubmit={(e) => submit(e, form.status === "published" ? "published" : "draft")}
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
                  maxLength={40000}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="mt-2 w-full rounded-xl border border-slate-500 bg-white p-4 text-slate-950"
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={busy}
                  type="submit"
                  className="min-h-12 rounded-xl border border-cyan-300 px-5 font-semibold text-cyan-100 disabled:opacity-60"
                >
                  {busy ? "Saving…" : form.status === "published" ? "Save changes" : "Save draft"}
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
            </form>}

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
                    {blog.can_write && <button
                      type="button"
                      onClick={() => edit(entry)}
                      className="min-h-11 rounded-lg border border-slate-500 px-4 text-sm"
                    >
                      Edit
                    </button>}
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
