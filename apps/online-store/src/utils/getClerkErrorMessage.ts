type ClerkErrorShape = {
  errors?: Array<{
    longMessage?: string;
    message?: string;
  }>;
};

export function getClerkErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === "object" && error !== null && "errors" in error) {
    const errors = (error as ClerkErrorShape).errors;
    const firstError = errors?.[0];
    if (firstError?.longMessage) {
      return firstError.longMessage;
    }
    if (firstError?.message) {
      return firstError.message;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}
