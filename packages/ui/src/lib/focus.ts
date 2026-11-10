const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/**
 * Move focus to the first focusable element after `el` in document order, or the last one before
 * it, ignoring anything inside `el`. Use before removing an element that holds focus, so keyboard
 * and screen-reader users aren't sent back to the top of the page.
 */
export function focusNearestOutside(el: Element) {
  const candidates = [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (node) => !el.contains(node) && !node.closest('[hidden], [inert], [aria-hidden="true"]'),
  )
  const after = candidates.find(
    (node) => el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
  )
  const before = candidates
    .filter((node) => el.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)
    .pop()
  ;(after ?? before)?.focus()
}
