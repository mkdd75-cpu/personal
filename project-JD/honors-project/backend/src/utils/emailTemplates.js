// Branded HTML email templates for Nkwapa Health.
// Each function returns { subject, html } ready to pass to sendEmail().

const BRAND = '#30876c';

function layout(title, bodyHtml) {
    return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #2d2d2d;">
      <div style="background: ${BRAND}; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="color: #fff; font-size: 20px; margin: 0;">Nkwapa Health</h1>
      </div>
      <div style="border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <h2 style="color: ${BRAND}; font-size: 18px; margin-top: 0;">${title}</h2>
        ${bodyHtml}
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="font-size: 12px; color: #999; margin: 0;">
          Akomapa Health &middot; This is an automated message, please do not reply.
        </p>
      </div>
    </div>`;
}

function formatDateTime(d) {
    return new Date(d).toLocaleString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

/**
 * Welcome email — sent when a user registers.
 */
export function welcomeEmail(user) {
    return {
        subject: 'Welcome to Nkwapa Health',
        html: layout('Welcome aboard!', `
            <p>Hi ${user.firstname},</p>
            <p>Your Nkwapa Health account has been created successfully as a
            <strong>${user.role}</strong>.</p>
            <p>You can now sign in to manage your health records, book appointments,
            and message clinicians securely.</p>
        `),
    };
}

/**
 * Appointment confirmation/request email.
 * `audience` is either 'patient' or 'provider' to tailor the wording.
 */
export function appointmentEmail(appointment, audience) {
    const patientName = `${appointment.patient?.firstname || ''} ${appointment.patient?.lastname || ''}`.trim();
    const providerName = `${appointment.recipient?.firstname || ''} ${appointment.recipient?.lastname || ''}`.trim();
    const when = formatDateTime(appointment.scheduledFor);
    const isConfirmed = appointment.status === 'confirmed';

    const heading = isConfirmed ? 'Appointment Confirmed' : 'New Appointment Request';

    const details = `
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 0; color: #888; width: 120px;">When</td><td style="padding: 6px 0;"><strong>${when}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Reason</td><td style="padding: 6px 0;">${appointment.reason}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Type</td><td style="padding: 6px 0; text-transform: capitalize;">${appointment.visitType}</td></tr>
          <tr><td style="padding: 6px 0; color: #888;">Status</td><td style="padding: 6px 0; text-transform: capitalize;">${appointment.status}</td></tr>
        </table>`;

    if (audience === 'provider') {
        return {
            subject: `${heading}: ${patientName}`,
            html: layout(heading, `
                <p>Hi ${providerName || 'there'},</p>
                <p>${isConfirmed ? 'An appointment has been scheduled with' : 'You have a new appointment request from'}
                <strong>${patientName}</strong>.</p>
                ${details}
                <p>Please log in to review${isConfirmed ? '' : ', confirm, or decline'} this appointment.</p>
            `),
        };
    }

    // patient audience
    return {
        subject: `${heading} with ${providerName}`,
        html: layout(heading, `
            <p>Hi ${appointment.patient?.firstname || 'there'},</p>
            <p>${isConfirmed
                ? `Your appointment with <strong>${providerName}</strong> has been confirmed.`
                : `Your appointment request with <strong>${providerName}</strong> has been received and is pending confirmation.`}</p>
            ${details}
        `),
    };
}

/**
 * NHIS expiry reminder email.
 */
export function nhisReminderEmail(user, daysLeft) {
    const expiry = user.nhisStatus?.nhisExpiry
        ? new Date(user.nhisStatus.nhisExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'soon';
    return {
        subject: 'Your NHIS card is expiring soon',
        html: layout('NHIS Renewal Reminder', `
            <p>Hi ${user.firstname},</p>
            <p>Our records show your National Health Insurance Scheme (NHIS) card
            ${daysLeft > 0 ? `expires in <strong>${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>` : 'has expired'}
            (expiry date: <strong>${expiry}</strong>).</p>
            <p>Please renew your NHIS card to keep your coverage active for your visits.</p>
        `),
    };
}
