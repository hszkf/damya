import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { fromIni } from '@aws-sdk/credential-provider-ini';

const awsProfile = process.env.AWS_PROFILE || 'data-prod';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  credentials: fromIni({ profile: awsProfile }),
});

const BUCKET = process.env.S3_BUCKET || 'prod-545009847083-analytics-reporting';
const PREFIX = process.env.S3_PREFIX || 'amylia/';

// Helper to add prefix to key
const withPrefix = (key: string): string => {
  if (!PREFIX) return key;
  // Don't double-add prefix
  if (key.startsWith(PREFIX)) return key;
  return `${PREFIX}${key}`;
};

// Helper to remove prefix from key for display
const withoutPrefix = (key: string): string => {
  if (!PREFIX) return key;
  if (key.startsWith(PREFIX)) return key.slice(PREFIX.length);
  return key;
};

export interface FileInfo {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
  isFolder: boolean;
  contentType?: string;
}

export interface UploadResult {
  key: string;
  url: string;
  size: number;
}

class StorageService {
  // Get bucket and prefix info
  getBucket(): string {
    return BUCKET;
  }

  getPrefix(): string {
    return PREFIX;
  }

  // Check S3 connection health
  async healthCheck(): Promise<{ status: string; bucket: string; prefix: string; connected: boolean }> {
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      return {
        status: 'healthy',
        bucket: BUCKET,
        prefix: PREFIX,
        connected: true,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        bucket: BUCKET,
        prefix: PREFIX,
        connected: false,
      };
    }
  }

  // Upload a single file
  async uploadFile(
    file: File | Buffer,
    key: string,
    contentType?: string
  ): Promise<UploadResult> {
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

    const fullKey = withPrefix(key);

    // For buffers with known length, use PutObjectCommand directly
    // This avoids the "Stream of unknown length" warning
    if (body.length < 5 * 1024 * 1024) {
      // Files under 5MB - use simple put
      await s3Client.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: fullKey,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
        })
      );
    } else {
      // Files 5MB+ - use multipart upload
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: BUCKET,
          Key: fullKey,
          Body: body,
          ContentType: contentType,
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
        leavePartsOnError: false,
      });

      await upload.done();
    }

    return {
      key: withoutPrefix(fullKey),
      url: `https://${BUCKET}.s3.amazonaws.com/${fullKey}`,
      size,
    };
  }

  // Upload multiple files
  async uploadFiles(
    files: Array<{ file: File | Buffer; key: string; contentType?: string }>
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];

    for (const { file, key, contentType } of files) {
      const result = await this.uploadFile(file, key, contentType);
      results.push(result);
    }

    return results;
  }

  // Download a file
  async downloadFile(key: string): Promise<{ data: Buffer; contentType: string }> {
    const fullKey = withPrefix(key);
    const response = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: fullKey,
      })
    );

    const data = await response.Body?.transformToByteArray();

    return {
      data: Buffer.from(data || []),
      contentType: response.ContentType || 'application/octet-stream',
    };
  }

  // Get presigned URL for download
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const fullKey = withPrefix(key);
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: fullKey,
    });

    return await getSignedUrl(s3Client, command, { expiresIn });
  }

  // List files in a path
  async listFiles(subfolder = '', delimiter = '/'): Promise<FileInfo[]> {
    // Combine base prefix with subfolder
    // Ensure subfolder ends with / if not empty (for proper prefix matching)
    const normalizedSubfolder = subfolder && !subfolder.endsWith('/') ? `${subfolder}/` : subfolder;
    const fullPrefix = withPrefix(normalizedSubfolder);
    
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: fullPrefix,
        Delimiter: delimiter,
      })
    );

    const files: FileInfo[] = [];
    const folderNames = new Set<string>();

    // Add folders from CommonPrefixes (folders with content)
    if (response.CommonPrefixes) {
      for (const cp of response.CommonPrefixes) {
        if (cp.Prefix) {
          const displayKey = withoutPrefix(cp.Prefix);
          // Remove the current subfolder prefix to get relative name
          const relativePath = normalizedSubfolder ? displayKey.replace(normalizedSubfolder, '') : displayKey;
          const name = relativePath.replace(/\/$/, '');
          if (name && !name.includes('/')) {
            folderNames.add(name);
            files.push({
              key: displayKey,
              name,
              size: 0,
              lastModified: new Date(),
              isFolder: true,
            });
          }
        }
      }
    }

    // Add files and empty folder markers from Contents
    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          const displayKey = withoutPrefix(obj.Key);
          // Remove the current subfolder prefix to get relative name
          const relativePath = normalizedSubfolder ? displayKey.replace(normalizedSubfolder, '') : displayKey;
          
          // Skip the folder marker for current directory
          if (!relativePath || relativePath === '/') continue;
          
          // Check if this is an empty folder marker (ends with /)
          if (relativePath.endsWith('/')) {
            const name = relativePath.replace(/\/$/, '');
            // Only add if it's a direct child (no nested slashes) and not already added
            if (name && !name.includes('/') && !folderNames.has(name)) {
              folderNames.add(name);
              files.push({
                key: displayKey,
                name,
                size: 0,
                lastModified: obj.LastModified || new Date(),
                isFolder: true,
              });
            }
          } else {
            // Regular file - only add if it's a direct child (no nested slashes)
            const name = relativePath;
            if (name && !name.includes('/')) {
              files.push({
                key: displayKey,
                name,
                size: obj.Size || 0,
                lastModified: obj.LastModified || new Date(),
                isFolder: false,
              });
            }
          }
        }
      }
    }

    // Sort: folders first, then files, alphabetically
    files.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });

    return files;
  }

  // Delete a file or folder (with recursive delete for folders)
  async deleteFile(key: string): Promise<{ deleted: number }> {
    const fullKey = withPrefix(key);
    
    // Check if this is a folder (ends with /)
    if (key.endsWith('/')) {
      // It's a folder - need to delete all contents first
      console.log(`[Storage] Deleting folder recursively: ${key}`);
      const count = await this.deleteFolderRecursive(key);
      console.log(`[Storage] Deleted ${count} objects from folder: ${key}`);
      return { deleted: count };
    } else {
      // It's a file - just delete it
      console.log(`[Storage] Deleting file: ${key}`);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: fullKey,
        })
      );
      return { deleted: 1 };
    }
  }

  // Recursively delete a folder and all its contents
  async deleteFolderRecursive(folderKey: string): Promise<number> {
    // Ensure folder key ends with /
    const normalizedKey = folderKey.endsWith('/') ? folderKey : `${folderKey}/`;
    const fullPrefix = withPrefix(normalizedKey);
    let deletedCount = 0;
    let continuationToken: string | undefined;

    console.log(`[Storage] Listing objects with prefix: ${fullPrefix}`);

    // List and delete all objects with this prefix
    do {
      const response = await s3Client.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: fullPrefix,
          ContinuationToken: continuationToken,
        })
      );

      console.log(`[Storage] Found ${response.Contents?.length || 0} objects to delete`);

      if (response.Contents && response.Contents.length > 0) {
        // Delete each object
        for (const obj of response.Contents) {
          if (obj.Key) {
            console.log(`[Storage] Deleting: ${obj.Key}`);
            await s3Client.send(
              new DeleteObjectCommand({
                Bucket: BUCKET,
                Key: obj.Key,
              })
            );
            deletedCount++;
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    // Also delete the folder marker itself if it exists
    try {
      const folderMarkerKey = withPrefix(normalizedKey);
      console.log(`[Storage] Deleting folder marker: ${folderMarkerKey}`);
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: folderMarkerKey,
        })
      );
    } catch (e) {
      // Folder marker might not exist, that's ok
    }

    return deletedCount;
  }

  // Delete multiple files
  async deleteFiles(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.deleteFile(key);
    }
  }

  // Move/rename a file
  async moveFile(sourceKey: string, destinationKey: string): Promise<void> {
    const fullSourceKey = withPrefix(sourceKey);
    const fullDestKey = withPrefix(destinationKey);
    
    // Copy to new location
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${fullSourceKey}`,
        Key: fullDestKey,
      })
    );

    // Delete original (use the full key directly since deleteFile will add prefix again)
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: fullSourceKey,
      })
    );
  }

  // Create a folder (by creating an empty object with trailing /)
  async createFolder(path: string): Promise<void> {
    const folderKey = path.endsWith('/') ? path : `${path}/`;
    const fullKey = withPrefix(folderKey);

    // Use PutObjectCommand with empty Buffer for folder markers
    // This is the correct way to create folder markers in S3
    const emptyBuffer = Buffer.alloc(0);
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: fullKey,
        Body: emptyBuffer,
        ContentLength: 0,
        ContentType: 'application/x-directory',
      })
    );
  }

  // Rename a file
  async renameFile(key: string, newName: string): Promise<string> {
    const parts = key.split('/');
    parts[parts.length - 1] = newName;
    const newKey = parts.join('/');

    await this.moveFile(key, newKey);

    return newKey;
  }
}

export const storageService = new StorageService();
