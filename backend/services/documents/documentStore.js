import crypto from 'crypto';
import mongoose from 'mongoose';

const BUCKET_NAME = 'documents';

export class DocumentStoreError extends Error {
  constructor(message, httpStatus = 503) {
    super(message);
    this.name = 'DocumentStoreError';
    this.httpStatus = httpStatus;
  }
}

export const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

export function safeFileName(name) {
  const base = String(name || 'document.pdf').split(/[\\/]/).pop();
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 160) || 'document.pdf';
}

/**
 * Stores original PDFs in MongoDB GridFS (bucket "documents"). Uploads are
 * deduplicated by SHA-256 within the same kind and scheme, so retries never
 * create a second copy.
 */
export function createDocumentStore({ getDb = () => mongoose.connection.db } = {}) {
  const db = () => {
    const handle = getDb();
    if (!handle || mongoose.connection.readyState !== 1) {
      throw new DocumentStoreError('The database is not connected, so documents cannot be stored or read.');
    }
    return handle;
  };
  const bucket = () => new mongoose.mongo.GridFSBucket(db(), { bucketName: BUCKET_NAME });
  const files = () => db().collection(`${BUCKET_NAME}.files`);

  async function storePdf({ buffer, filename, kind, schemeId = null, uploadedBy = null }) {
    const hash = sha256(buffer);
    const existing = await files().findOne({ 'metadata.sha256': hash, 'metadata.kind': kind, 'metadata.schemeId': schemeId });
    if (existing) {
      return { fileId: existing._id.toString(), sha256: hash, size: existing.length, filename: existing.filename, deduplicated: true };
    }
    const name = safeFileName(filename);
    const upload = bucket().openUploadStream(name, {
      metadata: { kind, schemeId, sha256: hash, contentType: 'application/pdf', uploadedBy },
    });
    await new Promise((resolve, reject) => {
      upload.once('finish', resolve);
      upload.once('error', reject);
      upload.end(buffer);
    });
    return { fileId: upload.id.toString(), sha256: hash, size: buffer.length, filename: name, deduplicated: false };
  }

  async function readPdf(fileId) {
    if (!mongoose.isValidObjectId(fileId)) throw new DocumentStoreError('Invalid document id.', 400);
    const id = new mongoose.Types.ObjectId(String(fileId));
    const meta = await files().findOne({ _id: id });
    if (!meta) throw new DocumentStoreError('The stored document was not found.', 404);
    const chunks = [];
    await new Promise((resolve, reject) => {
      bucket()
        .openDownloadStream(id)
        .on('data', (chunk) => chunks.push(chunk))
        .once('end', resolve)
        .once('error', reject);
    });
    return { buffer: Buffer.concat(chunks), filename: meta.filename, metadata: meta.metadata ?? {} };
  }

  /** Attaches a plan PDF uploaded before its scheme existed. */
  async function assignScheme(fileId, schemeId) {
    if (!mongoose.isValidObjectId(fileId)) throw new DocumentStoreError('Invalid document id.', 400);
    const result = await files().updateOne(
      { _id: new mongoose.Types.ObjectId(String(fileId)), 'metadata.kind': 'scheme-plan', 'metadata.schemeId': null },
      { $set: { 'metadata.schemeId': schemeId } },
    );
    if (result.matchedCount === 0) throw new DocumentStoreError('The plan document was not found or already belongs to a scheme.', 404);
    const meta = await files().findOne({ _id: new mongoose.Types.ObjectId(String(fileId)) });
    return { fileId: String(fileId), filename: meta.filename, sha256: meta.metadata?.sha256 ?? null };
  }

  return { storePdf, readPdf, assignScheme };
}

export const documentStore = createDocumentStore();
