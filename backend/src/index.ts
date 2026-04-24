import fs from "fs";
import https from "https";
import { createApp } from "./app";
import { config } from "./config";
import { maybeAutoInitDb } from "./db/initSchema";

async function main() {
  await maybeAutoInitDb();
  const app = createApp();

  if (config.ssl.enabled) {
    const credentials = {
      key: fs.readFileSync(config.ssl.keyPath),
      cert: fs.readFileSync(config.ssl.certPath),
    };
    https.createServer(credentials, app).listen(config.port, () => {
      console.log(`InkMind API listening on https://0.0.0.0:${config.port}`);
    });
  } else {
    app.listen(config.port, () => {
      console.log(`InkMind API listening on http://127.0.0.1:${config.port}`);
    });
  }
}

void main();
