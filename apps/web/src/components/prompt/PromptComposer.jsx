import React, { useId, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";

/**
 * The shared prompt-first input. One pattern for the homepage, the dashboard
 * and campaign improvement flows; the caller owns what happens to the text.
 * Keeps a 44px+ submit target and supports Ctrl/Cmd+Enter.
 */
export default function PromptComposer({
  id = "ifund-prompt",
  label = "What would you like to make possible?",
  placeholder = "I want to… I need help with… What if we could…",
  submitLabel = "Explore my possibilities",
  note = "Start privately. A campaign or donation is never required.",
  examples = [],
  maxLength = 12000,
  variant = "panel",
  initialValue = "",
  onSubmit,
  className = "",
}) {
  const generatedId = useId();
  const inputId = `${id}-${generatedId}`;
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();
  const dark = variant === "hero";

  function submit(event) {
    event?.preventDefault();
    if (!trimmed) return;
    onSubmit?.(trimmed);
  }

  return (
    <form
      onSubmit={submit}
      className={`${dark ? "border-cyan-200/25 bg-slate-950/80 text-white" : "border-border bg-card"} rounded-2xl border p-4 text-left shadow-xl ${className}`}
    >
      <label htmlFor={inputId} className={`flex items-center gap-2 text-sm font-semibold ${dark ? "text-cyan-100" : "text-foreground"}`}>
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        {label}
      </label>
      <textarea
        id={inputId}
        rows={3}
        maxLength={maxLength}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") submit(event);
        }}
        placeholder={placeholder}
        className={`mt-2 w-full resize-y rounded-xl border px-4 py-3 text-base ${dark ? "border-white/20 bg-slate-900 text-white placeholder-slate-400" : "border-input bg-background text-foreground"} min-h-[104px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400`}
      />
      {examples.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2" aria-label="Example prompts">
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setValue(example)}
              className={`ifund-tap rounded-full border px-3 py-1.5 text-left text-xs font-medium ${dark ? "border-white/20 text-slate-200 hover:border-cyan-300" : "border-border text-muted-foreground hover:border-cyan-400"}`}
            >
              {example}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!trimmed}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 font-semibold text-white shadow-lg shadow-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
        <p className={`text-xs ${dark ? "text-slate-300" : "text-muted-foreground"}`}>{note}</p>
      </div>
    </form>
  );
}
