/** Join ids for `aria-describedby` / `aria-labelledby`, dropping empty ones; undefined if none. */
export function joinIds(...ids: unknown[]): string | undefined {
  return (
    ids.filter((id): id is string => typeof id === 'string' && id !== '').join(' ') || undefined
  )
}
