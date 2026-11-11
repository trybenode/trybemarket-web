// A stand-in for Meta's Graph API: records every message the app tries to send.
import http from "http";
const sent = [];
let delayMs = 0;
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    if (req.url === "/_sent") { res.end(JSON.stringify(sent)); return; }
    if (req.url === "/_reset") { sent.length = 0; res.end("ok"); return; }
    if (req.url.startsWith("/_delay/")) { delayMs = Number(req.url.split("/")[2]); res.end("ok"); return; }
    const message = JSON.parse(body || "{}");
    setTimeout(() => {
      sent.push({ path: req.url, auth: req.headers.authorization, to: message.to, type: message.type, body: message.text?.body });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.out${sent.length}` }] }));
    }, delayMs);
  });
}).listen(4010, "127.0.0.1");
