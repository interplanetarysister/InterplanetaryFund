import { generatePayPalLink } from "../../lib/paypalLink";

// One-time platform-support PayPal button. Pays the Interplanetary Fund
// business PayPal account through the hosted payment link and never credits a
// campaign. Opens a small popup on desktop and falls back to a new tab.
export default function PayPalDonateButton({
  label = "Support Interplanetary Fund",
}) {
  const href = generatePayPalLink();
  const openPayPal = (event) => {
    if (typeof window === "undefined" || window.innerWidth < 640) return;
    const popup = window.open(
      href,
      "ifund-paypal-platform-support",
      "width=540,height=720,scrollbars=yes,resizable=yes",
    );
    if (popup) {
      try {
        popup.opener = null;
      } catch {
        // Cross-origin restrictions.
      }
      event.preventDefault();
      popup.focus();
    }
  };
  return (
    <div className="paypal-support">
      <a
        href={href}
        onClick={openPayPal}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label} - secure PayPal checkout window or tab`}
        className="paypal-support-button"
        style={{
          display: "inline-flex",
          width: "100%",
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          background: "#FFD140",
          color: "#003087",
          fontWeight: 600,
          padding: "12px 20px",
          textDecoration: "none",
        }}
      >
        {label}
      </a>
      <p style={{ fontSize: 11, textAlign: "center", opacity: 0.75 }}>
        Payment supports IFund only, not an individual campaign. PayPal controls
        checkout options.
      </p>
      <p style={{ fontSize: 11, textAlign: "center", opacity: 0.6 }}>
        Powered by{" "}
        <img
          src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg"
          alt="PayPal"
          style={{ height: 12, verticalAlign: "middle" }}
        />
      </p>
    </div>
  );
}
