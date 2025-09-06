// server.js
const express = require("express");
const bodyParser = require("body-parser");

const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
// O QBWC envia SOAP como texto; aceitar tudo como texto cru.
app.use(bodyParser.text({ type: "*/*", limit: "2mb" }));

// --- Helpers ---
function soapEnvelope(innerXml) {
  // NÃO coloques nada antes do XML decl (nem espaços)
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${innerXml}
  </soap:Body>
</soap:Envelope>`;
}

// Exemplo: criar um depósito simples de 100 USD na conta "Canada Wise USD"
function buildDepositAddRq() {
  // Importante: incluir cabeçalhos XML e qbxml e o nó <QBXML>
  return `<?xml version="1.0"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <DepositAddRq requestID="1">
      <DepositAdd>
        <TxnDate>2025-09-06</TxnDate>
        <DepositToAccountRef>
          <FullName>Canada Wise USD</FullName>
        </DepositToAccountRef>
        <Memo>API test deposit</Memo>
        <DepositLineAdd>
          <!-- Para testes, usa uma conta de resultados existente, p.ex. "Sales and Marketing" -->
          <AccountRef>
            <FullName>Sales and Marketing</FullName>
          </AccountRef>
          <Amount>100.00</Amount>
          <Memo>API test line</Memo>
        </DepositLineAdd>
      </DepositAdd>
    </DepositAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// --- Páginas simples ---
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// --- Endpoint principal chamado pelo QBWC ---
app.post("/upload", (req, res) => {
  const xml = req.body || "";
  const action = req.headers.soapaction || "";

  console.log("\n=== QBWC CALL RECEIVED ===");
  console.log("SOAPAction:", action);
  console.log("RAW SOAP:\n", xml);
  console.log("================================\n");

  // Normalizar verificação (evita problemas com maiúsc./minúsc.)
  const x = xml.toLowerCase();

  // 0) serverVersion
  if (x.includes("<serverversion")) {
    const inner = `<serverVersionResponse xmlns="http://developer.intuit.com/">
  <serverVersionResult></serverVersionResult>
</serverVersionResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 0.1) clientVersion
  if (x.includes("<clientversion")) {
    const inner = `<clientVersionResponse xmlns="http://developer.intuit.com/">
  <clientVersionResult></clientVersionResult>
</clientVersionResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 1) authenticate
  if (x.includes("<authenticate")) {
    const inner = `<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>SESSION-EP-123</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`;
    console.log(">> Responding to authenticate()");
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 2) sendRequestXML — devolver o QBXML pedido dentro de CDATA
  if (x.includes("<sendrequestxml")) {
    const qbxml = buildDepositAddRq(); // já inclui <?xml?>, <?qbxml?> e <QBXML>...</QBXML>
    const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
  <sendRequestXMLResult><![CDATA[${qbxml}]]></sendRequestXMLResult>
</sendRequestXMLResponse>`;
    console.log(">> sendRequestXML() OUT (QBXML enviado a QB):\n", qbxml);
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 3) receiveResponseXML — QB devolve a resposta do pedido
  if (x.includes("<receiveresponsexml")) {
    console.log(">> receiveResponseXML() IN (resposta do QB):\n", xml);
    // Devolve 100 para indicar ao QBWC que terminámos este ciclo
    const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 4) getLastError — devolver string vazia para “sem erro”
  if (x.includes("<getlasterror")) {
    const inner = `<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 5) connectionError — dizer ao QBWC que pode tentar de novo (“done” encerra)
  if (x.includes("<connectionerror")) {
    const inner = `<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // 6) closeConnection — mensagem final
  if (x.includes("<closeconnection")) {
    const inner = `<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`;
    return res.type("text/xml").send(soapEnvelope(inner));
  }

  // Fallback — em caso de chamada desconhecida
  const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
  return res.type("text/xml").send(soapEnvelope(inner));
});

// --- Start ---
app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
