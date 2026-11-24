let sessaoAtual = null;
let blocos = [];
let proximoIdBloco = 1;

const raiz = document.getElementById("app");

function formatarBRL(valor) {
  const numero = Number(valor) || 0;
  return numero.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dataHoraBrasil() {
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(agora);
  const obter = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${obter("day")}/${obter("month")}/${obter("year")} ${obter("hour")}:${obter("minute")}:${obter("second")}`;
}

function dataParaTextoBR(valorInputDate) {
  if (!valorInputDate) return "";
  const [ano, mes, dia] = valorInputDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

async function chamarBackend(dados) {
  const resposta = await fetch(CONFIG.URL_BACKEND, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(dados),
  });
  if (!resposta.ok) throw new Error("Servidor respondeu com erro.");
  return resposta.json();
}

function estaOnline() {
  return navigator.onLine;
}

function renderLogin(mensagemErro) {
  raiz.innerHTML = `
    <div class="tela-centralizada">
      <h2>🔒 Acesso restrito</h2>
      <p class="ajuda">Digite sua senha pessoal para entrar.</p>
      <form id="form-login">
        <input type="password" id="campo-senha" placeholder="Senha" autofocus required />
        <button type="submit" class="botao-primario">Entrar</button>
      </form>
      ${mensagemErro ? `<p class="erro">${mensagemErro}</p>` : ""}
      <p class="ajuda-rodape">${estaOnline() ? "" : "⚠️ Sem internet agora — funciona se você já entrou neste aparelho antes."}</p>
    </div>
  `;

  document.getElementById("form-login").addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const senha = document.getElementById("campo-senha").value;
    await tentarLogin(senha);
  });
}

async function tentarLogin(senha) {

  if (estaOnline()) {
    try {
      const resultado = await chamarBackend({ action: "login", senha });
      if (!resultado.ok) {
        renderLogin(resultado.erro || "Senha incorreta.");
        return;
      }
      sessaoAtual = { fiscal: resultado.fiscal, senha, contratos: resultado.contratos };
      await salvarSessao(sessaoAtual);
      iniciarTelaFormulario();
      return;
    } catch (erro) {
    }
  }

  const sessaoSalva = await obterSessao();
  if (sessaoSalva && sessaoSalva.senha === senha) {
    sessaoAtual = sessaoSalva;
    iniciarTelaFormulario();
  } else {
    renderLogin("Sem internet e não encontrei um login salvo com essa senha neste aparelho.");
  }
}

function iniciarTelaFormulario() {
  blocos = [{ id: proximoIdBloco++, contrato: "", torre: "" }];
  renderFormulario();
  atualizarContadorPendencias();
}

function opcoesDeContrato() {
  const nomes = sessaoAtual.contratos.map((c) => c.contrato);
  if (CONFIG.FISCAIS_INSTALACOES.includes(sessaoAtual.fiscal)) {
    nomes.push("Instalações");
  }
  nomes.push("Não há atualização");
  return nomes;
}

function abaOrigemDoContrato(nomeContrato) {
  const achado = sessaoAtual.contratos.find((c) => c.contrato === nomeContrato);
  return achado ? achado.aba : "";
}

function renderFormulario() {
  const opcoes = opcoesDeContrato();

  raiz.innerHTML = `
    <div class="cabecalho">
      <div>
        <h1>🏗️ Atualização Semanal de Contratos</h1>
        <p class="ajuda">Olá, <strong>${sessaoAtual.fiscal}</strong>. Preencha um ou mais contratos.</p>
      </div>
      <button id="botao-sair" class="botao-link" title="Encerrar sessão">Sair</button>
    </div>

    <div id="aviso-pendencias" class="aviso-pendencias" hidden></div>

    <div id="lista-blocos"></div>

    <button id="botao-adicionar" class="botao-secundario">➕ Adicionar outro contrato</button>
    <hr />
    <button id="botao-enviar" class="botao-primario botao-grande">✅ Enviar tudo</button>
    <p id="mensagem-envio" class="ajuda"></p>
  `;

  document.getElementById("botao-sair").addEventListener("click", async () => {
    sessaoAtual = null;
    await limparSessao();
    renderLogin();
  });
  document.getElementById("botao-adicionar").addEventListener("click", () => {
    blocos.push({ id: proximoIdBloco++, contrato: "", torre: "" });
    renderBlocos();
  });
  document.getElementById("botao-enviar").addEventListener("click", enviarTudo);

  renderBlocos();
  atualizarContadorPendencias();
}

function renderBlocos() {
  const container = document.getElementById("lista-blocos");
  const opcoes = opcoesDeContrato();

  container.innerHTML = blocos.map((bloco, indice) => `
    <div class="cartao" data-bloco="${bloco.id}">
      <div class="cartao-topo">
        <strong>Contrato #${indice + 1}</strong>
        ${blocos.length > 1 ? `<button class="botao-remover" data-remover="${bloco.id}">🗑️</button>` : ""}
      </div>

      <label>Contrato</label>
      <select data-campo="contrato" data-bloco-campo="${bloco.id}">
        <option value="" ${!bloco.contrato ? "selected" : ""} disabled>Selecione...</option>
        ${opcoes.map((op) => `<option value="${op}" ${bloco.contrato === op ? "selected" : ""}>${op}</option>`).join("")}
      </select>

      <label>Torre/Bloco</label>
      <input type="text" placeholder="Ex: Torre A" data-campo="torre" data-bloco-campo="${bloco.id}" value="${bloco.torre || ""}" />
      ${CONFIG.ABAS_QUE_AVISAM_TORRE.includes(abaOrigemDoContrato(bloco.contrato)) ? '<p class="ajuda">⚠️ Informe a torre ou bloco</p>' : ""}

      <div class="corpo-bloco" data-corpo="${bloco.id}"></div>
    </div>
  `).join("");

  blocos.forEach((bloco) => renderCorpoDoBloco(bloco));

  container.querySelectorAll("[data-bloco-campo]").forEach((elemento) => {
    elemento.addEventListener("input", () => {
      const bloco = blocos.find((b) => b.id == elemento.dataset.blocoCampo);
      bloco[elemento.dataset.campo] = elemento.value;
      if (elemento.dataset.campo === "contrato") renderBlocos();
    });
  });

  container.querySelectorAll("[data-remover]").forEach((botao) => {
    botao.addEventListener("click", () => {
      blocos = blocos.filter((b) => b.id != botao.dataset.remover);
      renderBlocos();
    });
  });
}

function renderCorpoDoBloco(bloco) {
  const alvo = document.querySelector(`[data-corpo="${bloco.id}"]`);
  if (!alvo) return;

  if (bloco.contrato === "Não há atualização") {
    alvo.innerHTML = `
      <label>Situação da Obra</label>
      <select data-campo="situacao" data-bloco-campo="${bloco.id}">
        ${CONFIG.SITUACOES_OBRA.map((s) => `<option ${bloco.situacao === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>
      <label>Observações (opcional)</label>
      <textarea data-campo="observacoes" data-bloco-campo="${bloco.id}" placeholder="Pode explicar o motivo, se quiser...">${bloco.observacoes || ""}</textarea>
    `;
  } else if (bloco.contrato === "Instalações") {
    alvo.innerHTML = `
      <label>Etapa</label>
      <select data-campo="etapa" data-bloco-campo="${bloco.id}">
        ${CONFIG.ETAPAS.map((l) => `<option ${bloco.etapa === l ? "selected" : ""}>${l}</option>`).join("")}
      </select>
      ${blocoEletricaOuHidraulica(bloco, "Elétrica", "eletrica")}
      <hr />
      ${blocoEletricaOuHidraulica(bloco, "Hidráulica", "hidraulica")}
    `;
  } else if (bloco.contrato) {
    alvo.innerHTML = `
      <div class="duas-colunas">
        <div>
          <label>Valor Executado (R$)</label>
          <input type="number" min="0" step="0.01" data-campo="valor" data-bloco-campo="${bloco.id}" value="${bloco.valor || ""}" />
          <p class="ajuda">Valor executado na semana</p>
          <p class="ajuda" data-previa="valor">R$ ${formatarBRL(bloco.valor)}</p>
        </div>
        <div>
          <label>Área Executada (m²)</label>
          <input type="number" min="0" step="0.01" data-campo="area" data-bloco-campo="${bloco.id}" value="${bloco.area || ""}" />
        </div>
      </div>
      <label>Situação da Obra</label>
      <select data-campo="situacao" data-bloco-campo="${bloco.id}">
        ${CONFIG.SITUACOES_OBRA.map((s) => `<option ${bloco.situacao === s ? "selected" : ""}>${s}</option>`).join("")}
      </select>
      <label>Pavimentos Concluídos</label>
      <input type="number" min="0" step="1" data-campo="pavimentos" data-bloco-campo="${bloco.id}" value="${bloco.pavimentos || ""}" />
      <label>Observações</label>
      <textarea data-campo="observacoes" data-bloco-campo="${bloco.id}" placeholder="Alguma observação sobre o andamento do contrato...">${bloco.observacoes || ""}</textarea>
    `;
  } else {
    alvo.innerHTML = "";
  }

  alvo.querySelectorAll("[data-bloco-campo]").forEach((elemento) => {
    elemento.addEventListener("input", () => {
      const campo = elemento.dataset.campo;
      bloco[campo] = elemento.value;
      const previa = alvo.querySelector(`[data-previa="${campo}"]`);
      if (previa) previa.textContent = `R$ ${formatarBRL(elemento.value)}`;
    });
  });
}

function blocoEletricaOuHidraulica(bloco, rotulo, prefixo) {
  return `
    <p><strong>${rotulo}</strong></p>
    <div class="duas-colunas">
      <div>
        <label>Investimento (R$)</label>
        <input type="number" min="0" step="0.01" data-campo="${prefixo}Investimento" data-bloco-campo="${bloco.id}" value="${bloco[prefixo + "Investimento"] || ""}" />
        <p class="ajuda" data-previa="${prefixo}Investimento">R$ ${formatarBRL(bloco[prefixo + "Investimento"])}</p>
      </div>
      <div>
        <label>Área Executada (m²)</label>
        <input type="number" min="0" step="0.01" data-campo="${prefixo}Area" data-bloco-campo="${bloco.id}" value="${bloco[prefixo + "Area"] || ""}" />
      </div>
    </div>
    <label>Pavimentos Concluídos</label>
    <input type="number" min="0" step="1" data-campo="${prefixo}Pavimentos" data-bloco-campo="${bloco.id}" value="${bloco[prefixo + "Pavimentos"] || ""}" />
    <label>Conclusão da Obra</label>
    <input type="text" placeholder="Ex: Concluído" data-campo="${prefixo}Conclusao" data-bloco-campo="${bloco.id}" value="${bloco[prefixo + "Conclusao"] || ""}" />
    <label>Data de Conclusão</label>
    <input type="date" data-campo="${prefixo}Data" data-bloco-campo="${bloco.id}" value="${bloco[prefixo + "Data"] || ""}" />
  `;
}

function montarLinhasParaEnvio() {
  const normais = [];
  const instalacoes = [];
  const agora = dataHoraBrasil();

  blocos.forEach((bloco) => {
    if (!bloco.contrato) return;
    const aba = abaOrigemDoContrato(bloco.contrato);

    if (bloco.contrato === "Não há atualização") {
      normais.push([
        agora, sessaoAtual.fiscal, aba, bloco.contrato, (bloco.torre || "").trim(),
        bloco.situacao && bloco.situacao !== "Selecione..." ? bloco.situacao : "",
        "", "", "", bloco.observacoes || "",
      ]);
    } else if (bloco.contrato === "Instalações") {
      instalacoes.push([
        agora, sessaoAtual.fiscal,
        bloco.etapa && bloco.etapa !== "Selecione..." ? bloco.etapa : "",
        (bloco.torre || "").trim(),
        formatarBRL(bloco.eletricaInvestimento), bloco.eletricaArea || 0, bloco.eletricaPavimentos || 0,
        bloco.eletricaConclusao || "", dataParaTextoBR(bloco.eletricaData),
        formatarBRL(bloco.hidraulicaInvestimento), bloco.hidraulicaArea || 0, bloco.hidraulicaPavimentos || 0,
        bloco.hidraulicaConclusao || "", dataParaTextoBR(bloco.hidraulicaData),
      ]);
    } else {
      normais.push([
        agora, sessaoAtual.fiscal, aba, bloco.contrato, (bloco.torre || "").trim(),
        bloco.situacao && bloco.situacao !== "Selecione..." ? bloco.situacao : "",
        formatarBRL(bloco.valor), bloco.area || 0, bloco.pavimentos || 0, bloco.observacoes || "",
      ]);
    }
  });

  return { normais, instalacoes };
}

async function enviarTudo() {
  const { normais, instalacoes } = montarLinhasParaEnvio();
  if (normais.length === 0 && instalacoes.length === 0) {
    document.getElementById("mensagem-envio").textContent = "Preencha ao menos um contrato antes de enviar.";
    return;
  }

  for (const linha of normais) await adicionarPendencia({ tipo: "normal", linha });
  for (const linha of instalacoes) await adicionarPendencia({ tipo: "instalacoes", linha });

  blocos = [{ id: proximoIdBloco++, contrato: "", torre: "" }];
  await sincronizar();
  renderFormulario();
}

async function sincronizar() {
  if (!estaOnline()) {
    await atualizarContadorPendencias();
    return;
  }

  const pendencias = await listarPendencias();
  if (pendencias.length === 0) {
    await atualizarContadorPendencias();
    return;
  }

  const respostasNormais = pendencias.filter((p) => p.tipo === "normal").map((p) => p.linha);
  const respostasInstalacoes = pendencias.filter((p) => p.tipo === "instalacoes").map((p) => p.linha);

  try {
    const resultado = await chamarBackend({
      action: "sincronizar",
      fiscal: sessaoAtual.fiscal,
      senha: sessaoAtual.senha,
      respostasNormais,
      respostasInstalacoes,
    });
    if (resultado.ok) {
      await removerPendencias(pendencias.map((p) => p.id));
      const msg = document.getElementById("mensagem-envio");
      if (msg) msg.textContent = "✅ Enviado com sucesso!";
    }
  } catch (erro) {

  }
  await atualizarContadorPendencias();
}

async function atualizarContadorPendencias() {
  const aviso = document.getElementById("aviso-pendencias");
  if (!aviso) return;
  const pendencias = await listarPendencias();
  if (pendencias.length === 0) {
    aviso.hidden = true;
    return;
  }
  aviso.hidden = false;
  aviso.innerHTML = `
    📶 ${pendencias.length} lançamento(s) aguardando internet para enviar.
    <button id="botao-sincronizar">Sincronizar agora</button>
  `;
  const botao = document.getElementById("botao-sincronizar");
  if (botao) botao.addEventListener("click", sincronizar);
}

window.addEventListener("online", () => { if (sessaoAtual) sincronizar(); });

(async function iniciar() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  const sessaoSalva = await obterSessao();
  if (sessaoSalva) {
    sessaoAtual = sessaoSalva;
    iniciarTelaFormulario();
    if (estaOnline()) sincronizar();
  } else {
    renderLogin();
  }
})();
