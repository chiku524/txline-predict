import {
  OUTCOME_LEGEND,
  legendToneClass,
} from "@/lib/outcome-colors";

interface OutcomeColorLegendProps {
  compact?: boolean;
}

export function OutcomeColorLegend({ compact = false }: OutcomeColorLegendProps) {
  return (
    <aside
      className={`outcome-legend ${compact ? "outcome-legend--compact" : ""}`}
      aria-label="Outcome color guide"
    >
      <div className="outcome-legend__header">
        <h3 className="outcome-legend__title">Outcome colors</h3>
        <p className="outcome-legend__note">
          Colors show <strong>which side or line</strong> you are backing — not
          whether it is winning or losing.
        </p>
      </div>
      <div className="outcome-legend__grid" role="list">
        {OUTCOME_LEGEND.map((item) => (
          <div key={item.tone} className="outcome-legend__row" role="listitem">
            <span
              className={`legend-swatch ${legendToneClass(item.tone)}`}
              aria-hidden
            />
            <div className="outcome-legend__text">
              <span className="outcome-legend__label">{item.label}</span>
              <span className="outcome-legend__meaning">{item.meaning}</span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
