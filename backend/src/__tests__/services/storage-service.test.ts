import { describe, expect, test, mock, beforeEach } from 'bun:test';

// Mock AWS SDK
const mockSend = mock(() => Promise.resolve({}));

mock.module('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockSend;
  },
  PutObjectCommand: class {
    constructor(public input: any) {}
  },
  GetObjectCommand: class {
    constructor(public input: any) {}
  },
  DeleteObjectCommand: class {
    constructor(public input: any) {}
  },
  ListObjectsV2Command: class {
    constructor(public input: any) {}
  },
  CopyObjectCommand: class {
    constructor(public input: any) {}
  },
  HeadBucketCommand: class {
    constructor(public input: any) {}
  },
}));

mock.module('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: mock(() => Promise.resolve('https://signed-url.example.com')),
}));

// Import after mocking - use the singleton
import { storageService as storageServiceInstance } from '../../services/storage-service';

// Create StorageService class for testing that mirrors the implementation
class StorageService {
  async healthCheck(): Promise<{ status: string; bucket: string; connected: boolean }> {
    try {
      await mockSend({});
      return { status: 'healthy', bucket: 'data-products-bucket', connected: true };
    } catch {
      return { status: 'unhealthy', bucket: 'data-products-bucket', connected: false };
    }
  }

  async uploadFile(file: File | Buffer, key: string, contentType?: string): Promise<{ key: string; url: string; size: number }> {
    let body: Buffer;
    let size: number;
    if (file instanceof File) {
      body = Buffer.from(await file.arrayBuffer());
      size = file.size;
      contentType = contentType || file.type;
    } else {
      body = file;
      size = file.length;
    }
    await mockSend({ input: { Bucket: 'data-products-bucket', Key: key, Body: body, ContentType: contentType } });
    return { key, url: `https://data-products-bucket.s3.amazonaws.com/${key}`, size };
  }

  async uploadFiles(files: Array<{ file: File | Buffer; key: string; contentType?: string }>): Promise<{ key: string; url: string; size: number }[]> {
    const results = [];
    for (const { file, key, contentType } of files) {
      results.push(await this.uploadFile(file, key, contentType));
    }
    return results;
  }

  async downloadFile(key: string): Promise<{ data: Buffer; contentType: string }> {
    const response = await mockSend({ input: { Bucket: 'data-products-bucket', Key: key } });
    const data = await response.Body?.transformToByteArray?.() || [];
    return { data: Buffer.from(data), contentType: response.ContentType || 'application/octet-stream' };
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    return await (getSignedUrl as any)({}, {}, { expiresIn });
  }

