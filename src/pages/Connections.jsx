import { platforms } from "../lib/platforms";
function Connections() {
  return (
    <main>
      <h1>Connections</h1>
      <p>
        Provider connections appear as disconnected until an authenticated
        provider handshake and live sync verification succeed. Social publishing
        and automatic financial synchronization are not yet enabled in this
        migration build.
      </p>
      <div className="cards">
        {platforms.map((p) => (
          <div className="card" key={p.id}>
            <h3>{p.name}</h3>
            <span className="pill">Not connected</span>
            <p>OAuth or approved API integration required.</p>
          </div>
        ))}
      </div>
    </main>
  );
}
export default Connections;
