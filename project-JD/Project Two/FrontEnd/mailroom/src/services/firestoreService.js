// src/services/firestoreService.js
// All Firestore reads and writes go through here.
// Listener functions return an unsubscribe function — always call it in onUnmounted.

import {
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  limit,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/firebase/config'
import {
  createPackage,
  createTransaction,
  createUser,
  PACKAGE_STATUS,
  TRANSACTION_TYPES,
} from '@/models'

// ─────────────────────────────────────────────
// USERS — one-shot reads (used for auth/login, registration checks)
// ─────────────────────────────────────────────

/** Look up a user by card ID. Used by ScanView on swipe/manual login. */
export async function getUserByCardId(cardId) {
  const ref = doc(db, 'users', cardId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/** Look up a user by email. Used by manual sign-in form. */
export async function getUserByEmail(email) {
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase().trim())
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...d.data() }
}

/** Register a new user. cardId becomes the document ID. */
export async function registerUser(userData) {
  const ref = doc(db, 'users', userData.cardId)
  const userDoc = createUser({ ...userData, email: userData.email.toLowerCase().trim() })
  await setDoc(ref, userDoc)
  return { id: userData.cardId, ...userDoc }
}

/** Update fields on an existing user document. */
export async function updateUser(cardId, fields) {
  const ref = doc(db, 'users', cardId)
  await updateDoc(ref, fields)
}

// ─────────────────────────────────────────────
// USERS — real-time listeners
// ─────────────────────────────────────────────

/**
 * Subscribe to a single user document by cardId.
 * Calls onData(user) whenever the document changes.
 * Returns unsubscribe function.
 */
export function subscribeToUser(cardId, onData, onError) {
  const ref = doc(db, 'users', cardId)
  return onSnapshot(ref,
    (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
    (err) => onError?.(err)
  )
}

/**
 * Subscribe to all users.
 * Calls onData(users[]) on every change.
 * Returns unsubscribe function.
 */
export function subscribeToAllUsers(onData, onError) {
  const q = query(collection(db, 'users'), orderBy('name'))
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

// ─────────────────────────────────────────────
// PACKAGES — writes
// ─────────────────────────────────────────────

/** Log a new incoming package and write a check-in transaction. */
export async function checkInPackage(packageData, staffCardId) {
  const pkgDoc = createPackage({ ...packageData, checkedInBy: staffCardId })
  const pkgRef = await addDoc(collection(db, 'packages'), pkgDoc)
  await addDoc(collection(db, 'transactions'), createTransaction({
    cardId: packageData.recipientCardId,
    packageId: pkgRef.id,
    type: TRANSACTION_TYPES.CHECK_IN,
    performedBy: staffCardId,
  }))
  return { id: pkgRef.id, ...pkgDoc }
}

/** Mark a package as picked up and write a check-out transaction. */
export async function checkOutPackage(packageId, residentCardId, staffCardId = null) {
  await updateDoc(doc(db, 'packages', packageId), {
    status: PACKAGE_STATUS.PICKED_UP,
    checkedOutBy: staffCardId || residentCardId,
    checkedOutAt: serverTimestamp(),
  })
  await addDoc(collection(db, 'transactions'), createTransaction({
    cardId: residentCardId,
    packageId,
    type: TRANSACTION_TYPES.CHECK_OUT,
    performedBy: staffCardId || residentCardId,
  }))
}

// ─────────────────────────────────────────────
// PACKAGES — real-time listeners
// ─────────────────────────────────────────────

/**
 * Subscribe to all PENDING packages for a resident.
 * Returns unsubscribe function.
 */
export function subscribeToPendingPackagesForResident(cardId, onData, onError) {
  const q = query(
    collection(db, 'packages'),
    where('recipientCardId', '==', cardId),
    where('status', '==', PACKAGE_STATUS.PENDING),
    orderBy('checkedInAt', 'desc')
  )
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

/**
 * Subscribe to ALL pending packages (staff dashboard queue).
 * Returns unsubscribe function.
 */
export function subscribeToAllPendingPackages(onData, onError) {
  const q = query(
    collection(db, 'packages'),
    where('status', '==', PACKAGE_STATUS.PENDING),
    orderBy('checkedInAt', 'desc')
  )
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

/**
 * Subscribe to recent packages across all statuses (staff history tab).
 * Returns unsubscribe function.
 */
export function subscribeToRecentPackages(limitCount = 50, onData, onError) {
  const q = query(
    collection(db, 'packages'),
    orderBy('checkedInAt', 'desc'),
    limit(limitCount)
  )
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

// ─────────────────────────────────────────────
// TRANSACTIONS — real-time listener
// ─────────────────────────────────────────────

/**
 * Subscribe to recent transactions (audit log).
 * Returns unsubscribe function.
 */
export function subscribeToAllTransactions(limitCount = 100, onData, onError) {
  const q = query(
    collection(db, 'transactions'),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )
  return onSnapshot(q,
    (snap) => onData(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    (err) => onError?.(err)
  )
}

// ─────────────────────────────────────────────
// SEARCH — one-shot (called per keystroke with debounce)
// ─────────────────────────────────────────────

/**
 * Search residents by name or unit prefix (startsWith).
 * Runs two parallel queries and deduplicates results.
 */
export async function searchResidentsByField(searchTerm) {
  const q = searchTerm.toLowerCase().trim()
  if (!q) return []

  const makeQuery = (field) => query(
    collection(db, 'users'),
    where('role', '==', 'resident'),
    where(field, '>=', q),
    where(field, '<=', q + '\uf8ff'),
    orderBy(field),
    limit(6)
  )

  const [nameSnap, unitSnap] = await Promise.all([
    getDocs(makeQuery('name')),
    getDocs(makeQuery('unit')),
  ])

  const seen = new Set()
  const results = []
  for (const snap of [nameSnap, unitSnap]) {
    for (const d of snap.docs) {
      if (!seen.has(d.id)) {
        seen.add(d.id)
        results.push({ id: d.id, ...d.data() })
      }
    }
  }
  return results.slice(0, 6)
}