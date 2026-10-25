import "./globals.css";

// Every page reads runtime configuration (PUBLIC_BASE_URL, API_BASE_URL) and
// live catalog data, so nothing is prerendered at build time and one image
// works in any environment.
export const dynamic = "force-dynamic";

export {
  generateMetadata,
  RootLayout as default,
  viewport,
} from "@/_app/ui/root-layout";
