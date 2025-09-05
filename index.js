const express = require("express");
const fs = require("fs");
const path = require("path");
const soap = require("soap");

// ---------- CONFIG ----------
const PORT = process.env.PORT || 3000;
const QBWC_USER = process.env.QBWC_USER || "andre";
const QBWC_PASSWORD = process.env.QBWC_PASSWORD || "muda-isto";
const DEFAULT_BANK = process.env.QBWC_BANK || "Canada Wise USD"; // tem de existir no QB
const BASE_URL = process.env.BASE_URL || "https://qbxml-upload.onrender.com"; // URL do Render

// Trabalho simples em memória: enviamos UM CheckAdd por ciclo; depois fica vazio
let hasPendingJob = true;
let lastError = "";

// ---------- HELPERS ----------
function x(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildCheckAddQBXML({
  bankAccountFullName,
  payeeFullName,
  txnDate,
  memo,
  refNumber,
  lines
}) {
  const expenseLines = lines
    .map(
      (l) => `
        <ExpenseLineAdd>
          <AccountRef><FullName>${x(l.accountFullName)}</FullName></AccountRef>
          <Amount>${Number(l.amount).toFixed(2)}</Amount>
          ${l.memo ? `<Memo>${x(l.memo)}</Memo>` : ""}
        </ExpenseLineAdd>`
    )
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CheckAddRq>
      <CheckAdd>
        <BankAccountRef>
          <FullName>${x(bankAccountFullName)}</FullName>
        </BankAccountRef>
        <PayeeEntityRef>
          <FullName>${x(payeeFullName)}</FullName>
        </PayeeEntityRef>
        <TxnDate>${x(txnDate)}</TxnDate>
        ${refNumber ? `<RefNumber>${x(refNumber)}</RefNumber>` : ""}
        ${memo ? `<Memo>${x(memo)}</Memo>` : ""}
        ${expenseLines}
      </CheckAdd>
    </CheckAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// Exemplo a cair na conta "Canada Wise USD"
function buildExampleQBXML() {
  return buildCheckAddQBXML({
    bankAccountFullName: DEFAULT_BANK,
    payeeFullName: "TUV SUD SOUTH ASIA PRIVATE LIMITED",
    txnDate: "2025-09-05",
    memo: "Pagamento auditoria fábrica",
    refNumber: "QB-WISE-467",
    lines: [
      {
        accountFullName: "Professional Services:Factory Audits and Certificates",
        amount: 1275.58,
        memo: "Auditoria e certificados"
      }
    ]
  });
}

// ---------- EXPRESS ----------
const app = express();

// Rota raiz
app.get("/", (_req, res) => {
  res.send("Servidor QBXML ativo ✅");
});

// Endpoint para descarregar o ficheiro .QWC
app.get("/importador-andre.qwc", (_req, res) => {
  const qwc = `<?xml version="1.0"?>
<QBWCXML>
  <AppName>Andre Importador</AppName>
  <AppID></AppID>
  <AppURL>${BASE_URL}/qbwc</AppURL>
  <AppDescription>Integração QBXML via QuickBooks Web Connector</AppDescription>
  <AppSupport>${BASE_URL}/</AppSupport>
  <UserName>${QBWC_USER}</UserName>
  <OwnerID>{57F3B9B0-86F4-4d34-AF38-AC1E5A1C3C9D}</OwnerID>
  <FileID>{8A6B5B47-2D7E-4c1c-8F6E-7E2B3E7C9C11}</FileID>
  <QBType>QBFS</QBType>
  <Scheduler>
    <RunEveryNMinutes>5</RunEveryNMinutes>
  </Scheduler>
  <IsReadOnly>false</IsReadOnly>
</QBWCXML>`;
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="importador-andre.qwc"');
  res.send(qwc);
});

// Endpoints de teste rápido (opcional): gerar QBXML via browser
app.get("/check-exemplo.qbxml", (req, res) => {
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(buildExampleQBXML());
});

// ---------- SOAP (QBWC) ----------
const wsdlXml = fs.readFileSync(path.join(__dirname, "qbwc.wsdl"), "utf8");

// Implementação dos métodos do Web Connector
const service = {
  QBWebConnectorSvc: {
    QBWebConnectorSvcSoap: {
      // 1) Login
      authenticate(args) {
        const user = args.strUserName;
        const pass = args.strPassword;

        if (user === QBWC_USER && pass === QBWC_PASSWORD) {
          const ticket = `${Date.now()}-${Math.random()}`;
          // Segundo valor "" diz ao QB para usar a company file aberta
          return { authenticateResult: { string: [ticket, ""] } };
        } else {
          // Se falhar, segundo elemento "nvu" (not valid user)
          return { authenticateResult: { string: ["", "nvu"] } };
        }
      },

      // 2) Enviar pedido QBXML
      sendRequestXML(args) {
        // O QB chama isto repetidamente até devolvermos "" (sem trabalho)
        if (!hasPendingJob) {
          return { sendRequestXMLResult: "" };
        }

        // Aqui podes montar o QBXML dinamicamente (DB, fila, etc.)
        const qbxml = buildExampleQBXML();
        return { sendRequestXMLResult: qbxml };
      },

      // 3) Receber resposta do QB
      receiveResponseXML(args) {
        // args: { ticket, response, hresult, message }
        // Podes inspecionar 'hresult' e 'message' para erros do QB
        try {
          // Marca como concluído este job
          hasPendingJob = false;
          // Retorna percentagem concluída (0..100). 100 = terminou.
          return { receiveResponseXMLResult: 100 };
        } catch (e) {
          lastError = e?.message || "Erro desconhecido em receiveResponseXML";
          // Valor negativo pede retry mais tarde
          return { receiveResponseXMLResult: -1 };
        }
      },

      // 4) Último erro human-readable (se existir)
      getLastError() {
        return { getLastErrorResult: lastError || "Sem erros." };
      },

      // 5) Fechar sessão
      closeConnection() {
        return { closeConnectionResult: "OK" };
      }
    }
  }
};

// Arranca HTTP + SOAP
const server = app.listen(PORT, () => {
  console.log(`Servidor a ouvir na porta ${PORT}`);
  const soapPath = "/qbwc";
  soap.listen(server, soapPath, service, wsdlXml);
  console.log(`SOAP service disponível em ${soapPath}`);
});
