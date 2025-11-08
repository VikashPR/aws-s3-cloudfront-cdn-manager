'use client'

import { useState, useEffect, FormEvent, useRef } from 'react'
import Image from 'next/image'
import type { MediaFolder } from '@/lib/s3'

interface MediaFile {
  key: string
  fileName: string
  folder: MediaFolder
  size: number
  lastModified?: Date
  url: string
}

interface FilePreview {
  file: File
  url: string
  type: 'image' | 'document' | 'video'
}

export function MediaManager() {
  const [files, setFiles] = useState<MediaFile[]>([])
  const [selectedFolder, setSelectedFolder] = useState<MediaFolder | 'all'>('all')
  const [uploadFolder, setUploadFolder] = useState<MediaFolder>('images')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{ fileName: string; status: 'uploading' | 'success' | 'error' }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const folders: { value: MediaFolder; label: string }[] = [
    { value: 'images', label: 'Images' },
    { value: 'documents', label: 'Documents' },
    { value: 'videos', label: 'Videos' },
    { value: 'others', label: 'Others' },
  ]

  const loadFiles = async () => {
    setLoading(true)
    setError('')
    try {
      const folderParam = selectedFolder === 'all' ? '' : `?folder=${selectedFolder}`
      const response = await fetch(`/api/media/list${folderParam}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load files')
      }

      setFiles(data.files || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }

    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [dropdownOpen])

  const handleFileUpload = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select at least one file')
      return
    }

    setUploading(true)
    setError('')
    setSuccess('')
    setUploadProgress(selectedFiles.map(f => ({ fileName: f.name, status: 'uploading' })))

    try {
      const formData = new FormData()
      selectedFiles.forEach(file => {
        formData.append('files', file)
      })
      formData.append('folder', uploadFolder)

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok && response.status !== 207) {
        throw new Error(data.error || 'Upload failed')
      }

      // Update progress
      const newProgress = selectedFiles.map(file => {
        const uploadResult = data.uploads?.find((u: any) => u.originalName === file.name)
        const errorResult = data.errors?.find((e: any) => e.fileName === file.name)
        return {
          fileName: file.name,
          status: uploadResult ? 'success' : errorResult ? 'error' : 'uploading'
        } as { fileName: string; status: 'uploading' | 'success' | 'error' }
      })
      setUploadProgress(newProgress)

      if (data.success) {
        setSuccess(`✅ Successfully uploaded ${data.successCount} file(s)!`)
      } else {
        setSuccess(`⚠️ Uploaded ${data.successCount} of ${data.totalFiles} file(s). ${data.errorCount} failed.`)
        if (data.errors) {
          setError(`Failed files: ${data.errors.map((e: any) => e.fileName).join(', ')}`)
        }
      }

      // Clear after a delay to show results
      setTimeout(() => {
        clearFileSelection()
        setUploadProgress([])
      }, 3000)

      await loadFiles() // Reload file list
    } catch (err: any) {
      setError(err.message || 'Upload failed')
      setUploadProgress([])
    } finally {
      setUploading(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = Array.from(e.dataTransfer.files)
      setSelectedFiles(prev => [...prev, ...newFiles])
      setError('')
      newFiles.forEach(file => createFilePreview(file))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setSelectedFiles(prev => [...prev, ...newFiles])
      setError('')
      newFiles.forEach(file => createFilePreview(file))
    }
  }

  const createFilePreview = (file: File) => {
    const url = URL.createObjectURL(file)
    const isImage = file.type.startsWith('image/')
    const isVideo = file.type.startsWith('video/')
    setFilePreviews(prev => [...prev, {
      file,
      url,
      type: isImage ? 'image' : isVideo ? 'video' : 'document'
    }])
  }

  const clearFileSelection = () => {
    setSelectedFiles([])
    filePreviews.forEach(preview => {
      URL.revokeObjectURL(preview.url)
    })
    setFilePreviews([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    const removedPreview = filePreviews[index]
    if (removedPreview) {
      URL.revokeObjectURL(removedPreview.url)
    }
    const newPreviews = filePreviews.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    setFilePreviews(newPreviews)
  }

  const copyToClipboard = async (url: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleDelete = async (key: string, fileName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    
    if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
      return
    }

    setDeletingKey(key)
    setError('')
    
    try {
      const response = await fetch('/api/media/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed')
      }

      setSuccess(`File "${fileName}" deleted successfully`)
      await loadFiles() // Reload file list
    } catch (err: any) {
      setError(err.message || 'Delete failed')
    } finally {
      setDeletingKey(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const isImageFile = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(fileName)
  }

  const isVideoFile = (fileName: string) => {
    return /\.(mp4|webm|ogg|mov|avi|wmv|flv|mkv)$/i.test(fileName)
  }

  const isValidUrl = (url: string) => {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const filteredFiles = selectedFolder === 'all' 
    ? files 
    : files.filter(f => f.folder === selectedFolder)

  const imageFiles = filteredFiles.filter(f => isImageFile(f.fileName) && isValidUrl(f.url))
  const videoFiles = filteredFiles.filter(f => isVideoFile(f.fileName) && isValidUrl(f.url))
  const otherFiles = filteredFiles.filter(f => !isImageFile(f.fileName) && !isVideoFile(f.fileName))

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <span className="font-bold tracking-tight text-gray-900 text-lg">
                  Media CDN Manager
                </span>
                <span className="font-medium text-gray-500 tracking-wide text-xs">
                  S3 & CloudFront Media Management
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="py-6 px-4">
        <div className="max-w-7xl mx-auto">

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-5">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h2 className="text-lg font-semibold text-gray-900">Upload New File</h2>
          </div>
          
          <form onSubmit={handleFileUpload} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Folder Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Destination Folder
                </label>
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-blue-600 transition-colors focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 outline-none text-sm"
                  >
                    <span className="flex items-center gap-2 text-gray-900">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      {folders.find(f => f.value === uploadFolder)?.label || 'Select Folder'}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {folders.map((folder) => (
                        <button
                          key={folder.value}
                          type="button"
                          onClick={() => {
                            setUploadFolder(folder.value)
                            setDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                            uploadFolder === folder.value 
                              ? 'bg-blue-600 text-white' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {folder.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload with Multiple Files Support */}
              <div className="lg:col-span-1">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Select Files (Multiple)
                </label>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg transition-all ${
                    dragActive
                      ? 'border-blue-600 bg-blue-50 scale-[1.01]'
                      : selectedFiles.length > 0
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="px-4 py-3">
                    {selectedFiles.length > 0 ? (
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(selectedFiles.reduce((acc, f) => acc + f.size, 0))} total
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearFileSelection()
                          }}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors z-20"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 text-center justify-center">
                        <svg
                          className="w-5 h-5 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                          />
                        </svg>
                        <div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">Click to upload</span> or drag and drop
                          </p>
                          <p className="text-xs text-gray-500">Multiple files supported</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Files List with Remove Option */}
            {selectedFiles.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-600">
                    Selected Files ({selectedFiles.length})
                  </span>
                  <button
                    type="button"
                    onClick={clearFileSelection}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {selectedFiles.map((file, index) => {
                    const preview = filePreviews[index]
                    const progress = uploadProgress.find(p => p.fileName === file.name)
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-200"
                      >
                        {preview?.type === 'image' ? (
                          <div className="flex-shrink-0 w-12 h-12 relative rounded overflow-hidden">
                            <Image
                              src={preview.url}
                              alt={file.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex-shrink-0">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                        </div>
                        {progress && (
                          <div className="flex-shrink-0">
                            {progress.status === 'uploading' && (
                              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            )}
                            {progress.status === 'success' && (
                              <svg className="h-5 w-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            )}
                            {progress.status === 'error' && (
                              <svg className="h-5 w-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        )}
                        {!uploading && (
                          <button
                            type="button"
                            onClick={() => removeFile(index)}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-3 py-2 rounded text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border-l-4 border-green-500 text-green-700 px-3 py-2 rounded text-sm flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {success}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading || selectedFiles.length === 0}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {uploading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
                  </span>
                ) : (
                  `Upload ${selectedFiles.length > 0 ? selectedFiles.length : ''} File${selectedFiles.length !== 1 ? 's' : ''}`
                )}
              </button>
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={clearFileSelection}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-colors text-sm"
                >
                  Clear
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Filter:</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedFolder('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                  selectedFolder === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All Files
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.value}
                  onClick={() => setSelectedFolder(folder.value)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all text-xs ${
                    selectedFolder === folder.value
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {folder.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Files Display */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-2 text-gray-600">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm">Loading files...</span>
            </div>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-gray-500 text-sm font-medium">No files found</p>
            <p className="text-gray-400 text-xs mt-1">Upload a file to get started</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Image Gallery */}
            {imageFiles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Images ({imageFiles.length})</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {imageFiles.map((file) => (
                    <div
                      key={file.key}
                      className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-600/50 transition-all"
                    >
                      <div className="aspect-square relative bg-gray-50">
                        {isValidUrl(file.url) ? (
                          <Image
                            src={file.url}
                            alt={file.fileName}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            Invalid URL
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                            <button
                              onClick={(e) => copyToClipboard(file.url, e)}
                              className="flex-1 bg-white/95 hover:bg-white text-gray-900 px-2 py-1 rounded text-xs font-medium transition-colors"
                              title="Copy URL"
                            >
                              {copiedUrl === file.url ? '✓' : 'Copy'}
                            </button>
                            <button
                              onClick={(e) => handleDelete(file.key, file.fileName, e)}
                              disabled={deletingKey === file.key}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingKey === file.key ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-1.5 bg-white">
                        <p className="text-xs text-gray-600 truncate" title={file.fileName}>
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Video Gallery */}
            {videoFiles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Videos ({videoFiles.length})</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {videoFiles.map((file) => (
                    <div
                      key={file.key}
                      className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md hover:border-blue-600/50 transition-all"
                    >
                      <div className="aspect-square relative bg-gray-50">
                        {isValidUrl(file.url) ? (
                          <video
                            src={file.url}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                            Invalid URL
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="absolute bottom-2 left-2 right-2 flex gap-1">
                            <button
                              onClick={(e) => copyToClipboard(file.url, e)}
                              className="flex-1 bg-white/95 hover:bg-white text-gray-900 px-2 py-1 rounded text-xs font-medium transition-colors"
                              title="Copy URL"
                            >
                              {copiedUrl === file.url ? '✓' : 'Copy'}
                            </button>
                            <button
                              onClick={(e) => handleDelete(file.key, file.fileName, e)}
                              disabled={deletingKey === file.key}
                              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingKey === file.key ? '...' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-1.5 bg-white">
                        <p className="text-xs text-gray-600 truncate" title={file.fileName}>
                          {file.fileName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Files */}
            {otherFiles.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-sm font-semibold text-gray-900">Documents & Others ({otherFiles.length})</h3>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                            File Name
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                            Folder
                          </th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600">
                            Size
                          </th>
                          <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-600">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {otherFiles.map((file) => (
                          <tr key={file.key} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 font-medium">{file.fileName}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs capitalize">{file.folder}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {formatFileSize(file.size)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => copyToClipboard(file.url)}
                                  className="px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors text-xs font-medium"
                                >
                                  {copiedUrl === file.url ? '✓ Copied' : 'Copy URL'}
                                </button>
                                <button
                                  onClick={(e) => handleDelete(file.key, file.fileName, e)}
                                  disabled={deletingKey === file.key}
                                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 text-xs font-medium"
                                >
                                  {deletingKey === file.key ? 'Deleting...' : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  )
}

