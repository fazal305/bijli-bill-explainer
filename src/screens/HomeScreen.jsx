import { useEffect, useRef, useState } from 'react'
import ConsentDialog from '../components/ConsentDialog.jsx'
import Icon from '../components/Icon.jsx'
import Steps from '../components/Steps.jsx'
import { href } from '../hooks/useHashRoute.js'
import { ACCEPTED_TYPES } from '../lib/photo.js'

const CONSENT_KEY = 'bbe-consent-v1'
const SLOW_AFTER_MS = 15_000

const RETAKE_TIPS = ['پورا بل فریم میں آئے، کونے کٹے نہ ہوں', 'دن کی روشنی میں کھینچیں، فلیش کی چمک نہ پڑے', 'بل سیدھا اور ہموار رکھیں، موبائل ہلنے نہ پائے']

// Each failure says what went wrong and what to do next, in that order.
const ERRORS = {
  offline: { title: 'انٹرنیٹ بند ہے', body: 'بل پڑھنے کے لیے انٹرنیٹ چاہیے۔ وائی فائی یا موبائل ڈیٹا آن کر کے دوبارہ کوشش کریں۔' },
  network: { title: 'رابطہ نہیں ہو سکا', body: 'انٹرنیٹ کمزور لگتا ہے۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔' },
  timeout: { title: 'بہت دیر لگ گئی', body: 'بل پڑھنے میں معمول سے زیادہ وقت لگا۔ دوبارہ کوشش کریں، اکثر دوسری بار جلدی ہو جاتا ہے۔' },
  not_a_bill: { title: 'یہ بجلی کا بل نہیں لگتا', body: 'تصویر میں بجلی کا بل نظر نہیں آیا۔ بل کا وہ حصہ کھینچیں جہاں رقمیں لکھی ہیں۔', tips: true },
  unreadable: { title: 'بل صاف پڑھا نہیں جا سکا', body: 'تصویر دھندلی ہے یا رقمیں نظر نہیں آ رہیں۔ ایک نئی تصویر کھینچیں:', tips: true },
  unreadable_photo: { title: 'یہ تصویر کھل نہیں سکی', body: 'کوئی دوسری تصویر چنیں، یا کیمرے سے نئی تصویر کھینچیں۔' },
  wrong_type: { title: 'یہ فائل نہیں چلے گی', body: 'صرف JPG یا PNG تصویر چلتی ہے۔ کیمرے سے نئی تصویر کھینچیں۔' },
  unsupported_type: { title: 'یہ فائل نہیں چلے گی', body: 'صرف JPG یا PNG تصویر چلتی ہے۔ کیمرے سے نئی تصویر کھینچیں۔' },
  too_big: { title: 'تصویر بہت بڑی ہے', body: 'کوئی چھوٹی تصویر چنیں، یا کیمرے سے نئی تصویر کھینچیں۔' },
  too_large: { title: 'تصویر بہت بڑی ہے', body: 'کوئی چھوٹی تصویر چنیں، یا کیمرے سے نئی تصویر کھینچیں۔' },
  rate_limited: { title: 'تھوڑا رکیں', body: 'کم وقت میں بہت سے بل بھیجے گئے ہیں۔ چند منٹ بعد دوبارہ کوشش کریں۔' },
  not_configured: {
    title: 'بل پڑھنے کی سروس ابھی بند ہے',
    body: 'معذرت، اس وقت AI سروس دستیاب نہیں۔ تب تک نمونہ بل دیکھ کر سمجھ سکتے ہیں کہ ایپ کیسے سمجھاتی ہے۔',
    sample: true,
  },
  upstream: { title: 'AI سروس مصروف ہے', body: 'مفت AI سروس پر اس وقت رش ہے۔ ایک منٹ بعد دوبارہ کوشش کریں۔' },
  server: { title: 'کچھ گڑبڑ ہو گئی', body: 'ہماری طرف سے کوئی مسئلہ ہوا۔ دوبارہ کوشش کریں۔' },
}

function readConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'yes'
  } catch {
    return false
  }
}

