import { href } from '../hooks/useHashRoute.js'

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="مزید صفحات">
        <a href={href('home')}>نیا بل</a>
        <a href={href('help')}>مدد اور الفاظ کے معنی</a>
        <a href={href('privacy')}>پرائیویسی</a>
        <a href={href('terms')}>شرائط</a>
      </nav>
      <p>
        یہ کسی بجلی کمپنی یا حکومت کی ایپ نہیں۔ رقم کے بارے میں حتمی بات ہمیشہ اصل بل اور بجلی کمپنی کی ہے۔
      </p>
    </footer>
  )
}
