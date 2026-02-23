import { fetchUrl } from "./src/tools/research";

async function main() {
    console.log("Fetching URL via Camoufox headless browser...");
    // @ts-expect-error test
    const res = await fetchUrl.execute({ url: "https://example.com" }, { toolCallId: "1", messages: [] });
    console.log(res);
}

main().catch(console.error);
