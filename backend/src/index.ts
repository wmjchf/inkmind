import { createApp } from "./app";
import { config } from "./config";
import { maybeAutoInitDb } from "./db/initSchema";

async function main() {
  await maybeAutoInitDb();
  const app = createApp();
  app.listen(config.port, () => {
    console.log(`InkMind API listening on http://127.0.0.1:${config.port}`);
  });
}

void main();
