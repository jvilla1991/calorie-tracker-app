import { apiUrl } from '../api/axios'
import { photoAlt } from '../utils/photos'
import type { MealPhoto } from '../types'
import type { PhotoUpload } from '../hooks/usePhotoUploads'

interface Props {
  photos: MealPhoto[]
  /** Photos of this meal still uploading: placeholder tiles after the real ones. */
  uploads: PhotoUpload[]
  mealLabel: string
  date: string
  onOpen: (index: number) => void
}

/**
 * A meal's photos as a row of 64px thumbnails (scrolls sideways past ~4). Tapping one
 * opens the viewer. Swipes here scroll the row instead of changing the day.
 */
export default function MealPhotos({ photos, uploads, mealLabel, date, onOpen }: Props) {
  const n = photos.length
  return (
    <div className="ct-photos" data-no-swipe>
      {photos.map((p, i) => (
        <button key={p.id} type="button" className="ct-photo" onClick={() => onOpen(i)}>
          <img
            className="ct-photo-img"
            src={apiUrl(p.thumbUrl)}
            alt={photoAlt(i, n, mealLabel, date)}
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
            // A missing thumbnail shows an empty tile instead of clipped alt text.
            onError={(e) => e.currentTarget.classList.add('broken')}
          />
        </button>
      ))}
      {uploads.map((u) => (
        <div
          key={u.key}
          className="ct-photo ct-photo-pending"
          role="img"
          aria-label={
            u.stage === 'uploading' ? `Uploading photo, ${Math.round(u.progress * 100)}%`
              : u.stage === 'preparing' ? 'Preparing photo' : 'Photo waiting to upload'
          }
        >
          {u.preview && <img className="ct-photo-img" src={u.preview} alt="" />}
          <span className="ct-photo-spin" aria-hidden />
          {u.stage === 'uploading' && (
            <span className="ct-photo-bar" aria-hidden>
              <span style={{ width: `${Math.round(u.progress * 100)}%` }} />
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
