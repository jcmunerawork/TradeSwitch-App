// file: tradeLockerStreamClient.js
import { io } from "socket.io-client";

// --- CONFIGURA ESTO ---
const API_KEY = "tl-7xUz3A0a2aAReLuGnaU%kmaF";       // la API-key (staging / dev)
const AUTH_TOKEN = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ0cmFkZWxvY2tlci1hcGkiLCJhdWQiOiJ0cmFkZWxvY2tlci1zdHJlYW1zIiwidHlwZSI6ImFjY2Vzc190b2tlbiIsInN1YiI6IlRGVU5EUyNiZDNlMDY2ZC0yZjFjLTQ2OWItYjJkZS1kMWI3ODQ2NzBmNmQjMSIsInVpZCI6ImJkM2UwNjZkLTJmMWMtNDY5Yi1iMmRlLWQxYjc4NDY3MGY2ZCIsImFpZCI6IkQjMTQ5MjY1NSIsImJyYW5kIjoiVEZVTkRTIiwiaG9zdCI6ImJzYi50cmFkZWxvY2tlci5jb20iLCJzaWQiOiJkYmIyZWU1ZC0yMTM5LTRhZDMtOTllMC1jMGE0ZDVjNDkzNmUiLCJlbWFpbCI6InRlc3RAdGhlZnVuZGVkcGlja3MuY29tIiwiYnJhbmRVc2VySWQiOiJiZDNlMDY2ZC0yZjFjLTQ2OWItYjJkZS1kMWI3ODQ2NzBmNmQiLCJhY2NvdW50VHlwZSI6IkRFTU8iLCJpYXQiOjE3NjQ2MDQ3NjAsImV4cCI6MTc2NDYwODM2MH0.YaxTvu1v8nVyvS8XAStefelBogt0t6eGHK4h03wH-J1NabobmDkFdy9dzMBYIgeqL5P13xw_Oz4OaYX270udLbxy16SsWjTMfjd6Uyp_x8HR8cWdwoI7pie0G3qcSmk6jov8tXsIa-IitQnWu9bI7IHwQK_Cjbg1XlYRr0_iximfuvTW1UTr0EcVawGBIt7CxQYD2DGAlOXo-spcTeX_gFUopK4L7i-LP_f3IXa7nSwBEnPNPMNw_-ev3RR8ndLSbFY2bLY-w27AgyNhFYgbbdA1AzW0Yfk13J8XJX4EgwljHFGwlSzMYnc4Zz8TunTwQArLzEmISnU4gcJj-QLYNw"; // el JWT que obtuviste vía REST
const ACCOUNT_ID = "1492655";           // id de la cuenta TradeLocker
const BRAND_ID = "TFUNDS";         // brandId (o server name), según doc
// ------------------------

// URL del servidor de streams — ambiente "development"
const SOCKET_URL = "wss://api-dev.tradelocker.com";
// Namespace / path según la documentación
const NAMESPACE = "/streams-api";
const PATH = "/streams-api/socket.io";

const socket = io(SOCKET_URL + NAMESPACE, {
  path: PATH,
  transports: ["websocket"],
  // En Node.js, extraHeaders sí se envían — no en navegador
  extraHeaders: {
    "developer-api-key": API_KEY
  },
  auth: {
    authToken: AUTH_TOKEN
  }
});

socket.on("connect", () => {
  console.log("✅ Connected. Socket id:", socket.id);

  // Emitir suscripción a la cuenta
  socket.emit("stream", {
    action: "SUBSCRIBE",
    accountId: ACCOUNT_ID,
    brandId: BRAND_ID,
    authToken: AUTH_TOKEN,
    type: "AccountStatus",
    currency: "USD"
  }, (ack) => {
    console.log("✅ Subscription ACK:", ack);
  });

  socket.emit("stream", {
    action: "SUBSCRIBE",
    accountId: ACCOUNT_ID,
    authToken: AUTH_TOKEN,
  }, (ack) => {
    console.log("✅ Subscription ACK:", ack);
  });
});

socket.on("stream", (data) => {
  console.log("📥 stream event:", data);
});

socket.on("disconnect", (reason) => {
  console.log("⚠️ Disconnected:", reason);
});

socket.on("connect_error", (err) => {
  console.error("🚨 Connection error:", err);
});

socket.on("error", (err) => {
  console.error("⚠️ Error:", err);
});
