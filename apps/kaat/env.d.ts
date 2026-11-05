/// <reference types="vite/client" />

// File System Access API surface used by Kaat that TypeScript's DOM lib doesn't declare yet.
interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite'
}
interface FileSystemHandle {
  queryPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
  requestPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>
}
interface DataTransferItem {
  getAsFileSystemHandle?(): Promise<FileSystemHandle | null>
}
interface OpenFilePickerOptions {
  multiple?: boolean
  excludeAcceptAllOption?: boolean
  types?: { description?: string; accept: Record<string, string[]> }[]
}
interface SaveFilePickerOptions {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}
interface Window {
  showOpenFilePicker?(o?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>
  showSaveFilePicker?(o?: SaveFilePickerOptions): Promise<FileSystemFileHandle>
}
interface Performance {
  memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number }
}

declare const __KAAT_BUILD__: string
