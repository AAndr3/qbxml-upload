// server.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Aceitar o SOAP cru (texto)
app.use(express.text({ type: "*/*", limit: "2mb" }));

// Envelopador SOAP (sem espaços antes do XML decl)
function soap(inner) {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${inner}
  </soap:Body>
</soap:Envelope>`;
}

// ---- QBXML DE TESTE (sempre válido) ----
function buildCustomerQueryRq() {
  // Sem <?xml?> nem <?qbxml?> aqui — apenas <QBXML>...</QBXML>
  return `<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq requestID="1" MaxReturned="1"/>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ---- (Depois usamos este para o depósito) ----
function buildDepositAddRq() {
  // Mantemos aqui pronto, mas primeiro valida SOAP com o CustomerQueryRq
  return `<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <DepositAddRq requestID="1">
      <DepositAdd>
        <TxnDate>2025-09-06</TxnDate>
        <DepositToAccountRef>
          <FullName>Canada Wise USD</FullName>
        </DepositToAccountRef>
        <Memo>API test deposit</Memo>
        <DepositLineAdd>
          <!-- Linha simples; muitos ficheiros exigem ReceivedFrom -->
          <ReceivedFrom>
            <FullName>Sales and Marketing</FullName>
          </ReceivedFrom>
          <Amount>100.00</Amount>
          <Memo>API test line</Memo>
        </DepositLineAdd>
      </DepositAdd>
    </DepositAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// Páginas simples
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// Endpoint do QBWC
app.post("/upload", (req, res) => {
  const xml = req.body || "";
  const action = req.headers.soapaction || "";

  console.log("\n=== QBWC CALL RECEIVED ===");
  console.log("SOAPAction:", action);
  console.log("RAW SOAP:\n", xml);
  console.log("================================\n");

  const x = xml.toLowerCase();

  // serverVersion
  if (x.includes("<serverversion")) {
    const inner = `<serverVersionResponse xmlns="http://developer.intuit.com/">
  <serverVersionResult></serverVersionResult>
</serverVersionResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // clientVersion
  if (x.includes("<clientversion")) {
    const inner = `<clientVersionResponse xmlns="http://developer.intuit.com/">
  <clientVersionResult></clientVersionResult>
</clientVersionResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // authenticate
  if (x.includes("<authenticate")) {
    const inner = `<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>SESSION-EP-123</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`;
    console.log(">> authenticate()");
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // sendRequestXML  (AQUI devolvemos o QBXML **dentro de CDATA**, sem escapes)
  if (x.includes("<sendrequestxml")) {
    // 1º: provar o caminho com CustomerQueryRq
    const qbxml = buildCustomerQueryRq();

    console.log(">> sendRequestXML() OUT (QBXML enviado a QB):\n", qbxml);

    const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
  <sendRequestXMLResult><![CDATA[${qbxml}]]></sendRequestXMLResult>
</sendRequestXMLResponse>`;

    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // receiveResponseXML
  if (x.includes("<receiveresponsexml")) {
    console.log(">> receiveResponseXML() IN (resposta do QB):\n", xml);
    const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // getLastError
  if (x.includes("<getlasterror")) {
    const inner = `<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // connectionError
  if (x.includes("<connectionerror")) {
    const inner = `<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // closeConnection
  if (x.includes("<closeconnection")) {
    const inner = `<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`;
    return res.type("text/xml; charset=utf-8").send(soap(inner));
  }

  // fallback
  const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
  return res.type("text/xml; charset=utf-8").send(soap(inner));
});

app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
