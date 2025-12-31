import * as core from "@actions/core";
import { VERSION } from "@workpipe/compiler";

export { VERSION };

export async function run(): Promise<void> {
  try {
    core.info(`WorkPipe Action v${VERSION}`);
    core.info("Action not yet implemented");
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
}

if (process.env.GITHUB_ACTIONS) {
  run();
}
