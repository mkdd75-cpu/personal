/**
 * NHIS expiry reminder job.
 *
 * Finds patients whose NHIS card expires within the next N days (default 30)
 * and sends each a reminder email. This is NOT triggered by a user action —
 * run it on a schedule.
 *
 * Run manually:
 *   node src/jobs/nhisReminders.js
 *
 * Or via cron (e.g. daily at 8am). On a server with crontab:
 *   0 8 * * *  cd /path/to/backend && node src/jobs/nhisReminders.js >> logs/nhis.log 2>&1
 *
 * Loads environment variables the same way the app does. If you start the app
 * with env-cmd, run this the same way:
 *   env-cmd node src/jobs/nhisReminders.js
 */

import mongoose from 'mongoose';
import '../db/mongoose.js';
import User from '../users/models/User.js';
import { sendEmail } from '../utils/mailer.js';
import { nhisReminderEmail } from '../utils/emailTemplates.js';

const DAYS_AHEAD = Number(process.env.NHIS_REMINDER_DAYS || 30);

async function run() {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() + DAYS_AHEAD);

    // Patients with an active NHIS card expiring between now and the cutoff
    const patients = await User.find({
        role: 'patient',
        'nhisStatus.isActive': true,
        'nhisStatus.nhisExpiry': { $gte: now, $lte: cutoff },
        email: { $exists: true, $ne: '' },
    }).select('firstname lastname email nhisStatus');

    console.log(`Found ${patients.length} patient(s) with NHIS expiring within ${DAYS_AHEAD} days.`);

    let sent = 0;
    for (const patient of patients) {
        const expiry = new Date(patient.nhisStatus.nhisExpiry);
        const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

        const { subject, html } = nhisReminderEmail(patient, daysLeft);
        const result = await sendEmail({ to: patient.email, subject, html });

        if (result.ok) {
            sent++;
            console.log(`  ✓ Reminder sent to ${patient.email} (${daysLeft} days left)`);
        } else {
            console.log(`  ✗ Failed for ${patient.email}: ${result.error}`);
        }
    }

    console.log(`Done. ${sent}/${patients.length} reminder(s) sent.`);
}

run()
    .catch((err) => {
        console.error('NHIS reminder job failed:', err);
        process.exitCode = 1;
    })
    .finally(() => mongoose.connection.close());
