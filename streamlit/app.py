import streamlit as st
import gspread
from google.oauth2.service_account import Credentials
from datetime import datetime, date
from zoneinfo import ZoneInfo
import uuid

FUSO_BR = ZoneInfo("America/Sao_Paulo")

TODOS_FISCAIS = [
    "Fiscal 01",
    "Fiscal 02",
    "Fiscal 03",
    "Fiscal 04",
    "Fiscal 05",
]

st.set_page_config(page_title="Atualização Semanal - Contratos", page_icon="🏗️", layout="centered")

NOME_DA_PLANILHA = "Atualização Semanal - Contratos"
NOME_DA_ABA = "Respostas"
NOME_DA_ABA_INSTALACOES = "Instalações"
NOME_DA_ABA_CONTRATOS = "Lista de Contratos"

CABECALHO_CONTRATOS = ["Contrato", "Fiscal", "Aba de Origem", "Situação do Contrato"]

CABECALHO = [
    "Data/Hora",
    "Fiscal",
    "Aba de Origem",
    "Contrato",
    "Torre/Bloco",
    "Situação da Obra",
    "Valor Executado",
    "Área Executada (m²)",
    "Pavimentos Concluídos",
    "Observações",
]

CABECALHO_INSTALACOES = [
    "Data/Hora",
    "Fiscal",
    "Etapa",
    "Torre/Bloco",
    "Elétrica - Investimento",
    "Elétrica - Área Executada (m²)",
    "Elétrica - Pavimentos Concluídos",
    "Elétrica - Conclusão da Obra",
    "Elétrica - Data de Conclusão",
    "Hidráulica - Investimento",
    "Hidráulica - Área Executada (m²)",
    "Hidráulica - Pavimentos Concluídos",
    "Hidráulica - Conclusão da Obra",
    "Hidráulica - Data de Conclusão",
]

SEM_ATUALIZACAO = "Não há atualização"
INSTALACOES = "Instalações"
FISCAL_INSTALACOES = "Fiscal 03"
SITUACOES_OBRA = ["Selecione...", "Em Execução", "Não Iniciada", "Concluída", "Paralisada"]
ETAPAS = ["Selecione...", "Etapa 1", "Etapa 2"]

def formatar_valor_brl(valor):
    texto = f"{valor:,.2f}"
    texto = texto.replace(",", "TEMP").replace(".", ",").replace("TEMP", ".")
    return texto

@st.cache_resource(show_spinner=False)
def conectar_cliente():
    escopos = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    credenciais = Credentials.from_service_account_info(
        st.secrets["gcp_service_account"], scopes=escopos
    )
    return gspread.authorize(credenciais)

def obter_aba(nome_aba, cabecalho):
    cliente = conectar_cliente()
    planilha = cliente.open(NOME_DA_PLANILHA)

    try:
        aba = planilha.worksheet(nome_aba)
    except gspread.WorksheetNotFound:
        aba = planilha.add_worksheet(title=nome_aba, rows=1000, cols=len(cabecalho))

    if aba.row_values(1) != cabecalho:
        aba.update("A1", [cabecalho])

    return aba

def enviar_linhas(nome_aba, cabecalho, linhas):
    if not linhas:
        return
    aba = obter_aba(nome_aba, cabecalho)
    aba.append_rows(linhas, value_input_option="USER_ENTERED")

@st.cache_data(ttl=300, show_spinner=False)
def carregar_fiscais_contratos():
    aba = obter_aba(NOME_DA_ABA_CONTRATOS, CABECALHO_CONTRATOS)
    registros = aba.get_all_records()

    fiscais_contratos = {fiscal: [] for fiscal in TODOS_FISCAIS}
    for linha in registros:
        situacao = str(linha.get("Situação do Contrato", "")).strip()
        if situacao.upper() != "EM EXECUÇÃO":
            continue

        fiscal = str(linha.get("Fiscal", "")).strip()
        contrato = str(linha.get("Contrato", "")).strip()
        aba_origem = str(linha.get("Aba de Origem", "")).strip()
        if not fiscal or not contrato:
            continue

        fiscais_contratos.setdefault(fiscal, []).append({"contrato": contrato, "aba": aba_origem})

    return fiscais_contratos

if "blocos" not in st.session_state:
    st.session_state.blocos = [str(uuid.uuid4())]

if "enviado" not in st.session_state:
    st.session_state.enviado = False

def adicionar_bloco():
    st.session_state.blocos.append(str(uuid.uuid4()))

def remover_bloco(bloco_id):
    st.session_state.blocos.remove(bloco_id)
    for chave in list(st.session_state.keys()):
        if chave.endswith(f"__{bloco_id}"):
            del st.session_state[chave]