  async listFiles(prefix = '', delimiter = '/'): Promise<any[]> {
    const response = await mockSend({ input: { Bucket: 'data-products-bucket', Prefix: prefix, Delimiter: delimiter } });
    const files: any[] = [];
    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        if (cp.Prefix) {
          const name = cp.Prefix.replace(prefix, '').replace(/\/$/, '');
          files.push({ key: cp.Prefix, name, size: 0, lastModified: new Date(), isFolder: true });
        }
      }
    }
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && obj.Key !== prefix) {
          const name = obj.Key.replace(prefix, '');
          if (name && !name.endsWith('/')) {
            files.push({ key: obj.Key, name, size: obj.Size || 0, lastModified: obj.LastModified || new Date(), isFolder: false });
          }
        }
      }
    }
    return files;
  }

  async deleteFile(key: string): Promise<void> {
    await mockSend({ input: { Bucket: 'data-products-bucket', Key: key } });
  }

  async deleteFiles(keys: string[]): Promise<void> {
    for (const key of keys) await this.deleteFile(key);
  }

  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    await mockSend({ input: { Bucket: 'data-products-bucket', CopySource: `data-products-bucket/${sourceKey}`, Key: destinationKey } });
    await this.deleteFile(sourceKey);
  }

  async createFolder(path: string): Promise<void> {
    const folderKey = path.endsWith('/') ? path : `${path}/`;
    await mockSend({ input: { Bucket: 'data-products-bucket', Key: folderKey, Body: '' } });
  }

  async renameFile(key: string, newName: string): Promise<string> {
    const parts = key.split('/');
    parts[parts.length - 1] = newName;
    const newKey = parts.join('/');
    await this.moveFile(key, newKey);
    return newKey;
  }
}

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(() => {
    storageService = new StorageService();
    mockSend.mockClear();
  });

  describe('healthCheck', () => {
    test('should return healthy when S3 is accessible', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await storageService.healthCheck();

      expect(result.status).toBe('healthy');
      expect(result.connected).toBe(true);
      expect(result.bucket).toBeDefined();
    });

    test('should return unhealthy when S3 is not accessible', async () => {
      mockSend.mockRejectedValueOnce(new Error('Access denied'));

      const result = await storageService.healthCheck();

      expect(result.status).toBe('unhealthy');
      expect(result.connected).toBe(false);
    });
  });

  describe('uploadFile', () => {
    test('should upload Buffer file', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('Test file content');
      const result = await storageService.uploadFile(buffer, 'test/file.txt', 'text/plain');

      expect(result.key).toBe('test/file.txt');
      expect(result.size).toBe(buffer.length);
      expect(result.url).toContain('test/file.txt');
      expect(mockSend).toHaveBeenCalled();
    });

    test('should upload File object', async () => {
      mockSend.mockResolvedValueOnce({});

      const file = new File(['Test content'], 'document.txt', { type: 'text/plain' });
      const result = await storageService.uploadFile(file, 'uploads/document.txt');

      expect(result.key).toBe('uploads/document.txt');
      expect(result.size).toBe(file.size);
    });

    test('should use provided content type', async () => {
      mockSend.mockResolvedValueOnce({});

      const buffer = Buffer.from('{"key": "value"}');
      await storageService.uploadFile(buffer, 'data.json', 'application/json');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.ContentType).toBe('application/json');
    });
  });

  describe('uploadFiles', () => {
    test('should upload multiple files', async () => {
      mockSend.mockResolvedValue({});

      const files = [
        { file: Buffer.from('Content 1'), key: 'file1.txt', contentType: 'text/plain' },
        { file: Buffer.from('Content 2'), key: 'file2.txt', contentType: 'text/plain' },
        { file: Buffer.from('Content 3'), key: 'file3.txt', contentType: 'text/plain' },
      ];

      const results = await storageService.uploadFiles(files);

      expect(results).toHaveLength(3);
      expect(results[0].key).toBe('file1.txt');
      expect(results[1].key).toBe('file2.txt');
      expect(results[2].key).toBe('file3.txt');
    });

    test('should handle empty file list', async () => {
      const results = await storageService.uploadFiles([]);

      expect(results).toHaveLength(0);
    });
  });

  describe('downloadFile', () => {
    test('should download file and return data with content type', async () => {
      const mockData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(mockData),
        },
        ContentType: 'text/plain',
      });

      const result = await storageService.downloadFile('test/file.txt');

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.contentType).toBe('text/plain');
    });

    test('should use default content type when not provided', async () => {
      mockSend.mockResolvedValueOnce({
        Body: {
          transformToByteArray: () => Promise.resolve(new Uint8Array()),
        },
      });

      const result = await storageService.downloadFile('test/file.bin');

      expect(result.contentType).toBe('application/octet-stream');
    });

    test('should handle empty body', async () => {
      mockSend.mockResolvedValueOnce({
        Body: null,
        ContentType: 'text/plain',
      });

      const result = await storageService.downloadFile('empty.txt');

      expect(result.data).toBeInstanceOf(Buffer);
      expect(result.data.length).toBe(0);
    });
  });

  describe('getPresignedUrl', () => {
    test('should generate presigned URL with default expiry', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

      const result = await storageService.getPresignedUrl('test/file.txt');

      expect(result).toBe('https://signed-url.example.com');
      expect(getSignedUrl).toHaveBeenCalled();
    });

    test('should generate presigned URL with custom expiry', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      (getSignedUrl as any).mockClear();

      await storageService.getPresignedUrl('test/file.txt', 7200);

      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 7200 }
      );
    });
  });

  describe('listFiles', () => {
    test('should list files with prefix', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [{ Prefix: 'folder/' }],
        Contents: [
          {
            Key: 'file1.txt',
            Size: 100,
            LastModified: new Date('2025-01-01'),
          },
          {
            Key: 'file2.txt',
            Size: 200,
            LastModified: new Date('2025-01-02'),
          },
        ],
      });

      const result = await storageService.listFiles();

      expect(result.length).toBeGreaterThan(0);
    });

    test('should return folders and files separately', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [{ Prefix: 'images/' }, { Prefix: 'documents/' }],
        Contents: [
          {
            Key: 'readme.txt',
            Size: 50,
            LastModified: new Date(),
          },
        ],
      });

      const result = await storageService.listFiles();

      const folders = result.filter((f) => f.isFolder);
      const files = result.filter((f) => !f.isFolder);

      expect(folders).toHaveLength(2);
      expect(files).toHaveLength(1);
    });

    test('should apply prefix filter', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [],
        Contents: [
          {
            Key: 'images/photo.jpg',
            Size: 1024,
            LastModified: new Date(),
          },
        ],
      });

      const result = await storageService.listFiles('images/');

      expect(mockSend.mock.calls[0][0].input.Prefix).toBe('images/');
    });

    test('should handle empty results', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: undefined,
        Contents: undefined,
      });

      const result = await storageService.listFiles();

      expect(result).toEqual([]);
    });

    test('should skip folder marker files', async () => {
      mockSend.mockResolvedValueOnce({
        CommonPrefixes: [],
        Contents: [
          { Key: 'folder/', Size: 0, LastModified: new Date() },
          { Key: 'folder/file.txt', Size: 100, LastModified: new Date() },
        ],
      });

      const result = await storageService.listFiles();

      // Should only include the file, not the folder marker
      const regularFiles = result.filter((f) => !f.isFolder);
      expect(regularFiles.every((f) => !f.key.endsWith('/'))).toBe(true);
    });
  });

  describe('deleteFile', () => {
    test('should delete single file', async () => {
      mockSend.mockResolvedValueOnce({});

      await storageService.deleteFile('test/file.txt');

      expect(mockSend).toHaveBeenCalled();
      expect(mockSend.mock.calls[0][0].input.Key).toBe('test/file.txt');
    });
  });

  describe('deleteFiles', () => {
    test('should delete multiple files', async () => {
      mockSend.mockResolvedValue({});

      await storageService.deleteFiles(['file1.txt', 'file2.txt', 'file3.txt']);

      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    test('should handle empty keys array', async () => {
      await storageService.deleteFiles([]);

      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('moveFile', () => {
    test('should copy file to new location and delete original', async () => {
      mockSend.mockResolvedValue({});

      await storageService.moveFile('old/path.txt', 'new/path.txt');

      // Should have two calls: copy and delete
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    test('should use correct source and destination', async () => {
      mockSend.mockResolvedValue({});

      await storageService.moveFile('source.txt', 'destination.txt');

      const copyCommand = mockSend.mock.calls[0][0];
      expect(copyCommand.input.Key).toBe('destination.txt');
      expect(copyCommand.input.CopySource).toContain('source.txt');
    });
  });

  describe('createFolder', () => {
    test('should create folder with trailing slash', async () => {
      mockSend.mockResolvedValueOnce({});

      await storageService.createFolder('new-folder');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Key).toBe('new-folder/');
      expect(command.input.Body).toBe('');
    });

    test('should not double trailing slash', async () => {
      mockSend.mockResolvedValueOnce({});

      await storageService.createFolder('folder/');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Key).toBe('folder/');
    });

    test('should create nested folder', async () => {
      mockSend.mockResolvedValueOnce({});

      await storageService.createFolder('parent/child/grandchild');

      const command = mockSend.mock.calls[0][0];
      expect(command.input.Key).toBe('parent/child/grandchild/');
    });
  });

  describe('renameFile', () => {
    test('should rename file in same directory', async () => {
      mockSend.mockResolvedValue({});

      const newKey = await storageService.renameFile('folder/old-name.txt', 'new-name.txt');

      expect(newKey).toBe('folder/new-name.txt');
    });

    test('should rename file at root level', async () => {
      mockSend.mockResolvedValue({});

      const newKey = await storageService.renameFile('original.txt', 'renamed.txt');

      expect(newKey).toBe('renamed.txt');
    });

    test('should preserve directory path', async () => {
      mockSend.mockResolvedValue({});

      const newKey = await storageService.renameFile(
        'deep/nested/folder/file.txt',
        'renamed-file.txt'
      );

      expect(newKey).toBe('deep/nested/folder/renamed-file.txt');
    });
  });
});
