import z from "zod";

export const ContactSubmissionStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);
