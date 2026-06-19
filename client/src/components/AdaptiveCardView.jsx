import { useEffect, useRef } from "react";
import * as AdaptiveCards from "adaptivecards";

// Renders one Adaptive Card JSON object into the DOM using the adaptivecards
// library. Custom Chart.* elements are already registered (see main.jsx).
export default function AdaptiveCardView({ card }) {
  const hostRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const adaptiveCard = new AdaptiveCards.AdaptiveCard();
    adaptiveCard.hostConfig = new AdaptiveCards.HostConfig({
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    });
    adaptiveCard.onExecuteAction = (action) => {
      if (action instanceof AdaptiveCards.OpenUrlAction && action.url) {
        window.open(action.url, "_blank", "noopener");
      }
    };

    try {
      adaptiveCard.parse(card);
      const rendered = adaptiveCard.render();
      host.replaceChildren();
      if (rendered) host.appendChild(rendered);
    } catch (e) {
      host.textContent = `Failed to render card: ${e.message}`;
    }

    return () => host.replaceChildren();
  }, [card]);

  return <div className="adaptive-card-host" ref={hostRef} />;
}
