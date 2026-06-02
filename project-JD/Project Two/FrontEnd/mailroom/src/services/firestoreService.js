// src/services/firestoreService.js
// All Firestore reads and writes go through here — never call Firestore directly from components.

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
// USERS
// ─────────────────────────────────────────────

/**
 * Look up a user by their card ID.
 * Returns the user object or null if not found.
 */
export async function getUserByCardId(cardId) {
  const ref = doc(db, 'users', cardId)
  const snap = await getDoc(ref)
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

/**
 * Register a new user with their card.
 * The card ID becomes the Firestore document ID.
 */
export async function registerUser(userData) {
  const ref = doc(db, 'users', userData.cardId)
  const userDoc = createUser(userData)
  await setDoc(ref, userDoc)
  return { id: userData.cardId, ...userDoc }
}

/**
 * Update an existing user's info.
 */
export async function updateUser(cardId, fields) {
  const ref = doc(db, 'users', cardId)
  await updateDoc(ref, fields)
}

/**
 * Fetch all users (for admin panel).
 */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─────────────────────────────────────────────
// PACKAGES
// ─────────────────────────────────────────────

/**
 * Log a new incoming package.
 * Also writes a check-in transaction record.
 */
export async function checkInPackage(packageData, staffCardId) {
  // 1. Create the package document
  const pkgDoc = createPackage({ ...packageData, checkedInBy: staffCardId })
  const pkgRef = await addDoc(collection(db, 'packages'), pkgDoc)

  // 2. Log the transaction
  const txDoc = createTransaction({
    cardId: packageData.recipientCardId,
    packageId: pkgRef.id,
    type: TRANSACTION_TYPES.CHECK_IN,
    performedBy: staffCardId,
  })
  await addDoc(collection(db, 'transactions'), txDoc)

  return { id: pkgRef.id, ...pkgDoc }
}

/**
 * Mark a package as picked up.
 * Also writes a check-out transaction record.
 */
export async function checkOutPackage(packageId, residentCardId, staffCardId = null) {
  const pkgRef = doc(db, 'packages', packageId)

  await updateDoc(pkgRef, {
    status: PACKAGE_STATUS.PICKED_UP,
    checkedOutBy: staffCardId || residentCardId,
    checkedOutAt: serverTimestamp(),
  })

  // Log the transaction
  const txDoc = createTransaction({
    cardId: residentCardId,
    packageId,
    type: TRANSACTION_TYPES.CHECK_OUT,
    performedBy: staffCardId || residentCardId,
  })
  await addDoc(collection(db, 'transactions'), txDoc)
}

/**
 * Get all pending packages for a specific resident.
 */
export async function getPendingPackagesForResident(cardId) {
  const q = query(
    collection(db, 'packages'),
    where('recipientCardId', '==', cardId),
    where('status', '==', PACKAGE_STATUS.PENDING),
    orderBy('checkedInAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Get ALL pending packages (for staff dashboard).
 */
export async function getAllPendingPackages() {
  const q = query(
    collection(db, 'packages'),
    where('status', '==', PACKAGE_STATUS.PENDING),
    orderBy('checkedInAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Get package history for a resident (all statuses).
 */
export async function getPackageHistoryForResident(cardId) {
  const q = query(
    collection(db, 'packages'),
    where('recipientCardId', '==', cardId),
    orderBy('checkedInAt', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ─────────────────────────────────────────────
// TRANSACTIONS (Audit Log)
// ─────────────────────────────────────────────

/**
 * Get full transaction history for a card.
 */
export async function getTransactionsByCard(cardId) {
  const q = query(
    collection(db, 'transactions'),
    where('cardId', '==', cardId),
    orderBy('timestamp', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Get all transactions (for admin audit log).
 */
export async function getAllTransactions(limitCount = 100) {
  const q = query(
    collection(db, 'transactions'),
    orderBy('timestamp', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.slice(0, limitCount).map((d) => ({ id: d.id, ...d.data() }))
}
