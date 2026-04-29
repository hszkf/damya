import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Maximize2, Minimize2 } from 'lucide-react';
import { getDownloadUrl } from '~/lib/storage-api';
import type { StorageFile } from '~/lib/storage-api';
import { formatMYDateTime } from '~/lib/date-utils';

interface FilePreviewModalProps {
  file: StorageFile | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export default function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onNext,
  onPrevious,
}: FilePreviewModalProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrevious) {
        onPrevious();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose, onNext, onPrevious]);

  // Load preview URL when file changes
  useEffect(() => {
    if (file && isOpen) {
      loadPreview();
    } else {
      setPreviewUrl(null);
      setError(null);
    }
  }, [file, isOpen]);

  const loadPreview = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await getDownloadUrl(file.key);
      if (result.status === 'success' && result.url) {
        setPreviewUrl(result.url);
      } else {
        setError('Failed to load preview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preview');
    } finally {
      setIsLoading(false);
    }
  };

  const getFileType = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();

    // Images
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext || '')) {
      return 'image';
    }

    // Videos
    if (['mp4', 'avi', 'mov', 'wmv', 'mkv', 'webm'].includes(ext || '')) {
      return 'video';
    }

    // PDFs
    if (['pdf'].includes(ext || '')) {
      return 'pdf';
    }

    // Audio
    if (['mp3', 'wav', 'ogg', 'flac', 'aac'].includes(ext || '')) {
      return 'audio';
    }

    // Code files
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'sql', 'md', 'txt'].includes(ext || '')) {
      return 'code';
    }

    // Text files
    if (['txt', 'md', 'csv', 'log'].includes(ext || '')) {
      return 'text';
    }

    return 'other';
  };

  const renderPreview = () => {
    if (!file) return null;

    const fileType = getFileType(file.name);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-on-surface-variant">Loading preview...</p>
          </div>
        </div>
      );
    }

    if (error || !previewUrl) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <p className="text-error mb-2">Preview not available</p>
            <p className="text-sm text-on-surface-variant">{error}</p>
            <button
              onClick={loadPreview}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    switch (fileType) {
      case 'image':
        return (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: isFullScreen ? '100vh' : '70vh' }}
          />
        );

      case 'video':
        return (
          <video
            src={previewUrl}
            controls
            className="max-w-full max-h-full"
            style={{ maxHeight: isFullScreen ? '100vh' : '70vh' }}
          >
            Your browser does not support the video tag.
          </video>
        );

      case 'pdf':
        return (
          <iframe
            src={previewUrl}
            className="w-full h-full"
            style={{ height: isFullScreen ? '100vh' : '70vh' }}
            title={file.name}
          />
        );

      case 'audio':
        return (
          <div className="flex items-center justify-center h-full">
            <audio controls className="w-full max-w-md">
              <source src={previewUrl} />
              Your browser does not support the audio element.
            </audio>
          </div>
        );

      case 'code':
      case 'text':
        return (
          <div className="w-full h-full overflow-auto p-4">
            <iframe
              src={previewUrl}
              className="w-full h-full min-h-96 bg-surface-container rounded"
              title={file.name}
            />
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-16 h-16 bg-surface-container-high rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-on-surface-variant">
                {file.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
            <p className="text-on-surface-variant mb-4">Preview not available for this file type</p>
            <a
              href={previewUrl}
              download={file.name}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
        );
    }
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className={`bg-surface-container text-on-surface rounded-lg shadow-2xl flex flex-col ${isFullScreen ? 'w-full h-full' : 'w-[90%] h-[90%] max-w-6xl'}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="font-semibold truncate" title={file.name}>
              {file.name}
            </h3>
            <span className="text-sm text-on-surface-variant">
              ({Math.round(file.size_bytes / 1024)} KB)
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Navigation buttons */}
            {onPrevious && (
              <button
                onClick={onPrevious}
                className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
                title="Previous file (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
                title="Next file (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}

            {/* Download button */}
            <a
              href={previewUrl || '#'}
              download={file.name}
              className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </a>

            {/* Full screen toggle */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
              title="Toggle full screen"
            >
              {isFullScreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-container-high rounded-lg transition-colors"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-surface-container">
          {renderPreview()}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-outline-variant text-sm text-on-surface-variant">
          <div className="flex justify-between">
            <span>Modified: {formatMYDateTime(file.last_modified)}</span>
            <span>Press Esc to close, ← → to navigate</span>
          </div>
        </div>
      </div>
    </div>
  );
}