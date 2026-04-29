

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Upload, File, FolderOpen, CheckCircle2, FileSpreadsheet, Table } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cn } from "~/lib/utils";
import { Button } from "./button";
import { uploadFile, uploadMultipleFiles, formatFileSize } from "~/lib/storage-api";
import { useToast } from "./toast-provider";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colorScheme?: "redshift";
  onUploadComplete?: () => void;
}

const TEAM_FOLDERS = [
  { id: "hasif", name: "Hasif", colour: "from-orange-500 to-amber-500" },
  { id: "nazierul", name: "Nazierul", colour: "from-blue-500 to-cyan-500" },
  { id: "izhar", name: "Izhar", colour: "from-green-500 to-emerald-500" },
  { id: "asyraff", name: "Asyraff", colour: "from-purple-500 to-violet-500" },
] as const;

type TeamFolderId = typeof TEAM_FOLDERS[number]["id"];

// Check if file is a data file (CSV/Excel)
function isDataFile(fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ext === "csv" || ext === "xlsx" || ext === "xls";
}

// Parse file to extract columns and rows
async function parseDataFile(file: File): Promise<{
  columns: string[];
  rows: Record<string, unknown>[];
} | null> {
  const fileName = file.name;
  const extension = fileName.split(".").pop()?.toLowerCase();

  try {
    if (extension === "csv") {
      const result = await new Promise<Papa.ParseResult<Record<string, unknown>>>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: resolve,
          error: reject,
        });
      });

      if (result.errors.length > 0) {
        console.error("CSV parse error:", result.errors[0]);
        return null;
      }

      return {
        rows: result.data,
        columns: result.meta.fields || [],
      };
    } else if (extension === "xlsx" || extension === "xls") {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet);

      if (jsonData.length === 0) {
        return null;
      }

      return {
        rows: jsonData,
        columns: Object.keys(jsonData[0]),
      };
    }
  } catch (error) {
    console.error("Failed to parse file:", error);
  }

  return null;
}

// Generate table name from file name (use original name, sanitized)
function generateTableName(fileName: string): string {
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const sanitizedName = baseName.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  return sanitizedName;
}

