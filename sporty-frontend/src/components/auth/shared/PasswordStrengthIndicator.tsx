"use client";

type PasswordStrengthIndicatorProps = {
  password: string;
};

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  if (!password) {
    return null;
  }

  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /\d/.test(password);

  let label = "Weak";
  let color = "#ff3b5c";
  let width = "33%";

  if (password.length >= 8 && hasLetters && hasNumbers) {
    label = "Strong";
    color = "#00ff88";
    width = "100%";
  } else if (password.length >= 6 && (hasLetters || hasNumbers)) {
    label = "Medium";
    color = "#ffd86b";
    width = "66%";
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[rgba(255,255,255,0.08)]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width, background: color }}
        />
      </div>
      <p className="font-barlow-condensed text-[11px] font-700 uppercase tracking-[1px] text-[#555560]">
        Password strength:{" "}
        <span style={{ color }}>{label}</span>
      </p>
    </div>
  );
}
