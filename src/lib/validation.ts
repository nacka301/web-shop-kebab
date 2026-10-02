// Hrvatski mobitel: 09x xxx xxxx, +385 9x xxx xxxx ili 00385 9x… Sprema se kao +3859xxxxxxxx.
export function normalizeCroatianPhone(raw: string): string | null {
  let digits = raw.replace(/[\s\-()/.]/g, "");
  if (digits.startsWith("00385")) digits = `+385${digits.slice(5)}`;
  if (digits.startsWith("0")) digits = `+385${digits.slice(1)}`;
  return /^\+3859\d{7,8}$/.test(digits) ? digits : null;
}
