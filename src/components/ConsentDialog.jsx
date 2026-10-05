import { useEffect, useRef } from 'react'
import { href } from '../hooks/useHashRoute.js'

export default function ConsentDialog({ open, onAccept, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="consent" aria-labelledby="consent-title" onClose={onClose}>
      <h2 id="consent-title">تصویر بھیجنے سے پہلے ایک بات</h2>
      <p>
        بل پڑھنے کے لیے آپ کی تصویر ایک AI سروس کو بھیجی جائے گی۔ بل پر آپ کا نام، پتا اور ریفرنس نمبر ہوتا ہے۔ ہم تصویر محفوظ نہیں
        کرتے، لیکن مفت AI سروس اسے اپنے نظام کو بہتر بنانے کے لیے استعمال کر سکتی ہے۔
      </p>
      <p>اگر آپ چاہیں تو تصویر کھینچنے سے پہلے نام اور پتے پر انگلی یا کاغذ رکھ دیں، رقم اور یونٹ نظر آتے رہیں۔</p>
      <p>
        <a href={href('privacy')} onClick={onClose}>
          پوری پرائیویسی پالیسی پڑھیں
        </a>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-primary" onClick={onAccept}>
          ٹھیک ہے، آگے چلیں
        </button>
        <button type="button" className="btn btn-quiet" onClick={onClose}>
          ابھی نہیں
        </button>
      </div>
    </dialog>
  )
}
