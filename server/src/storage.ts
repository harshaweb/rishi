import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { randomUUID } from "node:crypto"
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises"
import path from "node:path"
import { fileTypeFromBuffer } from "file-type"
import { GridFSBucket } from "mongodb"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { mongo, prisma } from "./db.js"

const root = path.resolve(".data/uploads")
const s3 = process.env.S3_BUCKET
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    })
  : null
const uploads = mongo
  ? new GridFSBucket(mongo, { bucketName: "Uploads" })
  : null
const mongoPrefix = "mongo:"
export async function saveFile(
  file: Express.Multer.File,
  isPublic: boolean,
  alt = ""
) {
  const type = await fileTypeFromBuffer(file.buffer)
  const allowed = isPublic
    ? ["image/png", "image/jpeg", "image/webp"]
    : ["application/pdf"]
  if (!type || !allowed.includes(type.mime) || type.mime !== file.mimetype)
    throw Object.assign(
      new Error(
        isPublic
          ? "Upload a PNG, JPEG or WebP image."
          : "Upload a valid PDF résumé."
      ),
      { status: 400 }
    )
  if (
    type.mime === "application/pdf" &&
    /\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction)\b/.test(
      file.buffer.toString("latin1")
    )
  )
    throw Object.assign(
      new Error("Active content is not allowed in résumés."),
      { status: 400 }
    )
  if (process.env.NODE_ENV === "production" && !s3 && !uploads)
    throw Object.assign(new Error("Object storage is not configured."), {
      status: 503,
    })
  const key = `${!s3 && uploads ? mongoPrefix : ""}${randomUUID()}.${type.ext}`
  if (s3)
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: type.mime,
      })
    )
  else if (uploads) {
    const stream = uploads.openUploadStream(key, {
      metadata: { contentType: type.mime },
    })
    try {
      await pipeline(Readable.from([file.buffer]), stream)
    } catch (error) {
      await stream.abort().catch(() => {})
      throw error
    }
  } else {
    await mkdir(root, { recursive: true })
    await writeFile(path.join(root, key), file.buffer)
  }
  try {
    return await prisma.mediaAsset.create({
      data: {
        filename: path.basename(file.originalname).slice(0, 200),
        key,
        mime: type.mime,
        size: file.size,
        public: isPublic,
        alt,
      },
    })
  } catch (error) {
    await removeStored(key)
    throw error
  }
}
export async function readStored(key: string) {
  // The key records the storage provider so enabling S3 later does not hide
  // files already saved in MongoDB.
  if (key.startsWith(mongoPrefix)) {
    if (!uploads) throw new Error("MongoDB upload storage is unavailable.")
    const chunks: Buffer[] = []
    for await (const chunk of uploads.openDownloadStreamByName(key))
      chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks)
  }
  if (s3) {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
    )
    return Buffer.from(await result.Body!.transformToByteArray())
  }
  return readFile(path.join(root, key))
}
export async function removeStored(key: string) {
  if (key.startsWith(mongoPrefix)) {
    if (!uploads) throw new Error("MongoDB upload storage is unavailable.")
    const file = await uploads.find({ filename: key }).next()
    if (file) await uploads.delete(file._id)
    return
  }
  if (s3)
    await s3.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
    )
  else
    await unlink(path.join(root, key)).catch((error) => {
      if (error.code !== "ENOENT") throw error
    })
}
