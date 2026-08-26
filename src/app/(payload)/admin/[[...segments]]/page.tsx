/* Payload admin catch-all page — scaffold per @payloadcms/next */
import type { Metadata } from "next";
import config from "@payload-config";
import { generatePageMetadata, RootPage } from "@payloadcms/next/views";
import { importMap } from "../importMap.js";
import { adminConfigured, SetupNotice } from "../setup-notice";

type Args = {
  params: Promise<{ segments: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};

export const generateMetadata = ({
  params,
  searchParams,
}: Args): Promise<Metadata> =>
  adminConfigured()
    ? generatePageMetadata({ config, params, searchParams })
    : Promise.resolve({ title: "WorldView admin — setup required" });

const Page = ({ params, searchParams }: Args) =>
  adminConfigured() ? (
    RootPage({ config, params, searchParams, importMap })
  ) : (
    <SetupNotice />
  );

export default Page;
