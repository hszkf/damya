import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute('/storage')({
  component: StoragePage,
});

import { useState, useRef, useCallback, useSyncExternalStore } from "react";
import { Link } from "@tanstack/react-router";
import { formatMYDateShort } from "~/lib/date-utils";
import { ThemeProvider } from "~/lib/theme-context";
import { StudioNav } from "~/components/studio-nav";
import { ToastProvider, useToast } from "~/components/ui/toast-provider";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import FilePreviewModal from "~/components/file-preview-modal";
import {
  checkStorageHealth,
  listFiles,
  uploadFile,
  uploadMultipleFiles,
  deleteFile,
  getDownloadUrl,
  createFolder,
  moveFiles,
  renameFile,
  formatFileSize,
  getFileTypeIcon,
  type StorageFile,
  type StorageHealthStatus,
} from "~/lib/storage-api";
import {
  ArrowLeft,
  Upload,
  RefreshCw,
  HardDrive,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileText,
  FileSpreadsheet,
  FileCode,
  Trash2,
  Download,
  Search,
  Loader2,
  Folder,
  FolderPlus,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Home,
  X,
  Move,
  CheckSquare,
  Square,
  Eye,
  Grid3X3,
  List,
  Database,
  Cloud,
  Signal,
  Settings,
  MoreHorizontal,
  Copy,
  Clock,
  HardDriveUpload,
  FolderTree,
  FileStack,
  Sparkles,
  Zap,
  Box,
  LayoutGrid,
  TableProperties,
  Plus,
  Filter,
  FlaskConical,
  BarChart3,
  Users,
} from "lucide-react";

// Team member configuration
interface TeamMember {
  name: string;
  colour: string;
  icon: string;
}

// Team/Department configuration
interface Team {
  id: string;
  name: string;
  description: string;
  colour: string;
  icon: "flask" | "chart";
  members: TeamMember[];
}

// Workspace configurations with teams and members
const TEAMS: Team[] = [
  {
    id: "data-science",
    name: "Data Science",
    description: "",
    colour: "#8B5CF6",
    icon: "flask",
    members: [
      { name: "hasif", colour: "#A78BFA", icon: "H" },
      { name: "nazierul", colour: "#22D3EE", icon: "N" },
      { name: "izhar", colour: "#FBBF24", icon: "I" },
      { name: "asyraff", colour: "#F472B6", icon: "A" },
    ],
  },
  {
    id: "business-intelligence",
    name: "Business Intelligence",
    description: "",
    colour: "#06B6D4",
    icon: "chart",
    members: [
      { name: "bob", colour: "#34D399", icon: "B" },
      { name: "yee-ming", colour: "#FB923C", icon: "Y" },
      { name: "ernie", colour: "#E879F9", icon: "E" },
    ],
  },
];

// Flatten all members for easy lookup
const ALL_MEMBERS = TEAMS.flatMap(team =>
  team.members.map(member => ({ ...member, teamId: team.id, teamName: team.name, teamColour: team.colour }))
);

interface FolderItem {
  name: string;
  type: "folder";
  path: string;
  key: string;
}

interface FileItem {
  name: string;
  type: "file";
  key: string;
  size_bytes: number;
  last_modified: string;
  s3_uri: string;
}

type ListItem = FolderItem | FileItem;

// Storage health cache
const STORAGE_HEALTH_CACHE_KEY = 'storage-health-cache';
const STORAGE_HEALTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface StorageHealthCache {
  data: StorageHealthStatus;
  timestamp: number;
}

