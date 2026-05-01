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
  let color = "bg-danger";
  let width = "33%";

  if (password.length >= 8 && hasLetters && hasNumbers) {
    label = "Strong";
    color = "bg-primary";
    width = "100%";
  } else if (password.length >= 6 && (hasLetters || hasNumbers)) {
    label = "Medium";
    color = "bg-warning";
    width = "66%";
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent/30">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width }} />
      </div>
      <p className="text-xs font-medium text-secondary">Password strength: {label}</p>
    </div>
  );
}
