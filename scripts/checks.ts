/** One end-to-end check and what was observed. */
export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** Prints each check and fails the process if any did. */
export const printChecks = (checks: readonly Check[]): void => {
  for (const check of checks) {
    console.log(
      `${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`
    );
  }

  if (checks.some(({ ok }) => !ok)) {
    process.exitCode = 1;
  }
};
