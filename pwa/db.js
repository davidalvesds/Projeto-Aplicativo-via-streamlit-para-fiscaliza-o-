const NOME_BANCO = "contratos-offline";
const VERSAO_BANCO = 1;

function abrirBanco() {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);

    pedido.onupgradeneeded = (evento) => {
      const banco = evento.target.result;
      if (!banco.objectStoreNames.contains("sessao")) {
        banco.createObjectStore("sessao");
      }
      if (!banco.objectStoreNames.contains("fila")) {
        banco.createObjectStore("fila", { keyPath: "id", autoIncrement: true });
      }
    };

    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function salvarSessao(sessao) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("sessao", "readwrite");
    transacao.objectStore("sessao").put(sessao, "atual");
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}

async function obterSessao() {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("sessao", "readonly");
    const pedido = transacao.objectStore("sessao").get("atual");
    pedido.onsuccess = () => resolve(pedido.result || null);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function limparSessao() {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("sessao", "readwrite");
    transacao.objectStore("sessao").delete("atual");
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}

async function adicionarPendencia(item) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("fila", "readwrite");
    transacao.objectStore("fila").add(item);
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}

async function listarPendencias() {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("fila", "readonly");
    const pedido = transacao.objectStore("fila").getAll();
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function removerPendencias(ids) {
  const banco = await abrirBanco();
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction("fila", "readwrite");
    const loja = transacao.objectStore("fila");
    ids.forEach((id) => loja.delete(id));
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error);
  });
}
