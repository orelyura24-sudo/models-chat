import AdaptiveCardView from "./AdaptiveCardView.jsx";

// Right-hand panel: renders every Adaptive Card the complex agent has produced,
// newest first.
export default function RenderPanel({ artifacts }) {
  return (
    <div className="render-pane">
      <header className="render-header">
        <h2>Rendered output</h2>
      </header>
      <div className="render-body">
        {artifacts.length === 0 && (
          <div className="empty">
            Responses from the <strong>Complex Agent</strong> render here as Adaptive Cards
            with native charts.
          </div>
        )}
        {artifacts.map((art) => (
          <div key={art.id} className="artifact">
            {art.prompt && <div className="artifact-prompt">“{art.prompt}”</div>}
            <AdaptiveCardView card={art.card} />
          </div>
        ))}
      </div>
    </div>
  );
}
