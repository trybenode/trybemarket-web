import { Config } from "@remotion/cli/config";

// Use the website's public/ folder, so the videos show the same example
// images and logo as the app (no copies to keep in sync).
Config.setPublicDir("../public");
Config.setVideoImageFormat("jpeg");
Config.setCodec("h264");
