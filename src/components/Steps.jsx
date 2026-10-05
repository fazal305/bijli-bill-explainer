const STEPS = ['بل کی تصویر', 'ایک ایک لائن پڑھائی', 'آسان اردو میں جواب']

export default function Steps({ active }) {
  return (
    <ol className="steps" aria-label="تین قدم">
      {STEPS.map((label, i) => {
        const state = i < active ? 'done' : i === active ? 'now' : 'next'
        return (
          <li key={label} className={`step step-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="step-num">{i + 1}</span>
            <span className="step-label">{label}</span>
          </li>
        )
      })}
    </ol>
  )
}
