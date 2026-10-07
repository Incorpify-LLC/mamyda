import { isMainModule } from "./with-app-env.mjs";

import { deploymentErrors } from "./deployment-config.mjs";
export { deploymentErrors };

if (isMainModule(import.meta.url)) {
  const errors = deploymentErrors(process.env);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  }
}
