import { drainJobs } from "../src/lib/jobs/process";
import { enqueueJob } from "../src/lib/jobs/queue";
import { loadEnvFile } from "../src/lib/load-env";

async function loop() {
  loadEnvFile();
  console.log("GrokBot worker iniciado");
  setInterval(() => {
    void enqueueJob("aggregate_dashboard_daily", { grokbotId: "*" }).catch(() => undefined);
  }, 15 * 60 * 1000);
  for (;;) {
    try {
      const n = await drainJobs(8);
      if (!n) await new Promise((r) => setTimeout(r, 2000));
    } catch (err) {
      console.error(err);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

void loop();
