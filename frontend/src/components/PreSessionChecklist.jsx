/**
 * PreSessionChecklist component.
 * Displays a 4-point real-time pre-session checklist:
 * 1. Required landmarks visible
 * 2. Framing & safety margins
 * 3. Camera view orientation (side vs front)
 * 4. Camera frame rate
 *
 * Provides prominent human-readable instructions when any check fails,
 * blocking calibration until the patient is correctly positioned.
 */
export default function PreSessionChecklist({
  validation,
  calibrationStatus,
  calibrationProgress = 0,
  calibrationMessage = '',
  onRetryCalibration,
  canCalibrate = false,
}) {
  if (!validation) return null;

  const { checks, ok: allOk, failingCheck, message } = validation;

  const items = [
    {
      id: 'landmarks',
      label: 'Body landmarks visible',
      check: checks?.landmarks,
      hint: 'Required joints above confidence threshold',
    },
    {
      id: 'framing',
      label: 'Framing & borders',
      check: checks?.framing,
      hint: 'Body inside camera view with margin',
    },
    {
      id: 'orientation',
      label: 'Camera orientation',
      check: checks?.orientation,
      hint: checks?.orientation?.code === 'VIEW_OK' ? 'Correct viewing angle' : 'Side or front view match',
    },
    {
      id: 'frameRate',
      label: 'Camera speed & lighting',
      check: checks?.frameRate,
      hint: checks?.frameRate?.fps ? `${checks.frameRate.fps} fps (min 15)` : 'At least 15 fps required',
    },
  ];

  return (
    <div className="card pre-session-checklist" style={{ margin: '14px 0', border: allOk ? '1px solid rgba(35, 121, 66, 0.3)' : '1px solid rgba(148, 96, 32, 0.3)' }}>
      <div className="row sp" style={{ marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Position & Camera Checklist</h3>
        <span className={`tag ${allOk ? 'ok' : 'warn'}`}>
          {allOk ? 'Ready to calibrate' : 'Positioning required'}
        </span>
      </div>

      <p className="mut" style={{ fontSize: 12, margin: '0 0 10px' }}>
        Kineticare verifies your camera angle and position before starting to ensure accurate movement tracking.
      </p>

      {/* Real-time Checklist Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        {items.map(item => {
          const isPassed = item.check?.ok;
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                background: isPassed ? 'var(--okb)' : 'var(--warnb)',
                border: `1px solid ${isPassed ? 'rgba(35, 121, 66, 0.2)' : 'rgba(148, 96, 32, 0.2)'}`,
              }}
            >
              <span style={{ fontSize: 14 }}>{isPassed ? '✓' : '⚠️'}</span>
              <div style={{ fontSize: 11, lineHeight: 1.25 }}>
                <b style={{ color: isPassed ? 'var(--ok)' : 'var(--warn)' }}>{item.label}</b>
                <span className="mut" style={{ display: 'block', fontSize: 10 }}>{item.check?.ok ? 'Passed' : item.check?.code || 'Checking...'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Human-readable instruction alert */}
      {failingCheck && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--warnb)',
            color: 'var(--warn)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 18 }}>👉</span>
          <span>{failingCheck.message || message}</span>
        </div>
      )}

      {/* Ready banner when all checks pass */}
      {allOk && calibrationStatus !== 'collecting' && calibrationStatus !== 'ready' && (
        <div
          role="status"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--okb)',
            color: 'var(--ok)',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 13,
          }}
        >
          <span>✓ Stance verified. Hold still for 2-second resting position setup.</span>
          {onRetryCalibration && (
            <button
              className="btn sm"
              style={{ flexShrink: 0 }}
              disabled={!canCalibrate}
              onClick={onRetryCalibration}
            >
              {calibrationStatus === 'error' ? 'Retry calibration' : 'Calibrate now'}
            </button>
          )}
        </div>
      )}

      {/* Calibration collecting progress */}
      {calibrationStatus === 'collecting' && (
        <div style={{ marginTop: 12 }}>
          <div className="row sp" style={{ fontSize: 12, marginBottom: 4 }}>
            <b>Measuring resting baseline...</b>
            <span>{calibrationProgress}%</span>
          </div>
          <div className="prog" style={{ height: 10 }}>
            <b style={{ width: `${calibrationProgress}%` }} />
          </div>
          <p className="mut" style={{ fontSize: 11, margin: '6px 0 0' }}>
            Hold completely still. Movement variance is tracked to ensure a stable baseline.
          </p>
        </div>
      )}

      {/* Calibration error */}
      {calibrationStatus === 'error' && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: '10px 14px',
            background: 'var(--badb)',
            color: 'var(--bad)',
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          <b>Setup needs another try:</b> {calibrationMessage}
        </div>
      )}
    </div>
  );
}

