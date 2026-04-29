import { Hono } from 'hono';
import { storageService } from '../services/storage-service';

export const storageRoutes = new Hono();

// Health check
storageRoutes.get('/health', async (c) => {
  try {
    const health = await storageService.healthCheck();
    return c.json({
      status: health.connected ? 'connected' : 'disconnected',
      bucket: health.bucket,
      prefix: health.prefix || null,
      region: process.env.AWS_REGION || 'ap-southeast-1',
      error: health.connected ? null : 'Unable to connect to S3',
    });
  } catch (error: any) {
    return c.json({
      status: 'disconnected',
      bucket: null,
      prefix: null,
      region: null,
      error: error.message || 'Health check failed',
    });
  }
});

// Upload single file
storageRoutes.post('/upload', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const subfolder = formData.get('subfolder') as string || '';

    if (!file) {
      return c.json(
        {
          status: 'error',
          message: 'No file provided',
        },
        400
      );
    }

    const key = subfolder ? `${subfolder}/${file.name}` : file.name;
    const result = await storageService.uploadFile(file, key);

    return c.json({
      status: 'success',
      message: 'File uploaded successfully',
      key: result.key,
      bucket: process.env.S3_BUCKET || 'data-products-bucket',
      size_bytes: result.size,
      content_type: file.type,
      s3_uri: `s3://${process.env.S3_BUCKET || 'data-products-bucket'}/${result.key}`,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Upload failed',
      },
      500
    );
  }
});

// Upload multiple files
storageRoutes.post('/upload-multiple', async (c) => {
  try {
    const formData = await c.req.formData();
    const files = formData.getAll('files') as File[];
    const subfolder = formData.get('subfolder') as string || '';

    if (!files || files.length === 0) {
      return c.json(
        {
          status: 'error',
          message: 'No files provided',
        },
        400
      );
    }

    const uploads = files.map((file) => ({
      file,
      key: subfolder ? `${subfolder}/${file.name}` : file.name,
    }));

    const results = await storageService.uploadFiles(uploads);
    const bucket = process.env.S3_BUCKET || 'data-products-bucket';

    return c.json({
      status: 'success',
      uploaded: results.length,
      failed: 0,
      results: results.map((r, i) => ({
        filename: files[i].name,
        status: 'success',
        message: 'File uploaded successfully',
        key: r.key,
        bucket,
        size_bytes: r.size,
        s3_uri: `s3://${bucket}/${r.key}`,
      })),
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Upload failed',
      },
      500
    );
  }
});

// List files - matches frontend /storage/files
storageRoutes.get('/files', async (c) => {
  try {
    const subfolder = c.req.query('subfolder') || '';
    const maxKeys = parseInt(c.req.query('max_keys') || '1000');
    const files = await storageService.listFiles(subfolder);
    const bucket = process.env.S3_BUCKET || 'data-products-bucket';

    return c.json({
      status: 'success',
      files: files.map(f => ({
        key: f.key,
        name: f.name,
        size_bytes: f.size,
        last_modified: f.lastModified.toISOString(),
        s3_uri: `s3://${bucket}/${f.key}`,
      })),
      count: files.length,
      prefix: subfolder,
      bucket,
      is_truncated: false,
      has_more: false,
    });
  } catch (error: any) {
    console.error('List error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Failed to list files',
        files: [],
        count: 0,
        prefix: '',
        bucket: process.env.S3_BUCKET || 'data-products-bucket',
      },
      500
    );
  }
});

// Legacy list endpoint for compatibility
storageRoutes.get('/list', async (c) => {
  try {
    const prefix = c.req.query('prefix') || '';
    const files = await storageService.listFiles(prefix);

    return c.json({
      success: true,
      data: files,
    });
  } catch (error: any) {
    console.error('List error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to list files',
      },
      500
    );
  }
});

