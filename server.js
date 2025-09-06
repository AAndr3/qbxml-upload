const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

// Middleware para aceitar texto plano (usado pelo Web Connector)
app.use(bodyParser.text({ type: "*/*" }));

// Endpoint de teste para o browser
app.get("/", (req, res) => {
  res.send("Servidor QBXML ativo.");
});

// Página de suporte (usada no ficheiro .qwc)
app.get("/support", (req, res) => {
  res.send("Página de suporte Earth Protex.");
});

// Endpoint principal que o Web Connector chama
app.post("/upload", (req, res) => {
  // Ignora a password por enquanto
  console.log("=== RECEIVED REQUEST ===");
  console.log("Headers:", req.headers);
  console.log("Body:", req.body);
  console.log("Ligação recebida do Web Connector");
  console.log("Authorization header:", req.headers.authorization); // opcional

  const responseXML = `<?xml version="1.0" encoding="utf-8"?>
  <?qbxml version="13.0"?>
  <QBXML>
    <QBXMLMsgsRs>
      <GeneralSummaryQueryRs statusCode="0" statusSeverity="Info" statusMessage="Ligado com sucesso (sem validar password)">
      </GeneralSummaryQueryRs>
    </QBXMLMsgsRs>
  </QBXML>`;

  res.type("text/xml").send(responseXML);
});


// Iniciar servidor
app.listen(port, () => {
  console.log(`Servidor a correr na porta ${port}`);
});
