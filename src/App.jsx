import { useEffect, useRef, useState } from 'react'
import { href, useHashRoute } from './hooks/useHashRoute.js'
import { useOnline } from './hooks/useOnline.js'
import { explainPhoto } from './lib/api.js'
import { explainBill } from './lib/explain.js'
import { preparePhoto } from './lib/photo.js'
import { SAMPLE_BILL } from './lib/sample.js'
import SiteFooter from './components/SiteFooter.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import ResultScreen from './screens/ResultScreen.jsx'
import HelpScreen from './screens/HelpScreen.jsx'
import PrivacyScreen from './screens/PrivacyScreen.jsx'
import TermsScreen from './screens/TermsScreen.jsx'
import NotFoundScreen from './screens/NotFoundScreen.jsx'

const PAGES = { help: HelpScreen, privacy: PrivacyScreen, terms: TermsScreen }

export default function App() {
  const route = useHashRoute()
  const online = useOnline()
  // The photo and its reading live only in memory; nothing is saved.
  const [job, setJob] = useState({ status: 'idle' })
  const [result, setResult] = useState(null)
  const photo = useRef({ blob: null, url: null })
  const controller = useRef(null)
  const mainRef = useRef(null)
  const firstRender = useRef(true)

  const screen = route === 'result' && !result ? 'home' : route

  useEffect(() => {
    if (route === 'result' && !result) window.history.replaceState(null, '', href('home'))
  }, [route, result])

  // Move focus to the new screen's heading so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    window.scrollTo(0, 0)
    mainRef.current?.querySelector('h1')?.focus()
  }, [screen])

  useEffect(() => () => controller.current?.abort(), [])

  function setPhoto(blob) {
    if (photo.current.url) URL.revokeObjectURL(photo.current.url)
    photo.current = { blob, url: blob ? URL.createObjectURL(blob) : null }
  }

  async function read(blob) {
    controller.current?.abort()
    const ctrl = new AbortController()
    controller.current = ctrl
    setJob({ status: 'reading', photoUrl: photo.current.url, startedAt: Date.now() })
    try {
      const bill = await explainPhoto(blob, ctrl.signal)
      if (ctrl.signal.aborted) return
      setResult({ explanation: explainBill(bill), sample: false, photoUrl: photo.current.url })
      setJob({ status: 'idle' })
      window.location.hash = href('result')
    } catch (error) {
      if (ctrl.signal.aborted) return
      setJob({ status: 'error', code: error.code || 'server', canRetry: true, photoUrl: photo.current.url })
    }
  }

  async function choosePhoto(file) {
    setJob({ status: 'preparing' })
    let blob
    try {
      blob = await preparePhoto(file)
    } catch (error) {
      setPhoto(null)
      setJob({ status: 'error', code: error.code || 'unreadable_photo', canRetry: false })
      return
    }
    setPhoto(blob)
    read(blob)
  }

  function retry() {
    if (photo.current.blob) read(photo.current.blob)
  }

  function cancel() {
    controller.current?.abort()
    setJob({ status: 'idle' })
  }

  function showSample() {
    setResult({ explanation: explainBill(SAMPLE_BILL), sample: true, photoUrl: null })
    window.location.hash = href('result')
  }

  function startOver() {
    controller.current?.abort()
    setPhoto(null)
    setResult(null)
    setJob({ status: 'idle' })
    window.location.hash = href('home')
  }

  let content
  if (screen === 'home') {
    content = (
      <HomeScreen
        job={job}
        online={online}
        onPhoto={choosePhoto}
        onRetry={retry}
        onCancel={cancel}
        onReset={startOver}
        onSample={showSample}
      />
    )
  } else if (screen === 'result') {
    content = <ResultScreen result={result} onAgain={startOver} />
  } else if (PAGES[screen]) {
    const Page = PAGES[screen]
    content = <Page onSample={showSample} />
  } else {
    content = <NotFoundScreen />
  }

  return (
    <>
      <main className="page" ref={mainRef}>
        {content}
      </main>
      <SiteFooter />
    </>
  )
}
