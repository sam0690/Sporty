"use client";

import { useEffect, useState } from "react";
import { toastifier } from "@/lib/toastifier";

type AvatarUploadProps = {
  currentAvatar: string;
  onAvatarChange: (file: File) => Promise<void> | void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function AvatarUpload({
  currentAvatar,
  onAvatarChange,
}: AvatarUploadProps) {
  const [blobPreview, setBlobPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const preview = blobPreview ?? currentAvatar;

  useEffect(() => {
    return () => {
      if (blobPreview) {
        URL.revokeObjectURL(blobPreview);
      }
    };
  }, [blobPreview]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toastifier.error("Please upload JPEG, PNG, or WEBP image.");
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toastifier.error("Avatar must be smaller than 2MB.");
      return;
    }

    setBlobPreview(URL.createObjectURL(file));
    setPendingFile(file);
  };

  const saveAvatar = async () => {
    if (!pendingFile) {
      return;
    }

    setIsUploading(true);
    try {
      await onAvatarChange(pendingFile);
      // Parent has refreshed currentAvatar by now; drop the local blob preview.
      setPendingFile(null);
      setBlobPreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-white/8 bg-surface-1">
      <header className="border-b border-white/8 px-5 py-3">
        <p className="section-label">Avatar</p>
      </header>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-white/8 bg-surface-2 text-fg-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview is a blob: object URL; next/image can't optimize those
            <img
              src={preview}
              alt="Avatar preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-barlow-condensed text-[10px] font-700 uppercase tracking-[1px]">
              No Image
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            id="avatar-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById("avatar-upload")?.click()}
            className="rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1"
          >
            Upload New
          </button>

          {pendingFile ? (
            <button
              type="button"
              onClick={saveAvatar}
              disabled={isUploading}
              className="rounded-[3px] bg-accent px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
