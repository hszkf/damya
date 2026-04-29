import { describe, expect, test, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';

// Mock storage service
const mockStorageService = {
  healthCheck: mock(() =>
    Promise.resolve({
      status: 'healthy',
      bucket: 'test-bucket',
      connected: true,
    })
  ),
  uploadFile: mock(() =>
    Promise.resolve({
      key: 'uploads/test.txt',
      url: 'https://bucket.s3.amazonaws.com/uploads/test.txt',
      size: 100,
    })
  ),
  uploadFiles: mock(() => Promise.resolve([])),
  listFiles: mock(() => Promise.resolve([])),
  downloadFile: mock(() =>
    Promise.resolve({
      data: Buffer.from('File content'),
      contentType: 'text/plain',
    })
  ),
  getPresignedUrl: mock(() => Promise.resolve('https://presigned-url.example.com')),
  deleteFile: mock(() => Promise.resolve()),
  moveFile: mock(() => Promise.resolve()),
  renameFile: mock(() => Promise.resolve('new-key.txt')),
  createFolder: mock(() => Promise.resolve()),
};

mock.module('../../services/storage-service', () => ({
  storageService: mockStorageService,
}));

// Import routes after mocking
import { storageRoutes } from '../../routes/storage';

describe('Storage Routes', () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route('/storage', storageRoutes);

    // Clear all mocks
    Object.values(mockStorageService).forEach((m) => m.mockClear());
  });

  describe('GET /storage/health', () => {
    test('should return connected status when healthy', async () => {
      const res = await app.request('/storage/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('connected');
      expect(json.bucket).toBe('test-bucket');
    });

    test('should return disconnected status on error', async () => {
      mockStorageService.healthCheck.mockRejectedValueOnce(new Error('S3 error'));

      const res = await app.request('/storage/health');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('disconnected');
      expect(json.error).toBeTruthy();
    });
  });

  describe('POST /storage/upload', () => {
    test('should upload file successfully', async () => {
      const formData = new FormData();
      formData.append('file', new File(['test content'], 'test.txt', { type: 'text/plain' }));
      formData.append('subfolder', 'uploads');

      mockStorageService.uploadFile.mockResolvedValueOnce({
        key: 'uploads/test.txt',
        url: 'https://bucket.s3.amazonaws.com/uploads/test.txt',
        size: 12,
      });

      const res = await app.request('/storage/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.key).toBe('uploads/test.txt');
    });

    test('should return 400 when no file provided', async () => {
      const formData = new FormData();

      const res = await app.request('/storage/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
      expect(json.message).toContain('No file');
    });

    test('should handle upload errors', async () => {
      const formData = new FormData();
      formData.append('file', new File(['content'], 'test.txt'));

      mockStorageService.uploadFile.mockRejectedValueOnce(new Error('Upload failed'));

      const res = await app.request('/storage/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.status).toBe('error');
    });
  });

  describe('POST /storage/upload-multiple', () => {
    test('should upload multiple files', async () => {
      const formData = new FormData();
      formData.append('files', new File(['content1'], 'file1.txt'));
      formData.append('files', new File(['content2'], 'file2.txt'));
      formData.append('subfolder', 'documents');

      mockStorageService.uploadFiles.mockResolvedValueOnce([
        { key: 'documents/file1.txt', url: 'url1', size: 8 },
        { key: 'documents/file2.txt', url: 'url2', size: 8 },
      ]);

      const res = await app.request('/storage/upload-multiple', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.uploaded).toBe(2);
    });

    test('should return 400 when no files provided', async () => {
      const formData = new FormData();

      const res = await app.request('/storage/upload-multiple', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
    });
  });

  describe('GET /storage/files', () => {
    test('should list files', async () => {
      mockStorageService.listFiles.mockResolvedValueOnce([
        { key: 'file1.txt', name: 'file1.txt', size: 100, lastModified: new Date(), isFolder: false },
        { key: 'folder/', name: 'folder', size: 0, lastModified: new Date(), isFolder: true },
      ]);

      const res = await app.request('/storage/files');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.files).toHaveLength(2);
      expect(json.count).toBe(2);
    });

    test('should list files with subfolder', async () => {
      mockStorageService.listFiles.mockResolvedValueOnce([]);

      await app.request('/storage/files?subfolder=documents/');

      expect(mockStorageService.listFiles).toHaveBeenCalledWith('documents/');
    });

    test('should handle listing errors', async () => {
      mockStorageService.listFiles.mockRejectedValueOnce(new Error('Access denied'));

      const res = await app.request('/storage/files');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.status).toBe('error');
    });
  });

  describe('GET /storage/list (legacy)', () => {
    test('should list files with legacy endpoint', async () => {
      mockStorageService.listFiles.mockResolvedValueOnce([
        { key: 'file1.txt', name: 'file1.txt', size: 100, lastModified: new Date(), isFolder: false },
      ]);

      const res = await app.request('/storage/list');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
    });
  });

  describe('GET /storage/download/:key', () => {
    test('should download file', async () => {
      mockStorageService.downloadFile.mockResolvedValueOnce({
        data: Buffer.from('File content here'),
        contentType: 'text/plain',
      });

      const res = await app.request('/storage/download/documents/file.txt');

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toBe('text/plain');
      expect(res.headers.get('Content-Disposition')).toContain('file.txt');
    });

    test('should handle download with nested path', async () => {
      mockStorageService.downloadFile.mockResolvedValueOnce({
        data: Buffer.from('Content'),
        contentType: 'application/pdf',
      });

      await app.request('/storage/download/path/to/nested/file.pdf');

      expect(mockStorageService.downloadFile).toHaveBeenCalledWith('path/to/nested/file.pdf');
    });

    test('should handle download errors', async () => {
      mockStorageService.downloadFile.mockRejectedValueOnce(new Error('File not found'));

      const res = await app.request('/storage/download/nonexistent.txt');
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.status).toBe('error');
    });
  });

  describe('GET /storage/download-url/:key', () => {
    test('should generate presigned download URL', async () => {
      mockStorageService.getPresignedUrl.mockResolvedValueOnce(
        'https://presigned.example.com/file.txt'
      );

      const res = await app.request('/storage/download-url/documents/file.txt');
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.url).toContain('presigned');
      expect(json.key).toBe('documents/file.txt');
    });

    test('should accept custom expiration', async () => {
      mockStorageService.getPresignedUrl.mockResolvedValueOnce('https://url.com');

      await app.request('/storage/download-url/file.txt?expiration=7200');

      expect(mockStorageService.getPresignedUrl).toHaveBeenCalledWith('file.txt', 7200);
    });
  });

  describe('POST /storage/presigned-url (legacy)', () => {
    test('should generate presigned URL', async () => {
      mockStorageService.getPresignedUrl.mockResolvedValueOnce(
        'https://presigned.example.com/file.txt'
      );

      const res = await app.request('/storage/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'file.txt' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.url).toContain('presigned');
    });

    test('should return 400 when key is missing', async () => {
      const res = await app.request('/storage/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain('required');
    });
  });

  describe('DELETE /storage/files', () => {
    test('should delete file', async () => {
      const res = await app.request('/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'documents/file.txt' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('documents/file.txt');
    });

    test('should return 400 when key is missing', async () => {
      const res = await app.request('/storage/files', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
    });
  });

  describe('DELETE /storage/:key (legacy)', () => {
    test('should delete file with legacy endpoint', async () => {
      const res = await app.request('/storage/documents/file.txt', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('documents/file.txt');
    });

    test('should handle delete errors', async () => {
      mockStorageService.deleteFile.mockRejectedValueOnce(new Error('Delete failed'));

      const res = await app.request('/storage/file.txt', { method: 'DELETE' });
      const json = await res.json();

      expect(res.status).toBe(500);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /storage/folders', () => {
    test('should create folder', async () => {
      const res = await app.request('/storage/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_name: 'new-folder' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(mockStorageService.createFolder).toHaveBeenCalledWith('new-folder');
    });

    test('should return 400 when folder_name is missing', async () => {
      const res = await app.request('/storage/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
    });
  });

  describe('POST /storage/create-folder (legacy)', () => {
    test('should create folder with legacy endpoint', async () => {
      const res = await app.request('/storage/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: 'new-folder' }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(mockStorageService.createFolder).toHaveBeenCalledWith('new-folder');
    });

    test('should return 400 when path is missing', async () => {
      const res = await app.request('/storage/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });

  describe('POST /storage/move', () => {
    test('should move files', async () => {
      const res = await app.request('/storage/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_keys: ['old/file1.txt', 'old/file2.txt'],
          destination_folder: 'new',
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.moved).toBe(2);
    });

    test('should return 400 when source_keys is missing', async () => {
      const res = await app.request('/storage/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination_folder: 'new' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
    });
  });

  describe('PUT /storage/files/rename', () => {
    test('should rename file', async () => {
      mockStorageService.renameFile.mockResolvedValueOnce('folder/new-name.txt');

      const res = await app.request('/storage/files/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'folder/old-name.txt',
          new_name: 'new-name.txt',
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe('success');
      expect(json.new_key).toBe('folder/new-name.txt');
    });

    test('should return 400 when parameters are missing', async () => {
      const res = await app.request('/storage/files/rename', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'file.txt' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.status).toBe('error');
    });
  });

  describe('POST /storage/rename (legacy)', () => {
    test('should rename file with legacy endpoint', async () => {
      mockStorageService.renameFile.mockResolvedValueOnce('folder/new-name.txt');

      const res = await app.request('/storage/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'folder/old-name.txt',
          new_name: 'new-name.txt',
        }),
      });
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.new_key).toBe('folder/new-name.txt');
    });

    test('should return 400 when parameters are missing', async () => {
      const res = await app.request('/storage/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'file.txt' }),
      });
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
    });
  });
});
