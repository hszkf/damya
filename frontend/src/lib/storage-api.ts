/**
 * Storage API client for S3 file management.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface StorageFile {
  key: string;
  name: string;
  size_bytes: number;
  last_modified: string;
  s3_uri: string;
}

export interface StorageHealthStatus {
  status: "connected" | "disconnected";
  bucket: string | null;
  prefix: string | null;
  region: string | null;
  error: string | null;
}

export interface UploadResult {
  status: "success" | "error";
  message: string;
  key?: string;
  bucket?: string;
  size_bytes?: number;
  content_type?: string;
  s3_uri?: string;
  error_code?: string;
}

export interface ListFilesResult {
  status: "success" | "error";
  files: StorageFile[];
  count: number;
  prefix: string;
  bucket: string;
  message?: string;
  is_truncated?: boolean;
  next_continuation_token?: string;
  has_more?: boolean;
}

export interface PresignedUrlResult {
  status: "success" | "error";
  url?: string;
  expiration_seconds?: number;
  key?: string;
  message?: string;
}

/**
 * Check storage service health.
 */
export async function checkStorageHealth(): Promise<StorageHealthStatus> {
  const response = await fetch(`${API_BASE_URL}/storage/health`);
  return response.json();
}

/**
 * Upload a single file to S3.
 */
export async function uploadFile(
  file: File,
  subfolder: string = ""
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("subfolder", subfolder);

  const response = await fetch(`${API_BASE_URL}/storage/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return response.json();
}

/**
 * Upload multiple files to S3.
 */
export async function uploadMultipleFiles(
  files: File[],
  subfolder: string = ""
): Promise<{
  status: "success" | "partial";
  uploaded: number;
  failed: number;
  results: (UploadResult & { filename: string })[];
}> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  formData.append("subfolder", subfolder);

  const response = await fetch(`${API_BASE_URL}/storage/upload-multiple`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Upload failed" }));
    throw new Error(error.detail || "Upload failed");
  }

  return response.json();
}

/**
 * List files in S3 storage with pagination, search, and filtering support.
 */
export async function listFiles(
  subfolder: string = "",
  maxKeys: number = 1000,
  continuationToken?: string,
  searchParams?: {
    search?: string;
    fileTypes?: string;
    dateFrom?: string;
    dateTo?: string;
    sizeMin?: number;
    sizeMax?: number;
    sortBy?: string;
    sortOrder?: string;
  }
): Promise<ListFilesResult> {
  const params = new URLSearchParams();
  if (subfolder) params.append("subfolder", subfolder);
  params.append("max_keys", maxKeys.toString());
  if (continuationToken) params.append("continuation_token", continuationToken);

  // Add search and filter parameters
  if (searchParams) {
    if (searchParams.search) params.append("search", searchParams.search);
    if (searchParams.fileTypes) params.append("file_types", searchParams.fileTypes);
    if (searchParams.dateFrom) params.append("date_from", searchParams.dateFrom);
    if (searchParams.dateTo) params.append("date_to", searchParams.dateTo);
    if (searchParams.sizeMin !== undefined) params.append("size_min", searchParams.sizeMin.toString());
    if (searchParams.sizeMax !== undefined) params.append("size_max", searchParams.sizeMax.toString());
    if (searchParams.sortBy) params.append("sort_by", searchParams.sortBy);
    if (searchParams.sortOrder) params.append("sort_order", searchParams.sortOrder);
  }

  const response = await fetch(
    `${API_BASE_URL}/storage/files?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to list files" }));
    throw new Error(error.detail || "Failed to list files");
  }

  return response.json();
}

/**
 * Delete a file from S3.
 */
export async function deleteFile(key: string): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/storage/files`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Delete failed" }));
    throw new Error(error.detail || "Delete failed");
  }

  return response.json();
}

/**
 * Create a folder in S3.
 */
export async function createFolder(
  folderName: string
): Promise<{ status: string; message: string; key?: string; s3_uri?: string }> {
  const response = await fetch(`${API_BASE_URL}/storage/folders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ folder_name: folderName }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to create folder" }));
    throw new Error(error.detail || "Failed to create folder");
  }

  return response.json();
}

/**
 * Get a presigned download URL for a file.
 */
export async function getDownloadUrl(
  key: string,
  expirationSeconds: number = 3600
): Promise<PresignedUrlResult> {
  const response = await fetch(
    `${API_BASE_URL}/storage/download-url/${encodeURIComponent(key)}?expiration=${expirationSeconds}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Failed to get download URL" }));
    throw new Error(error.detail || "Failed to get download URL");
  }

  return response.json();
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Move files to a different folder.
 */
export async function moveFiles(
  sourceKeys: string[],
  destinationFolder: string
): Promise<{
  status: "success" | "partial" | "error";
  moved: number;
  failed: number;
  results: { key: string; status: string; message: string }[];
}> {
  const response = await fetch(`${API_BASE_URL}/storage/move`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_keys: sourceKeys,
      destination_folder: destinationFolder,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Move failed" }));
    throw new Error(error.detail || "Move failed");
  }

  return response.json();
}

/**
 * Rename a file.
 */
export async function renameFile(
  key: string,
  newName: string
): Promise<{
  status: "success" | "error";
  message: string;
  new_key?: string;
  new_name?: string;
  s3_uri?: string;
}> {
  const response = await fetch(`${API_BASE_URL}/storage/files/rename`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      new_name: newName,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Rename failed" }));
    throw new Error(error.detail || "Rename failed");
  }

  return response.json();
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
}

/**
 * Get file icon based on extension.
 */
export function getFileTypeIcon(filename: string): "file" | "image" | "video" | "audio" | "archive" | "document" | "spreadsheet" | "code" {
  const ext = getFileExtension(filename);

  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "svg", "webp", "ico"];
  const videoExts = ["mp4", "avi", "mov", "wmv", "mkv", "webm"];
  const audioExts = ["mp3", "wav", "ogg", "flac", "aac", "m4a"];
  const archiveExts = ["zip", "rar", "7z", "tar", "gz", "bz2"];
  const documentExts = ["pdf", "doc", "docx", "txt", "rtf", "odt"];
  const spreadsheetExts = ["xls", "xlsx", "csv", "ods"];
  const codeExts = ["js", "ts", "tsx", "jsx", "py", "java", "cpp", "c", "h", "css", "html", "json", "xml", "yaml", "yml", "sql"];

  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (audioExts.includes(ext)) return "audio";
  if (archiveExts.includes(ext)) return "archive";
  if (documentExts.includes(ext)) return "document";
  if (spreadsheetExts.includes(ext)) return "spreadsheet";
  if (codeExts.includes(ext)) return "code";

  return "file";
}
