import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } from '@aws-sdk/client-s3'

// Validate environment variables
if (!process.env.AWS_ACCESS_KEY_ID) {
  throw new Error('AWS_ACCESS_KEY_ID environment variable is not set')
}
if (!process.env.AWS_SECRET_ACCESS_KEY) {
  throw new Error('AWS_SECRET_ACCESS_KEY environment variable is not set')
}
if (!process.env.AWS_S3_BUCKET_NAME) {
  throw new Error('AWS_S3_BUCKET_NAME environment variable is not set')
}
if (!process.env.AWS_CLOUDFRONT_DOMAIN) {
  throw new Error('AWS_CLOUDFRONT_DOMAIN environment variable is not set')
}

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME
const CLOUDFRONT_DOMAIN = process.env.AWS_CLOUDFRONT_DOMAIN

export type MediaFolder = 'images' | 'documents' | 'videos' | 'others'

/**
 * Normalize CloudFront URL - ensure it has proper protocol
 */
function normalizeCloudFrontUrl(path: string): string {
  if (!CLOUDFRONT_DOMAIN) {
    throw new Error('AWS_CLOUDFRONT_DOMAIN environment variable is not set')
  }
  
  // Remove trailing slash from domain if present
  const domain = CLOUDFRONT_DOMAIN.replace(/\/$/, '')
  
  // Ensure domain starts with https://
  const normalizedDomain = domain.startsWith('http') 
    ? domain 
    : `https://${domain}`
  
  // Ensure path doesn't start with /
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path
  
  return `${normalizedDomain}/${normalizedPath}`
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  file: Buffer,
  fileName: string,
  folder: MediaFolder,
  contentType: string
): Promise<string> {
  try {
    const key = `${folder}/${fileName}`
    
    console.log('S3 Upload Config:', {
      bucket: BUCKET_NAME,
      key,
      contentType,
      fileSize: file.length,
      region: process.env.AWS_REGION || 'us-east-1'
    })
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: file,
      ContentType: contentType,
      CacheControl: 'max-age=31536000', // 1 year cache
    })

    const response = await s3Client.send(command)
    console.log('S3 Upload Response:', { ETag: response.ETag, key })

    // Return CloudFront URL
    const url = normalizeCloudFrontUrl(key)
    console.log('Generated CloudFront URL:', url)
    return url
  } catch (error) {
    console.error('S3 Upload Error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      fileName,
      folder
    })
    throw new Error(`Failed to upload to S3: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

/**
 * List all objects in a folder
 */
export async function listS3Objects(folder?: MediaFolder) {
  const prefix = folder ? `${folder}/` : ''
  
  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: prefix,
  })

  const response = await s3Client.send(command)
  
  const files = (response.Contents || []).map((object) => {
    const key = object.Key || ''
    const fileName = key.split('/').pop() || key
    const fileFolder = key.split('/')[0] as MediaFolder
    
    return {
      key,
      fileName,
      folder: fileFolder,
      size: object.Size || 0,
      lastModified: object.LastModified,
      url: normalizeCloudFrontUrl(key),
    }
  })

  return files
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

/**
 * Get CloudFront URL for a file
 */
export function getCloudFrontUrl(key: string): string {
  return normalizeCloudFrontUrl(key)
}
