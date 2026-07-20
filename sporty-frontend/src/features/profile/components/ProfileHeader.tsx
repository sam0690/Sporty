"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { toastifier } from "@/lib/toastifier";
import { formatDate } from "@/utils/dateUtils";

type ProfileHeaderProps = {
  userName: string;
  userEmail: string;
  avatarUrl: string;
  memberSince?: string;
  onAvatarChange: (file: File) => Promise<void> | void;
};

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024;

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "U";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function ProfileHeader({
  userName,
  userEmail,
  avatarUrl,
  memberSince,
  onAvatarChange,
}: ProfileHeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [blobPreview, setBlobPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const preview = blobPreview ?? avatarUrl;
  const showImage = Boolean(preview) && !imageFailed;

  useEffect(() => {
    return () => {
      if (blobPreview) {
        URL.revokeObjectURL(blobPreview);
      }
    };
  }, [blobPreview]);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-selecting the same file after cancel
    if (!file) {
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toastifier.error("Please upload a JPEG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toastifier.error("Avatar must be smaller than 2MB.");
      return;
    }
    setImageFailed(false);
    setBlobPreview(URL.createObjectURL(file));
    setPendingFile(file);
  };

  const discardPending = () => {
    setPendingFile(null);
    setBlobPreview(null);
  };

  const saveAvatar = async () => {
    if (!pendingFile) {
      return;
    }
    setIsUploading(true);
    try {
      // Success/error toasts come from the upload mutation (useApiMutation).
      await onAvatarChange(pendingFile);
      discardPending();
    } catch {
      // Keep the pending preview so the user can retry; toast already shown.
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <header className="card-surface overflow-hidden">
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Change avatar"
          className="group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/25 bg-accent/10 font-display text-3xl tracking-[-0.02em] text-accent outline-none transition-[box-shadow,border-color] duration-200 hover:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          {showImage ? (
            blobPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: object URL, next/image can't optimize it
              <img
                src={preview}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <Image
                src={preview}
                alt=""
                width={96}
                height={96}
                className="size-full object-cover"
                onError={() => setImageFailed(true)}
              />
            )
          ) : (
            getInitials(userName)
          )}

          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-0/70 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
            <Camera className="size-5 text-fg-1" strokeWidth={1.75} />
            <span className="font-sans text-[9px] font-700 uppercase tracking-[1.5px] text-fg-1">
              Change
            </span>
          </span>
        </button>

        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate font-sans text-xl font-700 uppercase tracking-[1px] text-fg-1">
            {userName || "—"}
          </h1>
          <p className="truncate text-sm text-fg-3">{userEmail}</p>
          {memberSince ? (
            <p className="pt-1 font-sans text-[10px] font-700 uppercase tracking-[1.5px] text-fg-3">
              Member since {formatDate(memberSince)}
            </p>
          ) : null}
        </div>

        {pendingFile ? (
          <div className="flex w-full items-center gap-2 border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={saveAvatar}
              disabled={isUploading}
              className="flex-1 rounded-[3px] bg-accent px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-surface-0 transition-colors hover:bg-accent-bright disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isUploading ? "Saving…" : "Save photo"}
            </button>
            <button
              type="button"
              onClick={discardPending}
              disabled={isUploading}
              className="rounded-[3px] border border-white/8 bg-surface-3 px-4 py-2 font-sans text-xs font-700 uppercase tracking-[1.5px] text-fg-2 transition-colors hover:text-fg-1 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
