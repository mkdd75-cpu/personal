
// Track 1 format:  %CARDDATA^NAME^...?
// Track 2 format:  ;CARDDATA=...?
// We extract whatever is between the sentinel characters as the card ID.

import { ref, onMounted, onUnmounted } from 'vue'

// Magnetic stripe sentinels
const TRACK1_START = '%'
const TRACK2_START = ';'
const TRACK_END = '?'

// If characters arrive faster than this (ms), treat as card swipe not human typing
const SWIPE_SPEED_THRESHOLD = 5000

export function useCardReader({ onSwipe, onError, enabled = ref(true) } = {}) {
  const isListening = ref(false)
  const lastSwipeData = ref(null)
  const isProcessing = ref(false)

  let buffer = ''
  let lastKeyTime = 0
  let bufferTimeout = null

  function parseCardData(raw) {
    const cleaned = raw.trim()

    // Track 1: %CARDID^...?
    if (cleaned.startsWith(TRACK1_START)) {
      const inner = cleaned.slice(1) // strip leading %
      const endIdx = inner.indexOf(TRACK_END)
      const content = endIdx !== -1 ? inner.slice(0, endIdx) : inner

      // If there's a ^ separator, the part before it is the card ID
      const caretIdx = content.indexOf('^')
      const cardId = caretIdx !== -1 ? content.slice(0, caretIdx) : content
      return { cardId: cardId.trim(), raw: cleaned, track: 1 }
    }

    // Track 2: ;CARDID=...?
    if (cleaned.startsWith(TRACK2_START)) {
      const inner = cleaned.slice(1)
      const endIdx = inner.indexOf(TRACK_END)
      const content = endIdx !== -1 ? inner.slice(0, endIdx) : inner

      const eqIdx = content.indexOf('=')
      const cardId = eqIdx !== -1 ? content.slice(0, eqIdx) : content
      return { cardId: cardId.trim(), raw: cleaned, track: 2 }
    }

    // No sentinel found — use the raw value as-is (custom encoding)
    return { cardId: cleaned, raw: cleaned, track: null }
  }

  /**
   * Called when a full swipe buffer is ready to process.
   */
  async function handleSwipeComplete(rawData) {
    if (!rawData || isProcessing.value) return

    const parsed = parseCardData(rawData)

    if (!parsed.cardId) {
      onError?.('Could not read card. Please swipe again.')
      return
    }

    isProcessing.value = true
    lastSwipeData.value = parsed

    try {
      await onSwipe?.(parsed)
    } catch (err) {
      console.error('[CardReader] onSwipe handler error:', err)
      onError?.(err.message || 'An error occurred processing the card.')
    } finally {
      isProcessing.value = false
    }
  }

  /**
   * Global keydown handler — buffers rapid keystrokes from the card reader.
   */
  function handleKeyDown(event) {
    if (!enabled.value) return

    // Ignore if user is typing in an input/textarea manually
    // (card reader fires events with no target focus, or fires so fast it doesn't matter)
    const tag = document.activeElement?.tagName?.toLowerCase()
    const isInputFocused = tag === 'input' || tag === 'textarea'

    const now = Date.now()
    const timeSinceLast = now - lastKeyTime
    lastKeyTime = now

    // If Enter key — swipe is complete
    if (event.key === 'Enter') {
      if (buffer.length > 0) {
        const data = buffer
        buffer = ''
        clearTimeout(bufferTimeout)
        handleSwipeComplete(data)
      }
      return
    }

    // If keystrokes are coming in fast (card reader speed), buffer them
    // If slow (human typing in a focused input), ignore
    if (isInputFocused && timeSinceLast > SWIPE_SPEED_THRESHOLD) {
      buffer = ''
      return
    }

    // Add character to buffer
    if (event.key.length === 1) {
      buffer += event.key
    }

    // Safety timeout — clear buffer if no Enter arrives within 500ms
    clearTimeout(bufferTimeout)
    bufferTimeout = setTimeout(() => {
      buffer = ''
    }, 500)
  }

  function startListening() {
    window.addEventListener('keydown', handleKeyDown)
    isListening.value = true
  }

  function stopListening() {
    window.removeEventListener('keydown', handleKeyDown)
    isListening.value = false
    buffer = ''
    clearTimeout(bufferTimeout)
  }

  // Auto-start and auto-cleanup with the component lifecycle
  onMounted(() => startListening())
  onUnmounted(() => stopListening())

  return {
    isListening,
    isProcessing,
    lastSwipeData,
    startListening,
    stopListening,
  }
}
