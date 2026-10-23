const ALARM_SETUP_TIMEOUT_MS = 10_000;

export const withAlarmSetupTimeout = async <T>(
  operation: Promise<T>
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Alarm setup timed out. Try again."));
    }, ALARM_SETUP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([operation, timeout]);
  } finally {
    clearTimeout(timer);
  }
};
