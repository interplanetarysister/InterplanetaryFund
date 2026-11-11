import React, { useEffect, useRef, useState } from "react";
import { drivePickerConfigured, loadDrivePicker, pickDriveImage } from "@/lib/googleDrivePicker";

export default function DriveImageButton({ onFile, disabled, maxBytes, className }) {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const request = useRef(null);

  function prepare() {
    setStatus("loading");
    setError("");
    loadDrivePicker().then(() => setStatus("ready"), () => setStatus("unavailable"));
  }

  useEffect(() => {
    if (drivePickerConfigured) prepare();
    return () => request.current?.abort();
  }, []);

  if (!drivePickerConfigured) return null;

  async function selectImage() {
    if (status === "unavailable") { prepare(); return; }
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setStatus("picking");
    setError("");
    try {
      const file = await pickDriveImage(maxBytes, controller.signal);
      if (file && !controller.signal.aborted) await onFile(file);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause.message || "Google Drive could not import the image.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setStatus("ready");
    }
  }

  return <div>
    <button type="button" className={className} onClick={selectImage}
      disabled={disabled || status === "picking" || status === "loading"}>
      {status === "picking" ? "Opening Google Drive…" : status === "unavailable" ? "Retry Google Drive" : "Choose from Google Drive"}
    </button>
    {error && <p role="alert" className="text-sm">{error}</p>}
  </div>;
}
