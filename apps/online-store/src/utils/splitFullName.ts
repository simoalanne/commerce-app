export function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return {
      firstName: undefined,
      lastName: undefined,
    };
  }

  const [firstNameRaw = "", ...lastNameParts] = normalized.split(" ");

  return {
    firstName: firstNameRaw || undefined,
    lastName: lastNameParts.join(" ") || undefined,
  };
}
