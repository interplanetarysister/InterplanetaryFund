// Deliberately fictional UI fixtures; NOT PayPal sandbox receipts or Supabase ledger data.
// Avoid plausible live transaction identifiers and any PII. The demo remains usable at zero database cost.
export const financeDemoRows = Object.freeze([
  { id: "EXAMPLE-01", campaign: "Community Storm Relief", paymentMethod: "PayPal sandbox (example)", status: "Sample completed", amountCents: 5000, period: "Demo day 1" },
  { id: "EXAMPLE-02", campaign: "Student Science Kits", paymentMethod: "Card (example)", status: "Sample completed", amountCents: 2500, period: "Demo day 1" },
  { id: "EXAMPLE-03", campaign: "Community Storm Relief", paymentMethod: "PayPal sandbox (example)", status: "Sample completed", amountCents: 1200, period: "Demo day 1" },
  { id: "EXAMPLE-04", campaign: "Community Garden", paymentMethod: "PayPal sandbox (example)", status: "Sample completed", amountCents: 1500, period: "Demo day 2" },
  { id: "EXAMPLE-05", campaign: "Student Science Kits", paymentMethod: "Card (example)", status: "Sample pending", amountCents: 750, period: "Demo day 2" },
  { id: "EXAMPLE-06", campaign: "Community Garden", paymentMethod: "PayPal sandbox (example)", status: "Sample refunded", amountCents: 2000, period: "Demo day 2" },
  { id: "EXAMPLE-07", campaign: "Community Storm Relief", paymentMethod: "Card (example)", status: "Sample completed", amountCents: 10000, period: "Demo day 3" },
  { id: "EXAMPLE-08", campaign: "Accessible Learning", paymentMethod: "PayPal sandbox (example)", status: "Sample completed", amountCents: 3200, period: "Demo day 3" },
  { id: "EXAMPLE-09", campaign: "Accessible Learning", paymentMethod: "Card (example)", status: "Sample pending", amountCents: 1000, period: "Demo day 3" },
  { id: "EXAMPLE-10", campaign: "Student Science Kits", paymentMethod: "PayPal sandbox (example)", status: "Sample completed", amountCents: 4500, period: "Demo day 3" },
]);
export const demoFinanceStats = (rows = financeDemoRows) => ({
  examples: rows.length,
  completed: rows.filter(row => row.status === "Sample completed").length,
  exampleCapturedCents: rows.filter(row => row.status === "Sample completed")
    .reduce((sum, row) => sum + row.amountCents, 0),
});
