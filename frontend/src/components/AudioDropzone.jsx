import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'

export default function AudioDropzone({ onFileSelected, onFileError, isLoading }) {
  const onDrop = useCallback(
    (acceptedFiles, fileRejections) => {
      if (acceptedFiles.length > 0) {
        onFileSelected(acceptedFiles[0])
      } else if (fileRejections.length > 0 && onFileError) {
        const err = fileRejections[0].errors[0]
        onFileError(`File rejected: ${err.message}`)
      }
    },
    [onFileSelected, onFileError]
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.flac'],
      'video/mp4': ['.mp4', '.m4a'],
    },
    maxFiles: 1,
    maxSize: 100 * 1024 * 1024, // 100 MB limit
    disabled: isLoading,
  })

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors duration-200 ease-in-out
        ${isLoading ? 'opacity-50 cursor-not-allowed bg-black/10' : ''}
        ${isDragActive ? 'border-brand-accent bg-brand-accent/5' : 'border-brand-sage/40 hover:border-brand-sage/80'}
        ${isDragReject ? 'border-red-500 bg-red-500/5' : ''}
      `}
    >
      <input {...getInputProps()} />
      <UploadCloud
        className={`mx-auto h-16 w-16 mb-4 ${
          isDragActive ? 'text-brand-accent' : 'text-brand-sage/70'
        }`}
      />
      
      {isDragActive ? (
        <p className="text-xl font-medium text-brand-cream">Drop the audio file here ...</p>
      ) : (
        <>
          <p className="text-xl font-medium text-brand-cream mb-2">
            Drag & drop session audio here
          </p>
          <p className="text-sm text-brand-cream/50">
            or click to select a file from your computer
          </p>
        </>
      )}
      
      <div className="mt-6 flex flex-wrap gap-2 justify-center text-xs text-brand-cream/40">
        <span className="bg-black/20 px-2 py-1 rounded">MP3</span>
        <span className="bg-black/20 px-2 py-1 rounded">WAV</span>
        <span className="bg-black/20 px-2 py-1 rounded">M4A</span>
        <span className="bg-black/20 px-2 py-1 rounded">Max 100MB</span>
      </div>
    </div>
  )
}
