/* Payload admin root layout — scaffold per @payloadcms/next */
import config from "@payload-config";
import "@payloadcms/next/css";
import "./admin-theme.css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import { Bricolage_Grotesque, Caveat, Fraunces } from "next/font/google";
import React from "react";
import { importMap } from "./admin/importMap.js";
import { adminConfigured } from "./admin/setup-notice";

/* The public site's voices, carried into the admin (see admin-theme.css). */
const ui = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-admin-ui", display: "swap" });
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-admin-display",
  display: "swap",
  axes: ["SOFT", "WONK"],
  style: ["normal", "italic"],
});
const note = Caveat({ subsets: ["latin"], variable: "--font-admin-note", display: "swap" });
const fontVars = `${ui.variable} ${display.variable} ${note.variable}`;

type Args = {
  children: React.ReactNode;
};

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({
    ...args,
    config,
    importMap,
  });
};

const Layout = ({ children }: Args) =>
  adminConfigured() ? (
    <RootLayout
      config={config}
      htmlProps={{ className: fontVars }}
      importMap={importMap}
      serverFunction={serverFunction}
    >
      {children}
    </RootLayout>
  ) : (
    <html lang="en" className={fontVars}>
      <body>{children}</body>
    </html>
  );

export default Layout;
