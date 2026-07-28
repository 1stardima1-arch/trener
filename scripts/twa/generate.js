// Generates the Android TWA (Trusted Web Activity) Gradle project non-interactively,
// wrapping the deployed web app. Runs entirely through @bubblewrap/core's programmatic
// API (no Inquirer prompts) so it's safe to call from CI.
//
// Usage: node scripts/twa/generate.js
//
// Reads config from env vars (all have sane defaults, see .github/workflows/build-apk.yml):
//   WEB_MANIFEST_URL   - full URL to the deployed app's manifest.json
//   TWA_PACKAGE_ID     - Android package id, e.g. ru.trener.app
//   TWA_DIR            - output directory for the generated Android project
//   ANDROID_KEY_ALIAS  - alias name inside the signing keystore
//   APP_VERSION_CODE   - integer, must increase on every Play/RuStore upload
//   APP_VERSION_NAME   - human-readable version string

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const http = require("http");
const { TwaManifest, TwaGenerator, ConsoleLog } = require("@bubblewrap/core");

const CONTENT_TYPES = { ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml" };

// Bubblewrap downloads the icon PNGs over HTTP from iconUrl/maskableIconUrl. Deploy previews
// (e.g. Vercel) are often gated behind auth/SSO, which would 401 that download in CI even
// though the manifest itself is readable from the repo. Serving the same files from a local
// server sidesteps that entirely — the real production origin is still used for everything
// that actually matters for the installed app (host, start_url, Digital Asset Links).
function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const filePath = path.join(rootDir, decodeURIComponent(req.url.split("?")[0]));
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          return res.end();
        }
        res.writeHead(200, { "Content-Type": CONTENT_TYPES[path.extname(filePath)] || "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port }));
  });
}

