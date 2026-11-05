import "server-only"
import { randomUUID } from "node:crypto"
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGES = 5
const KEY_PATTERN = /^projects\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(png|jpg)$/
type StorageClient = Pick<S3Client, "send">

export class ProjectStorageValidationError extends Error {}
export class ProjectStorageConfigurationError extends Error {}

async function prepareImage(file: File) {
  if (!file.size || file.size > MAX_IMAGE_SIZE || !["image/png", "image/jpeg"].includes(file.type)) {
    throw new ProjectStorageValidationError("Demo images must be PNG or JPEG files up to 5 MB.")
  }
  try {
    const input = Buffer.from(await file.arrayBuffer())
    const image = sharp(input, { limitInputPixels: 16_000_000, failOn: "error" })
    const metadata = await image.metadata()
    if ((file.type === "image/png" && metadata.format !== "png") || (file.type === "image/jpeg" && metadata.format !== "jpeg")) throw new Error("Invalid image type")
    const png = metadata.format === "png"
    const body = await (png ? image.rotate().png() : image.rotate().jpeg()).toBuffer()
    if (body.byteLength > MAX_IMAGE_SIZE) throw new Error("Image is too large after processing")
    return { body, contentType: png ? "image/png" : "image/jpeg", extension: png ? "png" : "jpg" }
  } catch {
    throw new ProjectStorageValidationError("Demo images must be valid PNG or JPEG files up to 5 MB.")
  }
}

export function createProjectStorage(client: StorageClient, bucket: string) {
  async function deleteProjectDemos(keys: string[]) {
    if (keys.some((key) => !KEY_PATTERN.test(key))) throw new Error("Invalid project asset key")
    let failure = false
    for (const key of keys) {
      try { await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })) } catch { failure = true }
    }
    if (failure) throw new Error("Project asset cleanup failed")
  }

  async function saveProjectDemos(files: File[]) {
    if (files.length > MAX_IMAGES) throw new ProjectStorageValidationError("You can upload up to 5 demo images.")
    const saved: string[] = []
    try {
      for (const file of files) {
        const image = await prepareImage(file)
        const key = `projects/${randomUUID()}.${image.extension}`
        saved.push(key)
        await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: image.body, ContentType: image.contentType }))
      }
    } catch (error) {
      try { await deleteProjectDemos(saved) } catch { console.error("Failed to clean up project images after an upload error") }
      throw error
    }
    return saved
  }

  async function getProjectDemo(key: string) {
    if (!KEY_PATTERN.test(key)) throw new Error("Invalid project asset key")
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    if (!result.Body || (result.ContentLength !== undefined && result.ContentLength > MAX_IMAGE_SIZE)) throw new Error("Project image is unavailable")
    let size = 0
    const stream = result.Body.transformToWebStream().pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength
        if (size > MAX_IMAGE_SIZE) throw new Error("Project image is too large")
        controller.enqueue(chunk)
      },
    }))
    return { stream, contentType: key.endsWith(".png") ? "image/png" : "image/jpeg" }
  }

  return { saveProjectDemos, deleteProjectDemos, getProjectDemo }
}

function getStorage() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(R2_BUCKET_NAME)) {
    throw new ProjectStorageConfigurationError("Demo image storage is not configured. Contact the app administrator.")
  }
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  return createProjectStorage(client, R2_BUCKET_NAME)
}

export async function saveProjectDemos(files: File[]) {
  return files.length ? getStorage().saveProjectDemos(files) : []
}

export async function deleteProjectDemos(keys: string[]) {
  if (keys.length) await getStorage().deleteProjectDemos(keys)
}

export async function getProjectDemo(key: string) {
  return getStorage().getProjectDemo(key)
}
