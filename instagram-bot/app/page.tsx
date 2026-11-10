import Link from "next/link";
import { q } from "@/lib/db";
import { saveAutomation, toggleAutomation, deleteAutomation } from "./actions";

export const dynamic = "force-dynamic";

type A = {
  id: number; name: string; trigger: "comment" | "dm"; keywords: string; match_mode: string;
  media_id: string | null; dm_text: string; public_reply: string | null; quick_replies: string | null;
  active: boolean; hits: number;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const list = await q<A>("SELECT * FROM automations ORDER BY trigger, id");
  const cur = edit ? list.find((a) => a.id === Number(edit)) : undefined;

  return (
    <>
      <div className="card">
        <h2>Automações</h2>
        {list.length === 0 && <p className="muted">Nenhuma automação ainda. Crie a primeira abaixo.</p>}
        <div className="scroll">
          <table>
            <thead>
              <tr><th>Nome</th><th>Gatilho</th><th>Palavras-chave</th><th>Disparos</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}{a.media_id && <div className="muted">post {a.media_id}</div>}</td>
                  <td><span className="pill">{a.trigger === "comment" ? "Comentário → DM" : "Direct"}</span></td>
                  <td>{a.keywords} <span className="muted">({a.match_mode === "exact" ? "exata" : "contém"})</span></td>
                  <td>{a.hits}</td>
                  <td className={a.active ? "on" : "off"}>{a.active ? "Ativa" : "Pausada"}</td>
                  <td>
                    <div className="row">
                      <Link className="btn" href={`/?edit=${a.id}`}>Editar</Link>
                      <form action={toggleAutomation}><input type="hidden" name="id" value={a.id} />
                        <button className="ghost">{a.active ? "Pausar" : "Ativar"}</button></form>
                      <form action={deleteAutomation}><input type="hidden" name="id" value={a.id} />
                        <button className="danger">Excluir</button></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>{cur ? `Editar: ${cur.name}` : "Nova automação"}</h2>
        <form action={saveAutomation} key={cur?.id ?? "new"}>
          <input type="hidden" name="id" value={cur?.id ?? ""} />
          <div className="grid">
            <div><label>Nome interno</label><input name="name" defaultValue={cur?.name} placeholder="Ex.: Reel reajuste" required /></div>
            <div><label>Gatilho</label>
              <select name="trigger" defaultValue={cur?.trigger ?? "comment"}>
                <option value="comment">Comentário em post/reel → resposta no direct</option>
                <option value="dm">Mensagem no direct</option>
              </select></div>
            <div><label>Palavras-chave (separe por vírgula; * = qualquer)</label>
              <input name="keywords" defaultValue={cur?.keywords} placeholder="PLANO, reajuste" required /></div>
            <div><label>Correspondência</label>
              <select name="match_mode" defaultValue={cur?.match_mode ?? "contains"}>
                <option value="contains">Contém a palavra</option>
                <option value="exact">Texto exato</option>
              </select></div>
            <div><label>ID do post (opcional; vazio = todos)</label>
              <input name="media_id" defaultValue={cur?.media_id ?? ""} placeholder="Ex.: 17890000000000000" /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label>Mensagem enviada no direct</label>
            <textarea name="dm_text" defaultValue={cur?.dm_text} required
              placeholder="Oi! Aqui é a equipe da Marcelle Rosa Advocacia. Para analisarmos o seu caso, me conta: qual o seu plano e o que foi negado?" />
          </div>
          <div className="grid" style={{ marginTop: 12 }}>
            <div><label>Resposta pública no comentário (só gatilho Comentário)</label>
              <input name="public_reply" defaultValue={cur?.public_reply ?? ""} placeholder="Te enviei no direct!" /></div>
            <div><label>Botões de resposta rápida (só Direct; um por linha, até 20 letras)</label>
              <textarea name="quick_replies" defaultValue={cur?.quick_replies ?? ""} placeholder={"Plano de saúde\nSUS\nOutro assunto"} /></div>
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Salvar</button>
            {cur && <Link href="/" className="muted">Cancelar edição</Link>}
          </div>
        </form>
        <p className="muted" style={{ marginTop: 12 }}>
          Dica: o texto de cada botão de resposta rápida volta como mensagem. Crie uma automação de Direct com
          aquele texto como palavra-chave para continuar o fluxo.
        </p>
      </div>
    </>
  );
}
