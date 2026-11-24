# Atualização Semanal de Contratos

## O problema

Toda semana era preciso cobrar cada fiscal, um por um, para saber como estavam as obras: valor executado, área concluída, pavimentos finalizados e situação de cada contrato. As respostas chegavam por mensagem, cada uma de um jeito, e depois tinham que ser digitadas à mão numa planilha. Dava muito trabalho e abria espaço para erro.

## A solução

Criei um app em que o próprio fiscal faz a atualização pelo celular. Ele entra com a senha dele, vê só os contratos que estão com ele, preenche os dados da semana e envia. Tudo vai direto para uma planilha do Google Sheets, organizado e com data e hora, sem ninguém precisar redigitar nada.

## Duas versões

- **`streamlit/`**: versão em Python com Streamlit. Simples de manter, mas precisa de internet.
- **`pwa/` + `apps-script/`**: versão que funciona **offline**. Dentro de prédios em obra o sinal costuma falhar, então o fiscal preenche normalmente e as respostas ficam salvas no celular, sendo enviadas sozinhas quando a internet volta. Pode ser instalada na tela inicial como um aplicativo.

As duas gravam no mesmo formato, então a planilha é a mesma para qualquer uma delas.

## Como funciona

1. **A lista de contratos vem da planilha mestre.** O script `sincronizar_contratos.py` lê a planilha geral de acompanhamento de obras (separada em edifícios residenciais, comerciais, reformas e outras obras), pega só os contratos em execução e descobre qual fiscal cuida de cada um. Depois atualiza a aba "Lista de Contratos" no Google Sheets. Ele também avisa quando aparece um fiscal com o nome escrito diferente, para nenhum contrato sumir do app sem ninguém perceber.
2. **O fiscal entra com a senha.** A senha já identifica quem é, então não precisa escolher o nome numa lista.
3. **Ele preenche um ou mais contratos.** Para cada um, informa a torre ou bloco, o valor executado na semana, a área executada em m², quantos pavimentos foram concluídos, a situação da obra e alguma observação. Se não teve novidade, existe a opção "Não há atualização". As instalações prediais têm um formulário próprio, separado em elétrica e hidráulica, com a etapa, o investimento e a data de conclusão de cada uma.
4. **Envia tudo de uma vez.** As respostas vão para a aba "Respostas" (ou "Instalações"), uma linha por contrato.

## Estrutura

```
streamlit/
  app.py                       formulário em Streamlit
  sincronizar_contratos.py     leva os contratos da planilha mestre para o Google Sheets
  .streamlit/secrets.toml.example
pwa/
  index.html, app.js, style.css
  db.js                        guarda sessão e respostas pendentes no IndexedDB
  sw.js                        service worker que deixa o app abrir sem internet
  config.js                    o único arquivo que costuma precisar de ajuste
apps-script/
  Code.gs                      backend da versão offline (login e gravação na planilha)
exemplos/
  planilha_google_sheets_exemplo.xlsx   modelo da planilha usada pelo app
  planilha_mestre_exemplo.xlsx          modelo da planilha mestre lida pelo script
```

Todos os nomes, contratos, valores e senhas das planilhas de exemplo são fictícios.

## Colocando para rodar

### Planilha

Importe `exemplos/planilha_google_sheets_exemplo.xlsx` no Google Sheets e dê a ela o nome **Atualização Semanal - Contratos**.

### Versão Streamlit

1. No Google Cloud, crie uma conta de serviço com acesso às APIs do Sheets e do Drive e baixe a chave em JSON.
2. Compartilhe a planilha com o e-mail dessa conta de serviço, com permissão de edição.
3. Copie `streamlit/.streamlit/secrets.toml.example` para `secrets.toml` e preencha com os dados da chave e as senhas de cada fiscal.
4. Instale e rode:

```bash
cd streamlit
pip install -r requirements.txt
streamlit run app.py
```

Para atualizar a lista de contratos a partir da planilha mestre:

```bash
pip install -r requirements-sincronizacao.txt
python sincronizar_contratos.py caminho/da/planilha_mestre.xlsx caminho/da/chave.json
```

### Versão offline (PWA)

1. Na planilha do Google Sheets, abra **Extensões → Apps Script**, cole o conteúdo de `apps-script/Code.gs` e implante como **App da Web**, com acesso para qualquer pessoa.
2. Copie a URL gerada e cole em `URL_BACKEND`, no `pwa/config.js`.
3. Preencha a aba "Senhas" da planilha com o nome e a senha de cada fiscal.
4. Publique a pasta `pwa/` em qualquer hospedagem com HTTPS (GitHub Pages serve). No celular, é só abrir o link e escolher "Adicionar à tela inicial".


## Tecnologias

Python · Streamlit · gspread · openpyxl · JavaScript · IndexedDB · Service Worker (PWA) · Google Apps Script · Google Sheets
