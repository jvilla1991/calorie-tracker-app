import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type { IScannerControls } from '@zxing/browser'

interface Props {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScannerView({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current!,
        (result, err) => {
          if (result) {
            onScan(result.getText())
          }
          if (err && err.name !== 'NotFoundException') {
            setError('Camera error: ' + err.message)
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls
      })
      .catch((e: Error) => setError('Could not access camera: ' + e.message))

    return () => {
      controlsRef.current?.stop()
    }
  }, [onScan])

  return (
    <div className="flex flex-col items-center gap-3">
      {error ? (
        <div className="text-red-500 text-sm p-4 text-center">{error}</div>
      ) : (
        <>
          <p className="text-sm text-gray-500">Point camera at a barcode</p>
          <div className="relative w-full max-w-sm aspect-video bg-black rounded-xl overflow-hidden">
            <video ref={videoRef} className="w-full h-full object-cover" />
            {/* Scan guide overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-24 border-2 border-green-400 rounded" />
            </div>
          </div>
        </>
      )}
      <button onClick={onClose} className="text-sm text-gray-500 underline">
        Cancel
      </button>
    </div>
  )
}
