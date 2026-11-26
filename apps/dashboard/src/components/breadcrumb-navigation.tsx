import { Fragment } from "react";
import { Link, useLocation } from "react-router-dom";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

type BreadcrumbNavigationItem = {
  href?: string;
  label: string;
};

function formatLabel(value: string) {
  return value
    .replaceAll("-", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const getEntityName = (key: string) => {
  const idRemoved = key.replace("Id", "");
  const capitalized = idRemoved.charAt(0).toUpperCase() + idRemoved.slice(1).toLowerCase();
  return `${capitalized}s`;
};

function getEntityRoute(key: string) {
  return `/${key.replace("Id", "").replace("Name", "")}s`;
}

function getQueryItems(search: string): BreadcrumbNavigationItem[] {
  const searchParams = new URLSearchParams(search);
  const items: BreadcrumbNavigationItem[] = [];
  const seenKeys = new Set<string>();

  for (const [rawKey, rawValue] of searchParams.entries()) {
    const key = rawKey.trim();
    const value = rawValue.trim();

    if (!key || !value || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);

    if (key.endsWith("Id")) {
      items.push({
        href: getEntityRoute(key),
        label: getEntityName(key),
      });
    }

    if (key.endsWith("Name")) {
      items.push({
        href: getEntityRoute(key),
        label: decodeURIComponent(value),
      });
    }
  }

  return items;
}

function getPathItems(pathname: string): BreadcrumbNavigationItem[] {
  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => formatLabel(segment));

  return segments.map((segment, index) => ({
    href:
      index < segments.length - 1
        ? `/${pathname
            .split("/")
            .filter(Boolean)
            .slice(0, index + 1)
            .join("/")}`
        : undefined,
    label: segment,
  }));
}

export function BreadcrumbNavigation() {
  const { pathname, search } = useLocation();
  const items = [...getQueryItems(search), ...getPathItems(pathname)];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {index === items.length - 1 || !item.href ? (
                <BreadcrumbPage className={items.length === 1 ? "text-xl font-semibold" : ""}>
                  {item.label}
                </BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
