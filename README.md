# 🕒Sistema para gerar Folha de Ponto de Estagiários

Uma ferramenta web simples, rápida e que roda direto no navegador para gerar folhas de ponto mensais de forma automatizada. 

Este projeto nasceu com o intuito de facilitar e padronizar o preenchimento do ponto dos estagiários da **Prefeitura de Uruguaiana / RS**, substituindo o processo manual e repetitivo por uma interface inteligente. No entanto, a ferramenta foi construída de forma genérica e pode ser **facilmente adotada por qualquer empresa, prefeitura ou instituição** que necessite de controle de frequência em formato físico ou planilhas.

## ✨ Principais Funcionalidades

* **Preenchimento Automático:** Preenche os horários de entrada e saída para todos os dias úteis do mês com um clique.
* **Tolerância Aleatória (Horários Quebrados):** Simula marcações reais aplicando pequenas variações nos minutos de entrada e saída, preservando a carga horária diária exata (evita o padrão irreal de "08:00 e 12:00" todos os dias).
* **Detecção Inteligente de Feriados:** Integração com a *BrasilAPI* para buscar feriados nacionais automaticamente. Possui um sistema de fallback (cálculo matemático local) caso o usuário esteja utilizando o sistema localmente e sem internet.
* **Gestão de Ausências:** Permite marcar dias específicos como Atestado, Ponto Facultativo ou Feriado, bloqueando a edição de horas e sinalizando o motivo na linha correspondente.
* **Otimizado para Impressão (A4):** Layout CSS rigorosamente ajustado para impressão perfeita em folha A4.
* **Espaço para Carimbo:** Design pensado para o mundo real, com margem adequada para assinatura à caneta e carimbo do responsável no rodapé.
* **Exportação para Excel:** Geração instantânea de um arquivo `.xlsx` organizado com todos os dados do mês, facilitando o arquivamento digital pelo RH/Supervisão.

## 🛠️ Tecnologias Utilizadas

O projeto foi construído focando em máxima acessibilidade e zero dependências de infraestrutura complexa (não requer banco de dados ou servidor backend rodando).

* **HTML5 / CSS3:** Estrutura e estilização, com *media queries* específicas para impressão (`@media print`).
* **JavaScript:** Lógica de cálculo de datas, manipulação da DOM e consumo de API.
* **[SheetJS (XLSX)](https://sheetjs.com/):** Biblioteca via CDN utilizada exclusivamente para a exportação dos dados da tabela para o formato Excel.
* **[BrasilAPI](https://brasilapi.com.br/):** API pública e gratuita para consulta de feriados nacionais.

## 🚀 Como Usar

A ferramenta está online e pronta para uso, sem necessidade de instalação ou criação de contas:

1. Acesse o site oficial: **[ponto-estagiarios.vercel.app](https://ponto-estagiarios.vercel.app/)**
2. Preencha os dados iniciais (Mês, Ano, Nome do Estagiário, Lotação e Horários de Trabalho).
3. Ative a **Tolerância Aleatória** se desejar que o sistema gere minutos variados para simular marcações reais (o sistema mantém a carga horária total intacta).
4. Clique em **Gerar Folha de Ponto**.
5. Na tela da folha gerada, revise os dias. Você pode alterar o "Motivo / Ausência" de dias específicos para registrar um Atestado ou Feriado, por exemplo. Além disso, também é possível alterar horários manualmente.
6. Utilize os botões no topo da tela para **Imprimir / Gerar PDF** ou **Exportar para Excel**.

### 💻 Para Desenvolvedores (Rodando Localmente)
Caso você queira modificar o código, alterar cores ou adaptar para sua própria instituição:
1. Faça o clone deste repositório ou baixe o arquivo `.zip`.
2. O projeto é *Client-Side* puro (HTML, CSS e JS). Basta dar um duplo clique no arquivo `index.html` para abri-lo em qualquer navegador e começar a editar.

## 💡 Cenários de Uso

Embora focado em estagiários, o sistema atende perfeitamente:
* Servidores públicos em regime de ponto manual.
* Funcionários de pequenas e médias empresas.
* Prestadores de serviço que precisam comprovar horas trabalhadas.
* Bolsistas e pesquisadores em universidades.

## 📄 Licença

Este projeto é de código aberto. Sinta-se livre para clonar, modificar as cores, adicionar a logo da sua instituição e adaptar a ferramenta para a sua própria realidade.