export default function HomeScreen({ job, online, onPhoto, onRetry, onCancel, onReset, onSample }) {
  const cameraInput = useRef(null)
  const galleryInput = useRef(null)
  const pendingInput = useRef(null)
  const [askConsent, setAskConsent] = useState(false)
  const [slowSince, setSlowSince] = useState(null)
  const slow = job.status === 'reading' && slowSince === job.startedAt

  useEffect(() => {
    if (job.status !== 'reading') return
    const timer = setTimeout(() => setSlowSince(job.startedAt), Math.max(0, SLOW_AFTER_MS - (Date.now() - job.startedAt)))
    return () => clearTimeout(timer)
  }, [job.status, job.startedAt])

  function pick(input) {
    if (readConsent()) {
      input.current?.click()
    } else {
      pendingInput.current = input
      setAskConsent(true)
    }
  }

  function accept() {
    try {
      localStorage.setItem(CONSENT_KEY, 'yes')
    } catch {
      // Private browsing: ask again next time, which is fine.
    }
    setAskConsent(false)
    pendingInput.current?.current?.click()
  }

  function onFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onPhoto(file)
  }

  const busy = job.status === 'reading' || job.status === 'preparing'
  const error = job.status === 'error' ? ERRORS[job.code] || ERRORS.server : null

  return (
    <div className="home">
      <header className="hero">
        <p className="brand">
          <Icon name="bolt" size={22} /> بجلی بل ایکسپلینر
        </p>
        <h1 tabIndex={-1}>بجلی کا بل کیوں زیادہ آیا؟</h1>
        <p className="lede">بل کی تصویر کھینچیں۔ ہم ایک ایک لائن پڑھ کر آسان اردو میں بتائیں گے کہ پیسے کہاں گئے۔</p>
      </header>

      <Steps active={busy ? 1 : 0} />

      {!online && !busy && (
        <p className="banner" role="status">
          انٹرنیٹ بند ہے۔ بل پڑھنے کے لیے انٹرنیٹ چاہیے، لیکن نمونہ بل اور الفاظ کے معنی ابھی بھی دیکھ سکتے ہیں۔
        </p>
      )}

      <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <input ref={galleryInput} className="visually-hidden" type="file" accept={ACCEPTED_TYPES.join(',')} onChange={onFile} tabIndex={-1} aria-hidden="true" />

      {busy && (
        <section className="panel reading" aria-live="polite" aria-busy="true">
          {job.photoUrl && <img className="reading-photo" src={job.photoUrl} alt="آپ کے بل کی تصویر" />}
          <div className="reading-copy">
            <h2>{job.status === 'preparing' ? 'تصویر تیار ہو رہی ہے…' : 'بل کی ایک ایک لائن پڑھی جا رہی ہے…'}</h2>
            <p>{slow ? 'آج سروس یا انٹرنیٹ سست لگ رہا ہے۔ تھوڑا اور انتظار کریں، ایک منٹ تک لگ سکتا ہے۔' : 'عام طور پر 10 سے 20 سیکنڈ لگتے ہیں۔'}</p>
            <div className="skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            {job.status === 'reading' && (
              <button type="button" className="btn btn-quiet" onClick={onCancel}>
                رک جائیں
              </button>
            )}
          </div>
        </section>
      )}

      {error && (
        <section className="panel error" role="alert">
          <h2>
            <Icon name="alert" /> {error.title}
          </h2>
          <p>{error.body}</p>
          {error.tips && (
            <ul className="tips">
              {RETAKE_TIPS.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          )}
          <div className="error-actions">
            {job.canRetry && !error.tips && !error.sample && (
              <button type="button" className="btn btn-primary" onClick={onRetry}>
                دوبارہ کوشش کریں
              </button>
            )}
            {error.sample && (
              <button type="button" className="btn btn-primary" onClick={onSample}>
                نمونہ بل دیکھیں
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={onReset}>
              نئی تصویر
            </button>
          </div>
        </section>
      )}

      {!busy && (
        <section className="capture" aria-label="بل کی تصویر">
          <button type="button" className="btn btn-camera" onClick={() => pick(cameraInput)}>
            <Icon name="camera" size={40} />
            <span>بل کی تصویر کھینچیں</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => pick(galleryInput)}>
            <Icon name="gallery" />
            <span>گیلری سے تصویر چنیں</span>
          </button>
          <p className="fine">
            کے الیکٹرک، لیسکو، فیسکو، آئیسکو، پیپکو اور باقی سب کمپنیوں کے بل۔ تصویر کہیں محفوظ نہیں ہوتی۔{' '}
            <a href={href('privacy')}>مزید جانیں</a>
          </p>
        </section>
      )}

      {!busy && (
        <section className="panel sample-cta">
          <h2>پہلے دیکھنا چاہتے ہیں کہ جواب کیسا ہوتا ہے؟</h2>
          <p>ایک فرضی بل پر ایپ کا پورا جواب دیکھیں۔ کوئی تصویر نہیں بھیجی جائے گی۔</p>
          <button type="button" className="btn btn-secondary" onClick={onSample}>
            نمونہ بل دیکھیں
          </button>
        </section>
      )}

      <ConsentDialog open={askConsent} onAccept={accept} onClose={() => setAskConsent(false)} />
    </div>
  )
}
