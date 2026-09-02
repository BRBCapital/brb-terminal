import type { Metadata } from "next";
import { Lora, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { TopNav } from "@/components/shell/TopNav";
import { SiteFooter } from "@/components/shell/SiteFooter";
import { AppFrame } from "@/components/shell/AppFrame";

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BRB NGX Analyst Platform",
  description:
    "Internal analytical tool for NGX equity research — BRB Capital Group.",
};

// Tint the browser chrome with the brand forest green.
export const viewport = {
  themeColor: "#052A22",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${poppins.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the theme before paint to avoid a flash. Dark is the default —
            only an explicit 'light' choice opts out. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('brb-theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <AppFrame nav={<TopNav />} footer={<SiteFooter />}>
            {children}
          </AppFrame>
        </Providers>
      </body>
    </html>
  );
}
