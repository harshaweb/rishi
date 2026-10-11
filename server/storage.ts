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
import { prisma } from "./db.js"

const root = path.resolve(".data/uploads")
const s3 = process.env.S3_BUCKET
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    })
  : null
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
  if (process.env.NODE_ENV === "production" && !s3)
    throw Object.assign(new Error("Object storage is not configured."), {
      status: 503,
    })
  const key = `${randomUUID()}.${type.ext}`
  if (s3)
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: type.mime,
      })
    )
  else {
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
  if (s3) {
    const result = await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
    )
    return Buffer.from(await result.Body!.transformToByteArray())
  }
  return readFile(path.join(root, key))
}
export async function removeStored(key: string) {
  if (s3)
    await s3.send(
      new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })
    )
  else
    await unlink(path.join(root, key)).catch((error) => {
      if (error.code !== "ENOENT") throw error
    })
}