export function FileUploadDialog({
  open,
  onOpenChange,
  colorScheme = "redshift",
  onUploadComplete,
}: FileUploadDialogProps) {
  const { showToast } = useToast();
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [selectedFolder, setSelectedFolder] = React.useState<TeamFolderId | null>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [parsedFiles, setParsedFiles] = React.useState<Map<string, { columns: string[]; rows: Record<string, unknown>[] }>>(new Map());
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedFiles([]);
      setSelectedFolder(null);
      setIsDragOver(false);
      setParsedFiles(new Map());
    }
  }, [open]);

  // Parse data files when selected
  React.useEffect(() => {
    const parseFiles = async () => {
      const newParsedFiles = new Map<string, { columns: string[]; rows: Record<string, unknown>[] }>();

      for (const file of selectedFiles) {
        if (isDataFile(file.name)) {
          const parsed = await parseDataFile(file);
          if (parsed) {
            newParsedFiles.set(file.name, parsed);
          }
        }
      }

      setParsedFiles(newParsedFiles);
    };

    if (selectedFiles.length > 0) {
      parseFiles();
    }
  }, [selectedFiles]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      setSelectedFiles(Array.from(files));
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast("Please select at least one file", "error");
      return;
    }

    if (!selectedFolder) {
      showToast("Please select a folder", "error");
      return;
    }

    setIsUploading(true);

    try {
      // Upload to S3
      if (selectedFiles.length === 1) {
        await uploadFile(selectedFiles[0], selectedFolder);
      } else {
        await uploadMultipleFiles(selectedFiles, selectedFolder);
      }

      showToast(`Uploaded ${selectedFiles.length} file(s) to ${selectedFolder} folder`, "success");

      onUploadComplete?.();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";
      showToast(errorMessage, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
  const dataFilesCount = selectedFiles.filter(f => isDataFile(f.name)).length;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-in fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50",
            "w-full max-w-lg p-6 rounded-xl",
            "bg-surface-container shadow-elevation-3",
            "border border-outline-variant",
            "animate-in fade-in-0 zoom-in-95"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold text-on-surface flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Files to S3
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                className={cn(
                  "p-1.5 rounded-full",
                  "text-on-surface-variant hover:text-on-surface",
                  "hover:bg-surface-container-high transition-colors"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-5">
            {/* Step 1: Select Folder */}
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-container-high text-xs font-bold">
                    1
                  </span>
                  Select Folder <span className="text-red-400">*</span>
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEAM_FOLDERS.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolder(folder.id)}
                    className={cn(
                      "relative flex items-center gap-2 p-3 rounded-lg",
                      "border-2 transition-all duration-200",
                      selectedFolder === folder.id
                        ? "border-transparent ring-2 ring-offset-2 ring-offset-surface-container"
                        : "border-outline-variant hover:border-outline",
                      selectedFolder === folder.id &&
                        "ring-redshift",
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        "bg-gradient-to-br",
                        folder.colour
                      )}
                    >
                      <FolderOpen className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-medium text-on-surface">
                      {folder.name}
                    </span>
                    {selectedFolder === folder.id && (
                      <CheckCircle2
                        className={cn(
                          "absolute top-1.5 right-1.5 w-4 h-4 text-redshift"
                        )}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Upload Files */}
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-container-high text-xs font-bold">
                    2
                  </span>
                  Upload Files <span className="text-red-400">*</span>
                </span>
              </label>

              {/* Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative flex flex-col items-center justify-center",
                  "p-6 rounded-lg border-2 border-dashed cursor-pointer",
                  "transition-all duration-200",
                  isDragOver
                    ? "border-solid border-redshift bg-redshift/10"
                    : "border-outline-variant hover:border-outline hover:bg-surface-container-high"
                )}
              >
                <Upload
                  className={cn(
                    "w-8 h-8 mb-2",
                    isDragOver ? "text-redshift" : "text-on-surface-variant"
                  )}
                />
                <p className="text-sm text-on-surface-variant text-center">
                  {isDragOver ? (
                    "Drop files here"
                  ) : (
                    <>
                      <span className="font-medium text-on-surface">Click to upload</span>
                      {" "}or drag and drop
                    </>
                  )}
                </p>
                <p className="text-xs text-outline mt-1">
                  CSV/Excel files will be queryable as tables
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Selected Files List */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs text-on-surface-variant">
                    <span>{selectedFiles.length} file(s) selected</span>
                    <span>Total: {formatFileSize(totalSize)}</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1.5 rounded-lg bg-surface p-2">
                    {selectedFiles.map((file, index) => {
                      const isData = isDataFile(file.name);
                      const parsed = parsedFiles.get(file.name);
                      const tableName = isData ? generateTableName(file.name) : null;

                      return (
                        <div
                          key={`${file.name}-${index}`}
                          className={cn(
                            "flex items-center justify-between gap-2 p-2 rounded-md",
                            isData && parsed ? "bg-green-500/10 border border-green-500/30" : "bg-surface-container-high"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isData ? (
                              <FileSpreadsheet className="w-4 h-4 text-green-400 flex-shrink-0" />
                            ) : (
                              <File className="w-4 h-4 text-on-surface-variant flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <span className="text-xs text-on-surface truncate block">
                                {file.name}
                              </span>
                              {isData && parsed && (
                                <span className="text-[10px] text-green-400 flex items-center gap-1">
                                  <Table className="w-2.5 h-2.5" />
                                  {tableName} ({parsed.rows.length} rows)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-on-surface-variant">
                              {formatFileSize(file.size)}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeFile(index);
                              }}
                              className="p-0.5 rounded-full hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Info about data files */}
            {dataFilesCount > 0 && (
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                <p className="text-xs text-green-400">
                  <span className="flex items-center gap-2 mb-1">
                    <Table className="w-4 h-4" />
                    <strong>{dataFilesCount}</strong> data file(s) ready for upload
                  </span>
                </p>
              </div>
            )}

            {/* Upload Destination Preview */}
            {selectedFolder && selectedFiles.length > 0 && (
              <div className="p-3 rounded-lg bg-surface-container-high">
                <p className="text-xs text-on-surface-variant">
                  <span className="font-medium">Destination:</span>{" "}
                  <span className="font-mono text-on-surface">
                    s3://.../{selectedFolder}/{selectedFiles.length === 1 ? selectedFiles[0].name : `${selectedFiles.length} files`}
                  </span>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="default" size="sm" disabled={isUploading}>
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="run"
              size="sm"
              colorScheme={colorScheme}
              onClick={handleUpload}
              disabled={isUploading || selectedFiles.length === 0 || !selectedFolder}
            >
              <Upload className="w-4 h-4" />
              {isUploading
                ? "Uploading..."
                : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
