import * as Minio from 'minio';
import { MinIOConfig, BucketInfo, ObjectInfo, StorageStats, BatchOperationResult, PresignedUrlOptions } from './types.js';
import { Readable } from 'node:stream';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { URL } from 'node:url';
import * as http from 'node:http';
import * as https from 'node:https';

export class MinIOStorageClient {
  private client: Minio.Client | null = null;
  private config: MinIOConfig | null = null;

  /**
   * 连接到MinIO服务器
   */
  async connect(config: MinIOConfig): Promise<void> {
    try {
      this.client = new Minio.Client({
        endPoint: config.endPoint,
        port: config.port,
        useSSL: config.useSSL,
        accessKey: config.accessKey,
        secretKey: config.secretKey,
        region: config.region
      });

      // 测试连接
      await this.client.listBuckets();
      this.config = config;
    } catch (error) {
      throw new Error(`连接MinIO服务器失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 检查是否已连接
   */
  private ensureConnected(): void {
    if (!this.client || !this.config) {
      throw new Error('未连接到MinIO服务器，请先调用connect方法');
    }
  }

  /**
   * 列出所有存储桶
   */
  async listBuckets(): Promise<BucketInfo[]> {
    this.ensureConnected();
    const buckets = await this.client!.listBuckets();
    return buckets.map((bucket: any) => ({
      name: bucket.name,
      creationDate: bucket.creationDate
    }));
  }

  /**
   * 创建存储桶
   */
  async createBucket(bucketName: string, region?: string): Promise<void> {
    this.ensureConnected();
    await this.client!.makeBucket(bucketName, region || this.config!.region || 'us-east-1');
  }

  /**
   * 删除存储桶
   */
  async deleteBucket(bucketName: string): Promise<void> {
    this.ensureConnected();
    await this.client!.removeBucket(bucketName);
  }

  /**
   * 检查存储桶是否存在
   */
  async bucketExists(bucketName: string): Promise<boolean> {
    this.ensureConnected();
    return await this.client!.bucketExists(bucketName);
  }

  /**
   * 列出存储桶中的对象
   */
  async listObjects(bucketName: string, prefix?: string, recursive: boolean = false): Promise<ObjectInfo[]> {
    this.ensureConnected();
    
    return new Promise((resolve, reject) => {
      const objects: ObjectInfo[] = [];
      const stream = this.client!.listObjects(bucketName, prefix, recursive);
      
      stream.on('data', (obj: any) => {
        objects.push({
          name: obj.name,
          size: obj.size,
          lastModified: obj.lastModified,
          etag: obj.etag,
          isDir: obj.name.endsWith('/')
        });
      });
      
      stream.on('error', reject);
      stream.on('end', () => resolve(objects));
    });
  }

  /**
   * 上传文件
   */
  async uploadFile(bucketName: string, objectName: string, filePath: string, metadata?: Record<string, string>): Promise<void> {
    this.ensureConnected();

    let tempFilePath: string | null = null;

    try {
      // 检查filePath是否为URL
      let actualFilePath = filePath;
      if (this.isValidUrl(filePath)) {
        // 下载URL内容到临时文件
        tempFilePath = await this.downloadFromUrlToTempFile(filePath);
        actualFilePath = tempFilePath;
      }

      if (!fs.existsSync(actualFilePath)) {
        throw new Error(`文件不存在: ${actualFilePath}`);
      }

      const stats = fs.statSync(actualFilePath);
      const stream = fs.createReadStream(actualFilePath);

      await this.client!.putObject(bucketName, objectName, stream, stats.size, metadata);
    } finally {
      // 确保临时文件被删除
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
        } catch (error) {
          console.error(`删除临时文件失败: ${tempFilePath}`, error);
        }
      }
    }
  }

  /**
   * 上传数据流
   */
  async uploadStream(bucketName: string, objectName: string, stream: Readable, size?: number, metadata?: Record<string, string>): Promise<void> {
    this.ensureConnected();
    await this.client!.putObject(bucketName, objectName, stream, size, metadata);
  }

  /**
   * 下载文件
   */
  async downloadFile(bucketName: string, objectName: string, filePath: string): Promise<void> {
    this.ensureConnected();
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await this.client!.fGetObject(bucketName, objectName, filePath);
  }

  /**
   * 获取对象流
   */
  async getObjectStream(bucketName: string, objectName: string): Promise<Readable> {
    this.ensureConnected();
    return await this.client!.getObject(bucketName, objectName);
  }

  /**
   * 删除对象
   */
  async deleteObject(bucketName: string, objectName: string): Promise<void> {
    this.ensureConnected();
    await this.client!.removeObject(bucketName, objectName);
  }

  /**
   * 批量删除对象
   */
  async deleteObjects(bucketName: string, objectNames: string[]): Promise<BatchOperationResult> {
    this.ensureConnected();
    
    const result: BatchOperationResult = {
      success: true,
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    try {
      await this.client!.removeObjects(bucketName, objectNames);
      result.successCount = objectNames.length;
    } catch (error) {
      result.success = false;
      result.failureCount = objectNames.length;
      result.errors.push({
        item: objectNames.join(', '),
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return result;
  }

  /**
   * 复制对象
   */
  async copyObject(sourceBucket: string, sourceObject: string, destBucket: string, destObject: string): Promise<void> {
    this.ensureConnected();
    
    const copyConditions = new Minio.CopyConditions();
    await this.client!.copyObject(destBucket, destObject, `/${sourceBucket}/${sourceObject}`, copyConditions);
  }

  /**
   * 获取对象信息
   */
  async getObjectInfo(bucketName: string, objectName: string): Promise<ObjectInfo> {
    this.ensureConnected();
    
    const stat = await this.client!.statObject(bucketName, objectName);
    return {
      name: objectName,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      contentType: stat.metaData['content-type'],
      isDir: false
    };
  }

  /**
   * 生成预签名URL
   */
  async generatePresignedUrl(bucketName: string, objectName: string, method: 'GET' | 'PUT' | 'DELETE' = 'GET', options?: PresignedUrlOptions): Promise<string> {
    this.ensureConnected();
    
    const expires = options?.expires || 3600; // 默认1小时
    
    switch (method) {
      case 'GET':
        return await this.client!.presignedGetObject(bucketName, objectName, expires, options?.reqParams, options?.requestDate);
      case 'PUT':
        return await this.client!.presignedPutObject(bucketName, objectName, expires);
      case 'DELETE':
        return await this.client!.presignedUrl('DELETE', bucketName, objectName, expires, options?.reqParams, options?.requestDate);
      default:
        throw new Error(`不支持的HTTP方法: ${method}`);
    }
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<StorageStats> {
    this.ensureConnected();
    
    const buckets = await this.listBuckets();
    const bucketStats = [];
    let totalObjects = 0;
    let totalSize = 0;

    for (const bucket of buckets) {
      const objects = await this.listObjects(bucket.name, undefined, true);
      const bucketSize = objects.reduce((sum, obj) => sum + obj.size, 0);
      const objectCount = objects.length;
      
      bucketStats.push({
        bucketName: bucket.name,
        objectCount,
        totalSize: bucketSize
      });
      
      totalObjects += objectCount;
      totalSize += bucketSize;
    }

    return {
      totalBuckets: buckets.length,
      totalObjects,
      totalSize,
      bucketStats
    };
  }

  /**
   * 批量上传文件
   */
  async uploadFiles(bucketName: string, files: Array<{ localPath: string; objectName: string; metadata?: Record<string, string> }>): Promise<BatchOperationResult> {
    this.ensureConnected();
    
    const result: BatchOperationResult = {
      success: true,
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    for (const file of files) {
      try {
        await this.uploadFile(bucketName, file.objectName, file.localPath, file.metadata);
        result.successCount++;
      } catch (error) {
        result.success = false;
        result.failureCount++;
        result.errors.push({
          item: file.localPath,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  /**
   * 批量下载文件
   */
  async downloadFiles(bucketName: string, files: Array<{ objectName: string; localPath: string }>): Promise<BatchOperationResult> {
    this.ensureConnected();
    
    const result: BatchOperationResult = {
      success: true,
      successCount: 0,
      failureCount: 0,
      errors: []
    };

    for (const file of files) {
      try {
        await this.downloadFile(bucketName, file.objectName, file.localPath);
        result.successCount++;
      } catch (error) {
        result.success = false;
        result.failureCount++;
        result.errors.push({
          item: file.objectName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  /**
   * 设置存储桶策略
   */
  async setBucketPolicy(bucketName: string, policy: string): Promise<void> {
    this.ensureConnected();
    await this.client!.setBucketPolicy(bucketName, policy);
  }

  /**
   * 获取存储桶策略
   */
  async getBucketPolicy(bucketName: string): Promise<string> {
    this.ensureConnected();
    return await this.client!.getBucketPolicy(bucketName);
  }

  /**
   * 删除存储桶策略
   */
  async deleteBucketPolicy(bucketName: string): Promise<void> {
    this.ensureConnected();
    await this.client!.setBucketPolicy(bucketName, '');
  }

  /**
   * 验证字符串是否为有效的URL
   */
  private isValidUrl(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (error) {
      return false;
    }
  }

  /**
   * 从URL下载文件到临时文件
   */
  private async downloadFromUrlToTempFile(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const tempFileName = path.join(tmpdir(), `minio_mcp_temp_${randomBytes(16).toString('hex')}`);

      const fileStream = createWriteStream(tempFileName);

      const client = urlObj.protocol === 'https:' ? https : http;

      const request = client.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`下载失败: ${response.statusCode} ${response.statusMessage}`));
          return;
        }

        pipeline(response, fileStream)
          .then(() => resolve(tempFileName))
          .catch(reject);
      });

      request.on('error', (error) => {
        // 如果出现错误，先删除可能已创建的临时文件
        try {
          if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
          }
        } catch (cleanupError) {
          console.error(`清理临时文件时出错: ${cleanupError}`);
        }
        reject(error);
      });

      request.setTimeout(30000, () => {  // 30秒超时
        request.destroy();
        try {
          if (fs.existsSync(tempFileName)) {
            fs.unlinkSync(tempFileName);
          }
        } catch (cleanupError) {
          console.error(`清理超时临时文件时出错: ${cleanupError}`);
        }
        reject(new Error('下载超时'));
      });
    });
  }
}