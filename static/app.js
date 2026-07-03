const form = document.getElementById('predict-form');
const runBtn = document.getElementById('run-btn');
const errorBox = document.getElementById('error-box');

const gaugeProgress = document.getElementById('gauge-progress');
const needle = document.getElementById('needle');
const readoutLabel = document.getElementById('readout-label');
const readoutValue = document.getElementById('readout-value');
const readoutSub = document.getElementById('readout-sub');
const statDepreciation = document.getElementById('stat-depreciation');
const statRetained = document.getElementById('stat-retained');
const ticksGroup = document.getElementById('ticks');

// Draw static tick marks around the gauge arc
(function drawTicks() {
  const cx = 150, cy = 170, rOuter = 128, rInner = 118;
  const totalTicks = 9; // 0%, 12.5%, 25% ... 100%
  for (let i = 0; i < totalTicks; i++) {
    const angleDeg = -180 + (180 / (totalTicks - 1)) * i; // -180 -> 0 across top
    const rad = (angleDeg * Math.PI) / 180;
    const x1 = cx + rInner * Math.cos(rad);
    const y1 = cy + rInner * Math.sin(rad);
    const x2 = cx + rOuter * Math.cos(rad);
    const y2 = cy + rOuter * Math.sin(rad);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', x1);
    tick.setAttribute('y1', y1);
    tick.setAttribute('x2', x2);
    tick.setAttribute('y2', y2);
    tick.setAttribute('class', 'tick');
    ticksGroup.appendChild(tick);
  }
})();

const arcLength = gaugeProgress.getTotalLength();
gaugeProgress.style.strokeDasharray = `${arcLength}`;
gaugeProgress.style.strokeDashoffset = `${arcLength}`;

function setGauge(ratio) {
  // ratio: 0 (no value retained) -> 1 (full retained value)
  const clamped = Math.max(0, Math.min(1, ratio));
  const offset = arcLength * (1 - clamped);
  gaugeProgress.style.strokeDashoffset = `${offset}`;

  const angle = -90 + clamped * 180; // -90deg (left) -> +90deg (right)
  needle.style.transform = `rotate(${angle}deg)`;

  // colour cue: green-ish cyan when high retained value, amber mid, red low
  if (clamped > 0.6) {
    gaugeProgress.style.stroke = '#35c9e1';
  } else if (clamped > 0.3) {
    gaugeProgress.style.stroke = '#f2760f';
  } else {
    gaugeProgress.style.stroke = '#e85d5d';
  }
}

function showError(messages) {
  errorBox.hidden = false;
  errorBox.innerHTML = messages.map(m => `⚠ ${m}`).join('<br>');
}

function clearError() {
  errorBox.hidden = true;
  errorBox.innerHTML = '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const year = document.getElementById('year').value;
  const presentPrice = document.getElementById('present_price').value;
  const kmsDriven = document.getElementById('kms_driven').value;

  if (!year || !presentPrice || !kmsDriven) {
    showError(['Please fill in all three fields.']);
    return;
  }

  runBtn.disabled = true;
  runBtn.querySelector('span').textContent = 'CALCULATING…';
  readoutLabel.textContent = 'PROCESSING';

  try {
    const res = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Year: year,
        Present_Price: presentPrice,
        Kms_Driven: kmsDriven,
      }),
    });

    const data = await res.json();

    if (!data.success) {
      showError(data.errors || ['Something went wrong.']);
      readoutLabel.textContent = 'AWAITING INPUT';
      setGauge(0);
      return;
    }

    const predicted = data.selling_price_lakhs;
    const present = parseFloat(presentPrice);
    const ratio = present > 0 ? predicted / present : 0;
    const depreciationPct = Math.max(0, (1 - ratio) * 100);
    const retainedPct = Math.max(0, ratio * 100);

    setGauge(ratio);

    readoutLabel.textContent = 'ESTIMATED RESALE VALUE';
    readoutValue.textContent = predicted.toFixed(2);
    readoutValue.classList.add('is-live');
    readoutSub.textContent = 'lakhs ₹';

    statDepreciation.textContent = `${depreciationPct.toFixed(1)}%`;
    statRetained.textContent = `${retainedPct.toFixed(1)}%`;

  } catch (err) {
    showError(['Could not reach the server. Is app.py running?']);
  } finally {
    runBtn.disabled = false;
    runBtn.querySelector('span').textContent = 'ESTIMATE VALUE';
  }
});
