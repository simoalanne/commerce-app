import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import Handlebars from "handlebars";
import mjml2html from "mjml";

type TemplateVariables = Record<string, unknown>;
type MjmlParseError = Awaited<ReturnType<typeof mjml2html>>["errors"][number];
type MjmlValidationError = Error & {
  errors: MjmlParseError[];
};

const templateDirectory = new URL("./email-templates/", import.meta.url);
const compiledTemplateCache = new Map<string, Handlebars.TemplateDelegate<TemplateVariables>>();

const isMjmlValidationError = (error: unknown): error is MjmlValidationError =>
  error instanceof Error && "errors" in error && Array.isArray(error.errors);

export const renderMjmlTemplate = async (templateName: string, variables: TemplateVariables) => {
  const templatePath = new URL(templateName, templateDirectory);
  const templateFilePath = fileURLToPath(templatePath);
  let compiledTemplate = compiledTemplateCache.get(templateName);

  if (!compiledTemplate) {
    const template = await readFile(templateFilePath, "utf8");
    compiledTemplate = Handlebars.compile<TemplateVariables>(template, {
      strict: true,
    });
    compiledTemplateCache.set(templateName, compiledTemplate);
  }

  const mjml = compiledTemplate(variables);

  try {
    const { html } = await mjml2html(mjml, {
      filePath: templateFilePath,
      validationLevel: "strict",
    });

    return html;
  } catch (error) {
    if (isMjmlValidationError(error)) {
      throw new Error(
        `MJML validation failed for ${templateName}: ${error.errors.map((validationError) => validationError.formattedMessage ?? validationError.message).join(" | ")}`,
      );
    }

    throw error;
  }
};