def autenticar():
    if st.session_state.get("fiscal_logado"):
        return True

    st.markdown(
        "<h2 style='text-align: center;'>🔒 Acesso restrito</h2>",
        unsafe_allow_html=True,
    )
    st.caption("Digite sua senha pessoal para entrar.")
    with st.form("form_senha"):
        senha_digitada = st.text_input("Senha", type="password")
        entrar = st.form_submit_button("Entrar")

    if entrar:
        senhas_por_fiscal = st.secrets.get("fiscal_passwords", {})
        fiscal_correspondente = next(
            (nome for nome, senha in senhas_por_fiscal.items() if senha_digitada == senha),
            None,
        )
        if fiscal_correspondente:
            st.session_state.fiscal_logado = fiscal_correspondente
            st.rerun()
        else:
            st.error("Senha incorreta.")

    return False

if not autenticar():
    st.stop()

fiscal = st.session_state.fiscal_logado

if st.session_state.enviado:
    st.success("✅ Atualização enviada com sucesso! Obrigado.")
    if st.button("Preencher nova atualização"):
        st.session_state.enviado = False
        st.session_state.blocos = [str(uuid.uuid4())]
        st.rerun()
    st.stop()

col_titulo_pagina, col_atualizar = st.columns([5, 1])
with col_titulo_pagina:
    st.title("🏗️ Atualização Semanal de Contratos")
with col_atualizar:
    if st.button("🔄", help="Atualizar lista de contratos (se acabou de mudar na planilha)"):
        carregar_fiscais_contratos.clear()
        st.rerun()

col_saudacao, col_sair = st.columns([5, 1])
with col_saudacao:
    st.caption(f"Olá, **{fiscal}**. Preencha os dados de um ou mais contratos e envie tudo de uma vez.")
with col_sair:
    if st.button("Sair", help="Encerrar sessão (se outra pessoa for usar este aparelho)"):
        st.session_state.fiscal_logado = None
        st.rerun()

fiscais_contratos = carregar_fiscais_contratos()
contratos_do_fiscal = fiscais_contratos.get(fiscal, [])
opcoes_contrato = [c["contrato"] for c in contratos_do_fiscal]
if fiscal == FISCAL_INSTALACOES:
    opcoes_contrato = opcoes_contrato + [INSTALACOES]
opcoes_contrato = opcoes_contrato + [SEM_ATUALIZACAO]

st.divider()

respostas_normais = []
respostas_instalacoes = []

