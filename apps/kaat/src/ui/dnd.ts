/**
 * In-app drag & drop of assets from the media panel. `dataTransfer.getData` is unreadable during
 * dragover, so the dragged asset id is also kept here for drop previews.
 */
export const ASSET_MIME = 'application/x-kaat-asset'

let current: string | undefined

export function startAssetDrag(e: DragEvent, assetId: string): void {
  current = assetId
  e.dataTransfer?.setData(ASSET_MIME, assetId)
  e.dataTransfer?.setData('text/plain', assetId)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
}

export function endAssetDrag(): void {
  current = undefined
}

export function draggedAsset(): string | undefined {
  return current
}
