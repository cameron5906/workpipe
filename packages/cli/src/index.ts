#!/usr/bin/env node
import { Command } from "commander";
import { VERSION } from "@workpipe/compiler";
import { registerBuildCommand } from "./commands/build.js";
import { registerCheckCommand } from "./commands/check.js";
import { registerFmtCommand } from "./commands/fmt.js";
import { registerInitCommand } from "./commands/init.js";

const program = new Command();

program
  .name("workpipe")
  .description("WorkPipe DSL compiler for GitHub Actions")
  .version(VERSION);

registerBuildCommand(program);
registerCheckCommand(program);
registerFmtCommand(program);
registerInitCommand(program);

program.parse();
