"use client";

import { useEffect, useState } from "react";
import { toastifier } from "@/lib/toastifier";

type AvatarUploadProps = {
  currentAvatar: string;
  onAvatarChange: (avatar: string) => Promise<void> | void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function AvatarUpload({
  currentAvatar,
  onAvatarChange,
}: AvatarUploadProps) {
  const [preview, setPreview] = useState(currentAvatar);
  const [pendingAvatar, setPendingAvatar] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    setPreview(currentAvatar);
  }, [currentAvatar]);

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

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setPreview(result);
      setPendingAvatar(result);
    };
    reader.readAsDataURL(file);
  };

  const saveAvatar = async () => {
    if (!pendingAvatar) {
      return;
    }

    setIsUploading(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    await onAvatarChange(pendingAvatar);
    setPendingAvatar("");
    setIsUploading(false);
  };

  return (
    <section className="card-fade-in overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF]">
      <header className="border-b border-[rgba(11,18,32,0.08)] px-5 py-3">
        <p className="section-label">Avatar</p>
      </header>
      <div className="flex flex-wrap items-center gap-4 p-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#FFFFFF] text-[#6B7280]">
          {preview ? (
            <img
              src={preview}
              alt="Avatar preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="font-barlow-condensed text-[10px] font-bold uppercase tracking-[1px]">
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
            className="rounded-[3px] border border-[rgba(11,18,32,0.08)] bg-[#F3F4F7] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#6B7280] transition-colors hover:text-[#0B1220]"
          >
            Upload New
          </button>

          {pendingAvatar ? (
            <button
              type="button"
              onClick={saveAvatar}
              disabled={isUploading}
              className="rounded-[3px] bg-[#DC2626] px-4 py-2 font-barlow-condensed text-xs font-bold uppercase tracking-[1.5px] text-[#F6F7F9] transition-colors hover:bg-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Saving…" : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
