import PayPalDonateButton from "../components/payments/PayPalDonateButton";

export default function Support() {
  return (
    <main>
      <h1>Support Interplanetary Fund</h1>
      <p>
        Gifts here fund Interplanetary Fund itself: hosting, development, AI
        donor matching and user-safety moderation. They do not go to any
        individual campaign.
      </p>
      <div style={{ maxWidth: 360 }}>
        <PayPalDonateButton />
      </div>
    </main>
  );
}
