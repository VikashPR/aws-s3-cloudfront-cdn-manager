import { NextRequest, NextResponse } from 'next/server'
import { deleteFromS3 } from '@/lib/s3'

export async function DELETE(request: NextRequest) {
  try {
    const { key } = await request.json()

    if (!key) {
      return NextResponse.json(
        { error: 'File key is required' },
        { status: 400 }
      )
    }

    // Delete from S3
    await deleteFromS3(key)

    return NextResponse.json({
      success: true,
      message: 'File deleted successfully',
    })
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    )
  }
}

