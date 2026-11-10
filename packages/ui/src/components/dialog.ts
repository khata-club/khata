/** Shared shell for KDialog and KAlertDialog (Reka presence waits for these animations). */
export const dialogClasses = {
  overlay:
    'fixed inset-0 z-(--z-overlay) bg-(--backdrop) backdrop-blur-[3px] data-[state=closed]:animate-ck-fade-out data-[state=open]:animate-ck-fade-in',
  /** Centres the content; pointer-events pass through to the overlay outside it. */
  wrapper: 'pointer-events-none fixed inset-0 z-(--z-modal) grid place-items-center p-6',
  content:
    'pointer-events-auto flex w-full max-w-[440px] flex-col gap-5 rounded-2xl border border-line bg-surface p-8 shadow-floating outline-hidden data-[state=closed]:animate-ck-dialog-out data-[state=open]:animate-ck-dialog-in',
  title: 'm-0 text-2xl font-semibold',
  description: 'm-0 text-base [text-wrap:pretty] text-fg-muted',
  footer: 'mt-2 flex flex-wrap justify-end gap-3',
}

/**
 * Reka always points `aria-describedby` at a description id; with no description rendered that
 * id dangles. Spread this onto the content to clear it in that case.
 */
export const describedByFallback = (hasDescription: boolean) =>
  hasDescription ? {} : { 'aria-describedby': undefined }
