// server.js
const express = require("express");
const app = express();
const port = process.env.PORT || 3000;

// Accept raw SOAP with proper encoding handling
app.use(express.text({ type: "*/*", limit: "2mb" }));

// SOAP wrapper - ensure no extra whitespace
function soap(inner) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
${inner}
  </soap:Body>
</soap:Envelope>`;
}

// Ultra-minimal QBXML for validation - start with this
function buildHostQueryRq() {
  // NO <?xml version declaration here - it's already in the SOAP envelope
  return `<?qbxml version="14.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <HostQueryRq requestID="1"/>
  </QBXMLMsgsRq>
</QBXML>`;
}

// After HostQuery works, try this simpler query first
function buildCompanyQueryRq() {
  return `<?qbxml version="14.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CompanyQueryRq requestID="1"/>
  </QBXMLMsgsRq>
</QBXML>`;
}

// Then try customer query with minimal fields
function buildCustomerQueryRq() {
  return `<?qbxml version="14.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq requestID="1">
      <MaxReturned>1</MaxReturned>
    </CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// Simplified deposit - use the actual bank account name
function buildDepositAddRq() {
  return `<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <DepositAddRq requestID="1">
      <DepositAdd>
        <TxnDate>2025-09-06</TxnDate>
        <DepositToAccountRef>
          <FullName>Canada Wise CAD</FullName>
        </DepositToAccountRef>
        <Memo>Test API Deposit</Memo>
        <DepositLineAdd>
          <Amount>100.00</Amount>
          <Memo>Test deposit line from API</Memo>
        </DepositLineAdd>
      </DepositAdd>
    </DepositAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// Simple pages
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// QBWC endpoint
app.post("/upload", (req, res) => {
  const xml = req.body || "";
  const action = req.headers.soapaction || "";
  const x = xml.toLowerCase();

  console.log("\n=== QBWC CALL RECEIVED ===");
  console.log("SOAPAction:", action);
  console.log("RAW SOAP:\n", xml);
  console.log("================================\n");

  // Set proper response headers for all responses
  res.set({
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': action
  });

  // serverVersion
  if (x.includes("<serverversion")) {
    const inner = `<serverVersionResponse xmlns="http://developer.intuit.com/">
  <serverVersionResult>1.0.0</serverVersionResult>
</serverVersionResponse>`;
    return res.send(soap(inner));
  }

  // clientVersion
  if (x.includes("<clientversion")) {
    const inner = `<clientVersionResponse xmlns="http://developer.intuit.com/">
  <clientVersionResult></clientVersionResult>
</clientVersionResponse>`;
    return res.send(soap(inner));
  }

  // authenticate
  if (x.includes("<authenticate")) {
    const inner = `<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>SESSION-EP-123</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`;
    console.log(">> authenticate() - Session started");
    return res.send(soap(inner));
  }

  // sendRequestXML - This is where your XML gets sent to QB
  if (x.includes("<sendrequestxml")) {
    // Progress through different request types:
    // 1. buildHostQueryRq() ✓ WORKING!
    // 2. buildCompanyQueryRq() ✓
    // 3. buildCustomerQueryRq() ✓ 
    // 4. buildDepositAddRq() <- Testing deposit with line now!
    
    const qbxml = buildDepositAddRq(); // <-- Testing deposit transaction
    
    // Log exactly what we're sending
    console.log(">> sendRequestXML() OUT (QBXML enviado a QB):");
    console.log(qbxml);
    console.log("================================");

    const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
  <sendRequestXMLResult>${qbxml}</sendRequestXMLResult>
</sendRequestXMLResponse>`;

    return res.send(soap(inner));
  }

  // receiveResponseXML - QB's response comes back here
  if (x.includes("<receiveresponsexml")) {
    console.log(">> receiveResponseXML() IN (resposta do QB):");
    console.log(xml);
    console.log("================================");
    
    // Check for errors in the response
    if (xml.includes("0x80040400")) {
      console.log("ERROR: QuickBooks XML parsing error detected!");
      console.log("This usually means malformed XML was sent to QB.");
    }
    
    const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
    return res.send(soap(inner));
  }

  // getLastError
  if (x.includes("<getlasterror")) {
    const inner = `<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`;
    return res.send(soap(inner));
  }

  // connectionError
  if (x.includes("<connectionerror")) {
    const inner = `<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`;
    return res.send(soap(inner));
  }

  // closeConnection
  if (x.includes("<closeconnection")) {
    console.log(">> closeConnection() - Session ended");
    const inner = `<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`;
    return res.send(soap(inner));
  }

  // fallback
  console.log(">> Unhandled request - using fallback response");
  const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
  return res.send(soap(inner));
});

app.listen(port, () => {
  console.log(`Servidor QBWC rodando na porta ${port}`);
  console.log(`Endpoint: http://localhost:${port}/upload`);
});
