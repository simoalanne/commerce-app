import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

const color = {
  page: "#f9f9f9",
  card: "#ffffff",
  header: "#262626",
  border: "#d4d4d4",
  text: "#1a1c1c",
  strong: "#171717",
  muted: "#525252",
  link: "#404040",
  onHeader: "#f5f5f5",
  onHeaderMuted: "#e5e5e5",
  placeholder: "#f3f3f3",
};

const fontFamily = "Inter, Helvetica Neue, Arial, sans-serif";

// Classes the media query below narrows on small screens.
const mobileCss = `
@media only screen and (max-width: 480px) {
  .mobile-outer { padding-left: 8px !important; padding-right: 8px !important; }
  .mobile-section { padding-left: 16px !important; padding-right: 16px !important; }
  .mobile-header { padding-left: 18px !important; padding-right: 18px !important; }
}`;

export const EmailLayout = ({
  subject,
  preview,
  eyebrow,
  title,
  intro,
  action,
  headerLink,
  children,
}: {
  subject: string;
  preview: string;
  eyebrow: string;
  title: string;
  intro?: string;
  action?: { href: string; label: string };
  headerLink?: { prefix: string; href: string; label: string };
  children: ReactNode;
}) => (
  <Html>
    <Head>
      <title>{subject}</title>
      <style>{mobileCss}</style>
    </Head>
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: color.page, fontFamily, margin: 0 }}>
      <Container className="mobile-outer" style={{ maxWidth: 600, padding: "24px 12px" }}>
        <Section
          style={{
            backgroundColor: color.card,
            border: `1px solid ${color.border}`,
            borderRadius: 24,
          }}
        >
          <Section
            className="mobile-header"
            style={{
              backgroundColor: color.header,
              borderRadius: "24px 24px 0 0",
              padding: "30px 24px 28px",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "1.8px",
                textTransform: "uppercase",
                color: color.onHeaderMuted,
              }}
            >
              {eyebrow}
            </Text>
            <Text
              style={{
                margin: "12px 0 0",
                fontSize: 28,
                lineHeight: 1.15,
                fontWeight: 700,
                color: "#ffffff",
              }}
            >
              {title}
            </Text>
            {intro ? (
              <Text
                style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.6, color: color.onHeader }}
              >
                {intro}
              </Text>
            ) : null}
            {action ? (
              <Button
                href={action.href}
                style={{
                  marginTop: 20,
                  backgroundColor: color.strong,
                  color: "#ffffff",
                  borderRadius: 999,
                  fontSize: 15,
                  fontWeight: 700,
                  padding: "14px 22px",
                }}
              >
                {action.label}
              </Button>
            ) : null}
            {headerLink ? (
              <Text
                style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6, color: color.onHeader }}
              >
                {headerLink.prefix}{" "}
                <Link
                  href={headerLink.href}
                  style={{ color: color.onHeaderMuted, textDecoration: "none" }}
                >
                  {headerLink.label}
                </Link>
              </Text>
            ) : null}
          </Section>
          {children}
          <Section style={{ height: 28 }} />
        </Section>
      </Container>
    </Body>
  </Html>
);

export const EmailSection = ({ label, children }: { label?: string; children: ReactNode }) => (
  <Section className="mobile-section" style={{ padding: "28px 24px 0" }}>
    {label ? (
      <Text
        style={{
          margin: "0 0 14px",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color: color.strong,
        }}
      >
        {label}
      </Text>
    ) : null}
    {children}
  </Section>
);

export const AddressBlock = ({ label, lines }: { label: string; lines: string[] }) => (
  <>
    <Text style={{ margin: "0 0 4px", fontSize: 13, color: color.text }}>{label}</Text>
    <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: color.muted }}>
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </Text>
  </>
);

