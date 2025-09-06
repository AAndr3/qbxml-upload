const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

// Accept raw text (SOAP XML) from QBWC
app.use(bodyParser.text({ type: "*/*" }));

// Simple pages
app.get("/", (_req, res) => res.send("Servidor QBXML ativo."));
app.get("/support", (_req, res) => res.send("Página de suporte Earth Protex."));

// ---- Helpers ----
function soapResponse(innerXml) {
  return `<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${innerXml}
  </soap:Body>
</soap:Envelope>`;
}

// Minimal QBXML request to ask QB for something small (safe)
function minimalQBXMLRequest() {
  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <CustomerQueryRq requestID="1" MaxReturned="1"></CustomerQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
}

// ---- Main SOAP endpoint for QBWC ----
app.post("/upload", (req, res) => {
  const xml = req.body || "";
  const action = (req.headers["soapaction"] || "").toLowerCase();

  console.log("=== QBWC CALL ===");
  console.log("SOAPAction:", action);
  console.log("Body:", xml.substring(0, 500)); // log first 500 chars for brevity

  // 1) authenticate
  if (action.includes("authenticate") || xml.includes("<authenticate")) {
    // Accept any username/password for now and return a session token + empty string (company file)
    const token = "SESSION-EP-123"; // could be dynamic
    const inner = `<authenticateResponse xmlns="http://developer.intuit.com/">
  <authenticateResult>
    <string>${token}</string>
    <string></string>
  </authenticateResult>
</authenticateResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // 2) sendRequestXML — QBWC asks us what to send to QuickBooks
  if (action.includes("sendrequestxml") || xml.includes("<sendRequestXML")) {
    const qbxml = minimalQBXMLRequest();
    const inner = `<sendRequestXMLResponse xmlns="http://developer.intuit.com/">
  <sendRequestXMLResult>${escapeXml(qbxml)}</sendRequestXMLResult>
</sendRequestXMLResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // 3) receiveResponseXML — QBWC returns response from QB; we must return percentage done (0–100)
  if (action.includes("receiveresponsexml") || xml.includes("<receiveResponseXML")) {
    // You could parse the response here and decide progress. We'll say we're done.
    const percent = 100;
    const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>${percent}</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // 4) getLastError — QBWC asks last error message (if any). Return empty string if no error.
  if (action.includes("getlasterror") || xml.includes("<getLastError")) {
    const inner = `<getLastErrorResponse xmlns="http://developer.intuit.com/">
  <getLastErrorResult></getLastErrorResult>
</getLastErrorResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // 5) connectionError — QBWC notifies connection error
  if (action.includes("connectionerror") || xml.includes("<connectionError")) {
    const inner = `<connectionErrorResponse xmlns="http://developer.intuit.com/">
  <connectionErrorResult>done</connectionErrorResult>
</connectionErrorResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // 6) closeConnection — QBWC asks to close session; return a message
  if (action.includes("closeconnection") || xml.includes("<closeConnection")) {
    const inner = `<closeConnectionResponse xmlns="http://developer.intuit.com/">
  <closeConnectionResult>OK</closeConnectionResult>
</closeConnectionResponse>`;

    return res.type("text/xml").send(soapResponse(inner));
  }

  // Fallback (shouldn't happen often)
  const inner = `<receiveResponseXMLResponse xmlns="http://developer.intuit.com/">
  <receiveResponseXMLResult>100</receiveResponseXMLResult>
</receiveResponseXMLResponse>`;
  return res.type("text/xml").send(soapResponse(inner));
});

// Escape XML content when embedding QBXML inside SOAP
function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
