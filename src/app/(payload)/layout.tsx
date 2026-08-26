/* Payload admin root layout — scaffold per @payloadcms/next */
import config from "@payload-config";
import "@payloadcms/next/css";
import type { ServerFunctionClient } from "payload";
import { handleServerFunctions, RootLayout } from "@payloadcms/next/layouts";
import React from "react";
import { importMap } from "./admin/importMap.js";
import { adminConfigured } from "./admin/setup-notice";

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
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  ) : (
    <html lang="en">
      <body>{children}</body>
    </html>
  );

export default Layout;
