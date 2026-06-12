import { Resend } from 'resend';

// The API key lives ONLY in the environment — never hard-coded.
const resend = new Resend(process.env.RESEND_API_KEY);

// Until you verify your own domain in the Resend dashboard, this must stay as
// the Resend test sender. Once your domain is verified, change RESEND_FROM in
// .env to e.g. "Nkwapa Health <noreply@yourdomain.com>".
const FROM = process.env.RESEND_FROM || 'Nkwapa Health <onboarding@resend.dev>';

/**
 * Send an email via Resend.
 * This NEVER throws — email failures should not break the API request that
 * triggered them. It returns { ok, id } or { ok: false, error } so callers can
 * log the result without wrapping every call in try/catch.
 */
export async function sendEmail({ to, subject, html }) {
    // If no API key is configured, quietly skip (useful in local dev/tests)
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not set — skipping email:', subject);
        return { ok: false, error: 'No API key configured' };
    }

    if (!to) {
        return { ok: false, error: 'No recipient' };
    }

    try {
        const { data, error } = await resend.emails.send({ from: FROM, to, subject, html });

        if (error) {
            console.error('Resend error:', error);
            return { ok: false, error };
        }

        return { ok: true, id: data?.id };
    } catch (err) {
        console.error('Email send failed:', err.message);
        return { ok: false, error: err.message };
    }
}
