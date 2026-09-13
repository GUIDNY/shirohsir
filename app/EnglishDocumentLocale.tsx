"use client";

import { useEffect } from "react";

// app/layout.tsx hardcodes <html dir="rtl" lang="he"> for every route — the
// Hebrew flow is the live revenue path, so that file is never touched.
// Instead, the /en route mounts this component to flip the document to
// LTR/English while it's on screen, and flips it back the moment the
// customer navigates away (an in-app <Link> to "/" doesn't hard-reload,
// so without this restore the Hebrew homepage would render RTL content
// inside a stale dir="ltr" document).
export function EnglishDocumentLocale() {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("dir", "ltr");
    root.setAttribute("lang", "en");

    return () => {
      root.setAttribute("dir", "rtl");
      root.setAttribute("lang", "he");
    };
  }, []);

  return null;
}
