import sys
from pathlib import Path

import openpyxl
import gspread
from google.oauth2.service_account import Credentials

CAMINHO_PLANILHA_MESTRE = "planilha_mestre.xlsx"
CAMINHO_CREDENCIAIS = "credenciais_google.json"

NOME_DA_PLANILHA = "Atualização Semanal - Contratos"
NOME_DA_ABA_CONTRATOS = "Lista de Contratos"
CABECALHO_CONTRATOS = ["Contrato", "Fiscal", "Aba de Origem", "Situação do Contrato"]

ABAS_PARA_LER = [
    "EDIFÍCIOS RESIDENCIAIS",
    "EDIFÍCIOS COMERCIAIS",
    "REFORMAS",
    "OUTRAS OBRAS",
]

FISCAIS_CONHECIDOS = [
    "Fiscal 01",
    "Fiscal 02",
    "Fiscal 03",
    "Fiscal 04",
    "Fiscal 05",
]

def encontrar_coluna(cabecalho, *palavras_chave):
    alvo = " ".join(p.upper() for p in palavras_chave)

    for indice, valor in enumerate(cabecalho):
        if valor and " ".join(str(valor).upper().split()) == alvo:
            return indice

    for indice, valor in enumerate(cabecalho):
        if valor and all(p.upper() in str(valor).upper() for p in palavras_chave):
            return indice

    return None

def escolher_fiscal(valor_celula):
    texto = str(valor_celula).strip()
    if "\n" not in texto:
        return texto

    linhas = [parte.strip() for parte in texto.split("\n") if parte.strip()]
    for linha in linhas:
        if linha in FISCAIS_CONHECIDOS:
            return linha

    return linhas[0] if linhas else texto

def extrair_contratos_em_execucao(caminho_planilha_mestre):
    wb = openpyxl.load_workbook(caminho_planilha_mestre, data_only=True)
    resultados = []
    vistos = set()

    for nome_aba in ABAS_PARA_LER:
        if nome_aba not in wb.sheetnames:
            print(f'  aviso: aba "{nome_aba}" não encontrada na planilha mestre — pulando.')
            continue

        ws = wb[nome_aba]
        linha_cabecalho = 2 if nome_aba == "EDIFÍCIOS RESIDENCIAIS" else 1
        cabecalho = [celula.value for celula in ws[linha_cabecalho]]

        col_contrato = encontrar_coluna(cabecalho, "CONTRATO")
        col_fiscal = encontrar_coluna(cabecalho, "FISCAL")
        col_situacao = encontrar_coluna(cabecalho, "SITUA", "OBRA")

        if col_contrato is None or col_fiscal is None or col_situacao is None:
            print(f'  aviso: não encontrei as colunas esperadas na aba "{nome_aba}" — pulando.')
            continue

        for linha in ws.iter_rows(min_row=linha_cabecalho + 1, values_only=True):
            situacao = linha[col_situacao] if col_situacao < len(linha) else None
            if not situacao or "EM EXECU" not in str(situacao).upper():
                continue

            contrato = linha[col_contrato] if col_contrato < len(linha) else None
            fiscal = linha[col_fiscal] if col_fiscal < len(linha) else None
            if not contrato or not fiscal:
                continue

            contrato = str(contrato).strip()
            fiscal = escolher_fiscal(fiscal)

            chave = (nome_aba, contrato, fiscal)
            if chave in vistos:
                continue
            vistos.add(chave)

            resultados.append([contrato, fiscal, nome_aba, "Em Execução"])

    return resultados

def enviar_para_o_drive(linhas, caminho_credenciais):
    escopos = [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive",
    ]
    credenciais = Credentials.from_service_account_file(caminho_credenciais, scopes=escopos)
    cliente = gspread.authorize(credenciais)
    planilha = cliente.open(NOME_DA_PLANILHA)

    try:
        aba = planilha.worksheet(NOME_DA_ABA_CONTRATOS)
    except gspread.WorksheetNotFound:
        aba = planilha.add_worksheet(
            title=NOME_DA_ABA_CONTRATOS,
            rows=max(len(linhas) + 10, 100),
            cols=len(CABECALHO_CONTRATOS),
        )

    aba.clear()
    aba.update("A1", [CABECALHO_CONTRATOS] + linhas)

def main():
    caminho_planilha_mestre = sys.argv[1] if len(sys.argv) > 1 else CAMINHO_PLANILHA_MESTRE
    caminho_credenciais = sys.argv[2] if len(sys.argv) > 2 else CAMINHO_CREDENCIAIS

    if not Path(caminho_planilha_mestre).exists():
        print(f"Arquivo não encontrado: {caminho_planilha_mestre}")
        sys.exit(1)

    if not Path(caminho_credenciais).exists():
        print(f"Arquivo de credenciais não encontrado: {caminho_credenciais}")
        print("Veja o README.md para como conseguir esse arquivo, ou informe o caminho correto.")
        sys.exit(1)

    print("Lendo planilha mestre...")
    linhas = extrair_contratos_em_execucao(caminho_planilha_mestre)
    print(f"{len(linhas)} contratos em execução encontrados.")

    fiscais_desconhecidos = sorted({linha[1] for linha in linhas if linha[1] not in FISCAIS_CONHECIDOS})
    if fiscais_desconhecidos:
        print()
        print("⚠️  Atenção: os fiscais abaixo apareceram na planilha mestre mas não")
        print("    estão na lista de fiscais do app (TODOS_FISCAIS em app.py).")
        print("    Os contratos deles vão para a planilha, mas NÃO vão aparecer")
        print("    para ninguém no app até você ajustar o nome ou adicionar o fiscal:")
        for nome in fiscais_desconhecidos:
            print(f"    - {nome}")
        print()

    if not linhas:
        print("Nenhum contrato encontrado — confira se a planilha mestre está no formato esperado.")
        sys.exit(1)

    print("Enviando para a planilha no Google Drive...")
    enviar_para_o_drive(linhas, caminho_credenciais)

    print('Pronto! A aba "Lista de Contratos" foi atualizada com sucesso.')

if __name__ == "__main__":
    main()