function getStorageHealthFromCache(): StorageHealthStatus | null {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(STORAGE_HEALTH_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp }: StorageHealthCache = JSON.parse(cached);
    if (Date.now() - timestamp < STORAGE_HEALTH_CACHE_TTL) {
      return data;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStorageHealthToCache(data: StorageHealthStatus): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_HEALTH_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function FileIcon({ type, className = "w-4 h-4" }: { type: ReturnType<typeof getFileTypeIcon>; className?: string }) {
  const iconMap = {
    image: <FileImage className={`${className} text-pink-400`} />,
    video: <FileVideo className={`${className} text-violet-400`} />,
    audio: <FileAudio className={`${className} text-orange-400`} />,
    archive: <FileArchive className={`${className} text-amber-400`} />,
    document: <FileText className={`${className} text-sky-400`} />,
    spreadsheet: <FileSpreadsheet className={`${className} text-emerald-400`} />,
    code: <FileCode className={`${className} text-cyan-400`} />,
    file: <File className={`${className} text-on-surface-variant`} />,
  };
  return iconMap[type] || iconMap.file;
}

// Animated connection indicator
function ConnectionPulse({ connected }: { connected: boolean }) {
  return (
    <span className="relative flex h-2.5 w-2.5">
      {connected && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      )}
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
    </span>
  );
}

function StoragePageContent() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [healthStatus, setHealthStatus] = useState<StorageHealthStatus | null>(() => getStorageHealthFromCache());
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set(["data-science", "business-intelligence"]));

  // Dialogs
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [moveDestination, setMoveDestination] = useState("");

  // Rename
  const [editingFile, setEditingFile] = useState<{ key: string; name: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Preview
  const [previewFile, setPreviewFile] = useState<StorageFile | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);

  const currentPathString = currentPath.join("/");
  const fileItems = items.filter((item): item is FileItem => item.type === "file");
  const folderItems = items.filter((item): item is FolderItem => item.type === "folder");
  const allItems = items;
  const allItemsSelected = allItems.length > 0 && allItems.every(item => selectedFiles.has(item.type === "file" ? item.key : item.key));
  const someFilesSelected = selectedFiles.size > 0;

  // Get current member info from path
  const currentMember = currentPath[0] ? ALL_MEMBERS.find(m => m.name === currentPath[0]) : null;
  const currentTeam = currentMember ? TEAMS.find(t => t.id === currentMember.teamId) : null;

  // Load items
  const loadItems = useCallback(async (path: string) => {
    setIsLoading(true);
    setSelectedFiles(new Set());
    try {
      const result = await listFiles(path, 1000);
      const foldersMap = new Map<string, string>(); // name -> key
      const filesAtLevel: FileItem[] = [];

      result.files.forEach((file) => {
        // Check if this is a folder (ends with /)
        if (file.key.endsWith("/") || file.name.endsWith("/")) {
          // It's a folder - extract the folder name
          const folderName = file.name.replace(/\/$/, "");
          if (folderName) foldersMap.set(folderName, file.key);
        } else {
          // It's a file
          filesAtLevel.push({
            name: file.name,
            type: "file",
            key: file.key,
            size_bytes: file.size_bytes,
            last_modified: file.last_modified,
            s3_uri: file.s3_uri,
          });
        }
      });

      const folders: FolderItem[] = Array.from(foldersMap.entries()).map(([name, key]) => ({
        name,
        type: "folder",
        path: path ? `${path}/${name}` : name,
        key,
      }));
      folders.sort((a, b) => a.name.localeCompare(b.name));
      filesAtLevel.sort((a, b) => a.name.localeCompare(b.name));
      setItems([...folders, ...filesAtLevel]);
    } catch (error) {
      console.error("Failed to load items:", error);
      showToast("Failed to load items", "error");
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Check health
  const checkHealth = useCallback(async () => {
    try {
      const status = await checkStorageHealth();
      setHealthStatus(status);
      saveStorageHealthToCache(status);
    } catch (error) {
      const errorStatus: StorageHealthStatus = {
        status: "disconnected",
        bucket: null,
        prefix: null,
        region: null,
        error: "Failed to check health",
      };
      setHealthStatus(errorStatus);
      saveStorageHealthToCache(errorStatus);
    }
  }, []);

  // Initial load using ref pattern instead of useEffect
  const hasInitiallyLoaded = useRef(false);
  if (!hasInitiallyLoaded.current) {
    hasInitiallyLoaded.current = true;
    // Only check immediately if no cached health status
    // Otherwise refresh in background
    if (!healthStatus) {
      checkHealth();
    } else {
      setTimeout(checkHealth, 2000);
    }
  }

  // Load items when path changes - using ref to track previous value
  const previousPath = useRef<string | null>(null);
  if (previousPath.current !== currentPathString) {
    previousPath.current = currentPathString;
    if (currentPath.length > 0) {
      loadItems(currentPathString);
    } else {
      setItems([]);
      setSelectedFiles(new Set());
    }
  }

  // Focus rename input using ref comparison instead of useEffect
  const previousEditingFile = useRef<string | null>(null);
  if (editingFile !== previousEditingFile.current) {
    previousEditingFile.current = editingFile;
    if (editingFile && editInputRef.current) {
      // Use queueMicrotask to ensure DOM is ready
      queueMicrotask(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
          editInputRef.current.select();
        }
      });
    }
  }

  const handleRefresh = () => {
    checkHealth();
    if (currentPath.length > 0) loadItems(currentPathString);
  };

  const handleNavigate = (index: number) => {
    if (index === -1) setCurrentPath([]);
    else setCurrentPath(currentPath.slice(0, index + 1));
    setSearchQuery("");
    setSelectedFiles(new Set());
  };

  const handleEnterFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
    setSearchQuery("");
    setSelectedFiles(new Set());
  };

  const handleUpload = async (filesToUpload: File[]) => {
    if (currentPath.length === 0) {
      showToast("Please select a workspace first", "error");
      return;
    }
    setIsUploading(true);
    try {
      if (filesToUpload.length === 1) {
        await uploadFile(filesToUpload[0], currentPathString);
        showToast(`"${filesToUpload[0].name}" uploaded`, "success");
      } else {
        const result = await uploadMultipleFiles(filesToUpload, currentPathString);
        if (result.failed > 0) {
          showToast(`Uploaded ${result.uploaded}, ${result.failed} failed`, "error");
        } else {
          showToast(`${result.uploaded} files uploaded`, "success");
        }
      }
      await loadItems(currentPathString);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFilesInput = event.target.files;
    if (!selectedFilesInput || selectedFilesInput.length === 0) return;
    await handleUpload(Array.from(selectedFilesInput));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || currentPath.length === 0) return;
    try {
      await createFolder(`${currentPathString}/${newFolderName.trim()}`);
      showToast(`Folder "${newFolderName}" created`, "success");
      setShowNewFolderDialog(false);
      setNewFolderName("");
      await loadItems(currentPathString);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to create folder", "error");
    }
  };

  const handleDelete = async (item: FileItem) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await deleteFile(item.key);
      showToast(`"${item.name}" deleted`, "success");
      setSelectedFiles(prev => { const s = new Set(prev); s.delete(item.key); return s; });
      await loadItems(currentPathString);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Delete failed", "error");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsDeleting(true);
    try {
      let deleted = 0;
      let failed = 0;
      
      for (const key of selectedFiles) {
        try {
          await deleteFile(key);
          deleted++;
        } catch {
          failed++;
        }
      }
      
      if (failed > 0) {
        showToast(`Deleted ${deleted}, ${failed} failed`, "error");
      } else {
        showToast(`${deleted} file${deleted !== 1 ? "s" : ""} deleted`, "success");
      }
      
      setSelectedFiles(new Set());
      setShowDeleteDialog(false);
      await loadItems(currentPathString);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Delete failed", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownload = async (item: FileItem) => {
    try {
      const result = await getDownloadUrl(item.key);
      if (result.url) window.open(result.url, "_blank");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Download failed", "error");
    }
  };

  const handleMoveFiles = async () => {
    if (selectedFiles.size === 0 || !moveDestination.trim()) return;
    setIsMoving(true);
    try {
      const result = await moveFiles(Array.from(selectedFiles), moveDestination.trim());
      if (result.status === "success") {
        showToast(`${result.moved} file${result.moved !== 1 ? "s" : ""} moved`, "success");
      } else {
        showToast(`Moved ${result.moved}, ${result.failed} failed`, "error");
      }
      setShowMoveDialog(false);
      setMoveDestination("");
      setSelectedFiles(new Set());
      await loadItems(currentPathString);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Move failed", "error");
    } finally {
      setIsMoving(false);
    }
  };

  const handleStartRename = (key: string, currentName: string) => {
    setEditingFile({ key, name: currentName });
    setEditValue(currentName);
  };

  const handleSaveRename = async () => {
    if (!editingFile || !editValue.trim() || editValue.trim() === editingFile.name) {
      setEditingFile(null);
      return;
    }
    try {
      const result = await renameFile(editingFile.key, editValue.trim());
      if (result.status === "success") {
        showToast(`Renamed to "${result.new_name}"`, "success");
        await loadItems(currentPathString);
      } else {
        showToast(result.message, "error");
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Rename failed", "error");
    }
    setEditingFile(null);
  };

  const handleToggleSelect = (key: string) => {
    setSelectedFiles(prev => {
      const s = new Set(prev);
      if (s.has(key)) s.delete(key);
      else s.add(key);
      return s;
    });
  };

  const handleSelectAll = () => {
    if (allItemsSelected) setSelectedFiles(new Set());
    else setSelectedFiles(new Set(allItems.map(item => item.key)));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (currentPath.length > 0) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (currentPath.length === 0) {
      showToast("Please select a workspace first", "error");
      return;
    }
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) await handleUpload(droppedFiles);
  };

  const handlePreview = (file: FileItem) => {
    const filesList = items.filter(item => item.type === "file") as FileItem[];
    setPreviewFile(file);
    setPreviewIndex(filesList.indexOf(file));
  };

  const filteredItems = items.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isConnected = healthStatus?.status === "connected";

  // Get team colour for background
  const teamColour = currentTeam?.colour || "#8B5CF6";
  const memberColour = currentMember?.colour || "#A78BFA";

  return (
    <div className="flex flex-col h-screen bg-[#05050a] overflow-hidden">
      {/* Creative Gradient Background */}

      {/* Base gradient layer */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 50% -20%, ${memberColour}12, transparent 50%),
            radial-gradient(ellipse 60% 40% at 100% 0%, ${teamColour}10, transparent 50%),
            radial-gradient(ellipse 60% 40% at 0% 100%, rgba(6, 182, 212, 0.06), transparent 50%),
            linear-gradient(180deg, #05050a 0%, #0a0a12 50%, #05050a 100%)
          `,
        }}
      />

      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Primary orb - follows member colour */}
        <div
          className="absolute w-[800px] h-[800px] rounded-full blur-[120px] opacity-30 animate-pulse"
          style={{
            background: `radial-gradient(circle, ${memberColour}40, transparent 70%)`,
            top: "-20%",
            left: "10%",
            animationDuration: "8s",
          }}
        />
        {/* Secondary orb - team accent */}
        <div
          className="absolute w-[600px] h-[600px] rounded-full blur-[100px] opacity-20"
          style={{
            background: `radial-gradient(circle, ${teamColour}30, transparent 70%)`,
            top: "60%",
            right: "-10%",
            animation: "pulse 10s ease-in-out infinite reverse",
          }}
        />
        {/* Tertiary orb - cyan accent */}
        <div
          className="absolute w-[500px] h-[500px] rounded-full blur-[80px] opacity-15"
          style={{
            background: "radial-gradient(circle, rgba(34, 211, 238, 0.3), transparent 70%)",
            bottom: "-10%",
            left: "30%",
            animation: "pulse 12s ease-in-out infinite",
          }}
        />
      </div>

      {/* Mesh gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: `
            radial-gradient(at 40% 20%, ${memberColour}15 0px, transparent 50%),
            radial-gradient(at 80% 0%, rgba(120, 119, 198, 0.1) 0px, transparent 50%),
            radial-gradient(at 0% 50%, rgba(6, 182, 212, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 50%, ${teamColour}08 0px, transparent 50%),
            radial-gradient(at 0% 100%, rgba(167, 139, 250, 0.08) 0px, transparent 50%),
            radial-gradient(at 80% 100%, rgba(244, 114, 182, 0.06) 0px, transparent 50%)
          `,
        }}
      />

      {/* Subtle grid pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Noise texture for depth */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette effect */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(5, 5, 10, 0.4) 100%)",
        }}
      />

      {/* Top Navigation Bar */}
      <div className="relative z-20 flex-shrink-0">
        <StudioNav
          rightSlot={
            <div
              className="flex items-center gap-1.5 px-3 py-1"
              title={isConnected ? "Connected" : "Disconnected"}
            >
              <ConnectionPulse connected={isConnected} />
              <span className="text-[11px] text-[rgb(var(--on-surface-variant))]">
                {isConnected ? "S3 Storage" : "Offline"}
              </span>
            </div>
          }
        />
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0 relative z-10">
        {/* Sidebar - Folder Tree */}
        <aside className="w-56 flex-shrink-0 flex flex-col bg-[#0d0d14] border-r border-white/[0.06]">
          {/* Sidebar Header */}
          <div className="px-3 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">
                Workspaces
              </span>
              <div className="flex items-center gap-1">
                <ConnectionPulse connected={isConnected} />
                <span className="text-[10px] text-white/50 font-mono">
                  {isConnected ? "Connected" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Team Tree */}
          <div className="flex-1 overflow-auto py-1">
            {TEAMS.map((team) => {
              const isTeamExpanded = expandedTeams.has(team.id);
              const hasActiveMember = team.members.some(m => m.name === currentPath[0]);

              return (
                <div key={team.id}>
                  {/* Team Header */}
                  <button
                    onClick={() => {
                      setExpandedTeams(prev => {
                        const s = new Set(prev);
                        if (s.has(team.id)) s.delete(team.id);
                        else s.add(team.id);
                        return s;
                      });
                    }}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs transition-all duration-200 group ${
                      hasActiveMember
                        ? "text-white"
                        : "text-white/60 hover:text-white/90"
                    }`}
                  >
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 ${!isTeamExpanded ? "-rotate-90" : ""}`}
                      style={{ color: team.colour }}
                    />
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: `${team.colour}20` }}
                    >
                      {team.icon === "flask" ? (
                        <FlaskConical className="w-3 h-3" style={{ color: team.colour }} />
                      ) : (
                        <BarChart3 className="w-3 h-3" style={{ color: team.colour }} />
                      )}
                    </div>
                    <span className="font-medium">{team.name}</span>
                  </button>

                  {/* Team Members */}
                  {isTeamExpanded && (
                    <div className="ml-3 pl-2.5 border-l border-white/[0.06]">
                      {team.members.map((member) => {
                        const isActive = currentPath[0] === member.name;

                        return (
                          <button
                            key={member.name}
                            onClick={() => setCurrentPath([member.name])}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all duration-200 ${
                              isActive
                                ? "bg-white/[0.08] text-white"
                                : "text-white/60 hover:bg-white/[0.04] hover:text-white/90"
                            }`}
                          >
                            <div
                              className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
                              style={{
                                backgroundColor: `${member.colour}20`,
                                color: member.colour,
                              }}
                            >
                              {member.icon}
                            </div>
                            <span className="flex-1 text-left capitalize font-medium">
                              {member.name.replace("-", " ")}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content */}
        <main
          className="flex-1 flex flex-col min-h-0 bg-[#0a0a0f]"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Header Toolbar */}
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#0d0d14]/80 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => handleNavigate(-1)}
                  className={`px-2 py-1 rounded-md text-sm transition-colors ${
                    currentPath.length === 0
                      ? "text-white font-medium"
                      : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                  }`}
                >
                  Storage
                </button>
                {currentPath.map((segment, index) => (
                  <div key={index} className="flex items-center gap-1">
                    <ChevronRight className="w-3.5 h-3.5 text-white/30" />
                    <button
                      onClick={() => handleNavigate(index)}
                      className={`px-2 py-1 rounded-md text-sm transition-colors ${
                        index === currentPath.length - 1
                          ? "text-white font-medium"
                          : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
                      }`}
                    >
                      {segment}
                    </button>
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white/[0.04] border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all"
                />
              </div>

              {/* View Toggle */}
              <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "list"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 rounded-md transition-all ${
                    viewMode === "grid"
                      ? "bg-white/10 text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
              </div>

              {/* Selection Actions */}
              {someFilesSelected && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowMoveDialog(true)}
                    disabled={isMoving}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/80 text-sm font-medium transition-all"
                  >
                    <Move className="w-4 h-4" />
                    Move ({selectedFiles.size})
                  </button>
                  <button
                    onClick={() => setShowDeleteDialog(true)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-sm font-medium transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedFiles.size})
                  </button>
                </div>
              )}

              {/* Actions */}
              {currentPath.length > 0 && (
                <>
                  <button
                    onClick={() => setShowNewFolderDialog(true)}
                    disabled={!isConnected}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-all disabled:opacity-50"
                  >
                    <FolderPlus className="w-4 h-4" />
                    New Folder
                  </button>

                  <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || !isConnected}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: currentMember?.colour || "#A78BFA",
                      color: "#000",
                    }}
                  >
                    {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Upload
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto relative">
            {/* Drop Zone Overlay */}
            {isDragOver && (
              <div className="absolute inset-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm border-2 border-dashed flex items-center justify-center"
                style={{ borderColor: currentMember?.colour || "#A78BFA" }}
              >
                <div className="text-center">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${currentMember?.colour || "#A78BFA"}20` }}
                  >
                    <HardDriveUpload className="w-10 h-10" style={{ color: currentMember?.colour || "#A78BFA" }} />
                  </div>
                  <p className="text-xl font-semibold text-white mb-1">Drop files to upload</p>
                  <p className="text-sm text-white/50">to /{currentPathString}</p>
                </div>
              </div>
            )}

            {/* Team Selection View */}
            {currentPath.length === 0 ? (
              <div className="p-5">
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white mb-1 tracking-tight">
                    Team Workspaces
                  </h2>
                  <p className="text-xs text-white/50">
                    Select a workspace to browse files
                  </p>
                </div>

                {/* Teams Grid */}
                <div className="space-y-5">
                  {TEAMS.map((team) => {
                    return (
                      <div key={team.id}>
                        {/* Team Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${team.colour}20` }}
                          >
                            {team.icon === "flask" ? (
                              <FlaskConical className="w-3.5 h-3.5" style={{ color: team.colour }} />
                            ) : (
                              <BarChart3 className="w-3.5 h-3.5" style={{ color: team.colour }} />
                            )}
                          </div>
                          <h3 className="text-sm font-semibold text-white">{team.name}</h3>
                          <span className="text-[10px] text-white/40">({team.members.length})</span>
                        </div>

                        {/* Members Grid */}
                        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {team.members.map((member) => (
                            <button
                              key={member.name}
                              onClick={() => handleEnterFolder(member.name)}
                              className="group relative p-3 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.03] to-transparent hover:from-white/[0.06] hover:border-white/[0.12] transition-all duration-200 text-left"
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
                                  style={{ backgroundColor: `${member.colour}15` }}
                                >
                                  <span className="text-sm font-bold" style={{ color: member.colour }}>
                                    {member.icon}
                                  </span>
                                </div>
                                <span className="text-xs font-medium capitalize text-white truncate">
                                  {member.name.replace("-", " ")}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Stats */}
                <div className="mt-6 p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-medium text-white/60">Storage</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-white/40">{TEAMS.length} teams</span>
                      <span className="text-white/40">{ALL_MEMBERS.length} members</span>
                      <span className={isConnected ? "text-emerald-400" : "text-red-400"}>
                        {isConnected ? "Online" : "Offline"}
                      </span>
                      <span className="text-white/40 font-mono">{healthStatus?.region || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2
                    className="w-10 h-10 animate-spin mx-auto mb-4"
                    style={{ color: currentMember?.colour || "#A78BFA" }}
                  />
                  <p className="text-sm text-white/50">Loading files...</p>
                </div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-sm">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: `${currentMember?.colour || "#A78BFA"}10` }}
                  >
                    {searchQuery ? (
                      <Search className="w-9 h-9" style={{ color: currentMember?.colour || "#A78BFA" }} />
                    ) : (
                      <FolderOpen className="w-9 h-9" style={{ color: currentMember?.colour || "#A78BFA" }} />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {searchQuery ? "No results found" : "Empty folder"}
                  </h3>
                  <p className="text-sm text-white/40 mb-5">
                    {searchQuery ? "Try a different search term" : "Upload files or create a folder to get started"}
                  </p>
                  {searchQuery ? (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 text-sm font-medium transition-all"
                    >
                      Clear search
                    </button>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={{ backgroundColor: currentMember?.colour || "#A78BFA", color: "#000" }}
                    >
                      Upload Files
                    </button>
                  )}
                </div>
              </div>
            ) : viewMode === "list" ? (
              /* List View - Data Table Style */
              <div className="min-w-full">
                {/* Table Header */}
                <div className="grid grid-cols-[44px,1fr,100px,160px,120px] gap-3 px-5 py-3 bg-[#0d0d14] border-b border-white/[0.06] sticky top-0 z-10">
                  <div className="flex items-center justify-center">
                    {allItems.length > 0 && (
                      <button onClick={handleSelectAll} className="p-1 rounded hover:bg-white/[0.06]">
                        {allItemsSelected ? (
                          <CheckSquare className="w-4 h-4" style={{ color: currentMember?.colour || "#A78BFA" }} />
                        ) : (
                          <Square className="w-4 h-4 text-white/30" />
                        )}
                      </button>
                    )}
                  </div>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Name</div>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider text-right">Size</div>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider text-right">Modified</div>
                  <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider text-right">Actions</div>
                </div>

                {/* Table Body */}
                <div className="divide-y divide-white/[0.04]">
                  {filteredItems.map((item, index) => (
                    <div
                      key={item.key}
                      className={`grid grid-cols-[44px,1fr,100px,160px,120px] gap-3 px-5 py-3 items-center transition-all duration-150 group hover:bg-white/[0.02] ${
                        selectedFiles.has(item.key) ? "bg-white/[0.04]" : ""
                      }`}
                      style={{
                        animationDelay: `${index * 20}ms`,
                      }}
                    >
                      {/* Checkbox */}
                      <div className="flex items-center justify-center">
                        <button
                          onClick={() => handleToggleSelect(item.key)}
                          className="p-1 rounded hover:bg-white/[0.06]"
                        >
                          {selectedFiles.has(item.key) ? (
                            <CheckSquare className="w-4 h-4" style={{ color: currentMember?.colour || "#A78BFA" }} />
                          ) : (
                            <Square className="w-4 h-4 text-white/20 group-hover:text-white/40" />
                          )}
                        </button>
                      </div>

                      {/* Name */}
                      {item.type === "folder" ? (
                        <button
                          onClick={() => handleEnterFolder(item.name)}
                          className="flex items-center gap-3 text-left group/name"
                        >
                          <FolderOpen className="w-5 h-5" style={{ color: currentMember?.colour || "#FBBF24" }} />
                          <span className="text-sm text-white/90 group-hover/name:text-white transition-colors font-medium">
                            {item.name}
                          </span>
                        </button>
                      ) : editingFile?.key === item.key ? (
                        <div className="flex items-center gap-3">
                          <FileIcon type={getFileTypeIcon(item.name)} />
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename();
                              if (e.key === "Escape") setEditingFile(null);
                            }}
                            onBlur={handleSaveRename}
                            className="flex-1 px-2 py-1 bg-white/[0.06] border border-white/20 rounded text-sm text-white focus:outline-none focus:border-white/40"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 min-w-0">
                          <FileIcon type={getFileTypeIcon(item.name)} className="w-5 h-5 flex-shrink-0" />
                          <button
                            onClick={() => handleStartRename(item.key, item.name)}
                            className="text-sm text-white/80 hover:text-white transition-colors truncate text-left"
                            title={item.name}
                          >
                            {item.name}
                          </button>
                        </div>
                      )}

                      {/* Size */}
                      <div className="text-xs text-white/40 text-right font-mono">
                        {item.type === "file" ? formatFileSize(item.size_bytes) : "—"}
                      </div>

                      {/* Modified */}
                      <div className="text-xs text-white/40 text-right">
                        {item.type === "file"
                          ? formatMYDateShort(item.last_modified)
                          : "—"}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {item.type === "folder" ? (
                          <ChevronRight className="w-4 h-4 text-white/30" />
                        ) : (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handlePreview(item)}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-white/80 transition-all"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Preview</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDownload(item)}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-emerald-400 transition-all"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Download</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1.5 rounded-lg hover:bg-white/[0.08] text-white/40 hover:text-red-400 transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Grid View */
              <div className="p-5 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                {filteredItems.map((item, index) => (
                  <div
                    key={item.type === "folder" ? item.path : item.key}
                    className={`group relative p-4 rounded-xl border transition-all duration-200 cursor-pointer hover:border-white/20 ${
                      item.type === "file" && selectedFiles.has(item.key)
                        ? "border-white/20 bg-white/[0.06]"
                        : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                    }`}
                    onClick={() => {
                      if (item.type === "folder") handleEnterFolder(item.name);
                      else handleToggleSelect(item.key);
                    }}
                    onDoubleClick={() => {
                      if (item.type === "file") handlePreview(item);
                    }}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    {/* Selection indicator */}
                    {item.type === "file" && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {selectedFiles.has(item.key) ? (
                          <CheckSquare className="w-4 h-4" style={{ color: currentMember?.colour || "#A78BFA" }} />
                        ) : (
                          <Square className="w-4 h-4 text-white/30" />
                        )}
                      </div>
                    )}

                    {/* Icon */}
                    <div className="flex justify-center mb-3">
                      {item.type === "folder" ? (
                        <Folder className="w-10 h-10" style={{ color: currentMember?.colour || "#FBBF24" }} />
                      ) : (
                        <FileIcon type={getFileTypeIcon(item.name)} className="w-10 h-10" />
                      )}
                    </div>

                    {/* Name */}
                    <p className="text-xs text-center text-white/80 truncate font-medium">{item.name}</p>

                    {/* Size */}
                    {item.type === "file" && (
                      <p className="text-[10px] text-center text-white/30 mt-1 font-mono">
                        {formatFileSize(item.size_bytes)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <footer className="flex items-center justify-between px-5 py-2 bg-[#0d0d14] border-t border-white/[0.06] text-[11px]">
            <div className="flex items-center gap-5 text-white/40">
              <span className="flex items-center gap-1.5 font-mono">
                <Cloud className="w-3.5 h-3.5" />
                {healthStatus?.bucket || "—"}
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Database className="w-3.5 h-3.5" />
                {healthStatus?.region || "—"}
              </span>
              <span className="flex items-center gap-1.5">
                <Signal className="w-3.5 h-3.5" />
                <ConnectionPulse connected={isConnected} />
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-white/40">
              {currentPath.length > 0 && (
                <span className="font-mono text-white/50">/{currentPathString}</span>
              )}
              <span>
                {selectedFiles.size > 0
                  ? `${selectedFiles.size} selected`
                  : `${filteredItems.length} item${filteredItems.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </footer>
        </main>
      </div>

      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${currentMember?.colour || "#A78BFA"}20` }}
              >
                <FolderPlus className="w-5 h-5" style={{ color: currentMember?.colour || "#A78BFA" }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Create Folder</h3>
                <p className="text-xs text-white/40 font-mono">/{currentPathString}</p>
              </div>
            </div>

            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 mb-5"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowNewFolderDialog(false); setNewFolderName(""); }}
                className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: currentMember?.colour || "#A78BFA", color: "#000" }}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Files Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
                <Move className="w-5 h-5 text-white/60" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Move Files</h3>
                <p className="text-xs text-white/40">{selectedFiles.size} file{selectedFiles.size !== 1 ? "s" : ""} selected</p>
              </div>
            </div>

            <div className="mb-4 max-h-48 overflow-auto">
              <p className="text-xs text-white/40 mb-3 uppercase tracking-wider font-semibold">Quick select</p>
              {TEAMS.map((team) => (
                <div key={team.id} className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    {team.icon === "flask" ? (
                      <FlaskConical className="w-3.5 h-3.5" style={{ color: team.colour }} />
                    ) : (
                      <BarChart3 className="w-3.5 h-3.5" style={{ color: team.colour }} />
                    )}
                    <span className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">{team.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {team.members.map((member) => (
                      <button
                        key={member.name}
                        onClick={() => setMoveDestination(member.name)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          moveDestination === member.name ? "text-black" : "bg-white/[0.04] text-white/60 hover:text-white/90"
                        }`}
                        style={moveDestination === member.name ? { backgroundColor: member.colour } : {}}
                      >
                        /{member.name.replace("-", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-xs text-white/40 mb-2 uppercase tracking-wider font-semibold">
                Destination path
              </label>
              <div className="flex items-center">
                <span className="px-3 py-3 bg-white/[0.04] border border-r-0 border-white/[0.08] rounded-l-xl text-white/40 text-sm font-mono">/</span>
                <input
                  type="text"
                  value={moveDestination}
                  onChange={(e) => setMoveDestination(e.target.value)}
                  placeholder="workspace/subfolder"
                  className="flex-1 px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-r-xl text-white placeholder:text-white/30 focus:outline-none focus:border-white/20 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowMoveDialog(false); setMoveDestination(""); }}
                className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveFiles}
                disabled={!moveDestination.trim() || isMoving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isMoving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Move className="w-4 h-4" />}
                Move Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Items</h3>
                <p className="text-xs text-white/40">{selectedFiles.size} item{selectedFiles.size !== 1 ? "s" : ""} selected</p>
              </div>
            </div>

            <div className="mb-5 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
              <p className="text-sm text-white/70 mb-3">
                Are you sure you want to delete the following items? This action cannot be undone.
              </p>
              <div className="max-h-32 overflow-auto space-y-1">
                {Array.from(selectedFiles).map((key) => {
                  const isFolder = key.endsWith("/");
                  const itemName = key.replace(/\/$/, "").split("/").pop() || key;
                  return (
                    <div key={key} className="flex items-center gap-2 text-xs text-white/50 font-mono">
                      {isFolder ? (
                        <Folder className="w-3 h-3 flex-shrink-0 text-amber-400" />
                      ) : (
                        <File className="w-3 h-3 flex-shrink-0" />
                      )}
                      <span className="truncate">{itemName}{isFolder ? "/" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/70 text-sm font-medium transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-semibold transition-all disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete {selectedFiles.size} Item{selectedFiles.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        isOpen={!!previewFile}
        onClose={() => { setPreviewFile(null); setPreviewIndex(-1); }}
        onNext={() => {
          const filesList = items.filter(item => item.type === "file") as FileItem[];
          if (previewIndex < filesList.length - 1) {
            setPreviewFile(filesList[previewIndex + 1]);
            setPreviewIndex(previewIndex + 1);
          }
        }}
        onPrevious={() => {
          if (previewIndex > 0) {
            const filesList = items.filter(item => item.type === "file") as FileItem[];
            setPreviewFile(filesList[previewIndex - 1]);
            setPreviewIndex(previewIndex - 1);
          }
        }}
      />
    </div>
  );
}

function StoragePage() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <TooltipProvider delayDuration={200}>
          <StoragePageContent />
        </TooltipProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
