export type StrengthLevel = 0 | 1 | 2 | 3;

export function getPasswordStrength(password: string): StrengthLevel {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]/.test(password)) score++;
  if (score <= 1) return 1;
  if (score <= 2) return 2;
  return 3;
}

export function getPasswordTips(password: string): string[] {
  const tips: string[] = [];
  if (password.length < 6) tips.push("至少 6 个字符");
  if (!/[A-Z]/.test(password)) tips.push("建议包含大写字母");
  if (!/[a-z]/.test(password)) tips.push("建议包含小写字母");
  if (!/[0-9]/.test(password)) tips.push("建议包含数字");
  if (!/[!@#$%^&*()_+\-=\[\]{}|;':",.\/<>?`~]/.test(password)) tips.push("建议包含特殊字符");
  return tips;
}
