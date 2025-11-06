import { NextRequest, NextResponse } from 'next/server'
import { uploadToS3 } from '@/lib/s3'
import type { MediaFolder } from '@/lib/s3'

// Configure the route to accept larger files
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
}

// Set runtime configuration for edge/nodejs
export const runtime = 'nodejs'
export const maxDuration = 60 // Maximum execution time in seconds

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const folder = formData.get('folder') as MediaFolder

    console.log('Upload request received:', {
      hasFile: !!file,
      folder,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    })

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!folder || !['images', 'documents', 'videos', 'others'].includes(folder)) {
      return NextResponse.json(
        { error: 'Invalid folder' },
        { status: 400 }
      )
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024 // 50MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename (timestamp + original name)
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}-${sanitizedName}`

    // Upload to S3
    console.log('Uploading to S3:', { fileName, folder, bufferSize: buffer.length })
    const url = await uploadToS3(
      buffer,
      fileName,
      folder,
      file.type
    )

    console.log('Upload successful:', { url, fileName })
    return NextResponse.json({
      success: true,
      url,
      fileName,
      folder,
    })
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload file'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