// Download file
storageRoutes.get('/download/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');
    const { data, contentType } = await storageService.downloadFile(key);

    return new Response(data, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`,
      },
    });
  } catch (error: any) {
    console.error('Download error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Download failed',
      },
      500
    );
  }
});

// Get presigned download URL - matches frontend /storage/download-url/:key
storageRoutes.get('/download-url/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');
    const expiration = parseInt(c.req.query('expiration') || '3600');

    const url = await storageService.getPresignedUrl(key, expiration);

    return c.json({
      status: 'success',
      url,
      expiration_seconds: expiration,
      key,
    });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Failed to generate download URL',
      },
      500
    );
  }
});

// Legacy presigned URL endpoint (POST)
storageRoutes.post('/presigned-url', async (c) => {
  try {
    const body = await c.req.json();
    const { key, expires_in } = body;

    if (!key) {
      return c.json(
        {
          success: false,
          error: 'Key is required',
        },
        400
      );
    }

    const url = await storageService.getPresignedUrl(key, expires_in || 3600);

    return c.json({
      success: true,
      data: { url },
    });
  } catch (error: any) {
    console.error('Presigned URL error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to generate presigned URL',
      },
      500
    );
  }
});

// Delete file - matches frontend DELETE /storage/files
storageRoutes.delete('/files', async (c) => {
  try {
    const body = await c.req.json();
    const { key } = body;

    if (!key) {
      return c.json(
        {
          status: 'error',
          message: 'Key is required',
        },
        400
      );
    }

    await storageService.deleteFile(key);

    return c.json({
      status: 'success',
      message: 'File deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Delete failed',
      },
      500
    );
  }
});

// Legacy delete endpoint
storageRoutes.delete('/:key{.+}', async (c) => {
  try {
    const key = c.req.param('key');
    await storageService.deleteFile(key);

    return c.json({
      success: true,
      message: 'File deleted',
    });
  } catch (error: any) {
    console.error('Delete error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Delete failed',
      },
      500
    );
  }
});

// Create folder - matches frontend POST /storage/folders
storageRoutes.post('/folders', async (c) => {
  try {
    const body = await c.req.json();
    const { folder_name } = body;

    if (!folder_name) {
      return c.json(
        {
          status: 'error',
          message: 'folder_name is required',
        },
        400
      );
    }

    await storageService.createFolder(folder_name);
    const bucket = process.env.S3_BUCKET || 'data-products-bucket';
    const key = folder_name.endsWith('/') ? folder_name : `${folder_name}/`;

    return c.json({
      status: 'success',
      message: 'Folder created successfully',
      key,
      s3_uri: `s3://${bucket}/${key}`,
    });
  } catch (error: any) {
    console.error('Create folder error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Failed to create folder',
      },
      500
    );
  }
});

// Legacy create folder endpoint
storageRoutes.post('/create-folder', async (c) => {
  try {
    const body = await c.req.json();
    const { path } = body;

    if (!path) {
      return c.json(
        {
          success: false,
          error: 'path is required',
        },
        400
      );
    }

    await storageService.createFolder(path);

    return c.json({
      success: true,
      message: 'Folder created',
    });
  } catch (error: any) {
    console.error('Create folder error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Failed to create folder',
      },
      500
    );
  }
});

// Move files - matches frontend POST /storage/move
storageRoutes.post('/move', async (c) => {
  try {
    const body = await c.req.json();
    const { source_keys, destination_folder } = body;

    if (!source_keys || !Array.isArray(source_keys) || source_keys.length === 0) {
      return c.json(
        {
          status: 'error',
          message: 'source_keys array is required',
        },
        400
      );
    }

    if (!destination_folder) {
      return c.json(
        {
          status: 'error',
          message: 'destination_folder is required',
        },
        400
      );
    }

    const results: { key: string; status: string; message: string }[] = [];
    let moved = 0;
    let failed = 0;

    for (const sourceKey of source_keys) {
      try {
        const fileName = sourceKey.split('/').pop() || sourceKey;
        const destKey = destination_folder ? `${destination_folder}/${fileName}` : fileName;
        await storageService.moveFile(sourceKey, destKey);
        results.push({ key: sourceKey, status: 'success', message: 'File moved' });
        moved++;
      } catch (err: any) {
        results.push({ key: sourceKey, status: 'error', message: err.message });
        failed++;
      }
    }

    return c.json({
      status: failed === 0 ? 'success' : moved === 0 ? 'error' : 'partial',
      moved,
      failed,
      results,
    });
  } catch (error: any) {
    console.error('Move error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Move failed',
      },
      500
    );
  }
});

// Rename file - matches frontend PUT /storage/files/rename
storageRoutes.put('/files/rename', async (c) => {
  try {
    const body = await c.req.json();
    const { key, new_name } = body;

    if (!key || !new_name) {
      return c.json(
        {
          status: 'error',
          message: 'key and new_name are required',
        },
        400
      );
    }

    const newKey = await storageService.renameFile(key, new_name);
    const bucket = process.env.S3_BUCKET || 'data-products-bucket';

    return c.json({
      status: 'success',
      message: 'File renamed successfully',
      new_key: newKey,
      new_name,
      s3_uri: `s3://${bucket}/${newKey}`,
    });
  } catch (error: any) {
    console.error('Rename error:', error);
    return c.json(
      {
        status: 'error',
        message: error.message || 'Rename failed',
      },
      500
    );
  }
});

// Legacy rename endpoint
storageRoutes.post('/rename', async (c) => {
  try {
    const body = await c.req.json();
    const { key, new_name } = body;

    if (!key || !new_name) {
      return c.json(
        {
          success: false,
          error: 'key and new_name are required',
        },
        400
      );
    }

    const newKey = await storageService.renameFile(key, new_name);

    return c.json({
      success: true,
      data: { new_key: newKey },
    });
  } catch (error: any) {
    console.error('Rename error:', error);
    return c.json(
      {
        success: false,
        error: error.message || 'Rename failed',
      },
      500
    );
  }
});
