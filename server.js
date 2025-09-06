// server.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Aceitar SOAP como texto cru
app.use(express.text({ type: "*/*", limit: "2mb" }));

// Helpers
function soapEnvelope(innerXml) {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
${innerXml}
  </soap:Body>
</soap:Envelope>`;
}

// Escape seguro para embutir QBXML dentro do SOAP
function xmlEscape(s) {
  return s.replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&apos;");
}

// --- SUBSTITUI a tua buildDepositAddRq por esta ---
function buildDepositAddRq() {
  // IMPORTANTE: sem <?xml?> e sem <?qbxml?> aqui!
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


// Páginas simples
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// Endpoint principal do QBWC
app.post("/upload", (req, res) => {
  const xml = req.body || "";
  const action = req.headers.soapaction || "";

  console.log("\n=== QBWC CALL RECEIVED ===");
  console.log("SOAPAction:", action);
  console.log("RAW SOAP:\n", xml);
  console.log("================================\n");

  const x = xml.toLowerCase();
  const reply = (inner) => res.type("text/xml; charset=utf-8").send(soapEnvelope(inner));

  // serverVersion
  if (x.includes("<serverversion")) {
    return reply(`<serverVersionResponse xmlns="http://developer.intuit.com/">
  <serverVersionResult></serverVersionResult>
</serverVersionResponse>`);
  }

  // clientVersion
  if (x.includes("<clientversion")) {
    return reply(`<clientVersionResponse xmlns="http://developer.intuit.com/">
  <clientVersionResult></clientVersionResult>
</clientVersionResponse>`);
  }

  // authenticate
  if (x.includes("<authenticate")) {
    console.log(">> Responding to authenticate()");
    return reply(`<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>SESSION-EP-123</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`);
  }

  // sendRequestXML
  if (x.includes("<sendrequestxml")) {
    const qbxml = buildDepositAddRq(); // só <QBXML>…</QBXML>
    console.log(">> sendRequestXML() OUT (QBXML enviado a QB):\n", qbxml);
  
    // devolve EXACTAMENTE um sendRequestXMLResult com CDATA
    const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
    <sendRequestXMLResult><![CDATA[${qbxml}]]></sendRequestXMLResult>
  </sendRequestXMLResponse>`;
  
    return res.type("text/xml; charset=utf-8").send(soapEnvelope(inner));
  }

  // receiveResponseXML
  if (x.includes("<receiveresponsexml")) {
    console.log(">> receiveResponseXML() IN (resposta do QB):\n", xml);
    // 100 = done
    return reply(`<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`);
  }

  // getLastError
  if (x.includes("<getlasterror")) {
    return reply(`<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`);
  }

  // connectionError
  if (x.includes("<connectionerror")) {
    return reply(`<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`);
  }

  // closeConnection
  if (x.includes("<closeconnection")) {
    return reply(`<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`);
  }

  // fallback
  return reply(`<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`);
});

// Start
app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
