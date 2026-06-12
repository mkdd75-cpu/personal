import express from 'express';
import mongoose from 'mongoose';
import Appointment from '../models/Appointment.js';
import User from '../../users/models/User.js';
import { authenticate } from '../../middleware/auth.js';
import { sendEmail } from '../../utils/mailer.js';
import { appointmentEmail } from '../../utils/emailTemplates.js';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * POST /appointments
 * Create an appointment request.
 * - A patient can book with a doctor/preceptor.
 * - A doctor/preceptor can book with a patient.
 * The "patient" field is always set to whichever party is the patient.
 */
router.post('/appointments', authenticate, async (req, res) => {
    try {
        const { recipientId, reason, visitType, scheduledFor } = req.body;

        if (!recipientId || !isValidId(recipientId)) {
            return res.status(400).json({ error: 'A valid recipient is required' });
        }
        if (!reason || !scheduledFor) {
            return res.status(400).json({ error: 'Reason and date are required' });
        }

        const recipient = await User.findById(recipientId).select('role');
        if (!recipient) {
            return res.status(404).json({ error: 'Recipient not found' });
        }

        // Determine which party is the patient
        const requesterIsPatient = req.user.role === 'patient';
        const patientId = requesterIsPatient ? req.user._id : recipientId;

        // Staff auto-confirm their own bookings; patient requests start pending
        const status = requesterIsPatient ? 'pending' : 'confirmed';

        const appointment = await Appointment.create({
            requester: req.user._id,
            recipient: recipientId,
            patient: patientId,
            reason,
            visitType: visitType || 'screening',
            scheduledFor,
            status,
        });

        const populated = await Appointment.findById(appointment._id)
            .populate('requester', 'firstname lastname role email')
            .populate('recipient', 'firstname lastname role specialization email')
            .populate('patient', 'firstname lastname email');

        // Fire off notification emails (non-blocking — failures won't break the response)
        const patientEmail = populated.patient?.email;
        const providerEmail = populated.recipient?.email;

        if (patientEmail) {
            const { subject, html } = appointmentEmail(populated, 'patient');
            sendEmail({ to: patientEmail, subject, html });
        }
        if (providerEmail && providerEmail !== patientEmail) {
            const { subject, html } = appointmentEmail(populated, 'provider');
            sendEmail({ to: providerEmail, subject, html });
        }

        res.status(201).json(populated);
    } catch (err) {
        console.error('Create appointment error:', err);
        res.status(500).json({ error: 'Failed to create appointment' });
    }
});

/**
 * GET /appointments/:userId
 * Return the appointment queue for a user — both ones they requested
 * and ones where they are the recipient. Sorted soonest first.
 */
router.get('/appointments/:userId', authenticate, async (req, res) => {
    const { userId } = req.params;

    if (!isValidId(userId)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    // Users can only see their own queue (admins/preceptors can see any)
    if (
        req.user._id.toString() !== userId &&
        req.user.role !== 'preceptor' &&
        req.user.role !== 'admin'
    ) {
        return res.status(403).json({ error: 'You can only view your own appointments' });
    }

    try {
        const appointments = await Appointment.find({
            $or: [{ requester: userId }, { recipient: userId }],
        })
            .populate('requester', 'firstname lastname role')
            .populate('recipient', 'firstname lastname role specialization')
            .populate('patient', 'firstname lastname')
            .sort({ scheduledFor: 1 });

        res.json(appointments);
    } catch (err) {
        console.error('Get appointments error:', err);
        res.status(500).json({ error: 'Failed to fetch appointments' });
    }
});

/**
 * PATCH /appointments/:id/status
 * Update the status of an appointment (confirm, decline, complete, cancel).
 */
router.patch('/appointments/:id/status', authenticate, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'declined'];
    if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    if (!isValidId(id)) {
        return res.status(400).json({ error: 'Invalid appointment id' });
    }

    try {
        const appointment = await Appointment.findById(id);
        if (!appointment) {
            return res.status(404).json({ error: 'Appointment not found' });
        }

        // Only a participant (or staff) can change status
        const isParticipant =
            appointment.requester.toString() === req.user._id.toString() ||
            appointment.recipient.toString() === req.user._id.toString();

        if (!isParticipant && req.user.role !== 'preceptor' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized to modify this appointment' });
        }

        appointment.status = status;
        await appointment.save();

        const populated = await Appointment.findById(id)
            .populate('requester', 'firstname lastname role email')
            .populate('recipient', 'firstname lastname role specialization email')
            .populate('patient', 'firstname lastname email');

        // Notify the patient when the status meaningfully changes
        if (['confirmed', 'declined', 'cancelled', 'completed'].includes(status)) {
            const patientEmail = populated.patient?.email;
            if (patientEmail) {
                const { subject, html } = appointmentEmail(populated, 'patient');
                sendEmail({ to: patientEmail, subject, html });
            }
        }

        res.json(populated);
    } catch (err) {
        console.error('Update appointment status error:', err);
        res.status(500).json({ error: 'Failed to update appointment' });
    }
});

/**
 * POST /ratings/:userId
 * Leave a rating (1-5) and optional review for a doctor/preceptor.
 * Typically done by a patient after a completed appointment.
 */
router.post('/ratings/:userId', authenticate, async (req, res) => {
    const { userId } = req.params;
    const { rating, comment } = req.body;

    if (!isValidId(userId)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    const numericRating = Number(rating);
    if (!numericRating || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    try {
        const target = await User.findById(userId);
        if (!target) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (target.role !== 'doctor' && target.role !== 'preceptor') {
            return res.status(400).json({ error: 'Only doctors and preceptors can be rated' });
        }

        target.ratings.push(numericRating);
        target.reviews.push({
            reviewer: `${req.user.firstname} ${req.user.lastname}`,
            rating: numericRating,
            comment: comment || '',
            date: new Date(),
        });
        await target.save();

        const avg =
            target.ratings.reduce((a, b) => a + b, 0) / target.ratings.length;

        res.status(201).json({
            message: 'Rating submitted',
            averageRating: avg.toFixed(1),
            totalRatings: target.ratings.length,
        });
    } catch (err) {
        console.error('Rating error:', err);
        res.status(500).json({ error: 'Failed to submit rating' });
    }
});

export default router;
