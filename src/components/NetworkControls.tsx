import { useId, useState } from 'react';
import { NETWORK_DEFAULTS, type LinkProfile } from '../sim/network';
import type { NodeConfig, SimEdge, SimSnapshot } from '../sim/types';
import { formatMs } from './format';

function NetworkNumber({
  label,
  value,
  fallback = 0,
  max = 120000,
  step = 0.1,
  unit = 'ms',
  onChange,
}: {
  label: string;
  value?: number;
  fallback?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid =
    draft !== null &&
    draft !== '' &&
    (!Number.isFinite(Number(draft)) ||
      Number(draft) < 0 ||
      Number(draft) > max ||
      (step === 1 && !Number.isInteger(Number(draft))));
  return (
    <div className="ins-field-row">
      <label htmlFor={id} className="row-k">
        {label}
      </label>
      <span className="ins-number-wrap">
        <input
          id={id}
          className="ins-number"
          type="number"
          min={0}
          max={max}
          step={step}
          aria-invalid={invalid || undefined}
          value={draft ?? value ?? fallback}
          onChange={(event) => {
            const text = event.currentTarget.value;
            setDraft(text);
            const n = Number(text);
            if (
              text !== '' &&
              Number.isFinite(n) &&
              n >= 0 &&
              n <= max &&
              (step !== 1 || Number.isInteger(n))
            )
              onChange(n);
          }}
          onBlur={() => {
            if (invalid) return;
            if (draft === '') onChange(undefined);
            setDraft(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setDraft(null);
          }}
        />
        <span className="ins-unit">{unit}</span>
      </span>
      {invalid && (
        <p className="ins-hint is-danger" role="alert">
          Use {step === 1 ? 'a whole number' : 'a number'} from 0 to {max}.
        </p>
      )}
    </div>
  );
}

export function NetworkNodeControls({
  config,
  onChange,
}: {
  config: NodeConfig;
  onChange: (patch: Partial<NodeConfig>) => void;
}) {
  const placed = config.placementRegion !== undefined;
  return (
    <>
      <label className="ins-hint">
        <input
          type="checkbox"
          checked={placed}
          onChange={(event) =>
            onChange({
              placementRegion: event.currentTarget.checked ? 0 : undefined,
            })
          }
        />{' '}
        Place in a region and availability zone
      </label>
      <p className="ins-hint">
        Both endpoints must be placed. IDs name educational failure domains, not cloud
        locations. Outgoing defaults below are illustrative one-way delays, applied to
        both request and reply; link overrides replace, not add to, them.
      </p>
      {placed && (
        <div className="ins-fields">
          <NetworkNumber
            label="Region ID"
            value={config.placementRegion}
            max={999}
            step={1}
            unit=""
            onChange={(placementRegion) => onChange({ placementRegion })}
          />
          <NetworkNumber
            label="Zone ID"
            value={config.placementZone}
            max={999}
            step={1}
            unit=""
            onChange={(placementZone) => onChange({ placementZone })}
          />
          {(Object.keys(NETWORK_DEFAULTS) as (keyof typeof NETWORK_DEFAULTS)[]).map(
            (field) => (
              <NetworkNumber
                key={field}
                label={
                  {
                    sameZoneMs: 'Same-zone one-way delay',
                    interZoneMs: 'Inter-zone one-way delay',
                    crossRegionMs: 'Cross-region one-way delay',
                    networkJitterMs: 'Default network jitter',
                  }[field]
                }
                value={config[field]}
                fallback={NETWORK_DEFAULTS[field]}
                onChange={(value) => onChange({ [field]: value })}
              />
            ),
          )}
          <p className="ins-hint">
            Jitter is independent uniform +/- variation, clamped at zero. Changing
            placement alone does not move data or create replicas.
          </p>
        </div>
      )}
    </>
  );
}

export interface NetworkEdgeView {
  edge: SimEdge;
  profile: LinkProfile;
  observed?: NonNullable<SimSnapshot['network']>[string];
}

export function NetworkEdgeControls({
  network,
  onChange,
}: {
  network: NetworkEdgeView;
  onChange: (patch: Partial<SimEdge>) => void;
}) {
  const { edge, profile, observed } = network;
  return (
    <>
      <p className="ins-hint">
        {profile.scope === 'unplaced' ? 'Unplaced / legacy link' : profile.scope}.{' '}
        Configured one-way request {formatMs(profile.requestMs)}, reply{' '}
        {formatMs(profile.responseMs)}. Clear an override to inherit placement defaults.
        Old unplaced links delay requests only.
      </p>
      <div className="ins-fields">
        <NetworkNumber
          label="Request delay override"
          value={edge.latencyMs}
          fallback={profile.requestMs}
          onChange={(latencyMs) => onChange({ latencyMs })}
        />
        <NetworkNumber
          label="Reply delay override"
          value={edge.responseLatencyMs}
          fallback={profile.responseMs}
          onChange={(responseLatencyMs) => onChange({ responseLatencyMs })}
        />
        <NetworkNumber
          label="Link jitter override"
          value={edge.jitterMs}
          fallback={profile.jitterMs}
          onChange={(jitterMs) => onChange({ jitterMs })}
        />
        <NetworkNumber
          label="Reply loss"
          value={(edge.responseLossRate ?? 0) * 100}
          max={100}
          unit="%"
          onChange={(percent) => onChange({ responseLossRate: (percent ?? 0) / 100 })}
        />
      </div>
      <p className="ins-hint">
        Reply loss silently drops answers after work completes: configure a caller
        timeout to stop waiting. Request packet loss below reports an immediate crossing
        failure; cable cuts affect both directions on placed links.
      </p>
      <p className="ins-hint" aria-live="polite">
        Observed mean request crossing:{' '}
        {observed?.arrivedRps ? formatMs(observed.requestMs) : 'no samples'}. Reply
        crossing: {observed?.answeredRps ? formatMs(observed.responseMs) : 'no samples'}
        . Call round trip:{' '}
        {observed?.answeredRps ? formatMs(observed.roundTripMs) : 'no samples'}. Round
        trip includes target queue, own work and downstream waits; lost/timed-out
        replies are excluded, not counted as fast successes.
      </p>
    </>
  );
}