async function main() {
  const webManifestUrl =
    process.env.WEB_MANIFEST_URL || "https://trener-coach.vercel.app/manifest.json";
  const targetDir = path.resolve(process.env.TWA_DIR || "./android-twa");
  const packageId = process.env.TWA_PACKAGE_ID || "ru.trener.app";
  const keyAlias = process.env.ANDROID_KEY_ALIAS || "ball";
  const versionCode = Number(process.env.APP_VERSION_CODE || 1);
  const versionName = process.env.APP_VERSION_NAME || "1.0.0";

  // Read the web manifest straight from the repo (rather than fetching the live deployment)
  // so this step can't fail because a preview deployment is stale or momentarily unreachable —
  // the checked-out public/manifest.json is always the correct, current source of truth for
  // app name/icons/colors. The live URL is still used as the base for resolving icon/start_url
  // paths to absolute URLs, since the actual icon PNGs do need to be downloaded from there.
  const localManifestPath = path.resolve(__dirname, "../../public/manifest.json");
  console.log(`Reading web manifest from ${localManifestPath} (resolved against ${webManifestUrl}) ...`);
  const webManifestJson = JSON.parse(fs.readFileSync(localManifestPath, "utf8"));
  const twaManifest = TwaManifest.fromWebManifestJson(new URL(webManifestUrl), webManifestJson);

  twaManifest.packageId = packageId;
  twaManifest.appVersionCode = versionCode;
  twaManifest.appVersionName = versionName;
  twaManifest.signingKey.path = path.join(targetDir, "android-keystore");
  twaManifest.signingKey.alias = keyAlias;

  fs.mkdirSync(targetDir, { recursive: true });
  const manifestFile = path.join(targetDir, "twa-manifest.json");
  await twaManifest.saveToFile(manifestFile);

  // Redirect icon downloads to a local static server so this step doesn't depend on the
  // live deployment being publicly reachable (see startStaticServer above). This rewrite is
  // in-memory only — the twa-manifest.json already saved to disk keeps the real production
  // icon URLs.
  const publicDir = path.resolve(__dirname, "../../public");
  const { server, port } = await startStaticServer(publicDir);
  const remoteOrigin = new URL(webManifestUrl).origin;
  const localOrigin = `http://127.0.0.1:${port}`;
  if (twaManifest.iconUrl) twaManifest.iconUrl = twaManifest.iconUrl.replace(remoteOrigin, localOrigin);
  if (twaManifest.maskableIconUrl) {
    twaManifest.maskableIconUrl = twaManifest.maskableIconUrl.replace(remoteOrigin, localOrigin);
  }
  if (twaManifest.monochromeIconUrl) {
    twaManifest.monochromeIconUrl = twaManifest.monochromeIconUrl.replace(remoteOrigin, localOrigin);
  }
  // TwaGenerator also re-fetches the web manifest itself (to bundle a copy into the Android
  // assets) — redirect that too, for the same reason as the icons above.
  if (twaManifest.webManifestUrl) {
    twaManifest.webManifestUrl = new URL(twaManifest.webManifestUrl.toString().replace(remoteOrigin, localOrigin));
  }

  console.log(`Generating Android project in ${targetDir} (icons served locally from ${localOrigin}) ...`);
  const generator = new TwaGenerator();
  try {
    await generator.createTwaProject(targetDir, twaManifest, new ConsoleLog("twa-generate"));
  } finally {
    server.close();
  }

  // Bubblewrap generates the native launch splash screen (shown while the WebView is still
  // loading, before our own animated <AppSplash> in the page itself can render) by just
  // scaling the app's square launcher icon onto the background color — the icon-on-black-
  // screen look. Overwrite those with pre-rendered stills of the actual in-app splash design
  // (siri-orb + "Тренер" wordmark + tagline), pre-sized per density so this needs no image
  // library in CI. See scripts/twa/splash-source.html for the source and how to regenerate.
  const splashAssetsDir = path.resolve(__dirname, "assets/splash");
  const densities = ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
  for (const density of densities) {
    const src = path.join(splashAssetsDir, `${density}.png`);
    const dest = path.join(targetDir, "app/src/main/res", `drawable-${density}`, "splash.png");
    fs.copyFileSync(src, dest);
  }
  console.log("Replaced native splash.png (all densities) with the custom Тренер launch screen.");

  // androidbrowserhelper's LauncherActivity renders the splash drawable with
  // ImageView.ScaleType.CENTER by default — the bitmap at its native pixel
  // size, centered, with NO scaling at all. Since no single set of
  // per-density PNGs can pixel-match every real device's screen size, that
  // always leaves a visible background-color letterbox band on some devices
  // no matter how the source image is sized. Override the scale type to
  // CENTER_CROP so the image is scaled up just enough to fill the entire
  // screen (cropping the excess) — the only mode that guarantees true
  // edge-to-edge on every device.
  const launcherActivityPath = path.join(
    targetDir,
    "app/src/main/java",
    ...packageId.split("."),
    "LauncherActivity.java"
  );
  let launcherActivitySrc = fs.readFileSync(launcherActivityPath, "utf8");
  if (!launcherActivitySrc.includes("getSplashImageScaleType")) {
    launcherActivitySrc = launcherActivitySrc.replace(
      /^import android\.os\.Bundle;$/m,
      'import android.os.Bundle;\nimport android.widget.ImageView;'
    );
    launcherActivitySrc = launcherActivitySrc.replace(
      /\n\}\s*$/,
      "\n" +
        "    @Override\n" +
        "    protected ImageView.ScaleType getSplashImageScaleType() {\n" +
        "        return ImageView.ScaleType.CENTER_CROP;\n" +
        "    }\n" +
        "}\n"
    );
    fs.writeFileSync(launcherActivityPath, launcherActivitySrc);
    console.log("Patched LauncherActivity.java: splash image now scales with CENTER_CROP.");
  }

  // Bubblewrap's template only lists google()/jcenter() as Gradle repositories, but
  // jcenter() has been shut down and androidbrowserhelper is published on Maven Central —
  // without this the build fails to resolve that dependency.
  const rootBuildGradle = path.join(targetDir, "build.gradle");
  const original = fs.readFileSync(rootBuildGradle, "utf8");
  const patched = original.replace(/google\(\)/g, "google()\n        mavenCentral()");
  fs.writeFileSync(rootBuildGradle, patched);

  // Matches Bubblewrap's own checksum algorithm (sha1 hex of the manifest file bytes) so
  // `bubblewrap build` recognizes the project as up to date and skips its interactive prompt.
  const manifestContents = fs.readFileSync(manifestFile);
  const checksum = crypto.createHash("sha1").update(manifestContents).digest("hex");
  fs.writeFileSync(path.join(targetDir, "manifest-checksum.txt"), checksum);

  console.log("Done. Project ready for `bubblewrap build`.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
