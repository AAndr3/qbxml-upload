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
    return res.status(400).send("Provide at least one expense line (account/amount or lineN_*).");
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

app.get("/check-exemplo.qbxml", (_req, res) => {
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(exemploQBXML());
});

// Continúa no ficheiro seguinte com o WSDL e soapService...
