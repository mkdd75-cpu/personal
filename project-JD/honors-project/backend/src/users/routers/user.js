import express from 'express';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import User from '../models/User.js';
import MedicalRecord from '../models/MedicalRecord.js';
import Encounter from '../models/Encounter.js';
import { signToken, authenticate, authorize, authorizeSelf } from '../../middleware/auth.js';

const router = express.Router();
const PASSWORD_SALT_ROUNDS = 12;
const USER_SAFE_FIELDS = '-password';

// 'role' added to blocklist — users cannot promote themselves
const UPDATE_BLOCKLIST = new Set(['_id', 'password', 'email', 'role', 'createdAt', 'updatedAt']);

const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(PASSWORD_SALT_ROUNDS);
    return bcrypt.hash(password, salt);
};

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const sanitizeUpdate = (body) =>
    Object.fromEntries(Object.entries(body).filter(([key]) => !UPDATE_BLOCKLIST.has(key)));

// ── Public routes (no token required) ─────────────────────────────────────────

/**
 * POST /user
 * Register a new user (patient, doctor, or preceptor).
 */
router.post('/user', async (req, res) => {
    try {
        const {
            firstname, middlename, lastname, email, phone, dob, gender,
            address, role, cohort, specialization, emergencyContact,
            nhisStatus, nhisExpiry, nationalId, password,
        } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        const hashedPassword = await hashPassword(password);

        const newUser = new User({
            firstname, middlename, lastname, email, phone, dob, gender,
            address, role, cohort, specialization, emergencyContact,
            nhisStatus, nhisExpiry, nationalId,
            password: hashedPassword,
        });

        if (role === 'patient') {
            const medRecord = await MedicalRecord.create({ patient: newUser._id });
            newUser.medicalRecords.push(medRecord._id);
        }

        await newUser.save();

        const token = signToken(newUser);
        const userResponse = newUser.toObject();
        delete userResponse.password;

        res.status(201).json({ message: 'User created successfully', token, user: userResponse });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Validation failed', details: err.errors });
        }
        if (err.code === 11000 && err.keyPattern?.email) {
            return res.status(400).json({ error: 'Email already exists' });
        }
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /user/signin
 * Authenticate and return a JWT + user object.
 */
router.post('/user/signin', async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update last login timestamp
        user.lastLogin = new Date();
        await user.save();

        const token = signToken(user);
        const userData = user.toObject();
        delete userData.password;

        res.json({ message: 'Login successful', token, user: userData });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ── Protected routes (token required) ─────────────────────────────────────────

/**
 * GET /me
 * Return the full profile of the currently authenticated user.
 * Used by the frontend to re-hydrate the user object after a page refresh.
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        // req.user is already the full user (minus password) from the auth middleware
        res.json(req.user);
    } catch (err) {
        console.error('Get /me error:', err);
        res.status(500).json({ error: 'Failed to fetch current user' });
    }
});

/**
 * GET /users
 * Live search across first name, last name, and email.
 * Query params:
 *   q          - search term (matches name or email). 1+ char triggers a search.
 *   firstname  - legacy param, still supported.
 * Results are sorted by specialization (alphabetical, staff first) then by
 * average rating (highest first), so the most relevant providers surface first.
 */
router.get('/users', authenticate, async (req, res) => {
    try {
        const term = (req.query.q || req.query.firstname || '').trim();

        // Live search: a single character is enough to start returning results.
        // An empty term returns everyone the user is allowed to see (capped).
        const rx = term ? escapeRegex(term) : null;

        const baseQuery = rx
            ? {
                  $or: [
                      { firstname: { $regex: rx, $options: 'i' } },
                      { lastname: { $regex: rx, $options: 'i' } },
                      { email: { $regex: rx, $options: 'i' } },
                  ],
              }
            : {};

        let users = await User.find(baseQuery).select(USER_SAFE_FIELDS).limit(50);

        // Patients cannot see other patients
        if (req.user.role === 'patient') {
            users = users.filter((u) => u.role !== 'patient');
        }

        // Compute average rating once per user for sorting
        const withAvg = users.map((u) => {
            const obj = u.toObject();
            const ratings = obj.ratings || [];
            obj.averageRating = ratings.length
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : 0;
            return obj;
        });

        // Sort: providers with a specialization first (alphabetical),
        // then by highest average rating, then by name.
        withAvg.sort((a, b) => {
            const specA = a.specialization || '\uffff'; // patients sort last
            const specB = b.specialization || '\uffff';
            if (specA.toLowerCase() < specB.toLowerCase()) return -1;
            if (specA.toLowerCase() > specB.toLowerCase()) return 1;
            if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
            return (a.firstname || '').localeCompare(b.firstname || '');
        });

        res.json(withAvg);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /users/:id
 * Get a single user profile. Authenticated users only.
 */
router.get('/users/:id', authenticate, async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
        const user = await User.findById(req.params.id).select(USER_SAFE_FIELDS);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PATCH /users/:id
 * Update a user profile.
 * - Users can only edit their own profile (authorizeSelf).
 * - Admins can edit any profile.
 * - 'role' is blocklisted — cannot be changed here.
 */
router.patch('/users/:id', authenticate, authorizeSelf, async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { $set: sanitizeUpdate(req.body) },
            { new: true, runValidators: true }
        ).select(USER_SAFE_FIELDS);

        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(updatedUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Encounter routes (doctors & preceptors only) ───────────────────────────────

/**
 * GET /encounter/:user_id
 * Fetch all encounters for a user. Doctors and preceptors only.
 */
router.get(
    '/encounter/:user_id',
    authenticate,
    authorize('doctor', 'preceptor', 'admin'),
    async (req, res) => {
        if (!isValidObjectId(req.params.user_id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        try {
            const encounters = await Encounter.find({ role: req.params.user_id });
            res.json(encounters);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

/**
 * POST /encounter/:user_id
 * Create a new encounter for a patient. Doctors and preceptors only.
 */
router.post(
    '/encounter/:user_id',
    authenticate,
    authorize('doctor', 'preceptor', 'admin'),
    async (req, res) => {
        if (!isValidObjectId(req.params.user_id)) {
            return res.status(400).json({ error: 'Invalid user id' });
        }

        try {
            const { name, date, type, reason, who } = req.body;
            await Encounter.create({
                role: req.params.user_id,
                name,
                visitDate: date,
                visitType: type,
                reason,
                receiver: who,
            });
            res.sendStatus(201);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
);

export default router;