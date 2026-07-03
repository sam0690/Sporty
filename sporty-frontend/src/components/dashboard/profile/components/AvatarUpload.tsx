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
  const [preview, setPreview] = useState(currentAvatar);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setPreview(currentAvatar);
  }, [currentAvatar]);

  useEffect(() => {
    return () => {
      if (preview.startsWith("blob:")) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

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

    setPreview(URL.createObjectURL(file));
    setPendingFile(file);
  };

  const saveAvatar = async () => {
    if (!pendingFile) {
      return;
    }

    setIsUploading(true);
    try {
      await onAvatarChange(pendingFile);
      setPendingFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#111117]">
      <header className="border-b border-[rgba(255,255,255,0.08)] px-5 py-3">
        <p className="section-label">Avatar</p>
      </header>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0d0d12] text-[#555560]">
          {preview ? (
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
            className="rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#1d1d26] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#9a9aa5] transition-colors hover:text-[#f0f0f0]"
          >
            Upload New
          </button>

          {pendingFile ? (
            <button
              type="button"
              onClick={saveAvatar}
              disabled={isUploading}
              className="rounded-[3px] bg-[#e8fb25] px-4 py-2 font-barlow-condensed text-xs font-700 uppercase tracking-[1.5px] text-[#0a0a0f] transition-colors hover:bg-[#f0ff45] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
