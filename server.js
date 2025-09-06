 // server.js (ESM)
import express from "express";
import soap from "soap";
import { fileURLToPath } from "url";
import path from "path";

// ---------- ENV & SETUP ----------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const QBWC_USER = process.env.QBWC_USER || "andre";
const QBWC_PASSWORD = process.env.QBWC_PASSWORD || "Coolio135!";
const DEFAULT_BANK = process.env.QBWC_BANK || "Canada Wise USD";
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

let hasPendingJob = true; // demo: envia 1 CheckAdd e depois pára
let lastError = "";

// ---------- HELPERS ----------
const x = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

function gerarCheckAddQBXML({
  bankAccountFullName,
  payeeFullName,
  txnDate,
  memo,
  refNumber,
  lines, // [{ accountFullName, amount, memo }]
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

function exemploQBXML() {
  return gerarCheckAddQBXML({
    bankAccountFullName: DEFAULT_BANK,
    payeeFullName: "TUV SUD SOUTH ASIA PRIVATE LIMITED",
    txnDate: "2025-09-05",
    memo: "Pagamento auditoria fábrica",
    refNumber: "QB-WISE-467",
    lines: [
      {
        accountFullName: "Professional Services:Factory Audits and Certificates",
        amount: 1275.58,
        memo: "Auditoria e certificados",
      },
    ],
  });
}

// ---------- ROTAS HTTP ----------
app.get("/", (_req, res) => {
  res.send("Servidor QBXML ativo ✅");
});

/** Descarregar o .QWC para instalar no Web Connector */
app.get("/andre-importador.qwc", (_req, res) => {
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
  <Scheduler><RunEveryNMinutes>5</RunEveryNMinutes></Scheduler>
  <IsReadOnly>false</IsReadOnly>
</QBWCXML>`;
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.set("Content-Disposition", 'attachment; filename="andre-importador.qwc"');
  res.send(qwc);
});

/** Dinâmico: /check.qbxml?...  */
app.get("/check.qbxml", (req, res) => {
  const { bank, payee, date, memo, ref, account, amount, ...rest } = req.query;
  if (!bank || !payee || !date) {
    return res.status(400).send("Missing required params: bank, payee, date");
  }

  const lines = [];
  if (account && amount) lines.push({ accountFullName: account, amount, memo });

  const keys = Object.keys(rest);
  const idxs = new Set(
    keys
      .map((k) => (k.startsWith("line") ? Number(k.match(/^line(\d+)_/)?.[1]) : null))
      .filter((v) => v !== null)
  );
  idxs.forEach((i) => {
    const acc = req.query[`line${i}_account`];
    const amt = req.query[`line${i}_amount`];
    const mem = req.query[`line${i}_memo`];
    if (acc && amt) lines.push({ accountFullName: acc, amount: amt, memo: mem });
  });

  if (lines.length === 0) {
    return res
      .status(400)
      .send("Provide at least one expense line (account/amount or lineN_*).");
  }

  const xml = gerarCheckAddQBXML({
    bankAccountFullName: bank,
    payeeFullName: payee,
    txnDate: date,
    memo,
    refNumber: ref,
    lines,
  });

  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(xml);
});

/** Exemplo fixo para testar */
app.get("/check-exemplo.qbxml", (_req, res) => {
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(exemploQBXML());
});

// ---------- WSDL INLINE (evita problemas de path no Render) ----------
const WSDL = `<?xml version="1.0" encoding="UTF-8"?>
<definitions name="QBWebConnectorSvc"
  targetNamespace="http://developer.intuit.com/"
  xmlns:tns="http://developer.intuit.com/"
  xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/">

  <wsdl:types>
    <xsd:schema targetNamespace="http://developer.intuit.com/">
      <xsd:complexType name="ArrayOfString">
        <xsd:sequence>
          <xsd:element name="string" type="xsd:string" minOccurs="0" maxOccurs="unbounded"/>
        </xsd:sequence>
      </xsd:complexType>

      <xsd:element name="authenticate">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="strUserName" type="xsd:string"/>
          <xsd:element name="strPassword" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="authenticateResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="authenticateResult" type="tns:ArrayOfString"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <xsd:element name="sendRequestXML">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="ticket" type="xsd:string"/>
          <xsd:element name="strHCPResponse" type="xsd:string"/>
          <xsd:element name="strCompanyFileName" type="xsd:string"/>
          <xsd:element name="qbXMLCountry" type="xsd:string"/>
          <xsd:element name="qbXMLMajorVers" type="xsd:int"/>
          <xsd:element name="qbXMLMinorVers" type="xsd:int"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="sendRequestXMLResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="sendRequestXMLResult" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <xsd:element name="receiveResponseXML">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="ticket" type="xsd:string"/>
          <xsd:element name="response" type="xsd:string"/>
          <xsd:element name="hresult" type="xsd:string"/>
          <xsd:element name="message" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="receiveResponseXMLResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="receiveResponseXMLResult" type="xsd:int"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <xsd:element name="getLastError">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="ticket" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="getLastErrorResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="getLastErrorResult" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>

      <xsd:element name="closeConnection">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="ticket" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="closeConnectionResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="closeConnectionResult" type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </wsdl:types>

  <wsdl:message name="authenticateRequest"><wsdl:part name="parameters" element="tns:authenticate"/></wsdl:message>
  <wsdl:message name="authenticateResponse"><wsdl:part name="parameters" element="tns:authenticateResponse"/></wsdl:message>

  <wsdl:message name="sendRequestXMLRequest"><wsdl:part name="parameters" element="tns:sendRequestXML"/></wsdl:message>
  <wsdl:message name="sendRequestXMLResponse"><wsdl:part name="parameters" element="tns:sendRequestXMLResponse"/></wsdl:message>

  <wsdl:message name="receiveResponseXMLRequest"><wsdl:part name="parameters" element="tns:receiveResponseXML"/></wsdl:message>
  <wsdl:message name="receiveResponseXMLResponse"><wsdl:part name="parameters" element="tns:receiveResponseXMLResponse"/></wsdl:message>

  <wsdl:message name="getLastErrorRequest"><wsdl:part name="parameters" element="tns:getLastError"/></wsdl:message>
  <wsdl:message name="getLastErrorResponse"><wsdl:part name="parameters" element="tns:getLastErrorResponse"/></wsdl:message>

  <wsdl:message name="closeConnectionRequest"><wsdl:part name="parameters" element="tns:closeConnection"/></wsdl:message>
  <wsdl:message name="closeConnectionResponse"><wsdl:part name="parameters" element="tns:closeConnectionResponse"/></wsdl:message>

  <wsdl:portType name="QBWebConnectorSvcSoap">
    <wsdl:operation name="authenticate">
      <wsdl:input message="tns:authenticateRequest"/><wsdl:output message="tns:authenticateResponse"/>
    </wsdl:operation>
    <wsdl:operation name="sendRequestXML">
      <wsdl:input message="tns:sendRequestXMLRequest"/><wsdl:output message="tns:sendRequestXMLResponse"/>
    </wsdl:operation>
    <wsdl:operation name="receiveResponseXML">
      <wsdl:input message="tns:receiveResponseXMLRequest"/><wsdl:output message="tns:receiveResponseXMLResponse"/>
    </wsdl:operation>
    <wsdl:operation name="getLastError">
      <wsdl:input message="tns:getLastErrorRequest"/><wsdl:output message="tns:getLastErrorResponse"/>
    </wsdl:operation>
    <wsdl:operation name="closeConnection">
      <wsdl:input message="tns:closeConnectionRequest"/><wsdl:output message="tns:closeConnectionResponse"/>
    </wsdl:operation>
  </wsdl:portType>

  <wsdl:binding name="QBWebConnectorSvcSoap" type="tns:QBWebConnectorSvcSoap">
    <soap:binding transport="http://schemas.xmlsoap.org/soap/http" style="document"/>
    <wsdl:operation name="authenticate"><soap:operation soapAction="http://developer.intuit.com/authenticate"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="sendRequestXML"><soap:operation soapAction="http://developer.intuit.com/sendRequestXML"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="receiveResponseXML"><soap:operation soapAction="http://developer.intuit.com/receiveResponseXML"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="getLastError"><soap:operation soapAction="http://developer.intuit.com/getLastError"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
    <wsdl:operation name="closeConnection"><soap:operation soapAction="http://developer.intuit.com/closeConnection"/>
      <wsdl:input><soap:body use="literal"/></wsdl:input><wsdl:output><soap:body use="literal"/></wsdl:output>
    </wsdl:operation>
  </wsdl:binding>

  <wsdl:service name="QBWebConnectorSvc">
    <wsdl:port name="QBWebConnectorSvcSoap" binding="tns:QBWebConnectorSvcSoap">
      <soap:address location="${BASE_URL}/qbwc"/>
    </wsdl:port>
  </wsdl:service>
</definitions>`;

// ---------- IMPLEMENTAÇÃO SOAP ----------
const soapService = {
  QBWebConnectorSvc: {
    QBWebConnectorSvcSoap: {
      authenticate(args) {
        console.log("[QBWC] authenticate", args);
        const ok =
          args.strUserName === QBWC_USER && args.strPassword === QBWC_PASSWORD;
        if (ok) {
          const ticket = Date.now().toString();
          // Garante dois <string> (evita "Response not well-formed XML")
          return { authenticateResult: { string: [ticket, ""] } };
        } else {
          return { authenticateResult: { string: ["", "nvu"] } };
        }
      },
      sendRequestXML(args) {
        console.log("[QBWC] sendRequestXML", args);
        if (!hasPendingJob) {
          return { sendRequestXMLResult: "" }; // sem trabalho
        }
        const qbxml = exemploQBXML();
        console.log("[QBWC] -> enviando QBXML CheckAdd (len)", qbxml.length);
        return { sendRequestXMLResult: qbxml };
      },
      receiveResponseXML(args) {
        console.log("[QBWC] receiveResponseXML", {
          hresult: args.hresult,
          message: args.message,
          responseLen: (args.response || "").length,
        });
        hasPendingJob = false; // concluímos o job de demo
        lastError = args.hresult ? `${args.hresult} - ${args.message || ""}` : "";
        return { receiveResponseXMLResult: 100 };
      },
      getLastError() {
        console.log("[QBWC] getLastError ->", lastError || "Sem erros.");
        return { getLastErrorResult: lastError || "Sem erros." };
      },
      closeConnection() {
        console.log("[QBWC] closeConnection");
        return { closeConnectionResult: "OK" };
      },
    },
  },
};

// ---------- START ----------
const server = app.listen(PORT, () => {
  console.log(`Servidor QBXML ativo na porta ${PORT}`);
  soap.listen(server, "/qbwc", soapService, WSDL);
  console.log("SOAP /qbwc pronto");
});
