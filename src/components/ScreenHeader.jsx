import { href } from '../hooks/useHashRoute.js'

export default function ScreenHeader({ title }) {
  return (
    <header className="screen-header">
      <a className="back-link" href={href('home')}>
        <span aria-hidden="true">→</span> واپس
      </a>
      <h1 className="screen-title" tabIndex={-1}>
        {title}
      </h1>
    </header>
  )
}
