import React, { useState } from "react";
import { Check, Copy, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";

// Teaches an app user how to point an AI client at this app's MCP server.
// The server URL is resolved at runtime from the current origin so it works
// on any published domain or custom domain without hardcoding.
export default function Connect() {
  const serverUrl = new URL("/api/mcp", window.location.origin).toString();
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard?.writeText(serverUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const clients = [
    {
      name: "Claude",
      steps: [
        "Open your profile menu → Settings → Connectors.",
        'Click "Add custom connector", give it a name.',
        `Paste the server URL above, then click Add.`,
      ],
    },
    {
      name: "ChatGPT",
      steps: [
        "Go to Apps and enable Developer mode (accept the risk prompt).",
        'Click "Create app" and give it a name.',
        "Paste the server URL above, click Create, then enable the app from the chat composer before prompting.",
      ],
    },
    {
      name: "Cursor",
      steps: [
        'Open Settings → Tools & Integrations → "New MCP Server".',
        "This opens your mcp.json — add an entry whose url is the server URL above.",
        "Save and toggle the server on.",
      ],
    },
    {
      name: "Custom",
      steps: [
        "Copy the server URL above.",
        "Add it as a streamable HTTP MCP server in your client (name + URL is all most need).",
        "Reload the client so it picks up the tool list.",
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto py-4 sm:py-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
          <Plug className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-foreground">AI Connections</h1>
          <p className="text-sm text-muted-foreground">Connect an external AI client to your IFund workspace. Built-in IFund specialist agents remain in the AI Team.</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 mb-6">
        <p className="text-sm font-medium text-foreground mb-2">Server URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground truncate">{serverUrl}</code>
          <Button variant="outline" size="icon" onClick={copy} aria-label="Copy URL">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {clients.map((c) => (
          <div key={c.name} className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-lg text-foreground mb-3">{c.name}</h2>
            <ol className="space-y-2">
              {c.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <p className="text-sm text-foreground">
          <strong className="font-medium">One more step:</strong> each client will open this app's consent page. Sign in with your Interplanetary Fund account and approve — the assistant acts only as you, with exactly your permissions.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          After we ship changes to the platform, refresh the connector in your client — assistants cache the tool list.
        </p>
      </div>
    </div>
  );
}