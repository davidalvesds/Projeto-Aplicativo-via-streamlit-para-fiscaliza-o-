# Atualização Semanal de Contratos

Todo começo de semana era a mesma coisa: alguém precisava correr atrás de cada fiscal de obra para saber como andavam os prédios em construção. Quanto foi executado, quantos metros quadrados ficaram prontos, quantos pavimentos foram concluídos, se a obra estava andando ou parada. As respostas chegavam por mensagem, cada uma de um jeito, e depois tinham que ser digitadas numa planilha.

Este projeto resolve isso. Cada fiscal entra com a própria senha, vê só os contratos que estão com ele e preenche a atualização da semana num formulário simples, pelo celular, direto do canteiro. Tudo cai numa planilha do Google Sheets, organizada e com data e hora, pronta para quem acompanha as obras.

## Duas versões do mesmo app

O projeto começou em **Streamlit** e depois ganhou uma segunda versão, pensada para o campo.

- **`streamlit/`**: a primeira versão, escrita em Python. É rápida de montar e de manter, mas precisa de internet o tempo todo.
- **`pwa/` + `apps-script/`**: a versão que funciona **offline**. Dentro de um prédio em obra, no subsolo ou entre lajes de concreto, o sinal do celular some com facilidade. Por isso o fiscal pode preencher tudo sem internet. As respostas ficam guardadas no próprio celular e são enviadas sozinhas quando a conexão volta. Ela pode ser instalada na tela inicial como se fosse um aplicativo, e o "servidor" é um Google Apps Script ligado à própria planilha.

As duas versões gravam exatamente no mesmo formato, então dá para usar uma ou outra sem mexer na planilha.

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

## Cuidados

A chave da conta de serviço e as senhas reais nunca devem ir para o repositório. O `.gitignore` já deixa de fora o `secrets.toml`, os arquivos de credenciais e a planilha mestre.

## Tecnologias

Python · Streamlit · gspread · openpyxl · JavaScript · IndexedDB · Service Worker (PWA) · Google Apps Script · Google Sheets
