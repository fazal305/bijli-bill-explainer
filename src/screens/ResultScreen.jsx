import Icon from '../components/Icon.jsx'
import Steps from '../components/Steps.jsx'
import { COMPANY_NAMES } from '../lib/dictionary.js'
import { formatRs } from '../lib/explain.js'

function Rs({ value, signed = false }) {
  const sign = signed && value < 0 ? '−' : ''
  return (
    <bdi className="num">
      {sign}
      {formatRs(value)}
    </bdi>
  )
}

function History({ rows, current }) {
  const data = [{ month: 'یہ مہینہ', units: current, now: true }, ...rows.filter((r) => r.units !== null).slice(0, 6)]
  if (data.length < 2 || current === null) return null
  const max = Math.max(...data.map((r) => r.units), 1)
  return (
    <section className="panel history" aria-labelledby="history-title">
      <h2 id="history-title">پچھلے مہینوں کے یونٹ</h2>
      <table>
        <caption className="visually-hidden">ہر مہینے استعمال ہونے والے یونٹ</caption>
        <thead className="visually-hidden">
          <tr>
            <th scope="col">مہینہ</th>
            <th scope="col">یونٹ</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.month} className={row.now ? 'now' : undefined}>
              <th scope="row">
                <bdi>{row.month}</bdi>
              </th>
              <td>
                <div className="bar-row">
                  <span className="bar" style={{ inlineSize: `${Math.max(4, (row.units / max) * 100)}%` }} aria-hidden="true" />
                  <bdi className="num">{row.units}</bdi>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

export default function ResultScreen({ result, onAgain }) {
  const { explanation: e, sample, photoUrl } = result
  const up = e.change && e.change.amount > 0
  const where = [e.company && COMPANY_NAMES[e.company], e.billMonth].filter(Boolean)

  return (
    <div className="result">
      <Steps active={3} />

      {sample && (
        <p className="sample-badge" role="note">
          یہ نمونہ بل ہے، کسی کا اصلی بل نہیں۔ رقمیں صرف سمجھانے کے لیے بنائی گئی ہیں۔
        </p>
      )}

      <header className="panel total">
        <p className="total-where">{where.length > 0 ? <bdi>{where.join(' · ')}</bdi> : 'آپ کا بل'}</p>
        <h1 tabIndex={-1}>
          <span className="total-label">کل رقم</span>
          <span className="total-amount">
            <Rs value={e.total} /> <small>روپے</small>
          </span>
        </h1>
        <dl className="facts">
          {e.units !== null && (
            <div>
              <dt>یونٹ استعمال ہوئے</dt>
              <dd>
                <bdi className="num">{e.units}</bdi>
              </dd>
            </div>
          )}
          {e.dueDate && (
            <div>
              <dt>آخری تاریخ</dt>
              <dd>
                <bdi className="num">{e.dueDate}</bdi>
              </dd>
            </div>
          )}
          {e.afterDue !== null && (
            <div>
              <dt>تاریخ کے بعد</dt>
              <dd>
                <Rs value={e.afterDue} /> روپے
              </dd>
            </div>
          )}
        </dl>
        {e.change && e.change.amount !== 0 && (
          <p className={`change ${up ? 'change-up' : 'change-down'}`}>
            پچھلے مہینے کے بل سے <Rs value={e.change.amount} /> روپے {up ? 'زیادہ' : 'کم'}
          </p>
        )}
      </header>

      <section className="panel why" aria-labelledby="why-title">
        <h2 id="why-title">
          <Icon name="alert" /> {up ? 'بل کیوں زیادہ آیا؟' : 'اس بل کی اہم باتیں'}
        </h2>
        {e.reasons.length > 0 ? (
          <ul className="reasons">
            {e.reasons.map((reason) => (
              <li key={reason.id} className={`reason reason-${reason.tone}`}>
                {reason.text}
              </li>
            ))}
          </ul>
        ) : (
          <p>اس بل میں کوئی غیر معمولی اضافہ نظر نہیں آیا۔ نیچے ہر لائن کا مطلب دیکھیں۔</p>
        )}
      </section>

      {e.mismatch && (
        <p className="banner" role="note">
          نیچے کی لائنوں کا جوڑ کل رقم سے پورا نہیں ملتا۔ شاید کوئی لائن صاف پڑھی نہیں گئی، اس لیے اصل بل سے ملا لیں۔
        </p>
      )}

      <section className="panel lines" aria-labelledby="lines-title">
        <h2 id="lines-title">بل کی ایک ایک لائن کا مطلب</h2>
        <p className="legend">
          <span className="key key-usage">سبز: آپ کی جلائی ہوئی بجلی</span>
          <span className="key key-tax">سرخ: ٹیکس، سرچارج اور اضافی رقم</span>
        </p>
        {e.items.length > 0 ? (
          <ul className="items">
            {e.items.map((item, i) => (
              <li key={`${item.key}-${i}`} className={`item tone-${item.tone}`}>
                <div className="item-head">
                  <h3>{item.title}</h3>
                  <p className="item-amount">
                    <Rs value={item.amount} signed /> <small>روپے</small>
                  </p>
                </div>
                <p className="item-label" lang="en" dir="ltr">
                  {item.label || item.english}
                </p>
                <p className="item-body">{item.body}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>بل کی الگ الگ لائنیں نہیں پڑھی جا سکیں، صرف کل رقم ملی۔ بہتر جواب کے لیے بل کے رقم والے حصے کی صاف تصویر کھینچیں۔</p>
        )}
      </section>

      <History rows={e.history} current={e.units} />

      {photoUrl && (
        <details className="panel your-photo">
          <summary>اپنی تصویر سے ملا کر دیکھیں</summary>
          <img src={photoUrl} alt="آپ کے بل کی تصویر" />
        </details>
      )}

      <p className="fine">
        {sample
          ? 'اصلی بل کا جواب بھی اسی طرح آتا ہے۔'
          : 'رقمیں AI نے تصویر سے پڑھی ہیں اور غلط بھی ہو سکتی ہیں۔ کوئی بھی رقم جمع کرانے یا شکایت کرنے سے پہلے اصل بل سے ملا لیں۔'}
      </p>

      <button type="button" className="btn btn-camera" onClick={onAgain}>
        <Icon name="camera" size={36} />
        <span>{sample ? 'اب اپنا بل دیکھیں' : 'دوسرا بل دیکھیں'}</span>
      </button>
    </div>
  )
}
