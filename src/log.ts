const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

export const log = {
  step(msg: string) {
    process.stdout.write(`${CYAN}▸${RESET} ${msg}\n`);
  },
  ok(msg: string) {
    process.stdout.write(`${GREEN}✓${RESET} ${msg}\n`);
  },
  warn(msg: string) {
    process.stdout.write(`${YELLOW}⚠${RESET} ${msg}\n`);
  },
  err(msg: string) {
    process.stderr.write(`${RED}✗${RESET} ${msg}\n`);
  },
  blank() {
    process.stdout.write("\n");
  },
  title(msg: string) {
    process.stdout.write(`${BOLD}${msg}${RESET}\n`);
  },
  dim(msg: string) {
    process.stdout.write(`${DIM}${msg}${RESET}\n`);
  },
};

/** Single-line progress counter (overwrites itself). Call done() to finish the line. */
export function progress(total: number, label: string) {
  let current = 0;
  const render = () => {
    process.stdout.write(`\r  ${current}/${total} ${label}`);
  };
  return {
    tick(n = 1) {
      current = Math.min(total, current + n);
      render();
    },
    set(n: number) {
      current = Math.min(total, Math.max(0, n));
      render();
    },
    done() {
      current = total;
      render();
      process.stdout.write("\n");
    },
  };
}
