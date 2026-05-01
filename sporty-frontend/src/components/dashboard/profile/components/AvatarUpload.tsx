"use client";

import { useEffect, useState } from "react";
import { toastifier } from "@/libs/toastifier";

type AvatarUploadProps = {
  currentAvatar: string;
  onAvatarChange: (avatar: string) => Promise<void> | void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

export function AvatarUpload({ currentAvatar, onAvatarChange }: AvatarUploadProps) {
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
    <section className="card-fade-in rounded-lg border border-accent/20 bg-white p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-accent/30 text-secondary">
          {preview ? (
            <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold">No Image</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            className="rounded-lg border border-border px-4 py-2 text-black transition-colors hover:bg-[#F4F4F9]"
          >
            Upload New Avatar
          </button>

          {pendingAvatar ? (
            <button
              type="button"
              onClick={saveAvatar}
              disabled={isUploading}
              className="rounded-lg bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-700 disabled:opacity-70"
            >
              {isUploading ? "Saving..." : "Save"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
