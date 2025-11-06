import { NextRequest, NextResponse } from 'next/server'
import { listS3Objects } from '@/lib/s3'
import type { MediaFolder } from '@/lib/s3'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const folder = searchParams.get('folder') as MediaFolder | null

    const files = await listS3Objects(folder || undefined)

    return NextResponse.json({ success: true, files })
  } catch (error) {
    console.error('List error:', error)
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    )
  }
}

