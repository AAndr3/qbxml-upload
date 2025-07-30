import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/transacoes-exemplo.qbxml", (req, res) => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <ExpenseAddRq>
      <ExpenseAdd>
        <PayeeRef>
          <FullName>Loja Exemplo</FullName>
        </PayeeRef>
        <TxnDate>2025-07-30</TxnDate>
        <Memo>Compra de materiais</Memo>
        <ExpenseLineAdd>
          <AccountRef>
            <FullName>Office Supplies</FullName>
          </AccountRef>
          <Amount>45.60</Amount>
        </ExpenseLineAdd>
      </ExpenseAdd>
    </ExpenseAddRq>
  </QBXMLMsgsRq>
</QBXML>`;
  res.set("Content-Type", "text/xml");
  res.send(xml);
});

app.get("/", (req, res) => {
  res.send("Servidor QBXML ativo ✅");
});

app.listen(PORT, () => {
  console.log(`Servidor QBXML ativo na porta ${PORT}`);
});
