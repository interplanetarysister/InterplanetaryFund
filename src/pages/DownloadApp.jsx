import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Smartphone, MonitorDown, ArrowLeft } from "lucide-react";
import { Planet } from "../components/UI";

// Original DownloadApp source preserved in the read-only IFund maintenance branch.
// Browser installation is real only when the current browser offers its install
// prompt; Android APK links are never invented or pulled from the old host.
export default function DownloadApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true);
    const available = (event) => { event.preventDefault(); setPrompt(event); };
    const completed = () => { setInstalled(true); setPrompt(null); setNotice("IFund was installed."); };
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", completed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", completed);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const result = await prompt.userChoice;
      if (result?.outcome !== "accepted") setNotice("You can install IFund later from the browser menu.");
    } catch {
      setNotice("Use your browser's menu to add IFund to your device.");
    } finally {
      setPrompt(null);
    }
  }
  return <main className="ifund-download-page stack">
    <div className="ifund-download-hero">
      <Planet />
      <h1>Download IFund</h1>
      <p>Open Interplanetary Fund like an app on your phone, tablet or computer.</p>
    </div>
    <section className="card ifund-download-feature">
      <Download size={36} aria-hidden="true" />
      <h2>Install the web app</h2>
      {installed ? <p role="status">IFund is already installed on this device.</p>
        : prompt ? <button type="button" className="primary" onClick={install}><Download size={19} /> Install IFund</button>
        : <p>Use your browser's install or Add to Home Screen command. An automatic install button appears here only when the browser offers it.</p>}
      {notice && <p role="status">{notice}</p>}
    </section>
    <div className="ifund-download-grid">
      <section className="card"><Smartphone size={26} aria-hidden="true" /><h2>Phone or tablet</h2>
        <p>On Android, open Chrome's menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On iPhone or iPad, use Safari's Share menu and select <strong>Add to Home Screen</strong>.</p>
      </section>
      <section className="card"><MonitorDown size={26} aria-hidden="true" /><h2>Computer</h2>
        <p>In Chrome or Edge, use the install icon in the address bar or the browser's installation menu. Installation options vary by browser.</p>
      </section>
    </div>
    <p className="ifund-route-notice">A signed Android APK download will only appear after an independently verified release has been published. This page does not provide an unverified APK.</p>
    <Link to="/" className="ifund-download-back"><ArrowLeft size={19} /> Back to homepage</Link>
  </main>;
}
