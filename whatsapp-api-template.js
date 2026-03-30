const url = "https://graph.facebook.com/v22.0/1117077824813339/messages";
const headers = {
  "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
  "Content-Type": "application/json",
};
const body = {
  messaging_product: "whatsapp",
  to: "2348101502547",
  type: "template",
  template: {
    name: "new_message",
    language: {
      code: "en"
    },
    components: [
      {
        type: "body",
        parameters: [
          {
            type: "text",
            parameter_name: "customer_name",
            text: "Allen"
          }
        ]
      }
    ]
  }
};
const response = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify(body),
});
const data = await response.json();
console.log(data);