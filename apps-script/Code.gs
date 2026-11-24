var ABA_SENHAS = "Senhas";
var ABA_CONTRATOS = "Lista de Contratos";
var ABA_RESPOSTAS = "Respostas";
var ABA_INSTALACOES = "Instalações";

var CABECALHO_RESPOSTAS = [
  "Data/Hora", "Fiscal", "Aba de Origem", "Contrato", "Torre/Bloco",
  "Situação da Obra", "Valor Executado", "Área Executada (m²)",
  "Pavimentos Concluídos", "Observações"
];

var CABECALHO_INSTALACOES = [
  "Data/Hora", "Fiscal", "Etapa", "Torre/Bloco",
  "Elétrica - Investimento", "Elétrica - Área Executada (m²)",
  "Elétrica - Pavimentos Concluídos", "Elétrica - Conclusão da Obra",
  "Elétrica - Data de Conclusão",
  "Hidráulica - Investimento", "Hidráulica - Área Executada (m²)",
  "Hidráulica - Pavimentos Concluídos", "Hidráulica - Conclusão da Obra",
  "Hidráulica - Data de Conclusão"
];

function doPost(e) {
  var resposta;
  try {
    var pedido = JSON.parse(e.postData.contents);

    if (pedido.action === "login") {
      resposta = acaoLogin(pedido.senha);
    } else if (pedido.action === "sincronizar") {
      resposta = acaoSincronizar(pedido);
    } else {
      resposta = { ok: false, erro: "Ação desconhecida." };
    }
  } catch (erro) {
    resposta = { ok: false, erro: "Erro no servidor: " + erro.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(resposta))
    .setMimeType(ContentService.MimeType.JSON);
}

function acaoLogin(senhaDigitada) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var abaSenhas = planilha.getSheetByName(ABA_SENHAS);
  if (!abaSenhas) {
    return { ok: false, erro: 'Aba "Senhas" não encontrada. Veja o README.' };
  }

  var linhas = abaSenhas.getDataRange().getValues();
  var fiscalEncontrado = null;
  for (var i = 1; i < linhas.length; i++) {
    var fiscal = String(linhas[i][0]).trim();
    var senha = String(linhas[i][1]).trim();
    if (fiscal && senha === senhaDigitada) {
      fiscalEncontrado = fiscal;
      break;
    }
  }

  if (!fiscalEncontrado) {
    return { ok: false, erro: "Senha incorreta." };
  }

  return {
    ok: true,
    fiscal: fiscalEncontrado,
    contratos: obterContratosDoFiscal(fiscalEncontrado)
  };
}

function obterContratosDoFiscal(fiscal) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(ABA_CONTRATOS);
  if (!aba) return [];

  var linhas = aba.getDataRange().getValues();
  var cabecalho = linhas[0];
  var idxContrato = cabecalho.indexOf("Contrato");
  var idxFiscal = cabecalho.indexOf("Fiscal");
  var idxAba = cabecalho.indexOf("Aba de Origem");
  var idxSituacao = cabecalho.indexOf("Situação do Contrato");

  var contratos = [];
  for (var i = 1; i < linhas.length; i++) {
    var linha = linhas[i];
    var situacao = String(linha[idxSituacao] || "").trim().toUpperCase();
    var fiscalDaLinha = String(linha[idxFiscal] || "").trim();
    if (situacao === "EM EXECUÇÃO" && fiscalDaLinha === fiscal) {
      contratos.push({
        contrato: String(linha[idxContrato] || "").trim(),
        aba: String(linha[idxAba] || "").trim()
      });
    }
  }
  return contratos;
}

function acaoSincronizar(pedido) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var abaSenhas = planilha.getSheetByName(ABA_SENHAS);
  var linhas = abaSenhas.getDataRange().getValues();
  var senhaValida = false;
  for (var i = 1; i < linhas.length; i++) {
    if (String(linhas[i][0]).trim() === pedido.fiscal &&
        String(linhas[i][1]).trim() === pedido.senha) {
      senhaValida = true;
      break;
    }
  }
  if (!senhaValida) {
    return { ok: false, erro: "Sessão inválida — faça login novamente." };
  }

  if (pedido.respostasNormais && pedido.respostasNormais.length > 0) {
    gravarLinhas(ABA_RESPOSTAS, CABECALHO_RESPOSTAS, pedido.respostasNormais);
  }
  if (pedido.respostasInstalacoes && pedido.respostasInstalacoes.length > 0) {
    gravarLinhas(ABA_INSTALACOES, CABECALHO_INSTALACOES, pedido.respostasInstalacoes);
  }

  return { ok: true };
}

function gravarLinhas(nomeAba, cabecalho, linhas) {
  var planilha = SpreadsheetApp.getActiveSpreadsheet();
  var aba = planilha.getSheetByName(nomeAba);
  if (!aba) {
    aba = planilha.insertSheet(nomeAba);
  }
  if (aba.getLastRow() === 0) {
    aba.appendRow(cabecalho);
  }
  aba.getRange(aba.getLastRow() + 1, 1, linhas.length, cabecalho.length).setValues(linhas);
}

function doGet(e) {
  return ContentService
    .createTextOutput("Backend do app de contratos está funcionando.")
    .setMimeType(ContentService.MimeType.TEXT);
}
