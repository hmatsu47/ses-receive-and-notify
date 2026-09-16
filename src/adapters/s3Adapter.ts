import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'node:stream';

// NFR5: S3 依存はこの薄いアダプタ越しに扱い、DI/モックでユニットテスト可能にする。
// NFR3.5: AWS SDK は既定で HTTPS/TLS を用いる。

/** ドメイン層/ハンドラが依存する S3 操作の抽象 (DI 境界)。 */
export interface S3Port {
  getObject(bucket: string, key: string): Promise<Buffer>;
  putObject(bucket: string, key: string, body: Buffer | string, contentType: string): Promise<void>;
  /** オブジェクトの存在確認 (冪等性チェック用)。存在すれば true。 */
  objectExists(bucket: string, key: string): Promise<boolean>;
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/** AWS SDK v3 を用いた S3Port 実装。 */
export function createS3Adapter(region?: string): S3Port {
  const client = new S3Client(region ? { region } : {});

  return {
    async getObject(bucket, key) {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) {
        throw new Error(`s3Adapter.getObject: empty body for s3://${bucket}/${key}`);
      }
      return streamToBuffer(res.Body as Readable);
    },

    async putObject(bucket, key, body, contentType) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    },

    async objectExists(bucket, key) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (cause) {
        // NotFound (404) は「存在しない」を意味する正常分岐。それ以外は再スロー (fail loud)。
        const name = (cause as { name?: string }).name;
        const status = (cause as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;
        if (name === 'NotFound' || name === 'NoSuchKey' || status === 404) {
          return false;
        }
        throw cause;
      }
    },
  };
}
