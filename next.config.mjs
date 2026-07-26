/** @type {import('next').NextConfig} */
export default {
  async headers() {
    return [
      {
        // Service worker: pa kache l nan navigatè a (toujou fre pou detekte mizajou)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" }
        ]
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }]
      }
    ];
  }
};
