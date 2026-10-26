// Load wallet connection only on deliberate user interaction.
// A connected wallet is NOT evidence of a received donation.
let modalPromise;
export const reownConfigured = () => Boolean(String(import.meta.env.VITE_REOWN_PROJECT_ID || "").trim());

export async function openReownWallet() {
  const projectId = String(import.meta.env.VITE_REOWN_PROJECT_ID || "").trim();
  if (!projectId) throw new Error("Wallet provider is not configured.");
  if (!modalPromise) {
    modalPromise = (async () => {
      const [{ createAppKit }, { EthersAdapter }, { SolanaAdapter }, { BitcoinAdapter }, networks] = await Promise.all([
        import("@reown/appkit"),
        import("@reown/appkit-adapter-ethers"),
        import("@reown/appkit-adapter-solana"),
        import("@reown/appkit-adapter-bitcoin"),
        import("@reown/appkit/networks"),
      ]);
      const { mainnet, base, arbitrum, polygon, solana, bitcoin } = networks;
      return createAppKit({
        projectId,
        networks: [mainnet, base, arbitrum, polygon, solana, bitcoin],
        defaultNetwork: mainnet,
        adapters: [
          new EthersAdapter(),
          new SolanaAdapter({ wallets: [] }),
          new BitcoinAdapter({ networks: [bitcoin], projectId }),
        ],
        metadata: {
          name: "Interplanetary Fund",
          description: "Connect a wallet to Interplanetary Fund",
          url: window.location.origin,
          icons: [new URL("/icon-192.jpg", window.location.origin).href],
        },
        themeMode: "dark",
        themeVariables: { "--w3m-z-index": 3000 },
        features: { analytics: false, email: false, socials: [] },
      });
    })().catch((error) => { modalPromise = null; throw error; });
  }
  const modal = await modalPromise;
  await modal.open({ view: "Connect" });
  return modal;
}
