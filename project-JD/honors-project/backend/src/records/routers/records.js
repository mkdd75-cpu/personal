import express from 'express';
import mongoose from 'mongoose';
import MedicalRecord from '../../users/models/MedicalRecord.js';
import Encounter from '../../users/models/Encounter.js';
import User from '../../users/models/User.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = express.Router();
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// Only clinical staff may touch medical records
const clinicalStaff = authorize('doctor', 'preceptor', 'admin');

/**
 * GET /my-record
 * A patient's read-only view of their OWN medical record.
 */
router.get('/my-record', authenticate, async (req, res) => {
    try {
        let record = await MedicalRecord.findOne({ patient: req.user._id })
            .populate({
                path: 'encounters',
                populate: { path: 'receiver', select: 'firstname lastname role' },
                options: { sort: { visitDate: -1 } },
            });

        if (!record) {
            record = await MedicalRecord.create({ patient: req.user._id });
            await User.findByIdAndUpdate(req.user._id, {
                $addToSet: { medicalRecords: record._id },
            });
        }

        res.json(record);
    } catch (err) {
        console.error('Get my-record error:', err);
        res.status(500).json({ error: 'Failed to fetch your medical record' });
    }
});

/**
 * GET /records/:patientId
 * Fetch a patient's full medical record, with encounters populated.
 * Doctors and preceptors only.
 */
router.get('/records/:patientId', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;

    if (!isValidId(patientId)) {
        return res.status(400).json({ error: 'Invalid patient id' });
    }

    try {
        let record = await MedicalRecord.findOne({ patient: patientId })
            .populate({
                path: 'encounters',
                populate: { path: 'role receiver', select: 'firstname lastname role' },
                options: { sort: { visitDate: -1 } },
            });

        // Auto-create an empty record if none exists yet
        if (!record) {
            const patient = await User.findById(patientId).select('role');
            if (!patient) {
                return res.status(404).json({ error: 'Patient not found' });
            }
            record = await MedicalRecord.create({ patient: patientId });
            if (!patient.medicalRecords?.includes(record._id)) {
                await User.findByIdAndUpdate(patientId, {
                    $addToSet: { medicalRecords: record._id },
                });
            }
        }

        res.json(record);
    } catch (err) {
        console.error('Get record error:', err);
        res.status(500).json({ error: 'Failed to fetch medical record' });
    }
});

/**
 * PATCH /records/:patientId/vitals
 * Add a vital reading to the patient's record.
 */
router.patch('/records/:patientId/vitals', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;
    const { type, value } = req.body;

    const validTypes = ['bloodPressure', 'bloodGlucose', 'weight', 'height', 'BMI'];
    if (!validTypes.includes(type) || !value) {
        return res.status(400).json({ error: 'Valid vital type and value required' });
    }

    try {
        const record = await MedicalRecord.findOneAndUpdate(
            { patient: patientId },
            { $push: { vitals: { type, value, timestamp: new Date() } } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        console.error('Add vital error:', err);
        res.status(500).json({ error: 'Failed to add vital' });
    }
});

/**
 * PATCH /records/:patientId/labs
 * Add a lab result to the patient's record.
 */
router.patch('/records/:patientId/labs', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;
    const { testName, value, normalRange } = req.body;

    if (!testName || !value) {
        return res.status(400).json({ error: 'Test name and value required' });
    }

    try {
        const record = await MedicalRecord.findOneAndUpdate(
            { patient: patientId },
            { $push: { labResults: { testName, value, normalRange, timestamp: new Date() } } },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        console.error('Add lab error:', err);
        res.status(500).json({ error: 'Failed to add lab result' });
    }
});

/**
 * PATCH /records/:patientId/history
 * Add to the medical history (chronic conditions, allergies, surgeries, family history).
 * New items are MERGED with existing ones (deduplicated), so the input form can
 * stay blank and only ever submit additions.
 */
router.patch('/records/:patientId/history', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;
    const { chronicConditions, allergies, surgeries, familyHistory } = req.body;

    // Build a $addToSet update so new entries are appended without duplicates
    const addToSet = {};
    if (Array.isArray(chronicConditions) && chronicConditions.length)
        addToSet['medicalHistory.chronicConditions'] = { $each: chronicConditions };
    if (Array.isArray(allergies) && allergies.length)
        addToSet['medicalHistory.allergies'] = { $each: allergies };
    if (Array.isArray(surgeries) && surgeries.length)
        addToSet['medicalHistory.surgeries'] = { $each: surgeries };
    if (Array.isArray(familyHistory) && familyHistory.length)
        addToSet['medicalHistory.familyHistory'] = { $each: familyHistory };

    if (Object.keys(addToSet).length === 0) {
        return res.status(400).json({ error: 'No history items provided' });
    }

    try {
        const record = await MedicalRecord.findOneAndUpdate(
            { patient: patientId },
            { $addToSet: addToSet },
            { new: true, upsert: true }
        );
        res.json(record);
    } catch (err) {
        console.error('Update history error:', err);
        res.status(500).json({ error: 'Failed to update medical history' });
    }
});

/**
 * POST /records/:patientId/encounters
 * Create a full clinical encounter and attach it to the patient's record.
 */
router.post('/records/:patientId/encounters', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;
    const {
        visitType, visitDate, reason, diagnosis,
        vitals, labResults, treatment, counselingNotes, actionPlan,
    } = req.body;

    if (!visitType || !visitDate || !reason) {
        return res.status(400).json({ error: 'Visit type, date, and reason are required' });
    }

    try {
        const encounter = await Encounter.create({
            role: patientId,           // patient is the subject of the encounter
            receiver: req.user._id,    // the staff member who created it
            visitType,
            visitDate,
            reason,
            diagnosis,
            vitals: vitals || [],
            labResults: labResults || [],
            treatment: treatment || [],
            counselingNotes,
            actionPlan: actionPlan || [],
        });

        // Attach to the patient's medical record
        await MedicalRecord.findOneAndUpdate(
            { patient: patientId },
            { $push: { encounters: encounter._id } },
            { upsert: true }
        );

        // Also track on the patient's appointments array
        await User.findByIdAndUpdate(patientId, {
            $addToSet: { appointments: encounter._id },
        });

        const populated = await Encounter.findById(encounter._id)
            .populate('receiver', 'firstname lastname role');

        res.status(201).json(populated);
    } catch (err) {
        console.error('Create encounter error:', err);
        res.status(500).json({ error: 'Failed to create encounter' });
    }
});

/**
 * GET /records/:patientId/encounters
 * List all encounters for a patient, newest first.
 */
router.get('/records/:patientId/encounters', authenticate, clinicalStaff, async (req, res) => {
    const { patientId } = req.params;

    if (!isValidId(patientId)) {
        return res.status(400).json({ error: 'Invalid patient id' });
    }

    try {
        const encounters = await Encounter.find({ role: patientId })
            .populate('receiver', 'firstname lastname role')
            .sort({ visitDate: -1 });
        res.json(encounters);
    } catch (err) {
        console.error('Get encounters error:', err);
        res.status(500).json({ error: 'Failed to fetch encounters' });
    }
});

export default router;