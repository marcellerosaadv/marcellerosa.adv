import { q, getSetting } from "@/lib/db";
import { saveSettings, purgeOldData } from "../actions";

export const dynamic = "force-dynamic";

type L = { id: number; level: string; message: string; detail: unknown; created_at: string };

export default async function Config() {
  const [aviso, refreshed, logs] = await Promise.all([
    getSetting("aviso_privacidade"),
    getSetting("ig_token_refreshed_at"),
    q<L>("SELECT * FROM event_log ORDER BY id DESC LIMIT 50"),
  ]);
  const base = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  return (
    <>
      <div className="card">
        <h2>Conexão</h2>
        <p>URL do webhook para o painel da Meta:{" "}
          <code>{base ? `https://${base}/api/webhook` : "https://SEU-DOMINIO.vercel.app/api/webhook"}</code></p>
        <p>Token do Instagram: {process.env.IG_ACCESS_TOKEN || refreshed ? <span className="on">configurado</span> : <span className="err">ausente</span>}
          {refreshed && <span className="muted"> (renovado em {new Date(refreshed).toLocaleDateString("pt-BR")})</span>}</p>
        <p>Assinatura do webhook: {process.env.META_APP_SECRET ? <span className="on">ativa</span> : <span className="err">META_APP_SECRET ausente</span>}</p>
      </div>

      <div className="card">
        <h2>Aviso de privacidade (LGPD)</h2>
        <p className="muted">Enviado uma única vez, ao final da primeira mensagem automática para cada pessoa.</p>
        <form action={saveSettings}>
          <textarea name="aviso_privacidade" defaultValue={aviso ?? ""}
            placeholder="Seus dados serão usados apenas para o atendimento do seu caso, conforme a LGPD. Política de privacidade: https://..." />
          <div className="row" style={{ marginTop: 8 }}><button>Salvar aviso</button></div>
        </form>
      </div>

      <div className="card">
        <h2>Retenção de dados</h2>
        <p className="muted">Apaga mensagens e contatos sem interação há mais de X dias (mínimo 30).</p>
        <form action={purgeOldData} className="row">
          <input name="days" type="number" min={30} defaultValue={365} style={{ maxWidth: 120 }} />
          <button className="danger">Apagar dados antigos</button>
        </form>
      </div>

      <div className="card">
        <h2>Registro de eventos</h2>
        <div className="scroll"><table>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="muted">{new Date(l.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                <td className={l.level === "erro" ? "err" : ""}>{l.message}</td>
                <td className="muted"><pre>{l.detail ? JSON.stringify(l.detail) : ""}</pre></td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {logs.length === 0 && <p className="muted">Sem eventos.</p>}
      </div>
    </>
  );
}
