import { useMemo, useState } from "react";

export default function CampaignSharing({ id, title, status }) {
  const [message, setMessage] = useState("");
  const url = useMemo(() => new URL("/campaign/" + encodeURIComponent(id), window.location.origin).toString(), [id]);
  const embedUrl = useMemo(() => new URL("/embed/campaign/" + encodeURIComponent(id), window.location.origin).toString(), [id]);
  const embedCode = '<iframe src="' + embedUrl + '" title="' + String(title || "Interplanetary Fund campaign").replace(/[<>"&]/g, "") + '" loading="lazy" width="100%" height="450" style="border:0" referrerpolicy="no-referrer-when-downgrade"></iframe>';

  async function copy(text, description) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unsupported");
      await navigator.clipboard.writeText(text);
      setMessage(description + " copied.");
    } catch {
      setMessage("Automatic copying is unavailable. Select the link or embed code and copy it manually.");
    }
  }
  async function share() {
    if (!navigator.share) {
      await copy(url, "Campaign link");
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch (e) {
      if (e?.name !== "AbortError") setMessage("Sharing was not completed. Use the copy link option.");
    }
  }
  if (status !== "active") return null;
  return <section className="card ifund-share-campaign" aria-label="Share campaign">
    <h2>Share this campaign</h2>
    <p>Help others discover this fundraiser. Sharing does not make or process a donation.</p>
    <label>Public campaign link <input readOnly value={url} onFocus={e => e.target.select()} /></label>
    <div className="ifund-share-actions">
      <button type="button" onClick={() => copy(url, "Campaign link")}>Copy link</button>
      <button type="button" onClick={share}>Share</button>
      <a target="_blank" rel="noopener noreferrer" href={"https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url)}>Facebook</a>
      <a target="_blank" rel="noopener noreferrer" href={"https://twitter.com/intent/tweet?text=" + encodeURIComponent(title) + "&url=" + encodeURIComponent(url)}>X</a>
    </div>
    <details><summary>Embed this campaign</summary>
      <p>Use this code on a site you control. The embedded view does not accept payments.</p>
      <textarea readOnly rows={3} value={embedCode} onFocus={e => e.target.select()} aria-label="Campaign embed HTML" />
      <button type="button" onClick={() => copy(embedCode, "Embed code")}>Copy embed code</button>
    </details>
    {message && <p role="status">{message}</p>}
  </section>;
}
