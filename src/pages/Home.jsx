import { useState, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "../config/firebase";
import { addDoc, collection, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { ORDEM_CATEGORIAS, textoParaCor } from "../utils/categorias";
import { useLista } from "../hooks/useLista";
import { useCatalogo } from "../hooks/useCatalogo";
import { useTema } from "../hooks/useTema";
import CategoriaGrupo from "../components/CategoriaGrupo";
import DetalhesProduto from "../components/DetalhesProduto";
import Menu from "../components/Menu";
import {
  ChevronsUp,
  ChevronsDown,
  ShoppingCart,
  BookOpen,
  ChefHat,
  Search,
  X,
  Plus,
  Menu as MenuIcon,
  ArrowUpDown,
  Check,
} from "lucide-react";
import { isAdmin } from "../config/admins";
import { useSugestoes } from "../hooks/useSugestoes";
import { useReceitas } from "../hooks/useReceitas";
import { useGrupoSubstituicao } from "../hooks/useGrupoSubstituicao";
import { useBackStack } from "../hooks/useBackStack";
import { ReceitaLista } from "../components/receitas/ReceitaLista";
import { ReceitaDetalhe } from "../components/receitas/ReceitaDetalhe";
import { ReceitaFormulario } from "../components/receitas/ReceitaFormulario";
import { ReceitaTexto } from "../components/receitas/ReceitaTexto";
import FiltroCategoria from "../components/FiltroCategoria";
import {
  TIPOGRAFIA,
  FONTE,
  RAIO,
  BOTAO_PRIMARIO,
  BOTAO_SECUNDARIO,
  COR,
} from "../utils/estilos";

function Home({
  usuario,
  listaAtiva,
  todasListas,
  setListaAtiva,
  setTodasListas,
}) {
  const { catalogo, carregando: carregandoCatalogo } = useCatalogo();
  const {
    lista,
    carregando: carregandoLista,
    adicionarItem,
    adicionarItemComprado,
    toggleComprado,
    removerItem,
  } = useLista(listaAtiva, catalogo);
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const { escuro, toggleTema, seguirSistema } = useTema();
  const [aba, setAba] = useState("lista");
  const [busca, setBusca] = useState("");
  const [categoriasFiltro, setCategoriasFiltro] = useState([]);
  const [grupoFiltro, setGrupoFiltro] = useState([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const {
    sugestoes,
    pendentes: sugestoesPendentes,
    aprovar,
    rejeitar,
    atualizar,
    deletar,
  } = useSugestoes(usuario);
  const {
    aprovadas: receitasAprovadas,
    pendentes: receitasPendentes,
    sugerir: sugerirReceita,
    aprovar: aprovarReceita,
    rejeitar: rejeitarReceita,
    deletar: deletarReceita,
    atualizar: atualizarReceita,
  } = useReceitas(usuario);
  const { grupoSubstituicao } = useGrupoSubstituicao();
  const [modoAdmin, setModoAdmin] = useState(false);
  const [sugestaoEditando, setSugestaoEditando] = useState(null); // { id, nome, categoria, subcategoria }
  const [sugestaoNomeFoco, setSugestaoNomeFoco] = useState(false);
  const admin = isAdmin(usuario.email);
  const [telaMenu, setTelaMenu] = useState("menu");
  const [receitaSelecionada, setReceitaSelecionada] = useState(null);
  const [telaReceita, setTelaReceita] = useState("lista"); // "lista" | "detalhe" | "texto" | "formulario"
  const [textoReceita, setTextoReceita] = useState("");
  const [dadosParseados, setDadosParseados] = useState(null);
  const [receitaEditando, setReceitaEditando] = useState(null); // receita pendente sendo editada
  const [ordenacaoReceitas, setOrdenacaoReceitas] = useState("relevancia"); // "relevancia" | "az" | "za"
  const [ordenacaoAberta, setOrdenacaoAberta] = useState(false);

  const { pushBack } = useBackStack();

  const filtrar = (arr) =>
    arr.filter((p) => {
      const buscaOk = p.nome.toLowerCase().includes(busca.toLowerCase());
      const categoriaOk =
        categoriasFiltro.length === 0 || categoriasFiltro.includes(p.categoria);
      const grupoOk =
        grupoFiltro.length === 0 ||
        grupoFiltro.some(
          (g) =>
            (p.grupoSubstituicao ?? []).includes(g) || p.subcategoria === g,
        );
      return buscaOk && categoriaOk && grupoOk;
    });

  const irParaGrupo = (grupo) => {
    const abaAtual = aba;
    pushBack(() => { setAba(abaAtual); setGrupoFiltro([]); });
    setAba("catalogo");
    setBusca("");
    setCategoriasFiltro([]);
    setGrupoFiltro([grupo]);
  };

  const agrupar = (arr) =>
    ORDEM_CATEGORIAS.reduce((acc, cat) => {
      const itens = arr.filter((p) => p.categoria === cat);
      if (itens.length > 0) acc[cat] = itens;
      return acc;
    }, {});

  const pendentes = filtrar(lista.filter((i) => !i.comprado));
  const comprados = filtrar(lista.filter((i) => i.comprado));
  const porCategoriaPendentes = agrupar(pendentes);
  const porCategoriaComprados = agrupar(comprados);
  const catalogoFiltrado = filtrar(catalogo);
  const porCategoriaCatalogo = agrupar(catalogoFiltrado);
  const carregando = carregandoLista || carregandoCatalogo;
  const receitasFiltradas = (() => {
    const idsEmCasa = new Set(lista.filter(i => i.comprado).map(i => i.produtoId));
    const base = receitasAprovadas.filter(r => r.nome.toLowerCase().includes(busca.toLowerCase()));
    if (ordenacaoReceitas === "az") return [...base].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    if (ordenacaoReceitas === "za") return [...base].sort((a, b) => b.nome.localeCompare(a.nome, "pt-BR"));
    // relevancia: receitas com todos os ingredientes em casa primeiro
    return [...base].sort((a, b) => {
      const faltamA = (a.ingredientes ?? []).filter(i => i.produtoId && !idsEmCasa.has(i.produtoId)).length;
      const faltamB = (b.ingredientes ?? []).filter(i => i.produtoId && !idsEmCasa.has(i.produtoId)).length;
      return faltamA - faltamB;
    });
  })();

  const abrirProduto = (item) => {
    const produto = catalogo.find((p) => p.id === item.produtoId);
    if (produto) {
      setProdutoSelecionado({ ...produto, _origemLista: true });
      pushBack(() => setProdutoSelecionado(null));
    }
  };

  const removerItemPorProdutoId = (produto) => {
    const item = lista.find((i) => i.produtoId === produto.id);
    if (item) removerItem(item);
  };

  const deletarProdutoCatalogo = async (produto) => {
    await deleteDoc(doc(db, "catalogo", produto.id));
    setProdutoSelecionado(null);
  };

  const [todasExpandidas, setTodasExpandidas] = useState(true);
  const [todasExpandidasLista, setTodasExpandidasLista] = useState(true);

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: "72px",
        background: "var(--bg)",
      }}
    >
      {admin && modoAdmin && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "100%",
            maxWidth: "480px",
            background: COR.erro,
            padding: "1px 0",
            textAlign: "center",
            ...TIPOGRAFIA.label,
            color: "white",
            zIndex: 50,
            pointerEvents: "none",
          }}
        >
          Modo Edição Ativo
        </div>
      )}
      {/* Header */}
      <div
        style={{
          background: "var(--card)",
          boxShadow: "var(--shadow)",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            padding: "16px 20px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                fontFamily: "Comfortaa, sans-serif",
                fontWeight: 700,
                fontSize: "20px",
              }}
            >
              <span style={{ color: "var(--amarelo)" }}>QueQue</span>
              <span style={{ color: "var(--laranja)" }}>Falta</span>
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{ position: "relative", cursor: "pointer" }}
              onClick={() => { setMenuAberto(true); pushBack(() => { setMenuAberto(false); setTelaMenu("menu"); }); }}
            >
              <MenuIcon size={22} color="var(--text-soft)" />
            </div>
          </div>
        </div>

        {/* Busca */}
        <div style={{ padding: "0 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              background: "var(--bg)",
              borderRadius: RAIO.md,
              padding: "10px 14px",
            }}
          >
            <Search size={18} color="var(--text-soft)" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={
                aba === "lista" ? "Buscar na lista..." : aba === "catalogo" ? "Buscar no catálogo..." : "Buscar receitas..."
              }
              style={{
                border: "none",
                background: "transparent",
                outline: "none",
                fontFamily: "Nunito, sans-serif",
                fontSize: FONTE.base,
                flex: 1,
                color: "var(--text)",
              }}
            />
            {busca && (
              <X
                size={16}
                color="var(--text-soft)"
                style={{ cursor: "pointer" }}
                onClick={() => setBusca("")}
              />
            )}
          </div>
        </div>

        {/* Filtro categorias — lista e catálogo */}
        {aba !== "receitas" && <FiltroCategoria
          categoriasFiltro={grupoFiltro}
          setCategoriasFiltro={setGrupoFiltro}
          categorias={aba === "catalogo"
            ? [...new Set(catalogo.flatMap(p => [...(p.grupoSubstituicao ?? []), ...(p.subcategoria ? [p.subcategoria] : [])]))]
                .filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"))
            : aba === "lista"
            ? [...new Set(lista.flatMap(item => {
                const prod = catalogo.find(p => p.id === item.produtoId) ?? item;
                return [...(prod.grupoSubstituicao ?? []), ...(prod.subcategoria ? [prod.subcategoria] : [])];
              }))].filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"))
            : undefined}
          tituloModal="Filtrar"
          botoesExtras={
            aba === "catalogo" || aba === "lista" ? (
              <button
                onClick={() => aba === "catalogo"
                  ? setTodasExpandidas((e) => !e)
                  : setTodasExpandidasLista((e) => !e)}
                style={{
                  ...BOTAO_SECUNDARIO,
                  padding: "6px 14px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                {(aba === "catalogo" ? todasExpandidas : todasExpandidasLista) ? (
                  <>
                    <ChevronsUp size={14} /> Recolher
                  </>
                ) : (
                  <>
                    <ChevronsDown size={14} /> Expandir
                  </>
                )}
              </button>
            ) : null
          }
        />}

        {/* Ordenação + nova receita — só na listagem de receitas */}
        {aba === "receitas" && telaReceita === "lista" && (
          <div style={{ padding: "0 16px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <button
              onClick={() => { setOrdenacaoAberta(true); pushBack(() => setOrdenacaoAberta(false)); }}
              style={{
                ...BOTAO_SECUNDARIO,
                padding: "6px 14px",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--amarelo)",
                color: "#212529",
                border: "none",
              }}
            >
              <ArrowUpDown size={14} />
              {ordenacaoReceitas === "az" ? "A→Z" : ordenacaoReceitas === "za" ? "Z→A" : "Relevância"}
            </button>
            {admin && (
              <button
                onClick={() => { setTelaReceita("texto"); pushBack(() => setTelaReceita("lista")); }}
                style={{
                  ...BOTAO_SECUNDARIO,
                  padding: "6px 14px",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Plus size={14} /> Nova receita
              </button>
            )}
          </div>
        )}
      </div>

      {/* Aba Lista */}
      {aba === "lista" && (
        <div style={{ padding: "20px 16px" }}>
          {carregando && (
            <p style={{ textAlign: "center", color: "var(--text-soft)" }}>
              Carregando...
            </p>
          )}
          {!carregando &&
            busca &&
            pendentes.length === 0 &&
            comprados.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "60px",
                  padding: "0 20px",
                }}
              >
                <p style={{ fontSize: "48px" }}>🔍</p>
                <p
                  style={{
                    ...TIPOGRAFIA.h2,
                    marginTop: "12px",
                    color: "var(--text)",
                  }}
                >
                  "{busca}" não está na sua lista
                </p>
                <p
                  style={{
                    ...TIPOGRAFIA.corpo,
                    color: "var(--text-soft)",
                    marginTop: "8px",
                    lineHeight: 1.5,
                  }}
                >
                  Quer procurar no Catálogo?
                </p>
                <button
                  onClick={() => { const abaAtual = aba; pushBack(() => setAba(abaAtual)); setAba("catalogo"); }}
                  style={{
                    marginTop: "20px",
                    padding: "14px 24px",
                    ...BOTAO_PRIMARIO,
                    borderRadius: RAIO.md,
                    color: "white",
                    boxShadow: "0 4px 12px #FE5F0133",
                  }}
                >
                  🛍️ Buscar no Catálogo
                </button>
              </div>
            )}
          {Object.entries(porCategoriaPendentes).map(([categoria, itens]) => (
            <CategoriaGrupo
              key={categoria}
              categoria={categoria}
              itens={itens}
              onToggle={toggleComprado}
              onAbrir={abrirProduto}
              busca={busca}
              itensDaLista={lista}
              onRemover={removerItem}
              onFiltrarGrupo={irParaGrupo}
              forcarAberto={todasExpandidasLista}
            />
          ))}
          {comprados.length > 0 && (
            <div
              style={{
                marginTop: pendentes.length > 0 ? "24px" : "0",
                borderTop: pendentes.length > 0 ? `1px dashed ${COR.borda}` : "none",
                paddingTop: pendentes.length > 0 ? "16px" : "0",
              }}
            >
              <CategoriaGrupo
                key="tem-em-casa"
                categoria="Tem em casa"
                itens={comprados}
                onToggle={toggleComprado}
                onAbrir={abrirProduto}
                busca={busca}
                itensDaLista={lista}
                collapsed={true}
                corOverride={COR.neutro}
                onRemover={removerItem}
                onFiltrarGrupo={irParaGrupo}
              />
            </div>
          )}
        </div>
      )}

      {/* Aba Catálogo */}
      {aba === "catalogo" && (
        <div style={{ padding: "20px 16px" }}>
          {/* Pendentes — só visíveis em modo admin */}
          {admin && modoAdmin && sugestoesPendentes.length > 0 && (
            <div style={{ marginBottom: "24px" }}>
              <p style={{ ...TIPOGRAFIA.label, color: "var(--text-soft)", marginBottom: "10px" }}>
                Pendentes ({sugestoesPendentes.length})
              </p>
              {sugestoesPendentes.map((s) => {
                const editando = sugestaoEditando?.id === s.id;
                return (
                  <div
                    key={s.id}
                    style={{
                      opacity: editando ? 1 : 0.5,
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        padding: "12px 16px",
                        background: "var(--card)",
                        borderRadius: RAIO.md,
                        boxShadow: "var(--shadow)",
                        borderLeft: `4px solid ${editando ? "var(--laranja)" : COR.neutro}`,
                      }}
                    >
                      {editando ? (
                        <>
                          {(() => {
                            const termo = sugestaoEditando.nome.toLowerCase().trim();
                            const sugestoes = termo.length >= 2
                              ? catalogo.filter(p => p.nome.toLowerCase().includes(termo)).slice(0, 6)
                              : [];
                            const mostrarDropdown = sugestaoNomeFoco && sugestoes.length > 0;
                            return (
                              <div style={{ position: "relative" }}>
                                <input
                                  value={sugestaoEditando.nome}
                                  onChange={e => setSugestaoEditando(prev => ({ ...prev, nome: e.target.value }))}
                                  onFocus={() => setSugestaoNomeFoco(true)}
                                  onBlur={() => setTimeout(() => setSugestaoNomeFoco(false), 150)}
                                  placeholder="Nome *"
                                  style={{
                                    padding: "8px 12px", borderRadius: RAIO.sm,
                                    border: "1.5px solid var(--borda, #DEE2E6)",
                                    background: "var(--bg)", color: "var(--text)",
                                    fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                    outline: "none", width: "100%", boxSizing: "border-box",
                                  }}
                                />
                                {mostrarDropdown && (
                                  <div style={{
                                    position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
                                    background: "var(--card)", borderRadius: RAIO.md,
                                    border: "1.5px solid var(--borda, #DEE2E6)",
                                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                                    marginTop: "2px", overflow: "hidden",
                                  }}>
                                    {sugestoes.map(p => (
                                      <div
                                        key={p.id}
                                        onMouseDown={() => setSugestaoEditando(prev => ({
                                          ...prev,
                                          nome: p.nome,
                                          categoria: p.categoria ?? prev.categoria,
                                          subcategoria: p.subcategoria ?? prev.subcategoria,
                                        }))}
                                        style={{
                                          padding: "10px 14px", cursor: "pointer",
                                          borderBottom: "1px solid var(--borda, #DEE2E6)",
                                          fontFamily: "Nunito, sans-serif",
                                        }}
                                      >
                                        <p style={{ fontSize: FONTE.sm, color: "var(--text)", margin: 0 }}>{p.nome}</p>
                                        <p style={{ fontSize: FONTE.xs, color: "var(--text-soft)", margin: "2px 0 0" }}>
                                          {p.categoria}{p.subcategoria ? ` · ${p.subcategoria}` : ""} · já no catálogo
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          <select
                            value={sugestaoEditando.categoria}
                            onChange={e => setSugestaoEditando(prev => ({ ...prev, categoria: e.target.value, subcategoria: "" }))}
                            style={{
                              padding: "8px 12px", borderRadius: RAIO.sm,
                              border: "1.5px solid var(--borda, #DEE2E6)",
                              background: "var(--bg)", color: sugestaoEditando.categoria ? "var(--text)" : "var(--text-soft)",
                              fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                              outline: "none", width: "100%", boxSizing: "border-box",
                            }}
                          >
                            <option value="">Categoria *</option>
                            {[...ORDEM_CATEGORIAS].sort((a, b) => a.localeCompare(b, "pt-BR")).map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          {(() => {
                            const subcats = [...new Set(
                              catalogo
                                .filter(p => p.categoria === sugestaoEditando.categoria && p.subcategoria)
                                .map(p => p.subcategoria)
                            )].sort((a, b) => a.localeCompare(b, "pt-BR"));
                            return (
                              <select
                                value={sugestaoEditando.subcategoria}
                                onChange={e => setSugestaoEditando(prev => ({ ...prev, subcategoria: e.target.value }))}
                                disabled={!sugestaoEditando.categoria}
                                style={{
                                  padding: "8px 12px", borderRadius: RAIO.sm,
                                  border: "1.5px solid var(--borda, #DEE2E6)",
                                  background: "var(--bg)", color: sugestaoEditando.subcategoria ? "var(--text)" : "var(--text-soft)",
                                  fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                  outline: "none", width: "100%", boxSizing: "border-box",
                                  opacity: !sugestaoEditando.categoria ? 0.5 : 1,
                                }}
                              >
                                <option value="">Subcategoria *</option>
                                {subcats.map(sc => (
                                  <option key={sc} value={sc}>{sc}</option>
                                ))}
                              </select>
                            );
                          })()}
                          <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              onClick={() => setSugestaoEditando(null)}
                              style={{
                                padding: "6px 12px", borderRadius: RAIO.sm, border: "none",
                                background: "var(--bg)", color: "var(--text-soft)",
                                fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                fontWeight: FONTE.bold, cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={async () => {
                                await atualizar(s, {
                                  nome: sugestaoEditando.nome.trim(),
                                  categoria: sugestaoEditando.categoria,
                                  subcategoria: sugestaoEditando.subcategoria,
                                });
                                setSugestaoEditando(null);
                              }}
                              disabled={!sugestaoEditando.nome.trim() || !sugestaoEditando.categoria || !sugestaoEditando.subcategoria}
                              style={{
                                padding: "6px 12px", borderRadius: RAIO.sm, border: "none",
                                background: COR.sucessoBg, color: COR.sucesso,
                                fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                fontWeight: FONTE.bold, cursor: "pointer",
                                opacity: (!sugestaoEditando.nome.trim() || !sugestaoEditando.categoria || !sugestaoEditando.subcategoria) ? 0.5 : 1,
                              }}
                            >
                              Salvar
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ ...TIPOGRAFIA.nomeProduto, color: "var(--text)" }}>{s.nome}</p>
                            <p style={{ ...TIPOGRAFIA.subcategoria, color: "var(--text-soft)", marginTop: "2px" }}>
                              {s.categoria}{s.subcategoria ? ` · ${s.subcategoria}` : ""}
                            </p>
                          </div>
                          <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                            <button
                              onClick={() => setSugestaoEditando({ id: s.id, nome: s.nome, categoria: s.categoria ?? "", subcategoria: s.subcategoria ?? "" })}
                              style={{
                                padding: "6px 12px", borderRadius: RAIO.sm, border: "none",
                                background: "var(--bg)", color: "var(--text-soft)",
                                fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                fontWeight: FONTE.bold, cursor: "pointer",
                              }}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => !jaAprovou && s.categoria && aprovar(s)}
                              disabled={jaAprovou || !s.categoria}
                              style={{
                                padding: "6px 12px", borderRadius: RAIO.sm, border: "none",
                                background: jaAprovou || !s.categoria ? COR.borda : COR.sucessoBg,
                                color: jaAprovou || !s.categoria ? COR.neutro : COR.sucesso,
                                fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                fontWeight: FONTE.bold, cursor: jaAprovou || !s.categoria ? "default" : "pointer",
                              }}
                              title={!s.categoria ? "Defina uma categoria antes de aprovar" : undefined}
                            >
                              {jaAprovou ? "Aprovado" : "Aprovar"}
                            </button>
                            <button
                              onClick={() => rejeitar(s)}
                              style={{
                                padding: "6px 12px", borderRadius: RAIO.sm, border: "none",
                                background: COR.erroBg, color: COR.erro,
                                fontFamily: "Nunito, sans-serif", fontSize: FONTE.sm,
                                fontWeight: FONTE.bold, cursor: "pointer",
                              }}
                            >
                              Rejeitar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {carregando && (
            <p style={{ textAlign: "center", color: "var(--text-soft)" }}>
              Carregando...
            </p>
          )}
          {!carregando && catalogoFiltrado.length === 0 && (
            <div
              style={{
                textAlign: "center",
                marginTop: "60px",
                padding: "0 20px",
              }}
            >
              <p style={{ fontSize: "48px" }}>🔍</p>
              <p
                style={{
                  ...TIPOGRAFIA.h2,
                  marginTop: "12px",
                  color: "var(--text)",
                }}
              >
                Não encontramos "{busca}"
              </p>
              <p
                style={{
                  ...TIPOGRAFIA.corpo,
                  color: "var(--text-soft)",
                  marginTop: "8px",
                  lineHeight: 1.5,
                }}
              >
                Esse produto ainda não está no catálogo.
              </p>
              <button
                onClick={() => {
                  setMenuAberto(true);
                  setTelaMenu("sugestao");
                  pushBack(() => { setMenuAberto(false); setTelaMenu("menu"); });
                }}
                style={{
                  marginTop: "20px",
                  padding: "14px 24px",
                  ...BOTAO_PRIMARIO,
                  borderRadius: RAIO.md,
                  color: "white",
                  boxShadow: "0 4px 12px #FE5F0133",
                }}
              >
                💡 Sugerir produto
              </button>
            </div>
          )}
          {Object.entries(porCategoriaCatalogo).map(([categoria, itens]) => (
            <CategoriaGrupo
              key={categoria}
              categoria={categoria}
              itens={itens}
              onToggle={adicionarItem}
              onAbrir={(p) => { setProdutoSelecionado(p); pushBack(() => setProdutoSelecionado(null)); }}
              busca={busca}
              itensDaLista={lista}
              contexto="catalogo"
              onRemover={removerItemPorProdutoId}
              forcarAberto={todasExpandidas}
              onFiltrarGrupo={irParaGrupo}
            />
          ))}
        </div>
      )}

      {/* Aba Receitas */}
      {aba === "receitas" && (
        <div style={{ padding: "20px 16px 96px" }}>
          {admin && modoAdmin && receitasPendentes.length > 0 && telaReceita === "lista" && (
            <div style={{ marginBottom: "24px" }}>
              <p style={{ ...TIPOGRAFIA.label, color: "var(--text-soft)", marginBottom: "10px" }}>
                Pendentes ({receitasPendentes.length})
              </p>
              {receitasPendentes.map((r) => {
                const temIngredienteTemp = r.ingredientes?.some((ing) => ing.nomeTemp);
                return (
                  <div
                    key={r.id}
                    style={{
                      opacity: 0.6,
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px 16px",
                        background: "var(--card)",
                        borderRadius: RAIO.md,
                        boxShadow: "var(--shadow)",
                        borderLeft: `4px solid ${COR.neutro}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ ...TIPOGRAFIA.nomeProduto, color: "var(--text)" }}>{r.nome}</p>
                        {temIngredienteTemp && (
                          <p style={{ ...TIPOGRAFIA.subcategoria, color: "var(--laranja)", marginTop: "2px" }}>
                            ⚠ Ingredientes não catalogados
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setReceitaEditando(r);
                            setDadosParseados(r);
                            setTelaReceita("formulario");
                          }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: RAIO.sm,
                            border: "none",
                            background: "var(--bg)",
                            color: "var(--text-soft)",
                            fontFamily: "Nunito, sans-serif",
                            fontSize: FONTE.sm,
                            fontWeight: FONTE.bold,
                            cursor: "pointer",
                          }}
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => !temIngredienteTemp && aprovarReceita(r)}
                          disabled={temIngredienteTemp}
                          style={{
                            padding: "6px 12px",
                            borderRadius: RAIO.sm,
                            border: "none",
                            background: temIngredienteTemp ? COR.borda : COR.sucessoBg,
                            color: temIngredienteTemp ? COR.neutro : COR.sucesso,
                            fontFamily: "Nunito, sans-serif",
                            fontSize: FONTE.sm,
                            fontWeight: FONTE.bold,
                            cursor: temIngredienteTemp ? "not-allowed" : "pointer",
                            opacity: temIngredienteTemp ? 0.6 : 1,
                          }}
                        >
                          Aprovar
                        </button>
                        <button
                          onClick={() => rejeitarReceita(r)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: RAIO.sm,
                            border: "none",
                            background: COR.erroBg,
                            color: COR.erro,
                            fontFamily: "Nunito, sans-serif",
                            fontSize: FONTE.sm,
                            fontWeight: FONTE.bold,
                            cursor: "pointer",
                          }}
                        >
                          Rejeitar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {telaReceita === "lista" && (
            <ReceitaLista
              receitas={receitasFiltradas}
              itensEmCasa={lista.filter(i => i.comprado)}
              onVerReceita={(r) => { setReceitaSelecionada(r); setTelaReceita("detalhe"); pushBack(() => { setReceitaSelecionada(null); setTelaReceita("lista"); }); }}
            />
          )}
          {telaReceita === "detalhe" && receitaSelecionada && (
            <ReceitaDetalhe
              receita={receitaSelecionada}
              itensEmCasa={lista.filter(i => i.comprado)}
              catalogo={catalogo}
              isAdmin={admin}
              onEditar={() => {
                setReceitaEditando(receitaSelecionada);
                setDadosParseados(receitaSelecionada);
                setReceitaSelecionada(null);
                setTelaReceita("formulario");
                pushBack(() => { setReceitaEditando(null); setTelaReceita("lista"); });
              }}
              onVoltar={() => { setReceitaSelecionada(null); setTelaReceita("lista"); }}
              onToggleEmCasa={async (ing) => {
                const produto = catalogo.find(p => p.id === ing.produtoId);
                if (!produto) return;
                const itemNaLista = lista.find(i => i.produtoId === ing.produtoId);
                if (itemNaLista) {
                  await toggleComprado(itemNaLista);
                } else {
                  await adicionarItemComprado(produto);
                }
              }}
              onAdicionarFaltantes={async (faltantes) => {
                for (const ing of faltantes) {
                  const produto = catalogo.find(p => p.id === ing.produtoId);
                  if (produto) await adicionarItem(produto);
                }
                setReceitaSelecionada(null);
                setTelaReceita("lista");
                const abaAntesFaltantes = aba;
                pushBack(() => setAba(abaAntesFaltantes));
                setAba("lista");
              }}
              onBuscarIngrediente={(nome) => {
                setReceitaSelecionada(null);
                setTelaReceita("lista");
                const abaAntesIngrediente = aba;
                pushBack(() => setAba(abaAntesIngrediente));
                setAba("catalogo");
                setBusca(nome);
                setGrupoFiltro([]);
                setCategoriasFiltro([]);
              }}
            />
          )}
          {telaReceita === "texto" && (
            <ReceitaTexto
              textoInicial={textoReceita}
              catalogo={catalogo}
              grupoSubstituicao={grupoSubstituicao}
              onVoltar={() => setTelaReceita("lista")}
              onContinuar={(texto, dados) => {
                setTextoReceita(texto);
                setDadosParseados(dados);
                setTelaReceita("formulario");
                pushBack(() => setTelaReceita("texto"));
              }}
            />
          )}
          {telaReceita === "formulario" && (
            <ReceitaFormulario
              catalogo={catalogo}
              grupoSubstituicao={grupoSubstituicao}
              isAdmin={admin && modoAdmin}
              dadosIniciais={dadosParseados}
              textoOriginal={receitaEditando ? null : textoReceita}
              onVoltarTexto={receitaEditando ? null : (texto) => {
                setTextoReceita(texto);
                setTelaReceita("texto");
              }}
              onVoltar={() => { setTextoReceita(""); setDadosParseados(null); setReceitaEditando(null); setTelaReceita("lista"); }}
              onEnviar={async (dados) => {
                if (receitaEditando) {
                  await atualizarReceita(receitaEditando, dados);
                } else {
                  await sugerirReceita(dados);
                }
              }}
              onSugerirIngrediente={async (nome) => {
                await addDoc(collection(db, "sugestoes"), {
                  nome,
                  categoria: "",
                  subcategoria: "",
                  sugeridoPor: usuario.email,
                  listaAtiva,
                  criadoEm: serverTimestamp(),
                  status: "pendente",
                });
              }}
            />
          )}
        </div>
      )}

      {/* Modal detalhes */}
      {produtoSelecionado && (
        <DetalhesProduto
          produto={
            catalogo.find((p) => p.id === produtoSelecionado.id) ||
            produtoSelecionado
          }
          onFechar={() => setProdutoSelecionado(null)}
          listaAtiva={listaAtiva}
          itemDaLista={lista.find((i) => i.produtoId === produtoSelecionado.id)}
          catalogo={catalogo}
          isAdmin={admin && modoAdmin}
          origemLista={!!produtoSelecionado._origemLista}
          onDeletar={admin && modoAdmin ? deletarProdutoCatalogo : undefined}
        />
      )}

      {/* Menu */}
      {menuAberto && (
        <Menu
          onFechar={() => {
            setMenuAberto(false);
            setTelaMenu("menu");
          }}
          escuro={escuro}
          toggleTema={toggleTema}
          seguirSistema={seguirSistema}
          listaAtiva={listaAtiva}
          todasListas={todasListas}
          setListaAtiva={setListaAtiva}
          setTodasListas={setTodasListas}
          usuario={usuario}
          isAdmin={admin}
          modoAdmin={modoAdmin}
          setModoAdmin={setModoAdmin}
          telaInicial={telaMenu}
          catalogo={catalogo}
        />
      )}

      {/* Navegação inferior */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "480px",
          background: "var(--card)",
          borderTop: `1px solid ${COR.divisoria}`,
          display: "flex",
          zIndex: 20,
        }}
      >
        {[
          { id: "lista", label: "Lista de compras", icon: ShoppingCart, badge: 0 },
          { id: "catalogo", label: "Catálogo", icon: BookOpen, badge: admin && modoAdmin ? sugestoesPendentes.length : 0 },
          { id: "receitas", label: "Receitas", icon: ChefHat, badge: admin && modoAdmin ? receitasPendentes.length : 0 },
        ].map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => {
              if (id !== aba) {
                const abaAtual = aba;
                pushBack(() => {
                  setAba(abaAtual);
                  setBusca("");
                  setCategoriasFiltro([]);
                  setGrupoFiltro([]);
                  if (abaAtual !== "receitas") { setTelaReceita("lista"); setReceitaSelecionada(null); }
                });
              }
              setAba(id);
              setBusca("");
              setCategoriasFiltro([]);
              setGrupoFiltro([]);
              if (id !== "receitas") { setTelaReceita("lista"); setReceitaSelecionada(null); }
            }}
            style={{
              flex: 1,
              padding: "12px 0",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              color: aba === id ? "var(--laranja)" : "var(--text-soft)",
              fontFamily: "Nunito, sans-serif",
              ...(aba === id ? TIPOGRAFIA.aba : TIPOGRAFIA.abaInativa),
              transition: "all 0.2s",
              borderTop:
                aba === id ? "2px solid var(--amarelo)" : "2px solid transparent",
            }}
          >
            <div style={{ position: "relative" }}>
              <Icon size={20} />
              {badge > 0 && (
                <div style={{
                  position: "absolute",
                  top: "-6px",
                  right: "-8px",
                  background: "var(--amarelo)",
                  color: "var(--text)",
                  borderRadius: RAIO.full,
                  width: "16px",
                  height: "16px",
                  fontSize: FONTE.xs,
                  fontWeight: FONTE.extrabold,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {badge}
                </div>
              )}
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Bottom sheet ordenação receitas */}
      {ordenacaoAberta && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end", background: "rgba(0,0,0,0.4)" }}
          onClick={() => setOrdenacaoAberta(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--card)", borderRadius: `${RAIO.xxl} ${RAIO.xxl} 0 0`, padding: "24px 20px 48px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <h2 style={{ ...TIPOGRAFIA.h2, color: "var(--text)" }}>Ordenar</h2>
              <X size={20} color="var(--text-soft)" style={{ cursor: "pointer" }} onClick={() => setOrdenacaoAberta(false)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[
                { id: "relevancia", label: "Relevância", descricao: "Receitas com mais ingredientes em casa primeiro" },
                { id: "az", label: "A → Z", descricao: "Ordem alfabética crescente" },
                { id: "za", label: "Z → A", descricao: "Ordem alfabética decrescente" },
              ].map(op => (
                <div
                  key={op.id}
                  onClick={() => { setOrdenacaoReceitas(op.id); setOrdenacaoAberta(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "14px 16px", borderRadius: RAIO.md,
                    background: ordenacaoReceitas === op.id ? "var(--amarelo)11" : "var(--bg)",
                    border: `1.5px solid ${ordenacaoReceitas === op.id ? "var(--amarelo)" : "transparent"}`,
                    cursor: "pointer",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ ...TIPOGRAFIA.nomeProduto, color: "var(--text)" }}>{op.label}</p>
                    <p style={{ ...TIPOGRAFIA.subcategoria, color: "var(--text-soft)", marginTop: "2px" }}>{op.descricao}</p>
                  </div>
                  {ordenacaoReceitas === op.id && <Check size={16} color="var(--laranja)" strokeWidth={3} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Home;
