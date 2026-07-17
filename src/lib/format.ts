export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export type PasswordStrength = {
  score: number;
  label: "Fraca" | "Média" | "Forte";
  color: string;
  isStrong: boolean;
};

export function passwordStrength(password: string): PasswordStrength {
  const checks = [
    password.length >= 8,
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  if (score <= 2) return { score, label: "Fraca", color: "bg-destructive", isStrong: false };
  if (score <= 3) return { score, label: "Média", color: "bg-warn", isStrong: false };
  return { score, label: "Forte", color: "bg-trust", isStrong: true };
}
