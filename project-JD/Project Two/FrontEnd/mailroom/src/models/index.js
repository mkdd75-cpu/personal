// src/models/index.js
// Factory functions for all Firestore documents.

import { serverTimestamp } from 'firebase/firestore'

export const ROLES = {
  RESIDENT: 'resident',
  STAFF: 'staff',
  ADMIN: 'admin',
}

export const PACKAGE_STATUS = {
  PENDING: 'pending',       
  PICKED_UP: 'picked_up',  
}

// ─────────────────────────────────────────────
// TRANSACTION TYPES
// ─────────────────────────────────────────────
export const TRANSACTION_TYPES = {
  CHECK_IN: 'checkin',      
  CHECK_OUT: 'checkout',    
}

// ─────────────────────────────────────────────
// CARRIERS
// ─────────────────────────────────────────────
export const CARRIERS = ['UPS', 'FedEx', 'USPS', 'Amazon', 'DHL', 'Other']

// ─────────────────────────────────────────────
// MODEL FACTORIES
// ─────────────────────────────────────────────

/**
 * Creates a new User document.
 * Stored at: users/{cardId}
 * The document ID IS the card's encoded value (unique per card).
 *
 * @param {Object} params
 * @param {string} params.name        - Full name
 * @param {string} params.email       - Email address
 * @param {string} params.unit        - Room/unit number or identifier
 * @param {string} params.role        - One of ROLES
 * @param {string} params.cardId      - Raw value read from magnetic stripe
 */
export function createUser({ name, email, unit, role = ROLES.RESIDENT, cardId }) {
  return {
    name,
    email,
    unit,
    role,
    cardId,
    createdAt: serverTimestamp(),
    active: true,
  }
}

/**
 * Creates a new Package document.
 * Stored at: packages/{auto-id}
 *
 * @param {Object} params
 * @param {string} params.recipientCardId   - Card ID of the recipient (links to users/{cardId})
 * @param {string} params.recipientName     - Denormalized for quick display
 * @param {string} params.recipientUnit     - Denormalized for quick display
 * @param {string} params.carrier           - One of CARRIERS
 * @param {string} params.trackingNumber    - Carrier tracking number (optional)
 * @param {string} params.checkedInBy       - UID of staff member who logged it
 * @param {string} params.notes             - Optional notes (fragile, oversized, etc.)
 */
export function createPackage({
  recipientCardId,
  recipientName,
  recipientUnit,
  carrier,
  trackingNumber = '',
  checkedInBy,
  notes = '',
}) {
  return {
    recipientCardId,
    recipientName,
    recipientUnit,
    carrier,
    trackingNumber,
    status: PACKAGE_STATUS.PENDING,
    notes,
    checkedInBy,
    checkedInAt: serverTimestamp(),
    checkedOutBy: null,
    checkedOutAt: null,
  }
}

/**
 * Creates a new Transaction document.
 * Stored at: transactions/{auto-id}
 * Every check-in and check-out is recorded here for a full audit log.
 *
 * @param {Object} params
 * @param {string} params.cardId        - Card that was swiped
 * @param {string} params.packageId     - Package involved
 * @param {string} params.type          - One of TRANSACTION_TYPES
 * @param {string} params.performedBy   - UID or cardId of who triggered the action
 */
export function createTransaction({ cardId, packageId, type, performedBy }) {
  return {
    cardId,
    packageId,
    type,
    performedBy,
    timestamp: serverTimestamp(),
  }
}