for i, bloco_id in enumerate(st.session_state.blocos):
    with st.container(border=True):
        col_titulo, col_remover = st.columns([5, 1])
        with col_titulo:
            st.markdown(f"**Contrato #{i + 1}**")
        with col_remover:
            if len(st.session_state.blocos) > 1:
                st.button(
                    "🗑️",
                    key=f"remover__{bloco_id}",
                    on_click=remover_bloco,
                    args=(bloco_id,),
                    help="Remover este contrato",
                )

        contrato_selecionado = st.selectbox(
            "Contrato",
            options=opcoes_contrato,
            key=f"contrato__{bloco_id}",
        )

        sem_atualizacao = contrato_selecionado == SEM_ATUALIZACAO
        eh_instalacoes = contrato_selecionado == INSTALACOES

        aba_origem = next(
            (c["aba"] for c in contratos_do_fiscal if c["contrato"] == contrato_selecionado),
            "",
        )

        torre = st.text_input(
            "Torre/Bloco",
            key=f"torre__{bloco_id}",
            placeholder="Ex: Torre A",
        )
        if aba_origem in ("EDIFÍCIOS RESIDENCIAIS", "EDIFÍCIOS COMERCIAIS"):
            st.caption("⚠️ Informe a torre ou bloco")

        if sem_atualizacao:
            situacao_obra = st.selectbox(
                "Situação da Obra",
                options=SITUACOES_OBRA,
                key=f"situacao__{bloco_id}",
            )
            observacoes = st.text_area(
                "Observações (opcional)",
                key=f"obs__{bloco_id}",
                placeholder="Pode explicar o motivo, se quiser (ex: obra parada, sem medição na semana)...",
            )

            respostas_normais.append(
                [
                    datetime.now(FUSO_BR).strftime("%d/%m/%Y %H:%M:%S"),
                    fiscal,
                    aba_origem,
                    contrato_selecionado,
                    torre.strip(),
                    situacao_obra if situacao_obra != "Selecione..." else "",
                    "",
                    "",
                    "",
                    observacoes,
                ]
            )
        elif eh_instalacoes:
            etapa = st.selectbox(
                "Etapa",
                options=ETAPAS,
                key=f"etapa__{bloco_id}",
            )

            def bloco_eletrica_ou_hidraulica(rotulo, prefixo):
                st.markdown(f"**{rotulo}**")
                col1, col2 = st.columns(2)
                with col1:
                    investimento_num = st.number_input(
                        "Investimento (R$)",
                        min_value=0.0,
                        step=1000.0,
                        format="%.2f",
                        key=f"{prefixo}_investimento__{bloco_id}",
                    )
                    investimento = formatar_valor_brl(investimento_num)
                    st.caption(f"R$ {investimento}")
                with col2:
                    area = st.number_input(
                        "Área Executada (m²)",
                        min_value=0.0,
                        step=1.0,
                        format="%.2f",
                        key=f"{prefixo}_area__{bloco_id}",
                    )

                pavimentos = st.number_input(
                    "Pavimentos Concluídos",
                    min_value=0,
                    step=1,
                    key=f"{prefixo}_pavimentos__{bloco_id}",
                )
                pavimentos = int(pavimentos)

                conclusao_texto = st.text_input(
                    "Conclusão da Obra",
                    key=f"{prefixo}_conclusao__{bloco_id}",
                    placeholder="Ex: Concluído, Em execução, etc.",
                )

                data_conclusao = st.date_input(
                    "Data de Conclusão",
                    key=f"{prefixo}_data__{bloco_id}",
                    value=None,
                    format="DD/MM/YYYY",
                )
                data_conclusao_txt = (
                    data_conclusao.strftime("%d/%m/%Y") if isinstance(data_conclusao, date) else ""
                )

                return [investimento, area, pavimentos, conclusao_texto, data_conclusao_txt]

            dados_eletrica = bloco_eletrica_ou_hidraulica("Elétrica", "eletrica")
            st.divider()
            dados_hidraulica = bloco_eletrica_ou_hidraulica("Hidráulica", "hidraulica")

            respostas_instalacoes.append(
                [
                    datetime.now(FUSO_BR).strftime("%d/%m/%Y %H:%M:%S"),
                    fiscal,
                    etapa if etapa != "Selecione..." else "",
                    torre.strip(),
                    *dados_eletrica,
                    *dados_hidraulica,
                ]
            )
        else:
            col1, col2 = st.columns(2)
            with col1:
                valor_num = st.number_input(
                    "Valor Executado (R$)",
                    min_value=0.0,
                    step=1000.0,
                    format="%.2f",
                    key=f"valor__{bloco_id}",
                )
                st.caption("Valor executado na semana")
                valor_executar = formatar_valor_brl(valor_num)
                st.caption(f"R$ {valor_executar}")
            with col2:
                area_executada = st.number_input(
                    "Área Executada (m²)",
                    min_value=0.0,
                    step=1.0,
                    format="%.2f",
                    key=f"area__{bloco_id}",
                )

            situacao_obra = st.selectbox(
                "Situação da Obra",
                options=SITUACOES_OBRA,
                key=f"situacao__{bloco_id}",
            )

            pavimentos = st.number_input(
                "Pavimentos Concluídos",
                min_value=0,
                step=1,
                key=f"pavimentos__{bloco_id}",
            )
            pavimentos = int(pavimentos)

            observacoes = st.text_area(
                "Observações",
                key=f"obs__{bloco_id}",
                placeholder="Alguma observação sobre o andamento do contrato...",
            )

            respostas_normais.append(
                [
                    datetime.now(FUSO_BR).strftime("%d/%m/%Y %H:%M:%S"),
                    fiscal,
                    aba_origem,
                    contrato_selecionado,
                    torre.strip(),
                    situacao_obra if situacao_obra != "Selecione..." else "",
                    valor_executar,
                    area_executada,
                    pavimentos,
                    observacoes,
                ]
            )

st.button("➕ Adicionar outro contrato", on_click=adicionar_bloco)

st.divider()

if st.button("✅ Enviar tudo", type="primary", use_container_width=True):
    try:
        with st.spinner("Enviando..."):
            enviar_linhas(NOME_DA_ABA, CABECALHO, respostas_normais)
            enviar_linhas(NOME_DA_ABA_INSTALACOES, CABECALHO_INSTALACOES, respostas_instalacoes)
        st.session_state.enviado = True
        st.rerun()
    except Exception as e:
        st.error(f"Ocorreu um erro ao enviar os dados: {e}")
        st.caption(
            "Confira se a planilha foi compartilhada com o e-mail da conta de serviço "
            "e se as credenciais estão corretas."
        )
