/**
 * Root of a label-wrapping choice control (KCheckbox, KRadio, KSwitch): the whole row is the hit
 * target, so the focus outline wraps the control and its label.
 */
export const choiceRootClass =
  'group flex min-h-(--touch-target) cursor-pointer items-center gap-3 rounded-md border-0 bg-transparent p-0 text-left text-base text-fg data-[disabled]:cursor-not-allowed data-[disabled]:text-fg-disabled'
