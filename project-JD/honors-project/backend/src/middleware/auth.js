import jwt from 'jsonwebtoken';
import User from '../users/models/User.js';

// ── Token helpers ──────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET) {
    console.error('JWT_SECRET is required in environment variables.');
    process.exit(1);
}

/**
 * Sign a JWT for a given user.
 * Payload is intentionally minimal — only what the middleware needs.
 */
export function signToken(user) {
    return jwt.sign(
        { id: user._id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// ── Middleware ─────────────────────────────────────────────────────────────────

/**
 * authenticate
 * Verifies the Bearer token in the Authorization header.
 * On success: attaches req.user (the full DB user, minus password).
 * On failure: returns 401.
 */
export async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.slice(7);

    try {
        const payload = jwt.verify(token, JWT_SECRET);

        const user = await User.findById(payload.id).select('-password');
        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Session expired, please sign in again' });
        }
        return res.status(401).json({ error: 'Invalid token' });
    }
}

/**
 * authorize(...roles)
 * Must be used after authenticate.
 * Restricts a route to users whose role is in the provided list.
 *
 * Usage:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 *   router.get('/staff', authenticate, authorize('doctor', 'preceptor'), handler)
 */
export function authorize(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'You do not have permission to do that' });
        }
        next();
    };
}

/**
 * authorizeSelf
 * Must be used after authenticate.
 * Allows the request only if the authenticated user matches the :id param,
 * OR if they are an admin.
 *
 * Usage:
 *   router.patch('/users/:id', authenticate, authorizeSelf, handler)
 */
export function authorizeSelf(req, res, next) {
    const targetId = req.params.id || req.params.user_id;

    if (req.user.role === 'admin' || req.user._id.toString() === targetId) {
        return next();
    }

    return res.status(403).json({ error: 'You can only modify your own account' });
}