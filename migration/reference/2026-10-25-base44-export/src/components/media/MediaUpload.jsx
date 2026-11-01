import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Loader2, UploadCloud, X } from "lucide-react";
import { uploadUserImage } from "@/lib/ifundImageBranding";

// Image uploads apply the account watermark policy before returning the URL.
// There is no separate branding or version-selection step.
const isVideo = (url = "") => /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(url);

export default function MediaUpload({
  value,
  onChange,
  label = "Upload media",
  accept = "image/*,video/*",
  previewClassName = "w-full max-h-[32rem] rounded-xl object-contain bg-slate-950",
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const file_url = await uploadUserImage(base44, file);
      if (!file_url) throw new Error("Upload did not return an asset URL");
      onChange(file_url);
    } catch {
      setError("Couldn't upload that file. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clearMedia = () => {
    setError("");
    onChange("");
  };

  return (
    <div className="space-y-2">
      {value && (
        <div className="relative">
          {isVideo(value) ? (
            <video src={value} controls className={previewClassName} />
          ) : (
            <Image src={value} alt="Preview" className={previewClassName} />
          )}
          <button
            type="button"
            onClick={clearMedia}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80"
            aria-label="Remove media"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="rounded-xl border-2 border-cyan-500 bg-white text-slate-950 font-semibold shadow-sm hover:bg-cyan-50 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-cyan-400"
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <UploadCloud className="w-4 h-4 mr-2" />
        )}
        {value ? "Replace media" : label}
      </Button>
    </div>
  );
}
