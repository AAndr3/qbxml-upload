const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

// Middleware para aceitar texto XML do QBWC
app.use(bodyParser.text({ type: "*/*" }));

// Helpers
function soapResponse(innerXml) {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${innerXml}
  </soap:Body>
</soap:Envelope>`;
}

function minimalQBXMLRequest() {
  return `
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <DepositAddRq>
      <DepositAdd>
        <AccountRef>
          <FullName>Canada Wise USD</FullName>
        </AccountRef>
        <CurrencyRef>
          <FullName>US Dollar</FullName>
        </CurrencyRef>
        <ExchangeRate>1.3927</ExchangeRate>
        <TxnDate>2025-09-05</TxnDate>
        <Memo>Deposit</Memo>
        <DepositLineAdd>
          <ReceivedFrom>
            <FullName>SOLTO INDUSTRIES CO LTD</FullName>
          </ReceivedFrom>
          <FromAccountRef>
            <FullName>Textile Sales:Textile Sales - Sample</FullName>
          </FromAccountRef>
          <Memo>/URI/2022 ML AUDIT CONSUMPTION, JAN'23</Memo>
          <Amount>1372.50</Amount>
        </DepositLineAdd>
      </DepositAdd>
    </DepositAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}




// Endpoints simples
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// Endpoint principal
app.post("/upload", (req, res) => {
  const xml = req.body;

  // 1) authenticate
  if (xml.includes("<authenticate")) {
    const inner = `<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>SESSION-EP-123</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`;
    return res.type("text/xml").send(soapResponse(inner));
  }

  // 2) sendRequestXML
if (xml.includes("<sendRequestXML")) {
  const qbxml = minimalQBXMLRequest();
  const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
  <sendRequestXMLResult>${qbxml}</sendRequestXMLResult>
</sendRequestXMLResponse>`;
  return res.type("text/xml").send(soapResponse(inner));
}

  // 3) receiveResponseXML
  if (xml.includes("<receiveResponseXML")) {
    const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
    return res.type("text/xml").send(soapResponse(inner));
  }

  // 4) getLastError
  if (xml.includes("<getLastError")) {
    const inner = `<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`;
    return res.type("text/xml").send(soapResponse(inner));
  }

  // 5) connectionError
  if (xml.includes("<connectionError")) {
    const inner = `<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`;
    return res.type("text/xml").send(soapResponse(inner));
  }

  // 6) closeConnection
  if (xml.includes("<closeConnection")) {
    const inner = `<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`;
    return res.type("text/xml").send(soapResponse(inner));
  }

  // fallback
  const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
  return res.type("text/xml").send(soapResponse(inner));
});

app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