export const FieldTable = ({ rows }: { rows: { label: string; value: ReactNode }[] }) => (
  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
    <tbody>
      {rows.map((row, index) => {
        const padding = index < rows.length - 1 ? "0 0 10px" : 0;
        return (
          <tr key={row.label} style={{ fontSize: 13, lineHeight: 1.55 }}>
            <td
              style={{
                width: "42%",
                padding,
                paddingRight: 12,
                color: color.text,
                fontWeight: 700,
              }}
            >
              {row.label}
            </td>
            <td style={{ padding, color: color.muted }}>{row.value}</td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export type EmailItem = {
  name: string;
  initials: string;
  imageUrl: string | null;
  imageAlt: string;
  lineItem?: string;
  vendor: string | null;
  total: string;
};

export const ItemRows = ({ items }: { items: EmailItem[] }) => (
  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
    <tbody>
      {items.map((item, index) => (
        <tr key={index}>
          <td
            style={{
              padding: "16px 0",
              borderBottom: index < items.length - 1 ? `1px solid ${color.border}` : undefined,
            }}
          >
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td style={{ width: 56, verticalAlign: "top" }}>
                    {item.imageUrl ? (
                      <Img
                        src={item.imageUrl}
                        alt={item.imageAlt}
                        width={48}
                        height={48}
                        style={{
                          borderRadius: 10,
                          objectFit: "cover",
                          background: color.placeholder,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          background: color.placeholder,
                          color: color.strong,
                          fontSize: 14,
                          fontWeight: 800,
                          lineHeight: "48px",
                          textAlign: "center",
                        }}
                      >
                        {item.initials}
                      </div>
                    )}
                  </td>
                  <td
                    style={{ verticalAlign: "top", padding: "0 8px", overflowWrap: "break-word" }}
                  >
                    <div
                      style={{ fontSize: 14, fontWeight: 800, color: color.text, lineHeight: 1.35 }}
                    >
                      {item.name}
                    </div>
                    {item.lineItem ? (
                      <div
                        style={{ fontSize: 13, color: color.muted, marginTop: 3, lineHeight: 1.4 }}
                      >
                        {item.lineItem}
                      </div>
                    ) : null}
                    {item.vendor ? (
                      <div
                        style={{ fontSize: 12, color: color.muted, marginTop: 3, lineHeight: 1.4 }}
                      >
                        {item.vendor}
                      </div>
                    ) : null}
                  </td>
                  <td
                    style={{
                      verticalAlign: "top",
                      textAlign: "right",
                      whiteSpace: "nowrap",
                      paddingLeft: 8,
                      fontSize: 14,
                      fontWeight: 800,
                      color: color.strong,
                      lineHeight: 1.35,
                    }}
                  >
                    {item.total}
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
);

export const TotalsTable = ({
  rows = [],
  total,
  footnote,
}: {
  rows?: { label: string; value: string }[];
  total: { label: string; value: string };
  footnote?: { label: string; value: string };
}) => {
  const totalCell = {
    padding: "14px 0 0",
    fontSize: 17,
    fontWeight: 800,
    color: color.strong,
    borderTop: `1px solid ${color.border}`,
  };
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ fontSize: 15, lineHeight: 1.6 }}
    >
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <td style={{ padding: "6px 0", color: color.muted }}>{row.label}</td>
            <td
              style={{
                padding: "6px 0",
                textAlign: "right",
                color: color.muted,
                whiteSpace: "nowrap",
              }}
            >
              {row.value}
            </td>
          </tr>
        ))}
        <tr>
          <td style={totalCell}>{total.label}</td>
          <td style={{ ...totalCell, textAlign: "right", whiteSpace: "nowrap" }}>{total.value}</td>
        </tr>
        {footnote ? (
          <tr>
            <td style={{ padding: "4px 0 0", color: color.muted, fontSize: 13 }}>
              {footnote.label}
            </td>
            <td
              style={{
                padding: "4px 0 0",
                textAlign: "right",
                color: color.muted,
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              {footnote.value}
            </td>
          </tr>
        ) : null}
      </tbody>
    </table>
  );
};

export const MutedText = ({ children, size = 13 }: { children: ReactNode; size?: number }) => (
  <Text style={{ margin: 0, fontSize: size, lineHeight: 1.6, color: color.muted }}>{children}</Text>
);

export const UrlLink = ({ href }: { href: string }) => (
  <Text style={{ margin: "10px 0 0", fontSize: 13, lineHeight: 1.6 }}>
    <Link
      href={href}
      style={{ color: color.link, textDecoration: "underline", wordBreak: "break-all" }}
    >
      {href}
    </Link>
  </Text>
);

export const MailLink = ({ email }: { email: string }) => (
  <Link href={`mailto:${email}`} style={{ color: color.link, textDecoration: "underline" }}>
    {email}
  </Link>
);

/** Help text and recipient line closing the customer emails. */
export const ContactFooter = ({
  helpText,
  contactEmail,
  recipientLabel,
  recipientEmail,
}: {
  // Contains an "{email}" placeholder for the contact address.
  helpText: string;
  contactEmail: string;
  recipientLabel: string;
  recipientEmail: string;
}) => {
  const [before, after = ""] = helpText.split("{email}");
  return (
    <Section className="mobile-section" style={{ padding: "24px 24px 0" }}>
      <MutedText size={12}>
        {before}
        <MailLink email={contactEmail} />
        {after}
      </MutedText>
      <Text style={{ margin: "16px 0 0", fontSize: 12, lineHeight: 1.6, color: color.muted }}>
        {recipientLabel} <MailLink email={recipientEmail} />
      </Text>
    </Section>
  );
};
