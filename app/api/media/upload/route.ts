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
    const files = formData.getAll('files') as File[]
    const folder = formData.get('folder') as MediaFolder

    console.log('Upload request received:', {
      fileCount: files.length,
      folder,
    })

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    if (!folder || !['images', 'documents', 'videos', 'others'].includes(folder)) {
      return NextResponse.json(
        { error: 'Invalid folder' },
        { status: 400 }
      )
    }

    // Validate file sizes (50MB limit per file)
    const maxSize = 50 * 1024 * 1024 // 50MB
    const oversizedFiles = files.filter(file => file.size > maxSize)
    if (oversizedFiles.length > 0) {
      return NextResponse.json(
        { error: `${oversizedFiles.length} file(s) exceed 50MB limit` },
        { status: 400 }
      )
    }

    // Upload all files
    const uploadResults = []
    const errors = []

    for (const file of files) {
      try {
        console.log('Processing file:', { fileName: file.name, size: file.size })

        // Convert file to buffer
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)

        // Sanitize filename
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
        const fileName = sanitizedName

        // Upload to S3
        const url = await uploadToS3(
          buffer,
          fileName,
          folder,
          file.type
        )

        uploadResults.push({
          success: true,
          url,
          fileName,
          folder,
          originalName: file.name,
        })

        console.log('Upload successful:', { fileName, url })
      } catch (error) {
        console.error('Upload error for file:', file.name, error)
        errors.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Upload failed'
        })
      }
    }

    // Return results
    const allSuccessful = errors.length === 0
    const response = {
      success: allSuccessful,
      totalFiles: files.length,
      successCount: uploadResults.length,
      errorCount: errors.length,
      uploads: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
      message: allSuccessful 
        ? `Successfully uploaded ${uploadResults.length} file(s)`
        : `Uploaded ${uploadResults.length} of ${files.length} file(s). ${errors.length} failed.`
    }

    return NextResponse.json(response, { 
      status: allSuccessful ? 200 : 207 // 207 Multi-Status for partial success
    })
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to upload files'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
