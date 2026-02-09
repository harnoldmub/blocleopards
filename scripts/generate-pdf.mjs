import puppeteer from "puppeteer";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "..", "public", "downloads");
const chartePath = path.resolve(__dirname, "charte-print.html");
const kitPath = path.resolve(__dirname, "kit-print.html");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();

async function renderPdf(inputPath, outputName) {
  const fileUrl = `file://${inputPath}`;
  await page.goto(fileUrl, { waitUntil: "networkidle0" });
  await page.pdf({
    path: path.join(publicDir, outputName),
    format: "A4",
    margin: { top: "24px", right: "24px", bottom: "24px", left: "24px" }
  });
}

await renderPdf(chartePath, "charte-bloc-leopards.pdf");
await renderPdf(kitPath, "kit-supporters.pdf");

await browser.close();

console.log("PDFs generated in public/downloads");
