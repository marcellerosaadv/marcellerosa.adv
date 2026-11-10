import { q } from "@/lib/db";
import { resumeBot, pauseBot } from "../actions";

export const dynamic = "force-dynamic";

type C = {
  ig_user_id: string; username: string | null; phone: string | null; email: string | null; origin: string | null;
  paused_until: string | null; last_inbound_at: string | null; created_at: string; last_text: string | null;
};

const fmt = (d: string | null) =>
  d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "";

export default async function Leads() {
  const rows = await q<C>(`
    SELECT c.*, (SELECT text FROM messages m WHERE m.ig_user_id = c.ig_user_id AND m.direction = 'in'
                 ORDER BY created_at DESC LIMIT 1) AS last_text
    FROM contacts c ORDER BY COALESCE(c.last_inbound_at, c.created_at) DESC LIMIT 300`);
  const now = new Date();

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Leads do Instagram ({rows.length})</h2>
        <a className="btn" href="/leads/export">Baixar CSV</a>
      </div>
      <div className="scroll">
        <table>
          <thead><tr><th>Perfil</th><th>Contato</th><th>Origem</th><th>Última mensagem</th><th>Bot</th></tr></thead>
          <tbody>
            {rows.map((c) => {
              const paused = c.paused_until && new Date(c.paused_until) > now;
              const within24h = c.last_inbound_at && now.getTime() - new Date(c.last_inbound_at).getTime() < 864e5;
              return (
                <tr key={c.ig_user_id}>
                  <td>{c.username ? <a href={`https://instagram.com/${c.username}`} target="_blank">@{c.username}</a> : <span className="muted">{c.ig_user_id}</span>}
                    <div className="muted">{fmt(c.last_inbound_at || c.created_at)}</div></td>
                  <td>{c.phone}<div>{c.email}</div></td>
                  <td>{c.origin}</td>
                  <td><pre>{(c.last_text || "").slice(0, 160)}</pre>
                    {within24h && <span className="pill on">janela de 24h aberta</span>}</td>
                  <td>
                    {paused ? (
                      <form action={resumeBot}><input type="hidden" name="id" value={c.ig_user_id} />
                        <span className="pill">pausado (humano)</span> <button className="ghost">Reativar</button></form>
                    ) : (
                      <form action={pauseBot}><input type="hidden" name="id" value={c.ig_user_id} />
                        <button className="ghost">Pausar bot</button></form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
