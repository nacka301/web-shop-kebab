// Slanje preko Resenda (REST, bez SDK-a). Postavke dolaze isključivo iz env varijabli.
export type Email = { to: string; subject: string; html: string; text: string };

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
}

// Nikad ne baca grešku: vraća true/false. U log ide samo status/vrsta greške, bez adresa i
// sadržaja narudžbe (tijelo Resendova odgovora namjerno se ne ispisuje).
export async function sendEmail(email: Email): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [email.to], subject: email.subject, html: email.html, text: email.text }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[mail] Resend je odbio zahtjev", { status: response.status });
      return false;
    }
    return true;
  } catch (error) {
    console.error("[mail] slanje nije uspjelo", { reason: error instanceof Error ? error.name : "unknown" });
    return false;
  }
}
