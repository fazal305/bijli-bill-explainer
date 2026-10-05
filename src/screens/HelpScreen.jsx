import ScreenHeader from '../components/ScreenHeader.jsx'
import { DICTIONARY, GLOSSARY_ORDER } from '../lib/dictionary.js'

const FAQ = [
  {
    q: 'کیا یہ ایپ مفت ہے؟',
    a: 'جی ہاں۔ کوئی اکاؤنٹ یا ادائیگی نہیں چاہیے۔ بل ایک مفت AI سروس پڑھتی ہے، اس لیے کبھی کبھی رش کی وجہ سے دیر لگ سکتی ہے۔',
  },
  {
    q: 'کیا میرا بل کہیں محفوظ ہوتا ہے؟',
    a: 'نہیں۔ تصویر صرف پڑھنے کے لیے AI سروس کو بھیجی جاتی ہے اور ہم اسے کہیں محفوظ نہیں کرتے۔ تفصیل پرائیویسی والے صفحے پر ہے۔',
  },
  {
    q: 'کیا جواب سو فیصد درست ہوتا ہے؟',
    a: 'نہیں۔ AI کبھی کبھار کوئی رقم غلط پڑھ سکتا ہے۔ اسی لیے ہم ہر لائن کے ساتھ بل پر لکھا انگریزی نام بھی دکھاتے ہیں تاکہ آپ اصل بل سے ملا سکیں۔ شکایت یا ادائیگی سے پہلے اصل بل ضرور دیکھیں۔',
  },
  {
    q: 'کن کمپنیوں کے بل چلتے ہیں؟',
    a: 'کے الیکٹرک اور واپڈا کی سب کمپنیاں: لیسکو، فیسکو، آئیسکو، گیپکو، میپکو، پیسکو، حیسکو، سیپکو، کیسکو اور ٹیسکو۔',
  },
  {
    q: 'بل غلط لگے تو کیا کریں؟',
    a: 'اپنی بجلی کمپنی کے دفتر یا ہیلپ لائن پر شکایت کریں۔ کمپنی کے فیصلے سے مطمئن نہ ہوں تو نیپرا (NEPRA) میں شکایت درج کرائی جا سکتی ہے۔',
  },
]

export default function HelpScreen() {
  return (
    <article className="doc">
      <ScreenHeader title="مدد اور الفاظ کے معنی" />

      <section className="panel">
        <h2>اچھی تصویر کیسے کھینچیں</h2>
        <ol className="tips">
          <li>بل کو میز پر سیدھا اور ہموار رکھیں۔</li>
          <li>دن کی روشنی میں کھینچیں، فلیش کی چمک رقموں پر نہ پڑے۔</li>
          <li>رقموں والا پورا حصہ اور پچھلے مہینوں کا یونٹ والا خانہ فریم میں آئے۔</li>
          <li>چاہیں تو نام اور پتے پر کاغذ رکھ دیں، اس سے جواب پر کوئی فرق نہیں پڑتا۔</li>
        </ol>
      </section>

      <section className="panel" aria-labelledby="glossary-title">
        <h2 id="glossary-title">بل پر لکھے الفاظ کا مطلب</h2>
        <dl className="glossary">
          {GLOSSARY_ORDER.map((key) => {
            const entry = DICTIONARY[key]
            return (
              <div key={key} className={`glossary-entry tone-${entry.tone === 'adjust' ? 'tax' : entry.tone}`}>
                <dt>
                  {entry.title}{' '}
                  <span className="item-label" lang="en" dir="ltr">
                    {entry.english}
                  </span>
                </dt>
                <dd>{entry.body}</dd>
              </div>
            )
          })}
        </dl>
      </section>

      <section className="panel" aria-labelledby="faq-title">
        <h2 id="faq-title">عام سوالات</h2>
        {FAQ.map(({ q, a }) => (
          <details key={q} className="faq">
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </article>
  )
}
