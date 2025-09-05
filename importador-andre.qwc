import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

/** Escapar caracteres perigosos para XML */
const x = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Gera QBXML CheckAdd com 1..N linhas de despesa */
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

/** Endpoint dinâmico: /check.qbxml?bank=...&payee=...&date=YYYY-MM-DD&amount=...&account=...&memo=...&ref=... 
 *  Para múltiplas linhas: line1_account=...&line1_amount=...&line1_memo=...&line2_account=...&line2_amount=...
 */
app.get("/check.qbxml", (req, res) => {
  const {
    bank,
    payee,
    date,
    memo,
    ref,
    account,
    amount,
    // múltiplas linhas por padrão: line{n}_account / line{n}_amount / line{n}_memo
    ...rest
  } = req.query;

  if (!bank || !payee || !date) {
    return res
      .status(400)
      .send("Missing required params: bank, payee, date");
  }

  // construir linhas
  const lines = [];

  // linha simples via account/amount (para conveniência)
  if (account && amount) {
    lines.push({
      accountFullName: account,
      amount,
      memo,
    });
  }

  // procurar line{n}_account / line{n}_amount / line{n}_memo
  const keys = Object.keys(rest);
  const indexes = new Set(
    keys
      .map((k) => {
        const m = k.match(/^line(\d+)_/);
        return m ? Number(m[1]) : null;
      })
      .filter((v) => v !== null)
  );

  indexes.forEach((i) => {
    const acc = req.query[`line${i}_account`];
    const amt = req.query[`line${i}_amount`];
    const mem = req.query[`line${i}_memo`];
    if (acc && amt) {
      lines.push({
        accountFullName: acc,
        amount: amt,
        memo: mem,
      });
    }
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

/** Exemplo pronto para “Canada Wise USD” */
app.get("/check-exemplo.qbxml", (req, res) => {
  const xml = gerarCheckAddQBXML({
    bankAccountFullName: "Canada Wise USD",
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
  res.set("Content-Type", "text/xml; charset=utf-8");
  res.send(xml);
});

app.get("/", (_req, res) => {
  res.send("Servidor QBXML ativo ✅");
});

app.listen(PORT, () => {
  console.log(`Servidor QBXML ativo na porta ${PORT}`);
});
